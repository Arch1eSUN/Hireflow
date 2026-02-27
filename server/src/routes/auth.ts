import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/passwords';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { success } from '../utils/response';

export async function authRoutes(app: FastifyInstance) {
    // --- Login ---
    app.post('/api/auth/login', async (request, reply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(6),
        });

        const { email, password } = schema.parse(request.body);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { company: true },
        });

        if (!user || !user.passwordHash) {
            return reply.status(401).send({ success: false, error: 'Invalid email or password' });
        }

        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
            return reply.status(401).send({ success: false, error: 'Invalid email or password' });
        }

        // Generate tokens
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        // Set secure cookie for refresh token
        // In dev, we can skip secure=true if on http
        const isProd = process.env.NODE_ENV === 'production';
        reply.setCookie('refreshToken', refreshToken, {
            path: '/',
            httpOnly: true,
            secure: isProd,
            sameSite: 'strict',
            maxAge: 7 * 24 * 3600, // 7 days
        });

        return success({
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                company: user.company,
            }
        });
    });

    // --- Register ---
    app.post('/api/auth/register', async (request, reply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(6),
            name: z.string().min(2),
            companyName: z.string().min(2),
            companySize: z.string().optional(),
            welcomeText: z.string().optional(),
        });

        const data = schema.parse(request.body);

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            return reply.status(400).send({ success: false, error: 'User already exists' });
        }

        const hashedPassword = await hashPassword(data.password);

        // Transaction: Create Company + User + Settings
        const result = await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name: data.companyName,
                    welcomeText: data.welcomeText || `Welcome to ${data.companyName}`,
                    settings: {
                        create: {} // Default settings
                    }
                }
            });

            const user = await tx.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    passwordHash: hashedPassword,
                    role: 'owner', // First user is owner
                    companyId: company.id,
                },
                include: { company: true }
            });

            return user;
        });

        // Auto login
        const payload = {
            userId: result.id,
            email: result.email,
            role: result.role,
            companyId: result.companyId,
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        reply.setCookie('refreshToken', refreshToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 3600,
        });

        return success({
            accessToken,
            user: {
                id: result.id,
                email: result.email,
                name: result.name,
                role: result.role,
                company: result.company,
            }
        });
    });

    // --- Refresh Token ---
    app.post('/api/auth/refresh', async (request, reply) => {
        const { refreshToken } = request.cookies;
        if (!refreshToken) return reply.status(401).send({ error: 'No refresh token' });

        const payload = verifyToken(refreshToken);
        if (!payload) return reply.status(401).send({ error: 'Invalid refresh token' });

        // Check if user still exists/active
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) return reply.status(401).send({ error: 'User not found' });

        const newPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        };
        const newAccessToken = signAccessToken(newPayload);

        return success({ accessToken: newAccessToken });
    });

    // --- Logout ---
    app.post('/api/auth/logout', async (request, reply) => {
        reply.clearCookie('refreshToken', { path: '/' });
        return success({ message: 'Logged out' });
    });

    // --- Me ---
    app.get('/api/auth/me', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader) return reply.status(401).send({ error: 'No token' });

        const token = authHeader.replace('Bearer ', '');
        const payload = verifyToken(token);

        if (!payload) {
            return reply.status(401).send({ error: 'Invalid token' });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { company: true }
        });

        if (!user) return reply.status(404).send({ error: 'User not found' });

        return success({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company: user.company,
        });
    });
}
