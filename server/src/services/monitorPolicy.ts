import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Monitor Policy Schema & Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const monitorPolicySchema = z.object({
    autoWarningEnabled: z.boolean().default(true),
    autoTerminateEnabled: z.boolean().default(false),
    maxAutoReshareAttempts: z.coerce.number().int().min(1).max(10).default(3),
    heartbeatTerminateThresholdSec: z.coerce.number().int().min(10).max(240).default(45),
    invalidSurfaceTerminateThreshold: z.coerce.number().int().min(1).max(10).default(2),
    enforceFullscreen: z.boolean().default(true),
    enforceEntireScreenShare: z.boolean().default(true),
    strictClipboardProtection: z.boolean().default(true),
    codeSyncIntervalMs: z.coerce.number().int().min(200).max(4000).default(300),
});

export type MonitorPolicy = z.infer<typeof monitorPolicySchema>;

export const DEFAULT_MONITOR_POLICY: MonitorPolicy = {
    autoWarningEnabled: true,
    autoTerminateEnabled: false,
    maxAutoReshareAttempts: 3,
    heartbeatTerminateThresholdSec: 45,
    invalidSurfaceTerminateThreshold: 2,
    enforceFullscreen: true,
    enforceEntireScreenShare: true,
    strictClipboardProtection: true,
    codeSyncIntervalMs: 300,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutation & Query Schemas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const monitorPolicyMutationSchema = monitorPolicySchema.extend({
    reason: z.string().trim().min(2).max(240).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const monitorPolicyHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const monitorPolicyRollbackSchema = z.object({
    versionId: z.string().min(8),
    reason: z.string().trim().min(2).max(240).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function normalizeMonitorPolicy(rawPolicy: unknown): MonitorPolicy {
    const parsed = monitorPolicySchema.safeParse(rawPolicy);
    if (!parsed.success) return DEFAULT_MONITOR_POLICY;
    return parsed.data;
}

export function toMonitorPolicyPayload(policy: MonitorPolicy): Prisma.InputJsonObject {
    return {
        autoWarningEnabled: policy.autoWarningEnabled,
        autoTerminateEnabled: policy.autoTerminateEnabled,
        maxAutoReshareAttempts: policy.maxAutoReshareAttempts,
        heartbeatTerminateThresholdSec: policy.heartbeatTerminateThresholdSec,
        invalidSurfaceTerminateThreshold: policy.invalidSurfaceTerminateThreshold,
        enforceFullscreen: policy.enforceFullscreen,
        enforceEntireScreenShare: policy.enforceEntireScreenShare,
        strictClipboardProtection: policy.strictClipboardProtection,
        codeSyncIntervalMs: policy.codeSyncIntervalMs,
    };
}

export function normalizeAuditReason(reason: unknown): string | null {
    if (typeof reason !== 'string') return null;
    const trimmed = reason.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function resolveAuditReason(reason: unknown, fallback: string): string {
    return normalizeAuditReason(reason) || fallback;
}

export function normalizeIdempotencyKey(idempotencyKey: unknown): string | null {
    if (typeof idempotencyKey !== 'string') return null;
    const trimmed = idempotencyKey.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export type PolicyAuditLogRow = {
    id: string;
    createdAt: Date;
    metadata: unknown;
    userId: string | null;
};

export function toMonitorPolicyHistoryItem(log: PolicyAuditLogRow) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const source = typeof metadata.source === 'string' ? metadata.source : 'saved';
    const reasonRaw = typeof metadata.reason === 'string' ? metadata.reason.trim() : '';
    const reason = reasonRaw.length > 0
        ? reasonRaw
        : source === 'rollback'
            ? 'manual rollback'
            : 'manual update';
    return {
        id: log.id,
        policy: normalizeMonitorPolicy(metadata.policy),
        source,
        rollbackFrom: typeof metadata.rollbackFrom === 'string' ? metadata.rollbackFrom : null,
        reason,
        updatedAt: log.createdAt.toISOString(),
        updatedBy: log.userId,
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Idempotent Policy Log Lookup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function findIdempotentPolicyLog(params: {
    companyId: string;
    action: string;
    targetType: string;
    targetId: string;
    idempotencyKey: string | null;
}): Promise<PolicyAuditLogRow | null> {
    if (!params.idempotencyKey) return null;

    const recentLogs = await prisma.auditLog.findMany({
        where: {
            companyId: params.companyId,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
        },
        orderBy: { createdAt: 'desc' },
        take: 120,
        select: {
            id: true,
            createdAt: true,
            metadata: true,
            userId: true,
        },
    });

    for (const log of recentLogs) {
        const metadata = (log.metadata || {}) as Record<string, unknown>;
        if (normalizeIdempotencyKey(metadata.idempotencyKey) === params.idempotencyKey) {
            return log;
        }
    }

    return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Company-level Monitor Policy (shared between settings & interviews)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getLatestCompanyMonitorPolicy(companyId: string): Promise<{
    policy: MonitorPolicy;
    source: 'saved' | 'default';
    hasSaved: boolean;
    updatedAt: string | null;
    updatedBy: string | null;
}> {
    const latest = await prisma.auditLog.findFirst({
        where: {
            companyId,
            action: 'monitor.policy.company.updated',
            targetType: 'company',
            targetId: companyId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
            metadata: true,
            createdAt: true,
            userId: true,
        },
    });

    return {
        policy: normalizeMonitorPolicy((latest?.metadata as any)?.policy),
        source: latest ? 'saved' : 'default',
        hasSaved: Boolean(latest),
        updatedAt: latest?.createdAt?.toISOString() || null,
        updatedBy: latest?.userId || null,
    };
}
