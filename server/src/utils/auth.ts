import { FastifyRequest } from 'fastify';
import { verifyToken } from './jwt';
import { prisma } from './prisma';

export async function authenticate(request: FastifyRequest) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        throw { statusCode: 401, message: 'Authentication required' };
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
        throw { statusCode: 401, message: 'Invalid or expired token' };
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
        where: { id: payload.userId }
    });

    if (!user) {
        throw { statusCode: 401, message: 'User not found or session invalid' };
    }

    return payload;
}
