// HireFlow AI — 数据分析页
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import { MOCK_FUNNEL, MOCK_DAILY_METRICS } from '@/data/mockData';

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

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('analytics.title')}</h1>
                <button className="btn btn-outlined">
                    <Download size={16} />
                    {t('analytics.export')}
                </button>
            </div>

            {/* 效率指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: t('analytics.avgDuration'), value: '32 min', change: -5.2 },
                    { label: t('analytics.passRate'), value: '68%', change: 3.1 },
                    { label: t('analytics.cancelRate'), value: '8.2%', change: -1.4 },
                    { label: t('analytics.aiAccuracy'), value: '94.3%', change: 2.0 },
                ].map((m, i) => (
                    <motion.div
                        key={m.label}
                        className="card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                    >
                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{m.label}</p>
                        <p className="text-display-medium mt-1">{m.value}</p>
                        <p className={`text-label-small mt-1 ${m.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.change > 0 ? '↑' : '↓'} {Math.abs(m.change)}%
                        </p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* 招聘漏斗 */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-headline-medium mb-4">{t('analytics.funnel')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={MOCK_FUNNEL}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* 来源分析 */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <h3 className="text-headline-medium mb-4">{t('analytics.sourceAnalysis')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={sourceData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {sourceData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* AI 使用趋势 */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-headline-medium mb-4">{t('analytics.tokenTrend')}</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={MOCK_DAILY_METRICS.map((d) => ({ ...d, tokens: Math.floor(Math.random() * 30000 + 10000) }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="tokens" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: 'var(--color-primary)', r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>
        </div>
    );
};

export default AnalyticsPage;
