import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate } from '../utils/auth';
import { prisma } from '../utils/prisma';


export const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preValidation', authenticate);

    // GET /api/api-keys
    fastify.get('/', async (request, reply) => {
        const { companyId } = (request as any).user;

        const keys = await prisma.developerApiKey.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                prefix: true,
                lastUsedAt: true,
                createdAt: true,
            },
        });

        return reply.send({ success: true, data: keys });
    });

    // POST /api/api-keys
    fastify.post(
        '/',
        {
            schema: {
                body: z.object({
                    name: z.string().min(1).max(100),
                }),
            },
        },
        async (request, reply) => {
            const { companyId } = (request as any).user;
            const { name } = request.body as { name: string };

            // Generate a securely random key
            // Format: hf_live_xxxxxxx
            const rawSecret = crypto.randomBytes(32).toString('hex');
            const apiKey = `hf_live_${rawSecret}`;

            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const prefix = apiKey.substring(0, 15); // 'hf_live_xxxxxxx'

            const newKey = await prisma.developerApiKey.create({
                data: {
                    companyId,
                    name,
                    keyHash,
                    prefix,
                },
            });

            // We return the raw apiKey exactly once
            return reply.code(201).send({
                success: true,
                data: {
                    id: newKey.id,
                    name: newKey.name,
                    prefix: newKey.prefix,
                    apiKey, // Make sure UI displays this once!
                    createdAt: newKey.createdAt,
                },
            });
        }
    );

    // DELETE /api/api-keys/:id
    fastify.delete(
        '/:id',
        {
            schema: {
                params: z.object({
                    id: z.string().uuid(),
                }),
            },
        },
        async (request, reply) => {
            const { companyId } = (request as any).user;
            const { id } = request.params as { id: string };

            // Ensure key belongs to company
            const key = await prisma.developerApiKey.findFirst({
                where: { id, companyId },
            });

            if (!key) {
                return reply.code(404).send({ success: false, error: 'API Key not found' });
            }

            await prisma.developerApiKey.delete({
                where: { id },
            });

            return reply.send({ success: true, data: { deleted: true } });
        }
    );
};
