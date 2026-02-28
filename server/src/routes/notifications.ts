import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function notificationRoutes(app: FastifyInstance) {
    app.get('/api/notifications', async (request, reply) => {
        try {
            const user = await authenticate(request);
            // user is TokenPayload { userId: string, ... }
            const notifications = await prisma.notification.findMany({
                where: { userId: user.userId },
                orderBy: { createdAt: 'desc' },
                take: 20
            });

            // Map to match frontend expectations
            const mapped = notifications.map(n => ({
                id: n.id,
                title: n.title,
                message: n.body,
                time: n.createdAt.toISOString(),
                type: n.type,
                read: n.read,
                actionUrl: n.actionUrl || ''
            }));

            return success(mapped);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.post('/api/notifications/:id/read', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            // Ensure notification belongs to user
            const exists = await prisma.notification.findFirst({
                where: { id, userId: user.userId }
            });

            if (!exists) {
                return reply.status(404).send({ error: 'Notification not found' });
            }

            await prisma.notification.update({
                where: { id },
                data: { read: true }
            });

            return success({ success: true });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // 全部标记已读
    app.post('/api/notifications/read-all', async (request, reply) => {
        try {
            const user = await authenticate(request);
            await prisma.notification.updateMany({
                where: { userId: user.userId, read: false },
                data: { read: true },
            });
            return success({ success: true });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // 未读计数（轻量级，供铃铛 badge 轮询）
    app.get('/api/notifications/unread-count', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const count = await prisma.notification.count({
                where: { userId: user.userId, read: false },
            });
            return success({ count });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
