import React from 'react';
import {
    Users, Briefcase, Video, TrendingUp, AlertTriangle, CheckCircle2,
    Activity, DollarSign, Clock, ArrowUpRight
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/react';
import { formatNumber, formatCurrency } from '@hireflow/utils/src/index';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useNavigate } from 'react-router-dom';

// Types
interface DashboardData {
    totalCandidates: number;
    activeJobs: number;
    interviewsThisWeek: number;
    hireRate: string;
    funnel: { name: string; count: number }[];
    dailyMetrics: { date: string; applications: number; interviews: number; offers: number }[];
    todaySchedule: Array<{
        interviewId: string;
        startTime: string;
        time: string;
        candidate: string;
        token?: string;
        status: string;
        type: string;
        jobTitle: string;
    }>;
    aiCost: {
        tokensUsed: number;
        estimatedCost: number;
        models: { model: string; percentage: number }[];
    };
    systemHealth?: {
        failedInterviewsThisWeek?: number;
    };
    meta?: {
        fetchLatencyMs?: number;
    };
}

const Dashboard: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // Data Fetching
    const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
        queryKey: ['dashboard', 'overview'],
        queryFn: async () => {
            const startedAt = performance.now();
            const res = await api.get<{ data: DashboardData }>('/analytics/overview');
            const data = res.data.data;
            return {
                ...data,
                meta: {
                    fetchLatencyMs: Math.round(performance.now() - startedAt),
                },
            };
        }
    });

    if (isLoading) return <div className="p-8 text-center text-[var(--color-text-secondary)]">{t('common.loading')}</div>;
    if (isError) {
        return (
            <ErrorState
                title={t('analytics.loadFailed')}
                message={t('error.network')}
                onRetry={() => {
                    void refetch();
                }}
            />
        );
    }

    const {
        totalCandidates = 0,
        activeJobs = 0,
        interviewsThisWeek = 0,
        hireRate = '0%',
        funnel = [],
        dailyMetrics = [],
        aiCost = { tokensUsed: 0, estimatedCost: 0, models: [] },
        todaySchedule = [],
        systemHealth = { failedInterviewsThisWeek: 0 },
        meta = {},
    } = data || {};

    const latestApplications = dailyMetrics[dailyMetrics.length - 1]?.applications || 0;
    const previousApplications = dailyMetrics[dailyMetrics.length - 2]?.applications || 0;
    const applicationsDelta = latestApplications - previousApplications;
    const applicationTrendLabel = applicationsDelta === 0
        ? t('dashboard.trend.stable')
        : `${applicationsDelta > 0 ? '+' : ''}${applicationsDelta}`;

    const nextInterview = todaySchedule.find((item) => item.status === 'upcoming' || item.status === 'active') || todaySchedule[0] || null;
    const failedInterviews = Number(systemHealth?.failedInterviewsThisWeek || 0);
    const measuredLatency = Number(meta?.fetchLatencyMs || 0);

    const kpis = [
        { label: t('dashboard.totalCandidates'), value: formatNumber(totalCandidates), icon: Users, trend: applicationTrendLabel, status: applicationsDelta >= 0 ? 'good' : 'warning' },
        { label: t('dashboard.activeJobs'), value: activeJobs.toString(), icon: Briefcase, trend: t('dashboard.trend.stable'), status: 'neutral' },
        { label: t('dashboard.interviewsThisWeek'), value: interviewsThisWeek.toString(), icon: Video, trend: `${todaySchedule.length} today`, status: 'good' },
        { label: t('dashboard.hireRate'), value: hireRate, icon: TrendingUp, trend: t('dashboard.trend.normal'), status: 'neutral' },
        { label: t('dashboard.aiCostSummary'), value: formatCurrency(aiCost.estimatedCost), icon: DollarSign, trend: t('dashboard.trend.normal'), status: 'neutral' },
    ];

    return (
        <div className="page-shell">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">{t('analytics.overview')}</h2>
                    <p className="page-subtitle">
                        {t('dashboard.greeting.afternoon')}，{user?.name || 'User'}
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outlined">{t('dashboard.period.7d')}</button>
                    <button className="btn btn-filled">{t('analytics.export')}</button>
                </div>
            </div>

            {/* KPI Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="card p-4 flex flex-col justify-between min-h-[108px] hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-label-small text-[var(--color-text-secondary)] uppercase tracking-wide">{kpi.label}</span>
                            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center">
                                <kpi.icon size={16} className="text-[var(--color-text-secondary)]" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                            <span className="text-display-medium leading-none tabular-nums text-[var(--color-text-primary)]">{kpi.value}</span>
                            <span className={`chip ${kpi.status === 'good' ? 'chip-success' : kpi.status === 'warning' ? 'chip-warning' : 'chip-neutral'}`}>
                                {kpi.trend}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Funnel & Trends */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Activity Trends */}
                    <div className="card-outlined bg-[var(--color-surface)]">
                        <div className="px-5 py-4 border-b border-[var(--color-outline)] flex items-center justify-between">
                            <h3 className="text-title-medium">{t('dashboard.section.recruitmentActivity')}</h3>
                        </div>
                        <div className="p-5 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline)" opacity={0.5} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <Area type="monotone" dataKey="applications" name={t('dashboard.legend.applications')} stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorApps)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="interviews" name={t('dashboard.legend.interviews')} stroke="var(--color-success)" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Funnel */}
                    <div className="card-outlined bg-[var(--color-surface)]">
                        <div className="px-5 py-4 border-b border-[var(--color-outline)]">
                            <h3 className="text-title-medium">{t('dashboard.section.pipelineConversion')}</h3>
                        </div>
                        <div className="p-5 h-[280px]">
                            {funnel.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={funnel} layout="vertical" barSize={24} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline)" opacity={0.5} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 13, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} contentStyle={{ borderRadius: 4 }} />
                                        <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--color-text-primary)', fontSize: 12 }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState title={t('dashboard.empty.pipeline')} subtitle={t('dashboard.empty.pipelineHint')} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Alerts & AI Status */}
                <div className="space-y-6">
                    {/* System Status / Risks */}
                    <div className="card-outlined bg-[var(--color-surface)]">
                        <div className="px-5 py-4 border-b border-[var(--color-outline)] flex items-center gap-2">
                            <Activity size={18} className="text-[var(--color-text-secondary)]" />
                            <h3 className="text-title-medium">{t('dashboard.section.systemHealth')}</h3>
                        </div>
                        <div className="p-0">
                            <div className="flex items-center justify-between p-4 border-b border-[var(--color-surface-dim)]">
                                <span className="text-[14px] flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                                    {t('dashboard.system.apiGateway')}
                                </span>
                                <span className="chip chip-success">{t('dashboard.system.operational')}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 border-b border-[var(--color-surface-dim)]">
                                <span className="text-[14px] flex items-center gap-2">
                                    <Clock size={16} className="text-[var(--color-warning)]" />
                                    {t('dashboard.system.avgLatency')}
                                </span>
                                <span className="text-[13px] tabular-nums font-medium">{measuredLatency > 0 ? `${measuredLatency}ms` : '--'}</span>
                            </div>
                            <div className={`flex items-center justify-between p-4 ${failedInterviews > 0 ? 'bg-[var(--color-error-bg)]' : 'bg-[var(--color-success-bg)]'}`}>
                                <span className={`text-[14px] flex items-center gap-2 ${failedInterviews > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`}>
                                    <AlertTriangle size={16} />
                                    {t('dashboard.system.failedInterviews')}
                                </span>
                                <span className={`font-bold ${failedInterviews > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`}>
                                    {failedInterviews}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* AI Cost Breakdown */}
                    <div className="card-outlined bg-[var(--color-surface)]">
                        <div className="px-5 py-4 border-b border-[var(--color-outline)]">
                            <h3 className="text-title-medium">{t('dashboard.section.aiUsage')}</h3>
                        </div>
                        <div className="p-5">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <p className="text-[12px] text-[var(--color-text-secondary)]">{t('dashboard.section.tokens')}</p>
                                    <p className="text-[20px] font-medium tabular-nums">{formatNumber(aiCost.tokensUsed)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[12px] text-[var(--color-text-secondary)]">{t('dashboard.section.cost')}</p>
                                    <p className="text-[20px] font-medium tabular-nums">{formatCurrency(aiCost.estimatedCost)}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {aiCost.models.map((m) => (
                                    <div key={m.model}>
                                        <div className="flex justify-between text-[12px] mb-1">
                                            <span>{m.model}</span>
                                            <span className="text-[var(--color-text-secondary)]">{m.percentage}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--color-surface-dim)] rounded-full overflow-hidden">
                                            <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${m.percentage}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions (Banner) */}
                    <div className="surface-tonal p-4">
                        <h4 className="text-label-large text-[var(--color-info)] mb-1">{t('dashboard.section.upcomingInterview')}</h4>
                        <p className="text-body-medium text-[var(--color-text-secondary)] mb-3">
                            {nextInterview ? `${nextInterview.jobTitle} / ${nextInterview.candidate}` : t('common.noData')}
                        </p>
                        <button
                            className="btn btn-outlined w-full justify-between"
                            onClick={() => {
                                if (!nextInterview) return;
                                if (nextInterview.status === 'active' && nextInterview.interviewId) {
                                    navigate(`/interviews/${nextInterview.interviewId}/monitor`);
                                    return;
                                }
                                navigate('/interviews');
                            }}
                        >
                            {t('dashboard.section.joinRoom')} <ArrowUpRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
