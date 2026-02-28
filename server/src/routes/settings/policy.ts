import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';
import { SocketManager } from '../../services/socket/manager';
import {
    evidenceChainPolicySchema,
    getLatestCompanyEvidenceChainPolicy,
    normalizeEvidenceChainPolicy,
    toEvidenceChainPolicyHistoryItem,
    toEvidenceChainPolicyPayload,
} from '../../services/evidence/policy';
import {
    monitorPolicySchema,
    monitorPolicyMutationSchema,
    monitorPolicyHistoryQuerySchema,
    monitorPolicyRollbackSchema,
    normalizeMonitorPolicy,
    toMonitorPolicyPayload,
    resolveAuditReason,
    normalizeAuditReason,
    normalizeIdempotencyKey,
    toMonitorPolicyHistoryItem,
    findIdempotentPolicyLog,
    getLatestCompanyMonitorPolicy,
} from '../../services/monitorPolicy';
import {
    monitorPolicyApplySchema,
    evidenceChainPolicyMutationSchema,
    evidenceChainPolicyHistoryQuerySchema,
    evidenceChainPolicyRollbackSchema,
} from './helpers';

export async function registerPolicyRoutes(app: FastifyInstance) {
    // ── Monitor policy template ─────────────────────────────────────────

    app.get('/api/settings/monitor-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const payload = await getLatestCompanyMonitorPolicy(user.companyId);
            return success(payload);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.put('/api/settings/monitor-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsed = monitorPolicyMutationSchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const {
                reason: reasonRaw,
                idempotencyKey: idempotencyKeyRaw,
                ...policyRaw
            } = parsed.data;
            const policy = monitorPolicySchema.parse(policyRaw);
            const reason = resolveAuditReason(reasonRaw, 'manual update');
            const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'monitor.policy.company.updated',
                targetType: 'company',
                targetId: user.companyId,
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

            const now = new Date();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'monitor.policy.company.updated',
                    targetType: 'company',
                    targetId: user.companyId,
                    metadata: {
                        policy: toMonitorPolicyPayload(policy),
                        source: 'settings',
                        reason,
                        idempotencyKey,
                        timestamp: now.toISOString(),
                    } satisfies Prisma.InputJsonObject,
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.sendToCompanyMonitors(user.companyId, {
                type: 'company_monitor_policy_template_updated',
                policy,
                source: 'settings',
                reason,
                updatedBy: user.userId,
                timestamp: now.toISOString(),
            });

            return success({
                policy,
                reason,
                savedAt: now.toISOString(),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.get('/api/settings/monitor-policy/history', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsedQuery = monitorPolicyHistoryQuerySchema.safeParse(request.query || {});
            if (!parsedQuery.success) {
                return reply.status(400).send({ error: parsedQuery.error.flatten() });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.policy.company.updated',
                    targetType: 'company',
                    targetId: user.companyId,
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

    app.post('/api/settings/monitor-policy/rollback', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsedBody = monitorPolicyRollbackSchema.safeParse(request.body || {});
            if (!parsedBody.success) {
                return reply.status(400).send({ error: parsedBody.error.flatten() });
            }

            const reason = resolveAuditReason(parsedBody.data.reason, 'manual rollback');
            const idempotencyKey = normalizeIdempotencyKey(parsedBody.data.idempotencyKey);
            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'monitor.policy.company.updated',
                targetType: 'company',
                targetId: user.companyId,
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
                    action: 'monitor.policy.company.updated',
                    targetType: 'company',
                    targetId: user.companyId,
                },
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });
            if (!version) {
                return reply.status(404).send({ error: 'Monitor policy template version not found' });
            }

            const policy = normalizeMonitorPolicy((version.metadata as any)?.policy);
            const nowIso = new Date().toISOString();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'monitor.policy.company.updated',
                    targetType: 'company',
                    targetId: user.companyId,
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
            socketManager.sendToCompanyMonitors(user.companyId, {
                type: 'company_monitor_policy_template_updated',
                policy,
                source: 'rollback',
                updatedBy: user.userId,
                rollbackFrom: version.id,
                reason,
                timestamp: nowIso,
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

    // ── Evidence chain policy ───────────────────────────────────────────

    app.get('/api/settings/evidence-chain-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const payload = await getLatestCompanyEvidenceChainPolicy(prisma, user.companyId);
            return success(payload);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.put('/api/settings/evidence-chain-policy', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsed = evidenceChainPolicyMutationSchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const {
                reason: reasonRaw,
                idempotencyKey: idempotencyKeyRaw,
                ...policyRaw
            } = parsed.data;
            const policy = evidenceChainPolicySchema.parse(policyRaw);
            const reason = resolveAuditReason(reasonRaw, 'manual update');
            const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'evidence.chain.policy.updated',
                targetType: 'company',
                targetId: user.companyId,
                idempotencyKey,
            });
            if (existing) {
                const existingMetadata = (existing.metadata || {}) as Record<string, unknown>;
                return success({
                    policy: normalizeEvidenceChainPolicy(existingMetadata.policy),
                    reason: normalizeAuditReason(existingMetadata.reason),
                    savedAt: existing.createdAt.toISOString(),
                    idempotentReplay: true,
                });
            }

            const nowIso = new Date().toISOString();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'evidence.chain.policy.updated',
                    targetType: 'company',
                    targetId: user.companyId,
                    metadata: {
                        policy: toEvidenceChainPolicyPayload(policy),
                        source: 'settings',
                        reason,
                        idempotencyKey,
                        timestamp: nowIso,
                    } satisfies Prisma.InputJsonObject,
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.sendToCompanyMonitors(user.companyId, {
                type: 'company_evidence_chain_policy_updated',
                policy,
                source: 'settings',
                reason,
                updatedBy: user.userId,
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

    app.get('/api/settings/evidence-chain-policy/history', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsedQuery = evidenceChainPolicyHistoryQuerySchema.safeParse(request.query || {});
            if (!parsedQuery.success) {
                return reply.status(400).send({ error: parsedQuery.error.flatten() });
            }

            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'evidence.chain.policy.updated',
                    targetType: 'company',
                    targetId: user.companyId,
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
                history: logs.map((log) => toEvidenceChainPolicyHistoryItem(log)),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.post('/api/settings/evidence-chain-policy/rollback', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsedBody = evidenceChainPolicyRollbackSchema.safeParse(request.body || {});
            if (!parsedBody.success) {
                return reply.status(400).send({ error: parsedBody.error.flatten() });
            }

            const reason = resolveAuditReason(parsedBody.data.reason, 'manual rollback');
            const idempotencyKey = normalizeIdempotencyKey(parsedBody.data.idempotencyKey);
            const existing = await findIdempotentPolicyLog({
                companyId: user.companyId,
                action: 'evidence.chain.policy.updated',
                targetType: 'company',
                targetId: user.companyId,
                idempotencyKey,
            });
            if (existing) {
                const existingMetadata = (existing.metadata || {}) as Record<string, unknown>;
                return success({
                    policy: normalizeEvidenceChainPolicy(existingMetadata.policy),
                    reason: normalizeAuditReason(existingMetadata.reason),
                    savedAt: existing.createdAt.toISOString(),
                    idempotentReplay: true,
                });
            }

            const version = await prisma.auditLog.findFirst({
                where: {
                    id: parsedBody.data.versionId,
                    companyId: user.companyId,
                    action: 'evidence.chain.policy.updated',
                    targetType: 'company',
                    targetId: user.companyId,
                },
                select: {
                    id: true,
                    createdAt: true,
                    metadata: true,
                    userId: true,
                },
            });
            if (!version) {
                return reply.status(404).send({ error: 'Evidence chain policy version not found' });
            }

            const policy = normalizeEvidenceChainPolicy((version.metadata as any)?.policy);
            const nowIso = new Date().toISOString();
            await prisma.auditLog.create({
                data: {
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'evidence.chain.policy.updated',
                    targetType: 'company',
                    targetId: user.companyId,
                    metadata: {
                        policy: toEvidenceChainPolicyPayload(policy),
                        source: 'rollback',
                        rollbackFrom: version.id,
                        reason,
                        idempotencyKey,
                        timestamp: nowIso,
                    } satisfies Prisma.InputJsonObject,
                },
            });

            const socketManager = SocketManager.getInstance();
            socketManager.sendToCompanyMonitors(user.companyId, {
                type: 'company_evidence_chain_policy_updated',
                policy,
                source: 'rollback',
                updatedBy: user.userId,
                rollbackFrom: version.id,
                reason,
                timestamp: nowIso,
            });

            return success({
                policy,
                rolledBackTo: toEvidenceChainPolicyHistoryItem(version),
                reason,
                savedAt: nowIso,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // ── Apply company template to interviews ────────────────────────────

    app.post('/api/settings/monitor-policy/apply', async (request, reply) => {
        try {
            const user = await authenticate(request);
            if (!['owner', 'admin'].includes(user.role)) {
                return reply.status(403).send({ error: 'Insufficient permissions' });
            }

            const parsed = monitorPolicyApplySchema.safeParse(request.body || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const { mode, statuses, limit, dryRun } = parsed.data;
            const companyTemplate = await getLatestCompanyMonitorPolicy(user.companyId);
            const policy = companyTemplate.policy;
            const policyPayload = toMonitorPolicyPayload(policy);

            const interviews = await prisma.interview.findMany({
                where: {
                    job: { companyId: user.companyId },
                    status: { in: statuses },
                },
                orderBy: { startTime: 'asc' },
                take: limit,
                select: { id: true, status: true },
            });

            if (interviews.length === 0) {
                return success({
                    mode,
                    statuses,
                    totalCandidates: 0,
                    applied: 0,
                    skipped: 0,
                    policy,
                });
            }

            const interviewIds = interviews.map((item) => item.id);
            const existingLogs = await prisma.auditLog.findMany({
                where: {
                    companyId: user.companyId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: { in: interviewIds },
                },
                orderBy: { createdAt: 'desc' },
                select: { targetId: true, createdAt: true },
            });

            const latestPolicyByInterview = new Map<string, Date>();
            for (const log of existingLogs) {
                if (!log.targetId) continue;
                if (!latestPolicyByInterview.has(log.targetId)) {
                    latestPolicyByInterview.set(log.targetId, log.createdAt);
                }
            }

            const nowIso = new Date().toISOString();
            const createRows: Prisma.AuditLogCreateManyInput[] = [];
            let skipped = 0;

            for (const interview of interviews) {
                const hasExisting = latestPolicyByInterview.has(interview.id);
                if (mode === 'missing_only' && hasExisting) {
                    skipped += 1;
                    continue;
                }

                createRows.push({
                    companyId: user.companyId,
                    userId: user.userId,
                    action: 'monitor.policy.updated',
                    targetType: 'interview',
                    targetId: interview.id,
                    metadata: {
                        policy: policyPayload,
                        source: mode === 'overwrite' ? 'company_apply_overwrite' : 'company_apply_bulk',
                        timestamp: nowIso,
                    } satisfies Prisma.InputJsonObject,
                });
            }

            if (dryRun) {
                const affectedInterviewIds = createRows
                    .map((row) => row.targetId)
                    .filter((value): value is string => typeof value === 'string' && value.length > 0);
                return success({
                    dryRun: true,
                    mode,
                    statuses,
                    totalCandidates: interviews.length,
                    applied: createRows.length,
                    skipped,
                    policy,
                    affectedInterviewIds,
                });
            }

            let applied = 0;
            const affectedInterviewIds: string[] = [];
            if (createRows.length > 0) {
                const created = await prisma.auditLog.createMany({
                    data: createRows,
                });
                applied = created.count;
                for (const row of createRows) {
                    if (row.targetId) {
                        affectedInterviewIds.push(row.targetId);
                    }
                }
            }

            if (affectedInterviewIds.length > 0) {
                const socketManager = SocketManager.getInstance();
                for (const interviewId of affectedInterviewIds) {
                    socketManager.broadcast(interviewId, {
                        type: 'monitor_policy_updated',
                        policy,
                        updatedBy: user.userId,
                        timestamp: nowIso,
                        source: mode === 'overwrite' ? 'company_apply_overwrite' : 'company_apply_bulk',
                    });
                }
            }

            return success({
                dryRun: false,
                mode,
                statuses,
                totalCandidates: interviews.length,
                applied,
                skipped,
                policy,
                affectedInterviewIds,
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
