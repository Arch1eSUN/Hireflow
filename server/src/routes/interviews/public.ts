import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { success } from '../../utils/response';
import { XIAOFAN_BRAND_NAME } from '../../services/interview/xiaofan';
import { type XiaofanResultEnvelope } from '../../services/interview/xiaofanResultService';
import { resolveInterviewStartReadiness } from '../../services/interview/modelConfig';
import { normalizeMonitorPolicy } from '../../services/monitorPolicy';
import { WebhookService } from '../../services/webhook';
import { sendEmail, interviewCompleteEmail } from '../../services/email/index';
import {
    PUBLIC_RATE_RULES,
    enforcePublicRouteRateLimit,
    canServePublicDemoInterview,
    ensurePublicDemoInterviewToken,
    getPublicInterviewAccessError,
    getCompanyMonitorPolicy,
    xiaofanResultService,
} from './helpers';

export async function registerPublicRoutes(app: FastifyInstance) {
    // Get a public demo token for local QA/bootstrap.
    app.get('/api/public/interview/demo/token', async (request, reply) => {
        try {
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token: 'demo',
                suffix: 'demo-token',
                rule: PUBLIC_RATE_RULES.demoToken,
                message: 'Too many demo token requests. Please retry shortly.',
            });
            if (!allowed) return;

            if (!canServePublicDemoInterview()) {
                return reply.status(404).send({ error: 'Not found' });
            }

            const result = await ensurePublicDemoInterviewToken();
            return success({
                token: result.token,
                created: result.created,
                interviewer: XIAOFAN_BRAND_NAME,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to get demo interview token' });
        }
    });

    // Validate Interview Token
    app.get('/api/public/interview/:token', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.preview,
                message: 'Too many interview preview requests. Please slow down.',
            });
            if (!allowed) return;

            const interview = await prisma.interview.findUnique({
                where: { token },
                include: {
                    job: {
                        select: {
                            companyId: true,
                            title: true,
                            company: { select: { name: true, logo: true, welcomeText: true } }
                        }
                    },
                    candidate: { select: { name: true } }
                }
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found or expired' });
            }

            const accessError = getPublicInterviewAccessError(interview);
            if (accessError) {
                return reply.status(accessError.status).send({ error: accessError.error });
            }

            const readiness = await resolveInterviewStartReadiness(interview.job.companyId);

            return success({
                valid: true,
                id: interview.id,
                jobTitle: interview.job.title,
                companyName: interview.job.company.name,
                companyLogo: interview.job.company.logo,
                welcomeText: interview.job.company.welcomeText,
                candidateName: interview.candidate.name,
                type: interview.type,
                startTime: interview.startTime,
                status: interview.status,
                interviewer: XIAOFAN_BRAND_NAME,
                startAvailable: readiness.ready,
                startBlockedReason: readiness.reason,
                runtimeModel: readiness.runtime.model,
            });

        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Load public transcript history for candidate-side room bootstrap.
    app.get('/api/public/interview/:token/messages', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.messages,
                message: 'Too many transcript fetch requests. Please slow down.',
            });
            if (!allowed) return;

            const interview = await prisma.interview.findUnique({
                where: { token },
                select: {
                    id: true,
                    status: true,
                    startTime: true,
                    endTime: true,
                },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found or expired' });
            }

            const accessError = getPublicInterviewAccessError(interview);
            if (accessError) {
                return reply.status(accessError.status).send({ error: accessError.error });
            }

            const messages = await prisma.interviewMessage.findMany({
                where: { interviewId: interview.id },
                orderBy: { createdAt: 'asc' },
                take: 120,
                select: {
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });

            return success({
                messages: messages
                    .filter((item) => item.role === 'assistant' || item.role === 'user')
                    .map((item) => ({
                        role: item.role,
                        content: item.content,
                        createdAt: item.createdAt.toISOString(),
                    })),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Get effective monitor policy for candidate secure-mode enforcement
    app.get('/api/public/interview/:token/monitor-policy', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.monitorPolicy,
                message: 'Too many monitor policy requests. Please slow down.',
            });
            if (!allowed) return;

            const interview = await prisma.interview.findUnique({
                where: { token },
                include: {
                    job: { select: { companyId: true } },
                },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const latest = await prisma.auditLog.findFirst({
                where: {
                    companyId: interview.job.companyId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: interview.id,
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    metadata: true,
                    createdAt: true,
                },
            });

            if (latest) {
                const sourceValue = String((latest.metadata as any)?.source || '').trim();
                return success({
                    policy: normalizeMonitorPolicy((latest.metadata as any)?.policy),
                    source: sourceValue || 'saved',
                    updatedAt: latest.createdAt.toISOString(),
                });
            }

            const companyPolicy = await getCompanyMonitorPolicy(interview.job.companyId);
            return success({
                policy: companyPolicy.policy,
                source: companyPolicy.hasSaved ? 'company_default' : 'default',
                updatedAt: companyPolicy.updatedAt?.toISOString() || null,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to fetch monitor policy' });
        }
    });

    // Create or get XiaoFan session id
    app.get('/api/public/interview/:token/xiaofan-session-id', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.sessionId,
                message: 'Too many session initialization attempts. Please retry shortly.',
            });
            if (!allowed) return;

            const interview = await xiaofanResultService.findInterviewByToken(token);
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }
            const accessError = getPublicInterviewAccessError(interview);
            if (accessError) {
                return reply.status(accessError.status).send({ error: accessError.error });
            }

            const sessionId = await xiaofanResultService.ensureSessionId(interview.job.companyId, interview.id);
            return success({
                brand: XIAOFAN_BRAND_NAME,
                sessionId,
                interviewId: interview.id,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to create XiaoFan session id' });
        }
    });

    // Get latest XiaoFan result by interview token
    app.get('/api/public/interview/:token/xiaofan-result', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.result,
                message: 'Too many result queries. Please retry shortly.',
            });
            if (!allowed) return;

            const interview = await xiaofanResultService.findInterviewByToken(token);
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const result = await xiaofanResultService.getLatestResult(interview.job.companyId, interview.id);
            return success({
                brand: XIAOFAN_BRAND_NAME,
                result,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to fetch XiaoFan result' });
        }
    });

    // Save GDPR Consent (Public)
    app.post('/api/public/interview/:token/consent', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.start,
                message: 'Too many consent requests. Please retry shortly.',
            });
            if (!allowed) return;

            const schema = z.object({
                gdprConsentGiven: z.boolean(),
            });
            const data = schema.parse(request.body || {});

            const interview = await prisma.interview.findUnique({
                where: { token },
                select: { id: true, gdprConsentGiven: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            if (!interview.gdprConsentGiven && data.gdprConsentGiven) {
                await prisma.interview.update({
                    where: { id: interview.id },
                    data: {
                        gdprConsentGiven: true,
                        gdprConsentAt: new Date(),
                    },
                });
            }

            return success({ success: true });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Consent update failed' });
        }
    });

    // Start Interview (Public)
    app.post('/api/public/interview/:token/start', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.start,
                message: 'Too many start requests. Please retry shortly.',
            });
            if (!allowed) return;

            const interview = await xiaofanResultService.findInterviewByToken(token);
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }
            const accessError = getPublicInterviewAccessError(interview);
            if (accessError) {
                return reply.status(accessError.status).send({ error: accessError.error });
            }

            const readiness = await resolveInterviewStartReadiness(interview.job.companyId);
            if (!readiness.ready) {
                return reply.status(412).send({
                    error: readiness.reason || 'AI interview service is not configured.',
                    code: 'AI_KEY_REQUIRED',
                    startAvailable: false,
                });
            }

            const sessionId = await xiaofanResultService.ensureSessionId(interview.job.companyId, interview.id);
            const alreadyStarted = interview.status === 'active';

            if (!alreadyStarted) {
                await prisma.interview.update({
                    where: { id: interview.id },
                    data: { status: 'active' },
                });
            }

            return success({
                status: 'active',
                alreadyStarted,
                sessionId,
                interviewer: XIAOFAN_BRAND_NAME,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Interview start failed' });
        }
    });

    // Save XiaoFan structured interview result
    app.post('/api/public/interview/:token/xiaofan-result-save', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.resultSave,
                message: 'Too many result save requests. Please retry shortly.',
            });
            if (!allowed) return;

            const interview = await xiaofanResultService.findInterviewByToken(token);
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const accessError = getPublicInterviewAccessError(interview);
            if (accessError) {
                return reply.status(accessError.status).send({ error: accessError.error });
            }

            const parsedPayload = xiaofanResultService.parseResultSaveRequest(request.body || {});
            if (
                parsedPayload.personal_info
                || parsedPayload.summary
                || parsedPayload.recommendation
                || parsedPayload.model
            ) {
                return reply.status(403).send({
                    error: 'Manual XiaoFan result payload is not allowed on public endpoint',
                });
            }

            const saved = await xiaofanResultService.saveResult({
                interview,
                payload: {
                    sessionId: parsedPayload.sessionId,
                    forceRegenerate: parsedPayload.forceRegenerate,
                },
            });

            return success({
                brand: XIAOFAN_BRAND_NAME,
                saved,
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to save XiaoFan interview result' });
        }
    });

    // Submit candidate-side interview feedback (Public)
    app.post('/api/public/interview/:token/feedback', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.feedback,
                message: 'Too many feedback submissions. Please retry shortly.',
            });
            if (!allowed) return;

            const schema = z.object({
                rating: z.coerce.number().int().min(1).max(5),
                comment: z.string().trim().max(2000).optional(),
            });
            const data = schema.parse(request.body || {});

            const interview = await prisma.interview.findUnique({
                where: { token },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const feedback = await prisma.interviewFeedback.create({
                data: {
                    interviewId: interview.id,
                    rating: data.rating,
                    comment: data.comment || null,
                },
            });

            return success({
                id: feedback.id,
                rating: feedback.rating,
                comment: feedback.comment,
                createdAt: feedback.createdAt,
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(400).send({ error: extractErrorMessage(err) || 'Failed to submit feedback' });
        }
    });

    // End Interview (Public)
    app.post('/api/public/interview/:token/end', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const allowed = enforcePublicRouteRateLimit({
                request,
                reply,
                token,
                rule: PUBLIC_RATE_RULES.end,
                message: 'Too many end requests. Please retry shortly.',
            });
            if (!allowed) return;

            const bodySchema = z.object({
                reason: z.string().max(280).optional(),
            });
            const parsed = bodySchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await xiaofanResultService.findInterviewByToken(token);
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            if (interview.status === 'completed') {
                const existing = await xiaofanResultService.getLatestResult(interview.job.companyId, interview.id);
                return success({
                    status: 'completed',
                    alreadyCompleted: true,
                    brand: XIAOFAN_BRAND_NAME,
                    xiaofan: existing,
                });
            }
            if (interview.status === 'cancelled') {
                const existing = await xiaofanResultService.getLatestResult(interview.job.companyId, interview.id);
                return success({
                    status: 'cancelled',
                    locked: true,
                    brand: XIAOFAN_BRAND_NAME,
                    xiaofan: existing,
                });
            }

            const cancellationReasons = new Set([
                'security_violation_threshold',
                'screen_share_stopped',
                'screen_share_lost',
                'screen_surface_violation',
                'fullscreen_exited',
                'tab_switched',
                'terminated_by_monitor',
                'manual_terminate_from_monitor',
                'auto_monitor_guardrail_terminate',
            ]);
            const reason = parsed.data.reason || '';
            const nextStatus = cancellationReasons.has(reason) ? 'cancelled' : 'completed';

            const updatedInterview = await prisma.interview.update({
                where: { id: interview.id },
                data: {
                    status: nextStatus,
                    endTime: new Date(),
                },
            });

            let xiaofanResult: XiaofanResultEnvelope | null = null;
            try {
                xiaofanResult = await xiaofanResultService.ensureResult(interview);

                // Dispatch Webhook on normal completion
                if (nextStatus === 'completed') {
                    WebhookService.dispatchEvent(interview.job.companyId, 'interview.completed', JSON.parse(JSON.stringify({
                        interviewId: interview.id,
                        candidateName: (interview.candidate as Record<string, unknown>)?.name || 'Unknown',
                        candidateEmail: (interview.candidate as Record<string, unknown>)?.email || 'Unknown',
                        jobTitle: interview.job.title,
                        status: 'completed',
                        result: xiaofanResult,
                    }))).catch((err: unknown) => request.log.error(err, 'Webhook dispatch error'));

                    // 面试完成邮件通知（异步，不阻塞响应）
                    (async () => {
                        try {
                            const settings = await prisma.companySettings.findUnique({
                                where: { companyId: interview.job.companyId },
                                select: { emailOnComplete: true },
                            });
                            if (!settings?.emailOnComplete) return;

                            const admins = await prisma.user.findMany({
                                where: {
                                    companyId: interview.job.companyId,
                                    role: { in: ['owner', 'admin', 'hr_manager'] },
                                },
                                select: { email: true },
                            });
                            if (admins.length === 0) return;

                            const candidateName = (interview.candidate as any)?.name || 'Unknown';
                            const jobTitle = interview.job.title;
                            const emailContent = interviewCompleteEmail(candidateName, jobTitle);

                            await sendEmail({
                                ...emailContent,
                                to: admins.map((a) => a.email),
                            });
                        } catch (emailErr) {
                            request.log.warn({ err: emailErr }, 'Failed to send interview completion email');
                        }
                    })();
                }
            } catch (error) {
                request.log.warn({ err: error, interviewId: interview.id }, 'Failed to finalize XiaoFan structured result');
            }

            return success({
                status: updatedInterview.status,
                endTime: updatedInterview.endTime,
                brand: XIAOFAN_BRAND_NAME,
                xiaofan: xiaofanResult,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) || 'Failed to end interview' });
        }
    });
}
