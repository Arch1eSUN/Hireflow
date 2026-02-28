import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';
import { loadInterviewAiRuntimeConfig } from '../../services/interview/modelConfig';
import { buildXiaofanQuestionPlan } from '../../services/interview/questionPlanner';
import { toMonitorPolicyPayload } from '../../services/monitorPolicy';
import {
    questionPlanPreviewSchema,
    xiaofanQuestionPlanSnapshotSchema,
    getCompanyMonitorPolicy,
} from './helpers';

export async function registerCoreRoutes(app: FastifyInstance) {
    // List Interviews
    app.get('/api/interviews', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { status, date } = request.query as any;

            const where: Record<string, unknown> = {
                job: { companyId: user.companyId }
            };

            if (status) where.status = status;

            const interviews = await prisma.interview.findMany({
                where,
                include: {
                    candidate: { select: { id: true, name: true, email: true } },
                    job: { select: { id: true, title: true } }
                },
                orderBy: { startTime: 'asc' }
            });

            return success(interviews);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Preview XiaoFan question plan before creating interview
    app.post('/api/interviews/question-plan-preview', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const parsed = questionPlanPreviewSchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const { candidateId, jobId, type } = parsed.data;
            const [job, candidate] = await Promise.all([
                prisma.job.findFirst({
                    where: { id: jobId, companyId: user.companyId },
                    select: {
                        id: true,
                        title: true,
                        descriptionJd: true,
                        requirements: true,
                        department: true,
                    },
                }),
                prisma.candidate.findFirst({
                    where: { id: candidateId, companyId: user.companyId },
                    select: {
                        id: true,
                        name: true,
                        jobId: true,
                    },
                }),
            ]);

            if (!job) return reply.status(400).send({ error: 'Invalid Job' });
            if (!candidate) return reply.status(400).send({ error: 'Invalid Candidate' });
            if (candidate.jobId !== job.id) {
                return reply.status(400).send({ error: 'Candidate and job do not match' });
            }

            const runtimeConfig = await loadInterviewAiRuntimeConfig(user.companyId);
            const plan = await buildXiaofanQuestionPlan({
                companyId: user.companyId,
                candidateName: candidate.name || 'Candidate',
                jobTitle: job.title,
                jobDescription: job.descriptionJd,
                jobRequirements: job.requirements || [],
                interviewType: type,
                runtimeConfig,
            });

            return success({
                plan,
                runtime: {
                    model: runtimeConfig.model,
                    provider: runtimeConfig.provider || null,
                    apiKeyName: runtimeConfig.apiKeyName || null,
                },
                job: {
                    id: job.id,
                    title: job.title,
                    department: job.department,
                },
                candidate: {
                    id: candidate.id,
                    name: candidate.name,
                },
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Question plan preview failed' });
        }
    });

    // Create Interview Link
    app.post('/api/interviews', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                candidateId: z.string(),
                jobId: z.string(),
                type: z.string().default('ai_interview'),
                startTime: z.string().datetime(),
                questionPlanSnapshot: xiaofanQuestionPlanSnapshotSchema.optional(),
            });

            const data = schema.parse(request.body);

            const job = await prisma.job.findFirst({
                where: { id: data.jobId, companyId: user.companyId }
            });
            if (!job) return reply.status(400).send({ error: 'Invalid Job' });

            const candidate = await prisma.candidate.findFirst({
                where: { id: data.candidateId, companyId: user.companyId },
                select: { id: true, jobId: true },
            });
            if (!candidate) return reply.status(400).send({ error: 'Invalid Candidate' });
            if (candidate.jobId !== data.jobId) {
                return reply.status(400).send({ error: 'Candidate and job do not match' });
            }

            const token = randomUUID();

            const interview = await prisma.interview.create({
                data: {
                    jobId: data.jobId,
                    candidateId: data.candidateId,
                    type: data.type,
                    startTime: data.startTime,
                    status: 'upcoming',
                    token,
                }
            });

            if (data.questionPlanSnapshot) {
                await prisma.auditLog.create({
                    data: {
                        companyId: user.companyId,
                        userId: user.userId,
                        action: 'interview.question_plan.snapshot',
                        targetType: 'interview',
                        targetId: interview.id,
                        metadata: {
                            source: 'create_modal',
                            snapshot: data.questionPlanSnapshot,
                            createdAt: new Date().toISOString(),
                        } satisfies Prisma.InputJsonObject,
                    },
                }).catch((error) => {
                    app.log.warn({ err: error, interviewId: interview.id }, 'Failed to persist question plan snapshot');
                });
            }

            try {
                const companyPolicy = await getCompanyMonitorPolicy(user.companyId);
                if (companyPolicy.hasSaved) {
                    await prisma.auditLog.create({
                        data: {
                            companyId: user.companyId,
                            userId: user.userId,
                            action: 'monitor.policy.updated',
                            targetType: 'interview',
                            targetId: interview.id,
                            metadata: {
                                policy: toMonitorPolicyPayload(companyPolicy.policy),
                                source: 'company_default',
                                timestamp: new Date().toISOString(),
                            } satisfies Prisma.InputJsonObject,
                        },
                    });
                }
            } catch (seedError) {
                app.log.warn({ err: seedError, interviewId: interview.id }, 'Failed to seed monitor policy');
            }

            return success(interview);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Get Interview Detail (Company)
    app.get('/api/interviews/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId }
                },
                include: {
                    candidate: true,
                    job: true,
                    feedbacks: true,
                    evaluations: true
                }
            });

            if (!interview) return reply.status(404).send({ error: 'Interview not found' });

            return success(interview);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
