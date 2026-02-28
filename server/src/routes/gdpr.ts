/**
 * GDPR / Privacy routes
 *
 * Endpoints:
 *   GET  /api/gdpr/candidates/:id/export   — 导出候选人全部数据（JSON）
 *   POST /api/gdpr/candidates/:id/anonymize — 匿名化候选人个人信息
 *   DELETE /api/gdpr/candidates/:id         — 删除候选人及关联数据
 *   GET  /api/gdpr/policy                   — 获取公司 GDPR 策略
 */
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { success } from '../utils/response';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errors';

import { Prisma } from '@prisma/client';

// ─── Helpers ────────────────────────────────────────────────────────────────

const candidateIdParam = z.object({
    id: z.string().uuid(),
});

function extractAuth(request: FastifyRequest): { userId: string; companyId: string } | null {
    const user = (request as any).user;
    if (!user?.userId || !user?.companyId) return null;
    return { userId: user.userId, companyId: user.companyId };
}

async function logGdprAction(params: {
    companyId: string;
    userId: string;
    action: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
}) {
    await prisma.auditLog.create({
        data: {
            companyId: params.companyId,
            userId: params.userId,
            action: params.action,
            targetType: 'candidate',
            targetId: params.targetId,
            metadata: params.metadata ?? Prisma.JsonNull,
        },
    });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function gdprRoutes(app: FastifyInstance) {

    // █ Export candidate data
    app.get('/api/gdpr/candidates/:id/export', async (request, reply) => {
        const auth = extractAuth(request);
        if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const { id } = candidateIdParam.parse(request.params);

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: auth.companyId },
                include: {
                    interviews: {
                        include: {
                            messages: {
                                orderBy: { createdAt: 'asc' },
                                select: {
                                    role: true,
                                    content: true,
                                    createdAt: true,
                                },
                            },
                            feedbacks: {
                                select: {
                                    rating: true,
                                    comment: true,
                                    createdAt: true,
                                },
                            },
                            evaluations: {
                                select: {
                                    scores: true,
                                    comment: true,
                                    vote: true,
                                    createdAt: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!candidate) {
                return reply.status(404).send({ error: 'Candidate not found' });
            }

            // Build export payload
            const exportData = {
                exportedAt: new Date().toISOString(),
                candidate: {
                    id: candidate.id,
                    name: candidate.name,
                    email: candidate.email,
                    phone: candidate.phone,
                    skills: candidate.skills,
                    tags: candidate.tags,
                    source: candidate.source,
                    stage: candidate.stage,
                    score: candidate.score,
                    appliedDate: candidate.appliedDate.toISOString(),
                    createdAt: candidate.createdAt.toISOString(),
                },
                interviews: candidate.interviews.map((interview) => ({
                    id: interview.id,
                    type: interview.type,
                    status: interview.status,
                    startTime: interview.startTime.toISOString(),
                    endTime: interview.endTime?.toISOString() || null,
                    messages: interview.messages.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                        at: msg.createdAt.toISOString(),
                    })),
                    feedbacks: interview.feedbacks.map((fb) => ({
                        rating: fb.rating,
                        comment: fb.comment,
                        at: fb.createdAt.toISOString(),
                    })),
                    evaluations: interview.evaluations.map((ev) => ({
                        scores: ev.scores,
                        comment: ev.comment,
                        vote: ev.vote,
                        at: ev.createdAt.toISOString(),
                    })),
                })),
            };

            await logGdprAction({
                companyId: auth.companyId,
                userId: auth.userId,
                action: 'gdpr.candidate_export',
                targetId: id,
            });

            logger.info({ candidateId: id, userId: auth.userId }, 'GDPR data export');

            return reply
                .header('Content-Type', 'application/json')
                .header('Content-Disposition', `attachment; filename="candidate-${id}-export.json"`)
                .send(exportData);

        } catch (error: unknown) {
            logger.error({ err: error }, 'GDPR export error');
            return reply.status(500).send({ error: extractErrorMessage(error) });
        }
    });

    // █ Anonymize candidate
    app.post('/api/gdpr/candidates/:id/anonymize', async (request, reply) => {
        const auth = extractAuth(request);
        if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const { id } = candidateIdParam.parse(request.params);

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: auth.companyId },
                select: { id: true, name: true, email: true },
            });

            if (!candidate) {
                return reply.status(404).send({ error: 'Candidate not found' });
            }

            // Anonymize PII fields
            const anonymizedSuffix = id.slice(0, 8);
            await prisma.candidate.update({
                where: { id },
                data: {
                    name: `Anonymized-${anonymizedSuffix}`,
                    email: `anonymized-${anonymizedSuffix}@redacted.local`,
                    phone: 'REDACTED',
                    resumeUrl: null,
                    tags: [],
                    source: 'anonymized',
                },
            });

            // Anonymize interview messages content
            const interviews = await prisma.interview.findMany({
                where: { candidateId: id },
                select: { id: true },
            });

            for (const interview of interviews) {
                await prisma.interviewMessage.updateMany({
                    where: { interviewId: interview.id, role: 'user' },
                    data: { content: '[REDACTED]' },
                });
            }

            await logGdprAction({
                companyId: auth.companyId,
                userId: auth.userId,
                action: 'gdpr.candidate_anonymized',
                targetId: id,
                metadata: {
                    originalName: candidate.name,
                    originalEmail: candidate.email,
                },
            });

            logger.info({ candidateId: id, userId: auth.userId }, 'GDPR candidate anonymized');

            return success({
                message: 'Candidate data anonymized',
                candidateId: id,
            });

        } catch (error: unknown) {
            logger.error({ err: error }, 'GDPR anonymize error');
            return reply.status(500).send({ error: extractErrorMessage(error) });
        }
    });

    // █ Delete candidate and all associated data
    app.delete('/api/gdpr/candidates/:id', async (request, reply) => {
        const auth = extractAuth(request);
        if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const { id } = candidateIdParam.parse(request.params);

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: auth.companyId },
                select: { id: true, name: true, email: true },
            });

            if (!candidate) {
                return reply.status(404).send({ error: 'Candidate not found' });
            }

            // Cascading delete in transaction
            await prisma.$transaction(async (tx) => {
                // 1. Get all interview IDs
                const interviews = await tx.interview.findMany({
                    where: { candidateId: id },
                    select: { id: true },
                });
                const interviewIds = interviews.map((i) => i.id);

                // 2. Delete interview messages
                if (interviewIds.length > 0) {
                    await tx.interviewMessage.deleteMany({
                        where: { interviewId: { in: interviewIds } },
                    });

                    // 3. Delete interview feedbacks
                    await tx.interviewFeedback.deleteMany({
                        where: { interviewId: { in: interviewIds } },
                    });

                    // 4. Delete evaluations
                    await tx.evaluation.deleteMany({
                        where: { interviewId: { in: interviewIds } },
                    });

                    // 5. Delete interviews
                    await tx.interview.deleteMany({
                        where: { id: { in: interviewIds } },
                    });
                }

                // 6. Delete candidate
                await tx.candidate.delete({
                    where: { id },
                });
            });

            await logGdprAction({
                companyId: auth.companyId,
                userId: auth.userId,
                action: 'gdpr.candidate_deleted',
                targetId: id,
                metadata: {
                    deletedName: candidate.name,
                    deletedEmail: candidate.email,
                },
            });

            logger.info({ candidateId: id, userId: auth.userId }, 'GDPR candidate deleted');

            return success({
                message: 'Candidate and all associated data permanently deleted',
                candidateId: id,
            });

        } catch (error: unknown) {
            logger.error({ err: error }, 'GDPR delete error');
            return reply.status(500).send({ error: extractErrorMessage(error) });
        }
    });

    // █ Get company GDPR policy
    app.get('/api/gdpr/policy', async (request, reply) => {
        const auth = extractAuth(request);
        if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const settings = await prisma.companySettings.findUnique({
                where: { companyId: auth.companyId },
                select: {
                    gdprEnabled: true,
                    dataRetentionDays: true,
                },
            });

            return success({
                gdprEnabled: settings?.gdprEnabled ?? false,
                dataRetentionDays: settings?.dataRetentionDays ?? 90,
            });
        } catch (error: unknown) {
            logger.error({ err: error }, 'GDPR policy error');
            return reply.status(500).send({ error: extractErrorMessage(error) });
        }
    });
}
