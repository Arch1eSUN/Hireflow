import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function teamRoutes(app: FastifyInstance) {
    // List team members for this company
    app.get('/api/team', async (request, reply) => {
        try {
            const user = await authenticate(request);

            const members = await prisma.user.findMany({
                where: { companyId: user.companyId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'asc' },
            });

            return success(members);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Update member role
    app.put('/api/team/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            // Only admin/owner can update roles
            if (!['admin', 'owner'].includes(user.role)) {
                return reply.status(403).send({ error: '权限不足' });
            }

            const schema = z.object({
                role: z.string().optional(),
                name: z.string().min(1).optional(),
            });

            const data = schema.parse(request.body);

            // Verify user belongs to same company
            const targetUser = await prisma.user.findFirst({
                where: { id, companyId: user.companyId },
            });
            if (!targetUser) return reply.status(404).send({ error: '成员不存在' });

            // Cannot demote yourself
            if (id === user.userId && data.role && data.role !== user.role) {
                return reply.status(400).send({ error: '不能修改自己的角色' });
            }

            const updated = await prisma.user.update({
                where: { id },
                data,
                select: { id: true, name: true, email: true, role: true },
            });

            return success(updated);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Remove member from team
    app.delete('/api/team/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            // Only admin/owner can remove members
            if (!['admin', 'owner'].includes(user.role)) {
                return reply.status(403).send({ error: '权限不足' });
            }

            // Cannot delete yourself
            if (id === user.userId) {
                return reply.status(400).send({ error: '不能移除自己' });
            }

            // Verify user belongs to same company
            const targetUser = await prisma.user.findFirst({
                where: { id, companyId: user.companyId },
            });
            if (!targetUser) return reply.status(404).send({ error: '成员不存在' });

            await prisma.user.delete({ where: { id } });

            return success({ deleted: true });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
