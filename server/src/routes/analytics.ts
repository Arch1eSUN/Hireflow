import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success } from '../utils/response';
import type { Candidate } from '@prisma/client';

type GuardrailCandidate = Pick<Candidate, 'id' | 'name' | 'stage' | 'score' | 'source' | 'appliedDate'>;

type GuardrailRiskLevel = 'low' | 'medium' | 'high';

interface SourceBreakdownRow {
    source: string;
    total: number;
    hired: number;
    rejected: number;
    inProcess: number;
    avgScore: number | null;
    passRate: number;
}

interface GuardrailFlag {
    id: string;
    name: string;
    stage: string;
    score: number | null;
    source: string;
    reason: string;
}

interface GuardrailSnapshot {
    generatedAt: string;
    riskLevel: GuardrailRiskLevel;
    summary: {
        totalCandidates: number;
        scoredCandidates: number;
        highScoreRejected: number;
        lowScoreHired: number;
        stalledHighPotential: number;
        sourceDisparityIndex: number;
    };
    sourceBreakdown: SourceBreakdownRow[];
    flaggedCandidates: GuardrailFlag[];
    recommendations: string[];
}

type CountByDayRow = {
    day: Date | string;
    count: bigint | number | string;
};

type ModelCharsRow = {
    model: string;
    chars: bigint | number | string;
};

function toNumber(value: bigint | number | string | null | undefined): number {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function dayKey(input: Date | string): string {
    if (input instanceof Date) return input.toISOString().slice(0, 10);
    const value = String(input || '').trim();
    return value.slice(0, 10);
}

function buildLastDaysWindow(days: number): Date[] {
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    const result: Date[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(base);
        date.setDate(base.getDate() - offset);
        result.push(date);
    }
    return result;
}

function toWeekdayLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

async function buildDailyMetrics(companyId: string): Promise<Array<{
    date: string;
    applications: number;
    interviews: number;
    offers: number;
}>> {
    const days = buildLastDaysWindow(7);
    const since = days[0];

    const [applicationRows, interviewRows, offerRows] = await Promise.all([
        prisma.$queryRaw<CountByDayRow[]>`
            SELECT DATE("appliedDate") AS day, COUNT(*)::bigint AS count
            FROM "Candidate"
            WHERE "companyId" = ${companyId}
              AND "appliedDate" >= ${since}
            GROUP BY DATE("appliedDate")
        `,
        prisma.$queryRaw<CountByDayRow[]>`
            SELECT DATE(i."startTime") AS day, COUNT(*)::bigint AS count
            FROM "Interview" i
            JOIN "Job" j ON j.id = i."jobId"
            WHERE j."companyId" = ${companyId}
              AND i."startTime" >= ${since}
            GROUP BY DATE(i."startTime")
        `,
        prisma.$queryRaw<CountByDayRow[]>`
            SELECT DATE("updatedAt") AS day, COUNT(*)::bigint AS count
            FROM "Candidate"
            WHERE "companyId" = ${companyId}
              AND "stage" IN ('offer', 'hired')
              AND "updatedAt" >= ${since}
            GROUP BY DATE("updatedAt")
        `,
    ]);

    const applicationsMap = new Map(applicationRows.map((row) => [dayKey(row.day), toNumber(row.count)]));
    const interviewsMap = new Map(interviewRows.map((row) => [dayKey(row.day), toNumber(row.count)]));
    const offersMap = new Map(offerRows.map((row) => [dayKey(row.day), toNumber(row.count)]));

    return days.map((date) => {
        const key = dayKey(date);
        return {
            date: toWeekdayLabel(date),
            applications: applicationsMap.get(key) || 0,
            interviews: interviewsMap.get(key) || 0,
            offers: offersMap.get(key) || 0,
        };
    });
}

function normalizeModelId(rawModel: string): string {
    const model = String(rawModel || '').trim();
    return model.length > 0 ? model : 'unknown';
}

function estimateCostPer1kTokens(modelId: string): number {
    const model = modelId.toLowerCase();
    if (model.startsWith('gpt-4o')) return 0.01;
    if (model.startsWith('gpt-4o-mini')) return 0.001;
    if (model.startsWith('codex')) return 0.003;
    if (model.startsWith('gemini-2.5-pro')) return 0.003;
    if (model.startsWith('gemini-2.5-flash')) return 0.0007;
    if (model.startsWith('claude-opus')) return 0.02;
    if (model.startsWith('claude-sonnet')) return 0.004;
    if (model.startsWith('deepseek')) return 0.0012;
    if (model.startsWith('qwen')) return 0.001;
    return 0.0015;
}

async function buildAiCostOverview(companyId: string): Promise<{
    tokensUsed: number;
    estimatedCost: number;
    models: Array<{ model: string; percentage: number }>;
}> {
    const [modelCounts, charsByModel] = await Promise.all([
        prisma.interview.groupBy({
            by: ['aiModel'],
            where: { job: { companyId } },
            _count: { _all: true },
        }),
        prisma.$queryRaw<ModelCharsRow[]>`
            SELECT COALESCE(i."aiModel", 'unknown') AS model,
                   COALESCE(SUM(LENGTH(m."content")), 0)::bigint AS chars
            FROM "InterviewMessage" m
            JOIN "Interview" i ON i.id = m."interviewId"
            JOIN "Job" j ON j.id = i."jobId"
            WHERE j."companyId" = ${companyId}
            GROUP BY COALESCE(i."aiModel", 'unknown')
        `,
    ]);

    const charsMap = new Map<string, number>();
    for (const row of charsByModel) {
        charsMap.set(normalizeModelId(row.model), toNumber(row.chars));
    }

    const modelStats = modelCounts
        .map((row) => {
            const model = normalizeModelId(row.aiModel || 'unknown');
            const interviewCount = toNumber(row._count?._all);
            const chars = charsMap.get(model) || 0;
            const estimatedTokens = Math.max(interviewCount * 1200, Math.round(chars / 1.8));
            const estimatedCost = (estimatedTokens / 1000) * estimateCostPer1kTokens(model);
            return {
                model,
                estimatedTokens,
                estimatedCost,
            };
        })
        .filter((row) => row.estimatedTokens > 0);

    if (modelStats.length === 0) {
        return {
            tokensUsed: 0,
            estimatedCost: 0,
            models: [],
        };
    }

    const totalTokens = modelStats.reduce((sum, item) => sum + item.estimatedTokens, 0);
    const totalCost = modelStats.reduce((sum, item) => sum + item.estimatedCost, 0);

    const models = modelStats
        .map((item) => ({
            model: item.model,
            percentage: totalTokens > 0 ? Math.round((item.estimatedTokens / totalTokens) * 100) : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);

    return {
        tokensUsed: totalTokens,
        estimatedCost: Math.round(totalCost * 100) / 100,
        models,
    };
}

function normalizeSource(source: string | null): string {
    const value = source?.trim();
    return value && value.length > 0 ? value : 'Unknown';
}

function average(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    const total = numbers.reduce((sum, value) => sum + value, 0);
    return Math.round((total / numbers.length) * 10) / 10;
}

function toPassRate(hired: number, rejected: number): number {
    const denominator = hired + rejected;
    if (denominator === 0) return 0;
    return Math.round((hired / denominator) * 1000) / 1000;
}

function calculateSourceBreakdown(candidates: GuardrailCandidate[]): SourceBreakdownRow[] {
    const rows = new Map<string, SourceBreakdownRow & { scores: number[] }>();
    for (const candidate of candidates) {
        const source = normalizeSource(candidate.source);
        const current = rows.get(source) || {
            source,
            total: 0,
            hired: 0,
            rejected: 0,
            inProcess: 0,
            avgScore: null,
            passRate: 0,
            scores: [],
        };

        current.total += 1;
        if (candidate.stage === 'hired') current.hired += 1;
        else if (candidate.stage === 'rejected') current.rejected += 1;
        else current.inProcess += 1;

        if (typeof candidate.score === 'number') current.scores.push(candidate.score);
        rows.set(source, current);
    }

    return Array.from(rows.values())
        .map((row) => ({
            source: row.source,
            total: row.total,
            hired: row.hired,
            rejected: row.rejected,
            inProcess: row.inProcess,
            avgScore: average(row.scores),
            passRate: toPassRate(row.hired, row.rejected),
        }))
        .sort((a, b) => b.total - a.total);
}

function calculateSourceDisparityIndex(sourceBreakdown: SourceBreakdownRow[]): number {
    const rates = sourceBreakdown
        .filter((row) => row.hired + row.rejected >= 3)
        .map((row) => row.passRate);
    if (rates.length <= 1) return 0;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    return Math.round((max - min) * 1000) / 1000;
}

function calculateGuardrailSnapshot(candidates: GuardrailCandidate[]): GuardrailSnapshot {
    const now = Date.now();
    const highScoreRejectedList = candidates.filter(
        (c) => c.stage === 'rejected' && typeof c.score === 'number' && c.score >= 85
    );
    const lowScoreHiredList = candidates.filter(
        (c) => c.stage === 'hired' && typeof c.score === 'number' && c.score < 60
    );
    const stalledHighPotentialList = candidates.filter((c) => {
        if (!(c.stage === 'screening' || c.stage === 'interview_1' || c.stage === 'interview_2')) return false;
        if (typeof c.score !== 'number' || c.score < 85) return false;
        const appliedTs = new Date(c.appliedDate).getTime();
        const ageDays = (now - appliedTs) / (1000 * 60 * 60 * 24);
        return ageDays >= 14;
    });

    const sourceBreakdown = calculateSourceBreakdown(candidates);
    const sourceDisparityIndex = calculateSourceDisparityIndex(sourceBreakdown);

    const flaggedCandidates: GuardrailFlag[] = [
        ...highScoreRejectedList.map((c) => ({
            id: c.id,
            name: c.name,
            stage: c.stage,
            score: c.score,
            source: normalizeSource(c.source),
            reason: 'High score candidate was rejected',
        })),
        ...lowScoreHiredList.map((c) => ({
            id: c.id,
            name: c.name,
            stage: c.stage,
            score: c.score,
            source: normalizeSource(c.source),
            reason: 'Low score candidate was hired',
        })),
        ...stalledHighPotentialList.map((c) => ({
            id: c.id,
            name: c.name,
            stage: c.stage,
            score: c.score,
            source: normalizeSource(c.source),
            reason: 'High potential candidate has stalled in pipeline',
        })),
    ].slice(0, 12);

    const recommendations: string[] = [];
    if (highScoreRejectedList.length > 0) {
        recommendations.push('Review rejection rationale for high-scoring candidates within 48 hours.');
    }
    if (lowScoreHiredList.length > 0) {
        recommendations.push('Audit interview notes for low-scoring hires and tighten offer criteria.');
    }
    if (stalledHighPotentialList.length > 0) {
        recommendations.push('Prioritize fast-track reviews for high-potential candidates stuck in screening.');
    }
    if (sourceDisparityIndex >= 0.25) {
        recommendations.push('Calibrate screening rubrics across candidate sources to reduce channel bias.');
    }
    if (recommendations.length === 0) {
        recommendations.push('Guardrails are healthy. Keep weekly calibration and spot checks in place.');
    }

    let riskLevel: GuardrailRiskLevel = 'low';
    if (
        highScoreRejectedList.length > 0 ||
        lowScoreHiredList.length > 1 ||
        sourceDisparityIndex >= 0.35
    ) {
        riskLevel = 'high';
    } else if (
        lowScoreHiredList.length > 0 ||
        stalledHighPotentialList.length > 0 ||
        sourceDisparityIndex >= 0.2
    ) {
        riskLevel = 'medium';
    }

    return {
        generatedAt: new Date().toISOString(),
        riskLevel,
        summary: {
            totalCandidates: candidates.length,
            scoredCandidates: candidates.filter((c) => typeof c.score === 'number').length,
            highScoreRejected: highScoreRejectedList.length,
            lowScoreHired: lowScoreHiredList.length,
            stalledHighPotential: stalledHighPotentialList.length,
            sourceDisparityIndex,
        },
        sourceBreakdown,
        flaggedCandidates,
        recommendations,
    };
}

export async function analyticsRoutes(app: FastifyInstance) {
    app.get('/api/analytics/overview', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const companyId = user.companyId;

            // Date ranges
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const weekDay = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - weekDay);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            // Parallel queries for dashboard stats
            const [
                totalCandidates,
                activeJobs,
                interviewsThisWeek,
                failedInterviewsThisWeek,
                todaySchedule,
                candidateStages,
            ] = await prisma.$transaction([
                // 1. Total Candidates
                prisma.candidate.count({ where: { companyId } }),

                // 2. Active Jobs
                prisma.job.count({ where: { companyId, status: 'active' } }),

                // 3. Interviews This Week (Upcoming or Completed)
                prisma.interview.count({
                    where: {
                        job: { companyId },
                        startTime: {
                            gte: startOfWeek.toISOString(),
                            lt: endOfWeek.toISOString()
                        }
                    }
                }),

                prisma.interview.count({
                    where: {
                        status: 'cancelled',
                        job: { companyId },
                        startTime: {
                            gte: startOfWeek.toISOString(),
                            lt: endOfWeek.toISOString(),
                        },
                    },
                }),

                // 4. Today's Interviews (for Schedule)
                prisma.interview.findMany({
                    where: {
                        job: { companyId },
                        startTime: {
                            gte: startOfDay.toISOString(),
                            lt: endOfDay.toISOString()
                        }
                    },
                    include: {
                        candidate: { select: { name: true } },
                        job: { select: { title: true } }
                    },
                    orderBy: { startTime: 'asc' }
                }),

                // 5. Funnel Stats (Group by Stage)
                prisma.candidate.groupBy({
                    by: ['stage'],
                    where: { companyId },
                    _count: { stage: true },
                    orderBy: { stage: 'asc' } // Satisfy lint requirement
                }),
            ]);

            const [computedDailyMetrics, computedAiCost] = await Promise.all([
                buildDailyMetrics(companyId),
                buildAiCostOverview(companyId),
            ]);

            // Process Funnel Data
            const funnelMap: Record<string, number> = {};
            candidateStages.forEach(s => {
                if (s._count) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    funnelMap[s.stage] = (s._count as any).stage || 0;
                }
            });

            const funnel = [
                { name: 'Applied', count: funnelMap['applied'] || 0 },
                { name: 'Screening', count: funnelMap['screening'] || 0 },
                { name: 'Interview', count: (funnelMap['interview_1'] || 0) + (funnelMap['interview_2'] || 0) },
                { name: 'Offer', count: funnelMap['offer'] || 0 },
                { name: 'Hired', count: funnelMap['hired'] || 0 },
            ];

            // Calculate Hire Rate (Hired / Total * 100) - Simplified
            const hireRate = totalCandidates > 0
                ? ((funnelMap['hired'] || 0) / totalCandidates * 100).toFixed(1) + '%'
                : '0%';

            // Transform Schedule for Frontend
            const formattedSchedule = todaySchedule.map(iv => ({
                interviewId: iv.id,
                time: new Date(iv.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                startTime: iv.startTime.toISOString(),
                candidate: iv.candidate.name,
                status: iv.status,
                token: iv.token,
                type: iv.type,
                jobTitle: iv.job.title
            }));

            return success({
                totalCandidates,
                activeJobs,
                interviewsThisWeek,
                hireRate,
                funnel,
                dailyMetrics: computedDailyMetrics,
                todaySchedule: formattedSchedule,
                aiCost: computedAiCost,
                systemHealth: {
                    failedInterviewsThisWeek,
                },
            });

        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    app.get('/api/analytics/quality-guardrails', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const candidates = await prisma.candidate.findMany({
                where: { companyId: user.companyId },
                select: {
                    id: true,
                    name: true,
                    stage: true,
                    score: true,
                    source: true,
                    appliedDate: true,
                },
            });

            const snapshot = calculateGuardrailSnapshot(candidates);
            return success(snapshot);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
