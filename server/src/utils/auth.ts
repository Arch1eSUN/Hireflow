import { FastifyRequest } from 'fastify';
import { verifyToken } from './jwt';

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

    return payload;
}
