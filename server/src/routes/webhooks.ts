import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate } from '../utils/auth';
import { prisma } from '../utils/prisma';


export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preValidation', authenticate);

    // GET /api/webhooks
    fastify.get('/', async (request, reply) => {
        const { companyId } = (request as any).user;

        const endpoints = await prisma.webhookEndpoint.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                url: true,
                isActive: true,
                events: true,
                createdAt: true,
            },
        });

        return reply.send({ success: true, data: endpoints });
    });

    // POST /api/webhooks
    fastify.post(
        '/',
        {
            schema: {
                body: z.object({
                    url: z.string().url(),
                    events: z.array(z.string()).min(1),
                }),
            },
        },
        async (request, reply) => {
            const { companyId } = (request as any).user;
            const { url, events } = request.body as { url: string; events: string[] };

            // Generate a cryptographically secure signing secret
            const secret = crypto.randomBytes(32).toString('hex');

            const endpoint = await prisma.webhookEndpoint.create({
                data: {
                    companyId,
                    url,
                    secret,
                    events,
                    isActive: true,
                },
            });

            return reply.code(201).send({
                success: true,
                data: {
                    id: endpoint.id,
                    url: endpoint.url,
                    secret: endpoint.secret, // Return once for user to configure HMAC
                    isActive: endpoint.isActive,
                    events: endpoint.events,
                    createdAt: endpoint.createdAt,
                },
            });
        }
    );

    // DELETE /api/webhooks/:id
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

            const endpoint = await prisma.webhookEndpoint.findFirst({
                where: { id, companyId },
            });

            if (!endpoint) {
                return reply.code(404).send({ success: false, error: 'Webhook Endpoint not found' });
            }

            await prisma.webhookEndpoint.delete({
                where: { id },
            });

            return reply.send({ success: true, data: { deleted: true } });
        }
    );

    // GET /api/webhooks/:id/deliveries
    fastify.get(
        '/:id/deliveries',
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

            const endpoint = await prisma.webhookEndpoint.findFirst({
                where: { id, companyId },
            });

            if (!endpoint) {
                return reply.code(404).send({ success: false, error: 'Webhook Endpoint not found' });
            }

            const deliveries = await prisma.webhookDelivery.findMany({
                where: { endpointId: id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            return reply.send({ success: true, data: deliveries });
        }
    );
};
