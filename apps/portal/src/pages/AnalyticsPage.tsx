// HireFlow AI — 数据分析页 (Real API)
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, TrendingUp, Users, Briefcase, Clock, ShieldAlert, TriangleAlert, CircleCheckBig } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/react';
import type { QualityGuardrailSnapshot } from '@hireflow/types';
import api from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

const COLORS = ['#1A73E8', '#1E8E3E', '#E37400', '#D93025', '#00ACC1'];

interface AnalyticsOverview {
    totalCandidates: number;
    activeJobs: number;
    interviewsThisWeek: number;
    hireRate: string;
    funnel: { name: string; count: number }[];
    dailyMetrics: { date: string; applications: number; interviews: number; offers: number }[];
    aiCost: {
        tokensUsed: number;
        estimatedCost: number;
        models: { model: string; percentage: number }[];
    };
}

const AnalyticsPage: React.FC = () => {
    const { t } = useI18n();

    const { data: analytics, isLoading, isError, refetch } = useQuery<AnalyticsOverview>({
        queryKey: ['analytics-overview'],
        queryFn: async () => {
            const res = await api.get<{ data: AnalyticsOverview }>('/analytics/overview');
            return res.data.data;
        },
    });

    const {
        data: guardrails,
        isLoading: isGuardrailLoading,
        isError: isGuardrailError,
        refetch: refetchGuardrails,
    } = useQuery<QualityGuardrailSnapshot>({
        queryKey: ['analytics-quality-guardrails'],
        queryFn: async () => {
            const res = await api.get<{ data: QualityGuardrailSnapshot }>('/analytics/quality-guardrails');
            return res.data.data;
        },
    });

    if (isLoading || isGuardrailLoading) {
        return (
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-headline-large">{t('analytics.title')}</h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="w-24 h-4 rounded bg-gray-200 mb-3" />
                            <div className="w-16 h-8 rounded bg-gray-200" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="card animate-pulse" style={{ height: 350 }}>
                            <div className="w-32 h-5 rounded bg-gray-200 mb-4" />
                            <div className="w-full h-64 rounded bg-gray-100" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError || isGuardrailError || !analytics || !guardrails) {
        return (
            <ErrorState
                title={t('analytics.loadFailed')}
                message={t('error.network')}
                onRetry={() => {
                    void refetch();
                    void refetchGuardrails();
                }}
            />
        );
    }

    const funnel = analytics.funnel || [];
    const dailyMetrics = analytics.dailyMetrics || [];
    const aiCost = analytics.aiCost || { tokensUsed: 0, estimatedCost: 0, models: [] };
    const sourceData = guardrails.sourceBreakdown.map((row) => ({
        name: row.source,
        value: row.total,
        passRate: row.passRate,
    }));
    const disparityPercent = (guardrails.summary.sourceDisparityIndex * 100).toFixed(1);

    const riskMeta =
        guardrails.riskLevel === 'high'
            ? {
                label: t('analytics.guardrails.risk.high'),
                className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]',
                icon: TriangleAlert,
            }
            : guardrails.riskLevel === 'medium'
                ? {
                    label: t('analytics.guardrails.risk.medium'),
                    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]',
                    icon: ShieldAlert,
                }
                : {
                    label: t('analytics.guardrails.risk.low'),
                    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]',
                    icon: CircleCheckBig,
                };

    const kpis = [
        { label: t('analytics.kpi.totalCandidates'), value: analytics.totalCandidates || 0, icon: Users, color: 'var(--color-primary)' },
        { label: t('analytics.kpi.activeJobs'), value: analytics.activeJobs || 0, icon: Briefcase, color: '#1E8E3E' },
        { label: t('analytics.kpi.interviewsThisWeek'), value: analytics.interviewsThisWeek || 0, icon: Clock, color: '#E37400' },
        { label: t('analytics.kpi.hireRate'), value: analytics.hireRate || '0%', icon: TrendingUp, color: '#0B57D0' },
    ];

    return (
        <div className="page-shell">
            <div className="page-header">
                <h1 className="page-title">{t('analytics.title')}</h1>
                <div className="page-actions">
                    <button className="btn btn-outlined">
                        <Download size={16} />
                        {t('analytics.export')}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={kpi.label}
                        className="card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${kpi.color}14` }}
                            >
                                <kpi.icon size={20} style={{ color: kpi.color }} />
                            </div>
                            <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{kpi.label}</p>
                        </div>
                        <p className="text-display-medium">{kpi.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Recruitment Funnel */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-headline-medium mb-4">{t('analytics.funnel')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={funnel}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '1px solid var(--color-outline-variant)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                }}
                            />
                            <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Source Analysis */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <h3 className="text-headline-medium mb-4">{t('analytics.sourceAnalysis')}</h3>
                    {sourceData.length === 0 ? (
                        <div className="h-[300px] flex items-center">
                            <EmptyState title={t('common.noData')} subtitle={t('analytics.sourceAnalysis')} />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={sourceData} cx="50%" cy="50%" outerRadius={96} dataKey="value" label={(({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`) as any}>
                                    {sourceData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [String(value ?? 0), t('common.total')]} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>
            </div>

            {/* Daily Metrics Trend */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-headline-medium mb-4">{t('analytics.dailyTrend')}</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--color-outline-variant)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            }}
                        />
                        <Line type="monotone" dataKey="applications" stroke="#1A73E8" strokeWidth={2} name={t('analytics.legend.applications')} dot={{ fill: '#1A73E8', r: 3 }} />
                        <Line type="monotone" dataKey="interviews" stroke="#1E8E3E" strokeWidth={2} name={t('analytics.legend.interviews')} dot={{ fill: '#1E8E3E', r: 3 }} />
                        <Line type="monotone" dataKey="offers" stroke="#E37400" strokeWidth={2} name={t('analytics.legend.offers')} dot={{ fill: '#E37400', r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Quality Guardrails */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-headline-medium">{t('analytics.guardrails.title')}</h3>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${riskMeta.className}`}>
                        <riskMeta.icon size={14} />
                        {riskMeta.label}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                        <p className="text-label-small text-[var(--color-text-secondary)]">{t('analytics.guardrails.metric.highScoreRejected')}</p>
                        <p className="text-title-large">{guardrails.summary.highScoreRejected}</p>
                    </div>
                    <div className="p-3 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                        <p className="text-label-small text-[var(--color-text-secondary)]">{t('analytics.guardrails.metric.lowScoreHired')}</p>
                        <p className="text-title-large">{guardrails.summary.lowScoreHired}</p>
                    </div>
                    <div className="p-3 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                        <p className="text-label-small text-[var(--color-text-secondary)]">{t('analytics.guardrails.metric.stalledHighPotential')}</p>
                        <p className="text-title-large">{guardrails.summary.stalledHighPotential}</p>
                    </div>
                    <div className="p-3 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                        <p className="text-label-small text-[var(--color-text-secondary)]">{t('analytics.guardrails.metric.sourceDisparity')}</p>
                        <p className="text-title-large">{disparityPercent}%</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-[12px] border border-[var(--color-outline)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                            <p className="text-label-large">{t('analytics.guardrails.flaggedCandidates')}</p>
                        </div>
                        {guardrails.flaggedCandidates.length === 0 ? (
                            <div className="p-4">
                                <EmptyState title={t('analytics.guardrails.cleanTitle')} subtitle={t('analytics.guardrails.cleanSubtitle')} />
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--color-outline)]">
                                {guardrails.flaggedCandidates.map((candidate) => (
                                    <div key={`${candidate.id}-${candidate.reason}`} className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-body-medium font-medium">{candidate.name}</p>
                                            <span className="text-label-small text-[var(--color-text-secondary)]">
                                                {t(`stage.${candidate.stage}`)} · {candidate.score ?? '-'}
                                            </span>
                                        </div>
                                        <p className="text-label-small text-[var(--color-text-secondary)] mt-1">
                                            {candidate.source} · {candidate.reason}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-[12px] border border-[var(--color-outline)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                            <p className="text-label-large">{t('analytics.guardrails.recommendations')}</p>
                        </div>
                        <div className="p-4 space-y-2">
                            {guardrails.recommendations.map((item) => (
                                <div key={item} className="flex gap-2 text-body-medium text-[var(--color-text-primary)]">
                                    <span className="text-[var(--color-primary)]">•</span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Usage Card */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h3 className="text-headline-medium mb-4">{t('analytics.section.aiUsageSummary')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{t('dashboard.tokensUsed')}</p>
                        <p className="text-display-medium mt-1">{(aiCost.tokensUsed / 1000).toFixed(1)}K</p>
                    </div>
                    <div>
                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{t('dashboard.estimatedCost')}</p>
                        <p className="text-display-medium mt-1">${aiCost.estimatedCost?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                        <p className="text-label-small mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>{t('analytics.section.modelDistribution')}</p>
                        <div className="space-y-2">
                            {(aiCost.models || []).map((m: any, i: number) => (
                                <div key={m.model} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-body-medium flex-1">{m.model}</span>
                                    <span className="text-label-large">{m.percentage}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AnalyticsPage;
