/**
 * Interview route helpers — shared types, schemas, and utility functions.
 */
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../../utils/prisma';
import type { MonitorPolicy } from '../../services/monitorPolicy';
import { getLatestCompanyMonitorPolicy } from '../../services/monitorPolicy';
import {
    buildPublicIdentity,
    consumePublicQuota,
    readIntEnv,
    type PublicQuotaRule,
} from '../../services/security/publicRateLimiter';
import { XiaofanResultService } from '../../services/interview/xiaofanResultService';
import { env } from '../../config/env';

// ─── Singleton ──────────────────────────────────────────────────────────────

export const xiaofanResultService = XiaofanResultService.getInstance();

// ─── Schemas ────────────────────────────────────────────────────────────────

export const monitorAlertSchema = z.object({
    type: z.enum([
        'screen_share_missing',
        'screen_surface_invalid',
        'heartbeat_delayed',
        'candidate_offline',
        'auto_terminate',
        'manual_intervention',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    message: z.string().trim().min(2).max(280),
    metadata: z.record(z.unknown()).optional(),
});

export const evidenceExportLogSchema = z.object({
    mode: z.enum(['all', 'bundle', 'json', 'csv']),
    exportedAt: z.string().datetime().optional(),
    files: z.array(z.string().trim().min(2).max(120)).max(12).default([]),
    summary: z.object({
        integrityEventCount: z.coerce.number().int().min(0).max(5000).optional(),
        highRiskIntegrityCount: z.coerce.number().int().min(0).max(5000).optional(),
        monitorAlertCount: z.coerce.number().int().min(0).max(5000).optional(),
        highSeverityMonitorAlertCount: z.coerce.number().int().min(0).max(5000).optional(),
        codeDiffEvents: z.coerce.number().int().min(0).max(10000).optional(),
        timelineEventCount: z.coerce.number().int().min(0).max(10000).optional(),
        policyReasonEvents: z.coerce.number().int().min(0).max(10000).optional(),
        policyReasonUnique: z.coerce.number().int().min(0).max(1000).optional(),
        policyTopReasons: z.array(z.object({
            reason: z.string().trim().min(1).max(240),
            count: z.coerce.number().int().min(1).max(10000),
        })).max(10).optional(),
        chainStatus: z.enum(['valid', 'broken', 'partial', 'not_initialized']).optional(),
        chainLinkedEvents: z.coerce.number().int().min(0).max(100000).optional(),
        chainCheckedEvents: z.coerce.number().int().min(0).max(100000).optional(),
        chainLatestHash: z.string().trim().min(8).max(128).optional(),
    }).optional(),
});

export const evidenceExportHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(40),
});

export const evidenceTimelineQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(400).default(120),
});

export const evidenceChainVerifyQuerySchema = z.object({
    limit: z.coerce.number().int().min(20).max(2000).default(500),
});

export const xiaofanQuestionPlanSnapshotSchema = z.object({
    source: z.enum(['ai', 'fallback']),
    roleSummary: z.string().trim().min(2).max(600),
    focusAreas: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
    coreQuestions: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
    followups: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
    model: z.string().trim().min(2).max(160).optional(),
});

export const questionPlanPreviewSchema = z.object({
    candidateId: z.string().trim().min(2).max(64),
    jobId: z.string().trim().min(2).max(64),
    type: z.string().trim().min(2).max(64).default('ai_interview'),
});

// ─── Rate limiting ──────────────────────────────────────────────────────────

const PUBLIC_ROUTE_WINDOW_MS = 60_000;
export const PUBLIC_RATE_RULES: Record<string, PublicQuotaRule> = {
    demoToken: {
        id: 'public_interview_demo_token',
        max: readIntEnv('PUBLIC_INTERVIEW_DEMO_TOKEN_RPM', 40, 5, 600),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    preview: {
        id: 'public_interview_preview',
        max: readIntEnv('PUBLIC_INTERVIEW_PREVIEW_RPM', 90, 10, 1200),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    messages: {
        id: 'public_interview_messages',
        max: readIntEnv('PUBLIC_INTERVIEW_MESSAGES_RPM', 120, 10, 2000),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    monitorPolicy: {
        id: 'public_interview_monitor_policy',
        max: readIntEnv('PUBLIC_INTERVIEW_MONITOR_POLICY_RPM', 60, 5, 600),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    sessionId: {
        id: 'public_interview_session_id',
        max: readIntEnv('PUBLIC_INTERVIEW_SESSION_ID_RPM', 40, 5, 500),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    result: {
        id: 'public_interview_xiaofan_result',
        max: readIntEnv('PUBLIC_INTERVIEW_XIAOFAN_RESULT_RPM', 30, 5, 400),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    start: {
        id: 'public_interview_start',
        max: readIntEnv('PUBLIC_INTERVIEW_START_RPM', 12, 2, 120),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    resultSave: {
        id: 'public_interview_result_save',
        max: readIntEnv('PUBLIC_INTERVIEW_RESULT_SAVE_RPM', 6, 1, 60),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    feedback: {
        id: 'public_interview_feedback',
        max: readIntEnv('PUBLIC_INTERVIEW_FEEDBACK_RPM', 20, 2, 120),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
    end: {
        id: 'public_interview_end',
        max: readIntEnv('PUBLIC_INTERVIEW_END_RPM', 12, 2, 120),
        windowMs: PUBLIC_ROUTE_WINDOW_MS,
    },
};

export function sendPublicRateLimitExceeded(reply: any, retryAfterSec: number, message: string) {
    return reply
        .code(429)
        .header('Retry-After', String(retryAfterSec))
        .send({
            error: message,
            code: 'RATE_LIMITED',
            retryAfterSec,
        });
}

export function enforcePublicRouteRateLimit(params: {
    request: any;
    reply: any;
    token?: string;
    rule: PublicQuotaRule;
    message: string;
    suffix?: string;
}): boolean {
    const identity = buildPublicIdentity({
        request: params.request,
        token: params.token,
        suffix: params.suffix,
    });
    const verdict = consumePublicQuota({
        identity,
        rule: params.rule,
    });
    if (verdict.allowed) return true;
    void sendPublicRateLimitExceeded(params.reply, verdict.retryAfterSec, params.message);
    return false;
}

// ─── Prisma JSON helpers ────────────────────────────────────────────────────

export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | null {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => toPrismaJsonValue(item));
    }
    if (typeof value === 'object') {
        const normalized: Record<string, Prisma.InputJsonValue | null> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            normalized[key] = toPrismaJsonValue(item);
        }
        return normalized;
    }
    return value === undefined ? null : String(value);
}

export function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    const normalized: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
        normalized[key] = toPrismaJsonValue(item);
    }
    return normalized as Prisma.InputJsonObject;
}

// ─── Evidence helpers ───────────────────────────────────────────────────────

export function toEvidenceExportHistoryItem(log: {
    id: string;
    createdAt: Date;
    metadata: unknown;
    userId: string | null;
}) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const modeRaw = typeof metadata.mode === 'string' ? metadata.mode : 'all';
    const mode = ['all', 'bundle', 'json', 'csv'].includes(modeRaw) ? modeRaw : 'all';
    const files = Array.isArray(metadata.files)
        ? metadata.files
            .map((item) => String(item || '').trim())
            .filter((item) => item.length > 0)
        : [];
    const summary = (metadata.summary && typeof metadata.summary === 'object')
        ? metadata.summary as Record<string, unknown>
        : {};
    const exportedAt = typeof metadata.exportedAt === 'string'
        ? metadata.exportedAt
        : log.createdAt.toISOString();

    return {
        id: log.id,
        userId: log.userId,
        mode,
        files,
        summary,
        exportedAt,
        createdAt: log.createdAt.toISOString(),
    };
}

export function toEvidenceTimelineItem(log: {
    id: string;
    action: string;
    createdAt: Date;
    metadata: unknown;
    userId: string | null;
}) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const createdAt = log.createdAt.toISOString();
    const base = {
        id: log.id,
        action: log.action,
        createdAt,
        userId: log.userId,
        details: metadata,
    };

    if (log.action === 'monitor.alert') {
        const alertType = typeof metadata.type === 'string' ? metadata.type : 'manual_intervention';
        const severityRaw = typeof metadata.severity === 'string' ? metadata.severity : 'low';
        const severity = ['low', 'medium', 'high'].includes(severityRaw) ? severityRaw : 'low';
        const message = typeof metadata.message === 'string' ? metadata.message : 'Monitor alert';
        return {
            ...base,
            category: 'alert',
            severity,
            title: `Alert · ${alertType}`,
            message,
        };
    }

    if (log.action === 'monitor.evidence_export') {
        const modeRaw = typeof metadata.mode === 'string' ? metadata.mode : 'all';
        const mode = ['all', 'bundle', 'json', 'csv'].includes(modeRaw) ? modeRaw : 'all';
        const files = Array.isArray(metadata.files)
            ? metadata.files.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        const summary = (metadata.summary && typeof metadata.summary === 'object')
            ? metadata.summary as Record<string, unknown>
            : {};
        const timelineEventCount = typeof summary.timelineEventCount === 'number'
            ? summary.timelineEventCount
            : null;
        const policyReasonEvents = typeof summary.policyReasonEvents === 'number'
            ? summary.policyReasonEvents
            : null;
        const fileText = files.length === 1 ? '1 file' : `${files.length} files`;
        const summaryTail = [
            timelineEventCount !== null ? `timeline ${timelineEventCount}` : null,
            policyReasonEvents !== null ? `policy reasons ${policyReasonEvents}` : null,
        ].filter(Boolean).join(' · ');
        return {
            ...base,
            category: 'export',
            severity: 'low',
            title: `Evidence Export · ${mode.toUpperCase()}`,
            message: summaryTail
                ? `Exported ${fileText} · ${summaryTail}`
                : `Exported ${fileText}`,
            details: {
                files,
                summary,
                exportedAt: typeof metadata.exportedAt === 'string' ? metadata.exportedAt : createdAt,
            },
        };
    }

    if (log.action === 'monitor.policy.updated') {
        const source = typeof metadata.source === 'string' ? metadata.source : 'saved';
        const rollbackFrom = typeof metadata.rollbackFrom === 'string' ? metadata.rollbackFrom : null;
        const reason = typeof metadata.reason === 'string' ? metadata.reason.trim() : '';
        const messageBase = rollbackFrom
            ? `Rolled back from ${rollbackFrom.slice(0, 8)}`
            : `Source: ${source}`;
        return {
            ...base,
            category: 'policy',
            severity: source === 'rollback' ? 'medium' : 'low',
            title: source === 'rollback' ? 'Monitor Policy Rollback' : 'Monitor Policy Updated',
            message: reason ? `${messageBase} · reason: ${reason}` : messageBase,
        };
    }

    if (log.action === 'interview.terminated') {
        const reason = typeof metadata.reason === 'string' ? metadata.reason : 'terminated_by_monitor';
        return {
            ...base,
            category: 'termination',
            severity: 'high',
            title: 'Interview Terminated',
            message: reason,
        };
    }

    return {
        ...base,
        category: 'unknown',
        severity: 'low',
        title: log.action,
        message: typeof metadata.message === 'string' ? metadata.message : 'Audit event',
    };
}

// ─── Company monitor policy ─────────────────────────────────────────────────

export async function getCompanyMonitorPolicy(companyId: string): Promise<{
    policy: MonitorPolicy;
    hasSaved: boolean;
    updatedAt: Date | null;
    updatedBy: string | null;
}> {
    const result = await getLatestCompanyMonitorPolicy(companyId);
    return {
        policy: result.policy,
        hasSaved: result.hasSaved,
        updatedAt: result.updatedAt ? new Date(result.updatedAt) : null,
        updatedBy: result.updatedBy,
    };
}

// ─── Demo interview helpers ─────────────────────────────────────────────────

export const DEMO_INTERVIEW_ALLOWED_STATUSES = ['upcoming', 'active', 'pending', 'ready'] as const;

export function canServePublicDemoInterview(): boolean {
    if (env.ENABLE_PUBLIC_DEMO_TOKEN === 'true') return true;
    return env.NODE_ENV !== 'production';
}

export function getPublicInterviewAccessError(interview: {
    status: string;
    startTime: Date;
    endTime: Date | null;
}): { status: number; error: string } | null {
    if (interview.status === 'completed' || interview.status === 'cancelled') {
        return { status: 400, error: 'Interview is no longer active' };
    }

    if (interview.endTime && interview.endTime.getTime() <= Date.now()) {
        return { status: 410, error: 'Interview link expired' };
    }

    return null;
}

export async function ensurePublicDemoInterviewToken(): Promise<{ token: string; created: boolean }> {
    const existingWithConnectedProvider = await prisma.interview.findFirst({
        where: {
            status: {
                in: [...DEMO_INTERVIEW_ALLOWED_STATUSES],
            },
            candidate: {
                source: 'system-demo',
            },
            job: {
                company: {
                    apiKeys: {
                        some: {
                            status: 'connected',
                        },
                    },
                },
            },
            OR: [
                { endTime: null },
                { endTime: { gt: new Date() } },
            ],
        },
        orderBy: [
            { updatedAt: 'desc' },
            { startTime: 'desc' },
        ],
        select: {
            token: true,
        },
    });
    if (existingWithConnectedProvider?.token) {
        return { token: existingWithConnectedProvider.token, created: false };
    }

    const existing = await prisma.interview.findFirst({
        where: {
            status: {
                in: [...DEMO_INTERVIEW_ALLOWED_STATUSES],
            },
            candidate: {
                source: 'system-demo',
            },
            OR: [
                { endTime: null },
                { endTime: { gt: new Date() } },
            ],
        },
        orderBy: [
            { updatedAt: 'desc' },
            { startTime: 'desc' },
        ],
        select: {
            token: true,
        },
    });
    if (existing?.token) {
        return { token: existing.token, created: false };
    }

    let company = await prisma.company.findFirst({
        where: {
            apiKeys: {
                some: {
                    status: 'connected',
                },
            },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    if (!company) {
        company = await prisma.company.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
    }
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'HireFlow Demo',
                primaryColor: '#1A73E8',
                welcomeText: '欢迎参加小梵语音面试。',
                settings: {
                    create: {
                        maxTokens: 8192,
                        temperature: 0.7,
                    },
                },
            },
            select: { id: true },
        });
    }

    let job = await prisma.job.findFirst({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
    });
    if (!job) {
        job = await prisma.job.create({
            data: {
                companyId: company.id,
                title: 'Senior Frontend Engineer',
                department: 'Product Engineering',
                location: 'Remote',
                type: 'full-time',
                status: 'active',
                descriptionJd: 'Build high quality interview products with React and TypeScript.',
                requirements: ['React', 'TypeScript', 'System design'],
                salaryRange: { min: 30000, max: 50000, currency: 'CNY' },
                pipeline: [
                    { id: 'screening', name: 'Screening', type: 'screening', order: 0 },
                    { id: 'ai_interview', name: 'AI Interview', type: 'interview_1', order: 1 },
                ],
            },
            select: { id: true },
        });
    }

    let candidate = await prisma.candidate.findFirst({
        where: {
            companyId: company.id,
            jobId: job.id,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
    });
    if (!candidate) {
        candidate = await prisma.candidate.create({
            data: {
                companyId: company.id,
                jobId: job.id,
                name: 'Demo Candidate',
                email: `demo-candidate+${Date.now()}@hireflow.ai`,
                phone: '+86 138-0000-0000',
                stage: 'interview_1',
                score: 0,
                skills: ['React', 'TypeScript'],
                verificationStatus: 'pending',
                tags: ['demo'],
                source: 'system-demo',
            },
            select: { id: true },
        });
    }

    const createdInterview = await prisma.interview.create({
        data: {
            jobId: job.id,
            candidateId: candidate.id,
            token: randomUUID(),
            status: 'upcoming',
            type: 'ai_interview',
            startTime: new Date(),
        },
        select: { token: true },
    });

    return {
        token: createdInterview.token,
        created: true,
    };
}
