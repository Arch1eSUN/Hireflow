import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';

export async function registerCoreRoutes(app: FastifyInstance) {
    // Get company settings
    app.get('/api/settings', async (request, reply) => {
        try {
            const user = await authenticate(request);

            const settings = await prisma.companySettings.findUnique({
                where: { companyId: user.companyId },
            });

            if (!settings) {
                const created = await prisma.companySettings.create({
                    data: { companyId: user.companyId },
                });
                return success(created);
            }

            return success(settings);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Update company settings
    app.put('/api/settings', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['admin', 'owner'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const schema = z.object({
                defaultModelId: z.string().trim().min(1).optional(),
                technicalModelId: z.string().trim().min(1).optional(),
                resumeModelId: z.string().trim().min(1).optional(),
                reportModelId: z.string().trim().min(1).optional(),
                temperature: z.coerce.number().min(0).max(2).optional(),
                maxTokens: z.coerce.number().min(256).max(128000).optional(),
                antiCheatEnabled: z.boolean().optional(),
                livenessDetection: z.boolean().optional(),
                multiFaceDetection: z.boolean().optional(),
                tabSwitchDetection: z.boolean().optional(),
                aiAnswerDetection: z.boolean().optional(),
                audioEnvironmentDetect: z.boolean().optional(),
                dataEncryption: z.boolean().optional(),
                recordingRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
                emailOnInvite: z.boolean().optional(),
                emailOnReminder: z.boolean().optional(),
                emailOnComplete: z.boolean().optional(),
                emailOnStatusChange: z.boolean().optional(),
                dataRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
                gdprEnabled: z.boolean().optional(),
            });

            const data = schema.parse(request.body || {});

            const updated = await prisma.companySettings.upsert({
                where: { companyId: user.companyId },
                create: { companyId: user.companyId, ...data },
                update: data,
            });

            return success(updated);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Brand settings
    app.put('/api/settings/brand', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = z.object({
            name: z.string().trim().min(2).optional(),
            logo: z.string().trim().url().optional().or(z.literal('')),
            primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
            welcomeText: z.string().trim().max(160).optional(),
        });

        try {
            const data = schema.parse(request.body || {});
            const nextData = {
                ...data,
                logo: data.logo === '' ? null : data.logo,
            };

            const company = await prisma.company.update({
                where: { id: user.companyId },
                data: nextData,
                select: { id: true, name: true, logo: true, primaryColor: true, welcomeText: true },
            });
            return success(company);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(400).send({ error: extractErrorMessage(err) });
        }
    });

    app.get('/api/settings/brand', async (request, reply) => {
        const user = await authenticate(request);
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: { name: true, logo: true, primaryColor: true, welcomeText: true },
        });
        return success(company);
    });
}
