import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function settingsRoutes(app: FastifyInstance) {
    // Get company settings
    app.get('/api/settings', async (request, reply) => {
        try {
            const user = await authenticate(request);

            const settings = await prisma.companySettings.findUnique({
                where: { companyId: user.companyId },
            });

            if (!settings) {
                // Create default settings if none exist
                const created = await prisma.companySettings.create({
                    data: { companyId: user.companyId },
                });
                return success(created);
            }

            return success(settings);
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Update company settings
    app.put('/api/settings', async (request, reply) => {
        try {
            const user = await authenticate(request);

            // Only admin/owner can update settings
            if (!['admin', 'owner'].includes(user.role)) {
                return reply.status(403).send({ error: '权限不足' });
            }

            const schema = z.object({
                // AI
                defaultModelId: z.string().optional(),
                technicalModelId: z.string().optional(),
                resumeModelId: z.string().optional(),
                reportModelId: z.string().optional(),
                temperature: z.number().min(0).max(2).optional(),
                maxTokens: z.number().min(256).max(128000).optional(),
                // Security
                antiCheatEnabled: z.boolean().optional(),
                livenessDetection: z.boolean().optional(),
                multiFaceDetection: z.boolean().optional(),
                tabSwitchDetection: z.boolean().optional(),
                aiAnswerDetection: z.boolean().optional(),
                audioEnvironmentDetect: z.boolean().optional(),
                dataEncryption: z.boolean().optional(),
                recordingRetentionDays: z.number().optional(),
                // Notifications
                emailOnInvite: z.boolean().optional(),
                emailOnReminder: z.boolean().optional(),
                emailOnComplete: z.boolean().optional(),
                emailOnStatusChange: z.boolean().optional(),
                // Privacy
                dataRetentionDays: z.number().optional(),
                gdprEnabled: z.boolean().optional(),
            });

            const data = schema.parse(request.body);

            const updated = await prisma.companySettings.upsert({
                where: { companyId: user.companyId },
                create: { companyId: user.companyId, ...data },
                update: data,
            });

            return success(updated);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });
}
