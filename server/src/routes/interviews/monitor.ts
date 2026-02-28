import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';
import { SocketManager } from '../../services/socket/manager';
import { XIAOFAN_BRAND_NAME } from '../../services/interview/xiaofan';
import { loadInterviewAiRuntimeConfig } from '../../services/interview/modelConfig';
import { generateWithCompanyFallback } from '../../services/ai/runtimeFallback';
import { getLatestCompanyEvidenceChainPolicy } from '../../services/evidence/policy';
import {
    CHAINED_EVIDENCE_ACTIONS,
    createChainedInterviewAuditLog,
    verifyInterviewEvidenceChainWithDb,
} from '../../services/evidence/chain';
import {
    monitorPolicySchema,
    monitorPolicyMutationSchema,
    monitorPolicyHistoryQuerySchema,
    monitorPolicyRollbackSchema,
    normalizeMonitorPolicy,
    toMonitorPolicyPayload,
    toMonitorPolicyHistoryItem,
    normalizeAuditReason,
    normalizeIdempotencyKey,
    findIdempotentPolicyLog,
} from '../../services/monitorPolicy';
import {
    monitorAlertSchema,
    evidenceExportLogSchema,
    evidenceExportHistoryQuerySchema,
    evidenceTimelineQuerySchema,
    evidenceChainVerifyQuerySchema,
    toPrismaJsonObject,
    toEvidenceExportHistoryItem,
    toEvidenceTimelineItem,
    getCompanyMonitorPolicy,
    xiaofanResultService,
} from './helpers';

export async function registerMonitorRoutes(app: FastifyInstance) {
    // Get realtime monitor room state
    app.get('/api/interviews/:id/monitor-state', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const socketManager = SocketManager.getInstance();
            const state = socketManager.getRoomState(id) || {
                interviewId: id,
                participantCount: 0,
                candidateCount: 0,
                monitorCount: 0,
                candidateOnline: false,
                monitorOnline: false,
                screenShareActive: false,
                screenSurface: 'unknown',
                screenMuted: false,
                lastScreenShareAt: null,
                updatedAt: new Date().toISOString(),
            };

            return success(state);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Get monitor auto-guardrail policy for this interview
    app.get('/api/interviews/:id/monitor-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const latest = await prisma.auditLog.findFirst({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: interview.id,
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    metadata: true,
                    createdAt: true,
                    userId: true,
                },
            });

            if (latest) {
                const policy = normalizeMonitorPolicy((latest.metadata as any)?.policy);
                const sourceValue = String((latest.metadata as any)?.source || '').trim();
                return success({
                    policy,
                    source: sourceValue || 'saved',
                    updatedAt: latest.createdAt.toISOString(),
                    updatedBy: latest.userId || null,
                });
            }

            const companyPolicy = await getCompanyMonitorPolicy(user.companyId);
            return success({
                policy: companyPolicy.policy,
                source: companyPolicy.hasSaved ? 'company_default' : 'default',
                updatedAt: companyPolicy.updatedAt?.toISOString() || null,
                updatedBy: companyPolicy.updatedBy || null,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Save monitor auto-guardrail policy for this interview
    app.put('/api/interviews/:id/monitor-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parseResult = monitorPolicyMutationSchema.safeParse(request.body || {});
            if (!parseResult.success) {
                return reply.status(400).send({ error: parseResult.error.flatten() });
            }

            const {
                reason: reasonRaw,
                idempotencyKey: idempotencyKeyRaw,
                ...policyRaw
            } = parseResult.data;
            const policy = monitorPolicySchema.parse(policyRaw);
            const reason = normalizeAuditReason(reasonRaw);
            const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'monitor.policy.updated',
                targetType: 'interview',
                targetId: interview.id,
                idempotencyKey,
            });
            if (existing) {
                const existingMetadata = (existing.metadata || {}) as Record<string, unknown>;
                return success({
                    policy: normalizeMonitorPolicy(existingMetadata.policy),
                    reason: normalizeAuditReason(existingMetadata.reason),
                    savedAt: existing.createdAt.toISOString(),
                    idempotentReplay: true,
                });
            }

            const policyPayload = toMonitorPolicyPayload(policy);
            const nowIso = new Date().toISOString();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: interview.id,
                    metadata: {
                        policy: policyPayload,
                        source: 'monitor',
                        reason,
                        idempotencyKey,
                        timestamp: nowIso,
                    } satisfies Prisma.InputJsonObject,
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.broadcast(interview.id, {
                type: 'monitor_policy_updated',
                policy,
                updatedBy: user.userId,
                reason,
                timestamp: nowIso,
            });

            return success({
                policy,
                reason,
                savedAt: nowIso,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // List interview monitor policy history
    app.get('/api/interviews/:id/monitor-policy/history', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsedQuery = monitorPolicyHistoryQuerySchema.safeParse(request.query || {});
            if (!parsedQuery.success) {
                return reply.status(400).send({ error: parsedQuery.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: id,
                },
                orderBy: { createdAt: 'desc' },
                take: parsedQuery.data.limit,
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });

            return success({
                history: logs.map((log) => toMonitorPolicyHistoryItem(log)),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Roll back interview monitor policy to a previous version
    app.post('/api/interviews/:id/monitor-policy/rollback', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsedBody = monitorPolicyRollbackSchema.safeParse(request.body || {});
            if (!parsedBody.success) {
                return reply.status(400).send({ error: parsedBody.error.flatten() });
            }
            const reason = normalizeAuditReason(parsedBody.data.reason);
            const idempotencyKey = normalizeIdempotencyKey(parsedBody.data.idempotencyKey);

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'monitor.policy.updated',
                targetType: 'interview',
                targetId: interview.id,
                idempotencyKey,
            });
            if (existing) {
                const existingMetadata = (existing.metadata || {}) as Record<string, unknown>;
                return success({
                    policy: normalizeMonitorPolicy(existingMetadata.policy),
                    reason: normalizeAuditReason(existingMetadata.reason),
                    savedAt: existing.createdAt.toISOString(),
                    idempotentReplay: true,
                });
            }

            const version = await prisma.auditLog.findFirst({
                where: {
                    id: parsedBody.data.versionId,
                    companyId: user.companyId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: id,
                },
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });
            if (!version) {
                return reply.status(404).send({ error: 'Monitor policy version not found' });
            }

            const policy = normalizeMonitorPolicy((version.metadata as any)?.policy);
            const nowIso = new Date().toISOString();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: interview.id,
                    metadata: {
                        policy: toMonitorPolicyPayload(policy),
                        source: 'rollback',
                        rollbackFrom: version.id,
                        reason,
                        idempotencyKey,
                        timestamp: nowIso,
                    } satisfies Prisma.InputJsonObject,
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.broadcast(interview.id, {
                type: 'monitor_policy_updated',
                policy,
                updatedBy: user.userId,
                timestamp: nowIso,
                source: 'rollback',
                rollbackFrom: version.id,
                reason,
            });

            return success({
                policy,
                rolledBackTo: toMonitorPolicyHistoryItem(version),
                reason,
                savedAt: nowIso,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Persist monitor guardrail alerts
    app.post('/api/interviews/:id/monitor-alerts', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsed = monitorAlertSchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const alert = parsed.data;
            const alertPayload: Prisma.InputJsonObject = {
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                metadata: toPrismaJsonObject(alert.metadata || {}),
                source: 'monitor',
                timestamp: new Date().toISOString(),
            };
            const created = await createChainedInterviewAuditLog({
                prisma,
                companyId: user.companyId,
                interviewId: interview.id,
                userId: user.userId,
                action: 'monitor.alert',
                metadata: alertPayload as unknown as Record<string, unknown>,
            });

            const normalized = {
                id: created.id,
                userId: created.userId,
                type: (created.metadata as any)?.type || alert.type,
                severity: (created.metadata as any)?.severity || alert.severity,
                message: (created.metadata as any)?.message || alert.message,
                metadata: (created.metadata as any)?.metadata || alert.metadata || {},
                createdAt: created.createdAt.toISOString(),
            };

            const socketManager = SocketManager.getInstance();
            socketManager.sendToMonitors(interview.id, {
                type: 'monitor_alert',
                alert: normalized,
            });

            return success(normalized);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // List monitor guardrail alerts
    app.get('/api/interviews/:id/monitor-alerts', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const { limit = 60 } = request.query as { limit?: string | number };
            const take = Math.max(1, Math.min(Number(limit) || 60, 200));

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.alert',
                    targetType: 'interview',
                    targetId: id,
                },
                orderBy: { createdAt: 'desc' },
                take,
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });

            const alerts = logs.map((log) => {
                const metadata = (log.metadata || {}) as Record<string, any>;
                return {
                    id: log.id,
                    userId: log.userId,
                    type: metadata.type || 'manual_intervention',
                    severity: metadata.severity || 'low',
                    message: metadata.message || 'Monitor alert',
                    metadata: metadata.metadata || {},
                    createdAt: log.createdAt.toISOString(),
                };
            });

            return success(alerts);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Persist evidence export actions from monitor side
    app.post('/api/interviews/:id/evidence-exports', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsed = evidenceExportLogSchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const payload = parsed.data;
            const exportPolicy = await getLatestCompanyEvidenceChainPolicy(prisma, user.companyId);
            const chainVerification = await verifyInterviewEvidenceChainWithDb({
                prisma,
                companyId: user.companyId,
                interviewId: interview.id,
                limit: 1200,
            });
            const blockOnBroken = exportPolicy.policy.blockOnBrokenChain && chainVerification.status === 'broken';
            const blockOnPartial = exportPolicy.policy.blockOnPartialChain && chainVerification.status === 'partial';
            if (blockOnBroken || blockOnPartial) {
                return reply.status(409).send({
                    error: 'Evidence export blocked by company chain policy. Resolve chain issues before exporting.',
                    policy: exportPolicy.policy,
                    chain: chainVerification,
                });
            }
            const chainSummary = {
                chainStatus: chainVerification.status,
                chainLinkedEvents: chainVerification.linkedEvents,
                chainCheckedEvents: chainVerification.checkedEvents,
                chainLatestHash: chainVerification.latestHash || undefined,
            };
            const created = await createChainedInterviewAuditLog({
                prisma,
                companyId: user.companyId,
                interviewId: interview.id,
                userId: user.userId,
                action: 'monitor.evidence_export',
                metadata: {
                    mode: payload.mode,
                    exportedAt: payload.exportedAt || new Date().toISOString(),
                    files: payload.files,
                    summary: {
                        ...(payload.summary || {}),
                        ...chainSummary,
                    },
                    source: 'monitor',
                    timestamp: new Date().toISOString(),
                },
            });

            const normalized = toEvidenceExportHistoryItem(created);
            const socketManager = SocketManager.getInstance();
            socketManager.sendToMonitors(interview.id, {
                type: 'evidence_export_logged',
                record: normalized,
            });

            return success(normalized);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // List persisted evidence export history for this interview
    app.get('/api/interviews/:id/evidence-exports', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsed = evidenceExportHistoryQuerySchema.safeParse(request.query || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.evidence_export',
                    targetType: 'interview',
                    targetId: id,
                },
                orderBy: { createdAt: 'desc' },
                take: parsed.data.limit,
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });

            return success({
                history: logs.map((log) => toEvidenceExportHistoryItem(log)),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // List replayable evidence timeline for this interview
    app.get('/api/interviews/:id/evidence-timeline', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsed = evidenceTimelineQuerySchema.safeParse(request.query || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    targetType: 'interview',
                    targetId: id,
                    action: {
                        in: [
                            'monitor.alert',
                            'monitor.evidence_export',
                            'monitor.policy.updated',
                            'interview.terminated',
                        ],
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: parsed.data.limit,
                select: {
                    id: true,
                    action: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });

            return success({
                timeline: logs.map((log) => toEvidenceTimelineItem(log)),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Verify interview evidence hash-chain integrity
    app.get('/api/interviews/:id/evidence-chain/verify', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const parsed = evidenceChainVerifyQuerySchema.safeParse(request.query || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });
            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const verification = await verifyInterviewEvidenceChainWithDb({
                prisma,
                companyId: user.companyId,
                interviewId: id,
                limit: parsed.data.limit,
            });

            return success({
                interviewId: id,
                generatedAt: new Date().toISOString(),
                supportedActions: [...CHAINED_EVIDENCE_ACTIONS],
                ...verification,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Get latest XiaoFan structured interview result
    app.get('/api/interviews/:id/xiaofan-result', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const result = await xiaofanResultService.getLatestResult(user.companyId, interview.id);
            return success({
                brand: XIAOFAN_BRAND_NAME,
                result,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Force terminate interview (Company-side proctor action)
    app.post('/api/interviews/:id/terminate', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const { id } = request.params as { id: string };
            const bodySchema = z.object({
                reason: z.string().max(280).optional(),
            });
            const parseResult = bodySchema.safeParse(request.body || {});
            if (!parseResult.success) {
                return reply.status(400).send({ error: parseResult.error.flatten() });
            }
            const { reason } = parseResult.data;

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId },
                },
                select: { id: true, status: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            if (interview.status === 'completed' || interview.status === 'cancelled') {
                return success({
                    interviewId: interview.id,
                    status: interview.status,
                    alreadyTerminated: true,
                });
            }

            const updated = await prisma.interview.update({
                where: { id },
                data: {
                    status: 'cancelled',
                    endTime: new Date(),
                },
                select: { id: true, status: true, endTime: true },
            });

            await createChainedInterviewAuditLog({
                prisma,
                companyId: user.companyId,
                interviewId: updated.id,
                userId: user.userId,
                action: 'interview.terminated',
                metadata: {
                    reason: reason || 'terminated_by_monitor',
                    terminatedByRole: user.role,
                    timestamp: new Date().toISOString(),
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.sendToCandidate(updated.id, {
                type: 'force_terminate',
                reason: reason || 'terminated_by_monitor',
            });
            socketManager.sendToMonitors(updated.id, {
                type: 'session_terminated',
                reason: reason || 'terminated_by_monitor',
                by: user.userId,
                timestamp: new Date().toISOString(),
            });

            return success({
                interviewId: updated.id,
                status: updated.status,
                endTime: updated.endTime,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Second opinion
    app.post('/api/interviews/:id/second-opinion', async (request, reply) => {
        const user = await authenticate(request);
        const { id } = request.params as { id: string };

        const interview = await prisma.interview.findFirst({
            where: { id, job: { companyId: user.companyId } },
            include: { candidate: true, job: true }
        });

        if (!interview) {
            return reply.status(404).send({ error: 'Interview not found' });
        }

        const messages = await prisma.interviewMessage.findMany({
            where: { interviewId: interview.id },
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true },
        });

        const transcript = messages
            .filter((item) => item.role === 'assistant' || item.role === 'user')
            .map((item) => `${item.role}: ${item.content}`)
            .join('\n')
            .slice(0, 16000);

        if (!transcript.trim()) {
            return reply.status(400).send({ error: 'No transcript available for evaluation.' });
        }

        const systemPrompt = `You are a Secondary HR Evaluation AI. Your job is to provide a "Second Opinion" on the candidate's interview performance to reduce bias. 
Candidate: ${interview.candidate.name || 'Unknown'}
Job Title: ${interview.job.title}
Job Description: ${interview.job.descriptionJd || 'N/A'}

Provide a concise, unbiased analysis of the transcript. Output a JSON object matching this schema:
{
  "summary": "Your secondary critique (max 3 sentences)",
  "recommendation": "strong_hire" | "hire" | "maybe" | "no_hire"
}`;

        const userPrompt = `Interview Transcript:\n\n${transcript}\n\nAnalyze this transcript and output strictly JSON.`;

        try {
            const config = await loadInterviewAiRuntimeConfig(interview.job.companyId);
            const rawResponse = await generateWithCompanyFallback({
                companyId: interview.job.companyId,
                prompt: userPrompt,
                systemInstruction: systemPrompt,
                model: config.model,
                temperature: 0.1,
                provider: (config.provider || undefined) as any,
                preferredKeyId: config.apiKeyId,
                primary: {
                    id: config.apiKeyId,
                    keyName: config.apiKeyName,
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                },
            });

            let rawText = rawResponse.response.text.trim();
            if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
            if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
            if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);

            let parsedOpinion;
            try {
                parsedOpinion = JSON.parse(rawText.trim());
            } catch (e) {
                return reply.status(500).send({ error: 'Failed to parse AI response as JSON.' });
            }

            const validRecommendation = ['strong_hire', 'hire', 'maybe', 'no_hire'].includes(parsedOpinion.recommendation)
                ? parsedOpinion.recommendation
                : 'maybe';

            const secondOpinionData = {
                summary: parsedOpinion.summary || 'No summary generated.',
                recommendation: validRecommendation,
                model: config.model,
                requestedAt: new Date().toISOString(),
                requestedBy: user.userId,
            };

            await prisma.interview.update({
                where: { id },
                data: {
                    secondOpinion: secondOpinionData as any,
                },
            });

            return success({ opinion: secondOpinionData });
        } catch (error: unknown) {
            request.log.error({ err: error, interviewId: id }, 'Failed Second Opinion');
            return reply.status(500).send({ error: extractErrorMessage(error) || 'Failed to generate second opinion' });
        }
    });
}
