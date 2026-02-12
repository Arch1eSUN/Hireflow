// ================================================
// HireFlow AI — 仪表盘 (Dashboard)
// Google M3 设计风格 · KPI · 漏斗 · 趋势 · 日程
// ================================================

import React from 'react';
import { motion } from 'framer-motion';
import {
    Users, Briefcase, Video, TrendingUp, Calendar,
    ArrowUpRight, DollarSign, Zap, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useI18n } from '@hireflow/i18n/src/react';
import { getGreeting, formatNumber, formatCurrency } from '@hireflow/utils/src/index';
import {
    MOCK_CANDIDATES, MOCK_FUNNEL, MOCK_DAILY_METRICS,
    MOCK_TODAY_SCHEDULE, MOCK_AI_COST, MOCK_JOBS,
} from '@/data/mockData';

// 动画配置
const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.06, duration: 0.35, ease: [0.2, 0, 0, 1] },
    }),
};

const Dashboard: React.FC = () => {
    const { t, locale } = useI18n();
    const greeting = getGreeting(locale);

    // KPI
    const kpis = [
        { label: t('dashboard.totalCandidates'), value: MOCK_CANDIDATES.length.toString(), change: 12.3, icon: Users, color: 'blue' as const },
        { label: t('dashboard.activeJobs'), value: MOCK_JOBS.filter((j) => j.status === 'active').length.toString(), change: 0, icon: Briefcase, color: 'green' as const },
        { label: t('dashboard.interviewsThisWeek'), value: '18', change: 5.2, icon: Video, color: 'purple' as const },
        { label: t('dashboard.hireRate'), value: '72.9%', change: -2.1, icon: TrendingUp, color: 'orange' as const },
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
                    {greeting}，张通 👋
                </h1>
                <p className="text-body-large mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('dashboard.interviewsToday', { count: MOCK_TODAY_SCHEDULE.length })}
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
                                {kpi.change !== 0 && (
                                    <p className={`kpi-change ${kpi.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {kpi.change > 0 ? '↑' : '↓'} {Math.abs(kpi.change).toFixed(1)}%
                                        <span className="ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            {t('dashboard.period.7d')}
                                        </span>
                                    </p>
                                )}
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
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={MOCK_FUNNEL} layout="vertical" barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 13, fill: 'var(--color-on-surface-variant)' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--color-surface)',
                                    border: '1px solid var(--color-outline)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 13,
                                }}
                                formatter={(value: number, name: string) => [
                                    `${value} 人`,
                                    '数量',
                                ]}
                            />
                            <Bar
                                dataKey="count"
                                fill="var(--color-primary)"
                                radius={[0, 6, 6, 0]}
                                barSize={24}
                            />
                        </BarChart>
                    </ResponsiveContainer>
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
                    <div className="space-y-3">
                        {MOCK_TODAY_SCHEDULE.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg hover:cursor-pointer"
                                style={{
                                    backgroundColor: 'var(--color-surface-dim)',
                                    transition: 'background var(--duration-micro) var(--ease-standard)',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-variant)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-dim)')}
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
                        <div className="flex gap-4 text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1A73E8' }} />
                                投递
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#7B1FA2' }} />
                                面试
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1E8E3E' }} />
                                Offer
                            </span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={MOCK_DAILY_METRICS}>
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
                            <Area type="monotone" dataKey="offers" name="Offer" stroke="#1E8E3E" strokeWidth={2} fillOpacity={0} />
                        </AreaChart>
                    </ResponsiveContainer>
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
                            <span className="text-title-medium">{formatNumber(MOCK_AI_COST.tokensUsed)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {t('dashboard.estimatedCost')}
                            </span>
                            <span className="text-title-medium">{formatCurrency(MOCK_AI_COST.estimatedCost)}</span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {MOCK_AI_COST.models.map((m) => (
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
                    </div>
                </motion.div>
            </div>

            {/* ======= 最近候选人 ======= */}
            <motion.div
                className="card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-headline-medium">{t('dashboard.recentCandidates')}</h2>
                    <button className="btn btn-text text-sm">
                        {t('common.viewAll')} <ChevronRight size={16} />
                    </button>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('common.name')}</th>
                                <th>申请岗位</th>
                                <th>{t('common.status')}</th>
                                <th>匹配分</th>
                                <th>技能</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_CANDIDATES.slice(0, 5).map((c) => {
                                const job = MOCK_JOBS.find((j) => j.id === c.jobId);
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                                                    style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}
                                                >
                                                    {c.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-label-large">{c.name}</p>
                                                    <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                                        {c.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-body-medium">{job?.title || '-'}</td>
                                        <td>
                                            <span className={`chip chip-${c.stage === 'offer' || c.stage === 'hired' ? 'success' :
                                                    c.stage === 'rejected' ? 'error' :
                                                        c.stage === 'applied' ? 'neutral' : 'primary'
                                                }`}>
                                                {t(`stage.${c.stage}`)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`font-medium ${c.score >= 90 ? 'text-green-600' :
                                                    c.score >= 75 ? 'text-blue-600' :
                                                        c.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {c.score}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {c.skills.slice(0, 3).map((s) => (
                                                    <span key={s} className="chip chip-neutral text-xs" style={{ height: 24, padding: '0 8px', fontSize: 12 }}>
                                                        {s}
                                                    </span>
                                                ))}
                                                {c.skills.length > 3 && (
                                                    <span className="text-label-small" style={{ color: 'var(--color-on-surface-variant)', lineHeight: '24px' }}>
                                                        +{c.skills.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
