import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success } from '../utils/response';
import { SocketManager } from '../services/socket/manager';
import { createChainedInterviewAuditLog } from '../services/evidence/chain';
import { getCompanyMonitorPolicy } from './interviews';
import {
    buildPublicIdentity,
    consumePublicQuota,
    readIntEnv,
    type PublicQuotaRule,
} from '../services/security/publicRateLimiter';
import type {
    IntegrityEventType,
    IntegrityInsight,
    IntegrityOverviewInterview,
    IntegrityOverviewSnapshot,
    IntegritySignalSummary,
} from '@hireflow/types';

const eventSchema = z.object({
    type: z.enum([
        'TAB_HIDDEN',
        'WINDOW_BLUR',
        'MULTI_FACE',
        'NO_FACE',
        'AI_TOOL_SUSPECTED',
        'NETWORK_UNSTABLE',
        'AUDIO_MUTED',
        'COPY_PASTE',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    message: z.string().max(280).optional(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.number().optional(),
});

const overviewQuerySchema = z.object({
    level: z.enum(['all', 'low', 'medium', 'high']).default('all'),
    days: z.coerce.number().int().min(1).max(180).default(30),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    search: z.string().trim().max(80).optional(),
});

const penaltyBySeverity: Record<'low' | 'medium' | 'high', number> = {
    low: 5,
    medium: 12,
    high: 25,
};

const defaultMessageByType: Record<IntegrityEventType, string> = {
    TAB_HIDDEN: 'Tab hidden during interview.',
    WINDOW_BLUR: 'Window focus lost during interview.',
    MULTI_FACE: 'Multiple faces detected.',
    NO_FACE: 'No face detected for an extended period.',
    AI_TOOL_SUSPECTED: 'Potential AI assistance signal detected.',
    NETWORK_UNSTABLE: 'Network instability detected.',
    AUDIO_MUTED: 'Microphone muted during active session.',
    COPY_PASTE: 'Copy/paste action detected in interview room.',
};

const PUBLIC_INTEGRITY_RATE_RULE: PublicQuotaRule = {
    id: 'public_integrity_event_ingest',
    max: readIntEnv('PUBLIC_INTEGRITY_EVENT_RPM', 240, 20, 4000),
    windowMs: 60_000,
};

function getRecommendation(score: number): string {
    if (score >= 80) return 'Low risk. Proceed with normal review flow.';
    if (score >= 60) return 'Medium risk. Recommend manual transcript and timeline review.';
    return 'High risk. Require secondary verification interview before hiring decision.';
}

function toSeverity(value: unknown): 'low' | 'medium' | 'high' {
    if (value === 'medium' || value === 'high') return value;
    return 'low';
}

function toEventType(value: unknown): IntegrityEventType {
    if (typeof value === 'string' && value in defaultMessageByType) {
        return value as IntegrityEventType;
    }
    return 'WINDOW_BLUR';
}

function mergeSeverity(
    current: 'low' | 'medium' | 'high',
    next: 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
    if (current === 'high' || next === 'high') return 'high';
    if (current === 'medium' || next === 'medium') return 'medium';
    return 'low';
}

function normalizeEvent(log: { metadata: unknown; createdAt: Date }): IntegrityInsight['timeline'][number] {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const type = toEventType(metadata.type);
    const severity = toSeverity(metadata.severity);
    const message =
        (metadata.message as string | undefined) ||
        defaultMessageByType[type] ||
        'Integrity event detected.';
    const timestamp = (metadata.timestamp as string | undefined) || log.createdAt.toISOString();
    return { type, severity, message, timestamp };
}

function buildTopSignals(
    timeline: IntegrityInsight['timeline']
): IntegritySignalSummary[] {
    const signalMap = new Map<IntegrityEventType, { count: number; severity: 'low' | 'medium' | 'high' }>();
    for (const event of timeline) {
        const current = signalMap.get(event.type);
        if (!current) {
            signalMap.set(event.type, { count: 1, severity: event.severity });
            continue;
        }
        signalMap.set(event.type, {
            count: current.count + 1,
            severity: mergeSeverity(current.severity, event.severity),
        });
    }

    return Array.from(signalMap.entries())
        .map(([type, value]) => ({
            type,
            count: value.count,
            severity: value.severity,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

function buildIntegrityInsight(
    interviewId: string,
    timeline: IntegrityInsight['timeline']
): IntegrityInsight {
    const sortedTimeline = [...timeline]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalPenalty = sortedTimeline.reduce((sum, event) => sum + penaltyBySeverity[event.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));
    const level: IntegrityInsight['level'] = score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high';
    const topSignals = buildTopSignals(sortedTimeline);

    return {
        interviewId,
        score,
        level,
        eventCount: sortedTimeline.length,
        topSignals,
        timeline: sortedTimeline.slice(0, 20),
        recommendation: getRecommendation(score),
    };
}

function buildOverviewRecommendations(snapshot: IntegrityOverviewSnapshot): string[] {
    const recommendations: string[] = [];

    if (snapshot.summary.highRisk > 0) {
        recommendations.push('Review all high-risk sessions before final offer decisions.');
    }
    if (snapshot.summary.highRiskRate >= 0.25) {
        recommendations.push('High-risk ratio is elevated. Enable stricter anti-cheat settings and secondary verification.');
    }
    if (snapshot.summary.totalEvents / Math.max(snapshot.summary.monitoredInterviews, 1) > 4) {
        recommendations.push('Signal density is high. Audit interview instructions and candidate device guidance.');
    }
    if (snapshot.summary.monitoredInterviews > 0 && snapshot.summary.interviewsWithSignals === 0) {
        recommendations.push('No integrity alerts detected. Keep current controls and run weekly spot checks.');
    }
    if (recommendations.length === 0) {
        recommendations.push('Integrity posture is stable. Continue monitoring and periodic calibration.');
    }

    return recommendations;
}

function emptyOverview(windowDays: number): IntegrityOverviewSnapshot {
    return {
        generatedAt: new Date().toISOString(),
        windowDays,
        summary: {
            monitoredInterviews: 0,
            interviewsWithSignals: 0,
            averageScore: 100,
            totalEvents: 0,
            highRisk: 0,
            mediumRisk: 0,
            lowRisk: 0,
            highRiskRate: 0,
        },
        topSignals: [],
        recommendations: ['No monitored interviews found in the selected window.'],
        interviews: [],
    };
}

export async function integrityRoutes(app: FastifyInstance) {
    // Candidate-side event ingestion
    app.post('/api/public/interview/:token/integrity-events', async (request, reply) => {
        const { token } = request.params as { token: string };
        const identity = buildPublicIdentity({
            request,
            token,
            suffix: 'integrity',
        });
        const quota = consumePublicQuota({
            identity,
            rule: PUBLIC_INTEGRITY_RATE_RULE,
        });
        if (!quota.allowed) {
            return reply
                .code(429)
                .header('Retry-After', String(quota.retryAfterSec))
                .send({
                    error: 'Too many integrity event uploads. Please retry shortly.',
                    code: 'RATE_LIMITED',
                    retryAfterSec: quota.retryAfterSec,
                });
        }

        const payload = eventSchema.parse(request.body);

        const interview = await prisma.interview.findUnique({
            where: { token },
            include: { job: { select: { companyId: true } } },
        });

        if (!interview) {
            return reply.status(404).send({ error: 'Interview not found' });
        }

        const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

        await createChainedInterviewAuditLog({
            prisma,
            companyId: interview.job.companyId,
            interviewId: interview.id,
            action: 'integrity.event',
            metadata: {
                type: payload.type,
                severity: payload.severity,
                message: payload.message || defaultMessageByType[payload.type],
                timestamp: timestamp.toISOString(),
                source: 'candidate-client',
                ...(payload.metadata || {}),
            },
        });

        // Push to monitors if they are observing this room
        SocketManager.getInstance().sendToMonitors(interview.id, {
            type: 'integrity_event',
            event: {
                type: payload.type,
                severity: payload.severity,
                message: payload.message || defaultMessageByType[payload.type],
                timestamp: timestamp.toISOString(),
            },
        });

        // Phase 7.1: Automated Alert Interventions
        if (payload.severity === 'high') {
            const companyPolicy = await getCompanyMonitorPolicy(interview.job.companyId);
            if (companyPolicy.policy.autoWarningEnabled) {
                SocketManager.getInstance().sendToCandidate(interview.id, {
                    type: 'intervention_warning',
                    event: {
                        type: payload.type,
                        severity: payload.severity,
                        message: payload.message || defaultMessageByType[payload.type],
                        timestamp: timestamp.toISOString(),
                    }
                });
            }
        }

        return success({ accepted: true });
    });

    // Company-side explainable integrity score
    app.get('/api/interviews/:id/integrity', async (request, reply) => {
        const user = await authenticate(request);
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

        const logs = await prisma.auditLog.findMany({
            where: {
                companyId: user.companyId,
                action: 'integrity.event',
                targetType: 'interview',
                targetId: id,
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        const timeline = logs.map((log) => normalizeEvent(log));
        const result: IntegrityInsight = buildIntegrityInsight(id, timeline);

        return success(result);
    });

    // Company-side integrity command center (blue-ocean differentiator)
    app.get('/api/integrity/overview', async (request, reply) => {
        const user = await authenticate(request);
        const parsedQuery = overviewQuerySchema.safeParse(request.query || {});
        if (!parsedQuery.success) {
            return reply.status(400).send({ error: parsedQuery.error.flatten() });
        }
        const query = parsedQuery.data;
        const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

        const interviews = await prisma.interview.findMany({
            where: {
                job: { companyId: user.companyId },
                startTime: { gte: since.toISOString() },
            },
            include: {
                candidate: { select: { name: true } },
                job: { select: { title: true } },
            },
            orderBy: { startTime: 'desc' },
            take: query.limit,
        });

        if (interviews.length === 0) {
            return success(emptyOverview(query.days));
        }

        const interviewIds = interviews.map((item) => item.id);
        const logs = await prisma.auditLog.findMany({
            where: {
                companyId: user.companyId,
                action: 'integrity.event',
                targetType: 'interview',
                targetId: { in: interviewIds },
                createdAt: { gte: since },
            },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });

        const timelineByInterview = new Map<string, IntegrityInsight['timeline']>();
        for (const log of logs) {
            if (!log.targetId) continue;
            const timeline = timelineByInterview.get(log.targetId) || [];
            timeline.push(normalizeEvent(log));
            timelineByInterview.set(log.targetId, timeline);
        }

        let records: IntegrityOverviewInterview[] = interviews.map((item) => {
            const insight = buildIntegrityInsight(item.id, timelineByInterview.get(item.id) || []);
            return {
                interviewId: item.id,
                candidateName: item.candidate.name,
                jobTitle: item.job.title,
                startTime: item.startTime.toISOString(),
                status: item.status,
                score: insight.score,
                level: insight.level,
                eventCount: insight.eventCount,
                topSignals: insight.topSignals,
                recentEvents: insight.timeline.slice(0, 3),
                recommendation: insight.recommendation,
            };
        });

        if (query.search) {
            const keyword = query.search.toLowerCase();
            records = records.filter((item) => {
                return item.candidateName.toLowerCase().includes(keyword) || item.jobTitle.toLowerCase().includes(keyword);
            });
        }

        if (query.level !== 'all') {
            records = records.filter((item) => item.level === query.level);
        }

        records.sort((a, b) => {
            const levelRank = { high: 0, medium: 1, low: 2 };
            const byLevel = levelRank[a.level] - levelRank[b.level];
            if (byLevel !== 0) return byLevel;
            return a.score - b.score;
        });

        if (records.length === 0) {
            return success(emptyOverview(query.days));
        }

        const scoreTotal = records.reduce((sum, item) => sum + item.score, 0);
        const highRisk = records.filter((item) => item.level === 'high').length;
        const mediumRisk = records.filter((item) => item.level === 'medium').length;
        const lowRisk = records.filter((item) => item.level === 'low').length;
        const totalEvents = records.reduce((sum, item) => sum + item.eventCount, 0);

        const signalMap = new Map<IntegrityEventType, { count: number; severity: 'low' | 'medium' | 'high' }>();
        const includedIds = new Set(records.map((item) => item.interviewId));
        for (const [interviewId, timeline] of timelineByInterview.entries()) {
            if (!includedIds.has(interviewId)) continue;
            for (const event of timeline) {
                const current = signalMap.get(event.type);
                if (!current) {
                    signalMap.set(event.type, { count: 1, severity: event.severity });
                    continue;
                }
                signalMap.set(event.type, {
                    count: current.count + 1,
                    severity: mergeSeverity(current.severity, event.severity),
                });
            }
        }

        const topSignals = Array.from(signalMap.entries())
            .map(([type, value]) => ({ type, count: value.count, severity: value.severity }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const snapshot: IntegrityOverviewSnapshot = {
            generatedAt: new Date().toISOString(),
            windowDays: query.days,
            summary: {
                monitoredInterviews: records.length,
                interviewsWithSignals: records.filter((item) => item.eventCount > 0).length,
                averageScore: Number((scoreTotal / records.length).toFixed(1)),
                totalEvents,
                highRisk,
                mediumRisk,
                lowRisk,
                highRiskRate: Number((highRisk / records.length).toFixed(3)),
            },
            topSignals,
            recommendations: [],
            interviews: records,
        };

        snapshot.recommendations = buildOverviewRecommendations(snapshot);
        return success(snapshot);
    });
}
