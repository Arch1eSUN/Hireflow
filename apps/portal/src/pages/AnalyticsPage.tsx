// HireFlow AI — 数据分析页 (Real API)
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, TrendingUp, Users, Briefcase, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';

const COLORS = ['#1A73E8', '#7B1FA2', '#1E8E3E', '#E37400', '#D93025'];

const sourceData = [
    { name: 'Boss直聘', value: 35 },
    { name: '内推', value: 28 },
    { name: '猎聘', value: 18 },
    { name: 'LinkedIn', value: 12 },
    { name: '其他', value: 7 },
];

const AnalyticsPage: React.FC = () => {
    const { t } = useI18n();

    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: async () => {
            const res = await api.get('/analytics/overview');
            return res.data.data;
        },
    });

    if (isLoading) {
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

    if (error) {
        return (
            <div className="space-y-5">
                <h1 className="text-headline-large">{t('analytics.title')}</h1>
                <div className="text-center py-16" style={{ color: 'var(--color-error)' }}>
                    加载分析数据失败，请刷新重试
                </div>
            </div>
        );
    }

    const funnel = analytics?.funnel || [];
    const dailyMetrics = analytics?.dailyMetrics || [];
    const aiCost = analytics?.aiCost || { tokensUsed: 0, estimatedCost: 0 };

    const kpis = [
        { label: '总候选人', value: analytics?.totalCandidates || 0, icon: Users, color: 'var(--color-primary)' },
        { label: '活跃岗位', value: analytics?.activeJobs || 0, icon: Briefcase, color: '#1E8E3E' },
        { label: '本周面试', value: analytics?.interviewsThisWeek || 0, icon: Clock, color: '#E37400' },
        { label: '录用率', value: analytics?.hireRate || '0%', icon: TrendingUp, color: '#7B1FA2' },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('analytics.title')}</h1>
                <button className="btn btn-outlined">
                    <Download size={16} />
                    {t('analytics.export')}
                </button>
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
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={sourceData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={(({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`) as any}>
                                {sourceData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* Daily Metrics Trend */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-headline-medium mb-4">每日趋势</h3>
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
                        <Line type="monotone" dataKey="applications" stroke="#1A73E8" strokeWidth={2} name="投递" dot={{ fill: '#1A73E8', r: 3 }} />
                        <Line type="monotone" dataKey="interviews" stroke="#1E8E3E" strokeWidth={2} name="面试" dot={{ fill: '#1E8E3E', r: 3 }} />
                        <Line type="monotone" dataKey="offers" stroke="#E37400" strokeWidth={2} name="Offer" dot={{ fill: '#E37400', r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>

            {/* AI Usage Card */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h3 className="text-headline-medium mb-4">AI 使用概览</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>Token 使用量</p>
                        <p className="text-display-medium mt-1">{(aiCost.tokensUsed / 1000).toFixed(1)}K</p>
                    </div>
                    <div>
                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>预估费用</p>
                        <p className="text-display-medium mt-1">${aiCost.estimatedCost?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                        <p className="text-label-small mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>模型分布</p>
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
