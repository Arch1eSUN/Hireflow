// ================================================
// HireFlow AI — 仪表盘 (Dashboard)
// Google M3 设计风格 · KPI · 漏斗 · 趋势 · 日程
// ================================================

import React from 'react';
import { motion, Variants } from 'framer-motion';
import {
    Users, Briefcase, Video, TrendingUp, Calendar,
    ChevronRight, Zap, BarChartHorizontal, Activity
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/src/react';
import { getGreeting, formatNumber, formatCurrency } from '@hireflow/utils/src/index';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

// 动画配置
const cardVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.06, duration: 0.35 },
    }),
};

// 仪表盘数据类型定义
interface FunnelItem {
    name: string;
    count: number;
}

interface DailyMetricItem {
    date: string;
    applications: number;
    interviews: number;
    offers: number;
}

interface ScheduleItem {
    time: string;
    candidate: string;
    type: string;
    jobTitle: string;
}

interface AICostModel {
    model: string;
    percentage: number;
}

interface DashboardData {
    totalCandidates: number;
    activeJobs: number;
    interviewsThisWeek: number;
    hireRate: string;
    funnel: FunnelItem[];
    dailyMetrics: DailyMetricItem[];
    todaySchedule: ScheduleItem[];
    aiCost: {
        tokensUsed: number;
        estimatedCost: number;
        models: AICostModel[];
    };
    recentCandidates?: any[];
}

const Dashboard: React.FC = () => {
    const { t, locale } = useI18n();
    const { user } = useAuthStore();
    const greeting = getGreeting(locale);

    // Fetch Dashboard Data
    const { data, isLoading, error } = useQuery<DashboardData>({
        queryKey: ['dashboard', 'overview'],
        queryFn: async () => {
            const res = await api.get<{ data: DashboardData }>('/analytics/overview');
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                {/* Greeting skeleton */}
                <div>
                    <div className="skeleton skeleton-text--lg" style={{ width: '280px', marginBottom: 8 }} />
                    <div className="skeleton skeleton-text" style={{ width: '180px' }} />
                </div>

                {/* KPI cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card" style={{ padding: 20 }}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 12 }} />
                                    <div className="skeleton skeleton-text--lg" style={{ width: '40%' }} />
                                </div>
                                <div className="skeleton skeleton-circle" style={{ width: 40, height: 40, flexShrink: 0 }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 2: Funnel + Schedule skeleton */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="card xl:col-span-2" style={{ padding: 20 }}>
                        <div className="skeleton skeleton-text" style={{ width: '140px', marginBottom: 20 }} />
                        <div className="skeleton" style={{ width: '100%', height: 280, borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="card" style={{ padding: 20 }}>
                        <div className="skeleton skeleton-text" style={{ width: '100px', marginBottom: 20 }} />
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="skeleton" style={{ width: 4, height: 44, borderRadius: 4 }} />
                                    <div className="flex-1">
                                        <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: 6 }} />
                                        <div className="skeleton skeleton-text--sm" style={{ width: '50%' }} />
                                    </div>
                                    <div className="skeleton skeleton-text--sm" style={{ width: 40 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 3: Trends + AI Cost skeleton */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="card xl:col-span-2" style={{ padding: 20 }}>
                        <div className="skeleton skeleton-text" style={{ width: '120px', marginBottom: 20 }} />
                        <div className="skeleton" style={{ width: '100%', height: 260, borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="card" style={{ padding: 20 }}>
                        <div className="skeleton skeleton-text" style={{ width: '110px', marginBottom: 20 }} />
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i}>
                                    <div className="flex justify-between mb-2">
                                        <div className="skeleton skeleton-text--sm" style={{ width: '45%' }} />
                                        <div className="skeleton skeleton-text--sm" style={{ width: 30 }} />
                                    </div>
                                    <div className="skeleton" style={{ width: '100%', height: 8, borderRadius: 4 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-red-500">无法加载仪表盘数据: {(error as any).message}</div>;
    }

    const {
        totalCandidates = 0,
        activeJobs = 0,
        interviewsThisWeek = 0,
        hireRate = '0%',
        funnel = [],
        dailyMetrics = [],
        todaySchedule = [],
        aiCost = { tokensUsed: 0, estimatedCost: 0, models: [] }
    } = data || {};

    // KPI Config
    const kpis = [
        { label: t('dashboard.totalCandidates'), value: totalCandidates.toString(), change: 0, icon: Users, color: 'blue' as const },
        { label: t('dashboard.activeJobs'), value: activeJobs.toString(), change: 0, icon: Briefcase, color: 'green' as const },
        { label: t('dashboard.interviewsThisWeek'), value: interviewsThisWeek.toString(), change: 0, icon: Video, color: 'purple' as const },
        { label: t('dashboard.hireRate'), value: hireRate, change: 0, icon: TrendingUp, color: 'orange' as const },
    ];

    return (
        <div className="space-y-6">
            {/* ======= 问候 ======= */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-display-medium">
                    {greeting}，{user?.name || 'User'} 👋
                </h1>
                <p className="text-body-large mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('dashboard.interviewsToday', { count: todaySchedule.length })}
                </p>
            </motion.div>

            {/* ======= KPI 卡片 ======= */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={kpi.label}
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        className={`kpi-card ${kpi.color}`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="kpi-label">{kpi.label}</p>
                                <p className="kpi-value mt-1">{kpi.value}</p>
                                {/* Change indicator removed for now as we don't have historical data hooked up yet */}
                            </div>
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{
                                    backgroundColor: kpi.color === 'blue' ? 'var(--color-info-container)' :
                                        kpi.color === 'green' ? 'var(--color-success-container)' :
                                            kpi.color === 'purple' ? '#F3E8FD' :
                                                'var(--color-warning-container)',
                                }}
                            >
                                <kpi.icon size={20} style={{
                                    color: kpi.color === 'blue' ? 'var(--color-primary)' :
                                        kpi.color === 'green' ? 'var(--color-success)' :
                                            kpi.color === 'purple' ? '#7B1FA2' :
                                                'var(--color-warning)',
                                }} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ======= 第二行：漏斗 + 日程 ======= */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* 招聘漏斗（横向） */}
                <motion.div
                    className="card xl:col-span-2"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.35 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-headline-medium">{t('dashboard.pipeline')}</h2>
                        <button className="btn btn-text text-sm">
                            {t('common.viewAll')} <ChevronRight size={16} />
                        </button>
                    </div>
                    {funnel.length === 0 || funnel.every((f: any) => f.count === 0) ? (
                        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <EmptyState
                                icon={BarChartHorizontal}
                                title="暂无漏斗数据"
                                subtitle="添加候选人后将展示招聘漏斗"
                            />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={funnel} layout="vertical" barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 13, fill: 'var(--color-on-surface-variant)' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--color-surface)',
                                        border: '1px solid var(--color-outline)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 13,
                                    }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="var(--color-primary)"
                                    radius={[0, 6, 6, 0]}
                                    barSize={24}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>

                {/* 今日日程 */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.35 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-headline-medium">{t('dashboard.todaySchedule')}</h2>
                        <Calendar size={20} style={{ color: 'var(--color-on-surface-variant)' }} />
                    </div>
                    {todaySchedule.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">暂无今日面试</div>
                    ) : (
                        <div className="space-y-3">
                            {todaySchedule.map((item: any, i: number) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 rounded-lg hover:cursor-pointer"
                                    style={{
                                        backgroundColor: 'var(--color-surface-dim)',
                                        transition: 'background var(--duration-micro) var(--ease-standard)',
                                    }}
                                >
                                    <div
                                        className="w-1 self-stretch rounded-full"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-label-large">{item.candidate}</p>
                                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            {item.type} · {item.jobTitle}
                                        </p>
                                    </div>
                                    <span className="text-label-small shrink-0" style={{ color: 'var(--color-primary)' }}>
                                        {item.time}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* ======= 第三行：活动趋势 + AI 费用 ======= */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* 活动趋势图 */}
                <motion.div
                    className="card xl:col-span-2"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.35 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-headline-medium">{t('dashboard.activityTrends')}</h2>
                    </div>
                    {dailyMetrics.length === 0 ? (
                        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <EmptyState
                                icon={Activity}
                                title="暂无趋势数据"
                                subtitle="招聘活动积累后将展示活动趋势"
                            />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={dailyMetrics}>
                                <defs>
                                    <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7B1FA2" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#7B1FA2" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--color-surface)',
                                        border: '1px solid var(--color-outline)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 13,
                                    }}
                                />
                                <Area type="monotone" dataKey="applications" name="投递" stroke="#1A73E8" strokeWidth={2} fill="url(#colorApplications)" />
                                <Area type="monotone" dataKey="interviews" name="面试" stroke="#7B1FA2" strokeWidth={2} fill="url(#colorInterviews)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>

                {/* AI 费用概览 */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.35 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-headline-medium">{t('dashboard.aiCostSummary')}</h2>
                        <Zap size={20} style={{ color: 'var(--color-warning)' }} />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {t('dashboard.tokensUsed')}
                            </span>
                            <span className="text-title-medium">{formatNumber(aiCost.tokensUsed)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {t('dashboard.estimatedCost')}
                            </span>
                            <span className="text-title-medium">{formatCurrency(aiCost.estimatedCost)}</span>
                        </div>
                        {aiCost.models && aiCost.models.length > 0 ? (
                            <div className="mt-4 space-y-3">
                                {aiCost.models.map((m: any) => (
                                    <div key={m.model}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-label-small">{m.model}</span>
                                            <span className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                                {m.percentage}%
                                            </span>
                                        </div>
                                        <div
                                            className="h-2 rounded-full overflow-hidden"
                                            style={{ backgroundColor: 'var(--color-surface-variant)' }}
                                        >
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: 'var(--color-primary)' }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${m.percentage}%` }}
                                                transition={{ delay: 0.6, duration: 0.8, ease: [0.2, 0, 0, 1] }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-body-medium mt-4 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                                暂无 AI 使用数据
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Removed "Recent Candidates" table for brevity/redundancy, can refetch in CandidatesPage or add a widget later if needed */}
        </div>
    );
};

export default Dashboard;
