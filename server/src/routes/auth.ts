import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/passwords';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { success } from '../utils/response';
import { env } from '../config/env';
import { maskEmail } from '../utils/logger';

function resolveCookieSameSite(): 'strict' | 'lax' | 'none' {
    return env.AUTH_COOKIE_SAMESITE;
}

function resolveCookieSecure(): boolean {
    return env.AUTH_COOKIE_SECURE;
}

export async function authRoutes(app: FastifyInstance) {
    // --- Login ---
    app.post('/api/auth/login', async (request, reply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(1),
        });

        try {
            const parsed = schema.parse(request.body);
            const email = parsed.email.trim().toLowerCase();
            const password = parsed.password;

            const user = await prisma.user.findUnique({
                where: { email },
                include: { company: true },
            });

            if (!user) {
                request.log.warn({ email: maskEmail(email) }, 'Login failed: user not found');
                return reply.status(401).send({ success: false, error: 'Invalid email or password' });
            }

            if (!user.passwordHash) {
                request.log.warn({ email: maskEmail(email) }, 'Login failed: no password hash');
                return reply.status(401).send({ success: false, error: 'Invalid email or password' });
            }

            const isValid = await comparePassword(password, user.passwordHash);
            if (!isValid) {
                request.log.warn({ email: maskEmail(email) }, 'Login failed: password mismatch');
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
            const refreshToken = signRefreshToken({
                ...payload,
                tokenVersion: user.tokenVersion ?? 0,
            });

            // Set secure cookie for refresh token
            reply.setCookie('refreshToken', refreshToken, {
                path: '/',
                httpOnly: true,
                secure: resolveCookieSecure(),
                sameSite: resolveCookieSameSite(),
                maxAge: 7 * 24 * 3600, // 7 days
            });

            request.log.info({ userId: user.id }, 'User logged in');

            return success({
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    companyId: user.companyId,
                    company: user.company,
                }
            });
        } catch (error: unknown) {
            request.log.error({ err: error }, 'Login error');
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ success: false, error: error.flatten() });
            }
            return reply.status(400).send({ success: false, error: 'Invalid request data' });
        }
    });

    // --- Register ---
    app.post('/api/auth/register', async (request, reply) => {
        try {
            const schema = z.object({
                email: z.string().email(),
                password: z.string().min(6),
                name: z.string().min(2),
                companyName: z.string().min(2),
                companySize: z.string().optional(),
                welcomeText: z.string().optional(),
            });

            const rawData = schema.parse(request.body);
            const data = {
                ...rawData,
                email: rawData.email.trim().toLowerCase(),
                name: rawData.name.trim(),
                companyName: rawData.companyName.trim(),
            };

            // Check if user exists
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing) {
                request.log.warn({ email: maskEmail(data.email) }, 'Register failed: email exists');
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

            request.log.info({ userId: result.id }, 'User registered');

            // Auto login
            const payload = {
                userId: result.id,
                email: result.email,
                role: result.role,
                companyId: result.companyId,
            };
            const accessToken = signAccessToken(payload);
            const refreshToken = signRefreshToken({
                ...payload,
                tokenVersion: result.tokenVersion ?? 0,
            });

            reply.setCookie('refreshToken', refreshToken, {
                path: '/',
                httpOnly: true,
                secure: resolveCookieSecure(),
                sameSite: resolveCookieSameSite(),
                maxAge: 7 * 24 * 3600,
            });

            return success({
                accessToken,
                user: {
                    id: result.id,
                    email: result.email,
                    name: result.name,
                    role: result.role,
                    companyId: result.companyId,
                    company: result.company,
                }
            });
        } catch (error: unknown) {
            request.log.error({ err: error }, 'Register error');
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ success: false, error: error.flatten() });
            }
            return reply.status(400).send({ success: false, error: 'Registration failed or invalid data' });
        }
    });

    // --- Refresh Token ---
    app.post('/api/auth/refresh', async (request, reply) => {
        const { refreshToken } = request.cookies;
        if (!refreshToken) return reply.status(401).send({ error: 'No refresh token' });

        const payload = verifyToken(refreshToken);
        if (!payload) return reply.status(401).send({ error: 'Invalid refresh token' });

        // Check if user still exists/active
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                role: true,
                companyId: true,
                tokenVersion: true,
            },
        });
        if (!user) return reply.status(401).send({ error: 'User not found' });
        const refreshTokenVersion = typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0;
        if (refreshTokenVersion !== user.tokenVersion) {
            return reply.status(401).send({ error: 'Refresh token revoked' });
        }

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
        const { refreshToken } = request.cookies;
        if (refreshToken) {
            const payload = verifyToken(refreshToken);
            if (payload?.userId) {
                await prisma.user.updateMany({
                    where: { id: payload.userId },
                    data: {
                        tokenVersion: { increment: 1 },
                    },
                });
            }
        }

        reply.clearCookie('refreshToken', {
            path: '/',
            httpOnly: true,
            secure: resolveCookieSecure(),
            sameSite: resolveCookieSameSite(),
        });
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
            companyId: user.companyId,
            company: user.company,
        });
    });
}
