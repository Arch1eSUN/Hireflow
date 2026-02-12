// ================================================
// HireFlow AI - Dashboard Page
// Recruitment funnel, KPIs, candidate table, charts
// ================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, Activity, Users, FileCheck, Search, Filter,
    MoreHorizontal, TrendingUp, ArrowUpRight, ArrowDownRight,
    Calendar, Clock, Zap, Target,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell,
    AreaChart, Area, LineChart, Line,
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, getScoreColor, getStatusStyle, getInitials, getColorForString, timeAgo } from '@/lib/utils';
import { MOCK_CANDIDATES, MOCK_FUNNEL_DATA, MOCK_DAILY_METRICS, MOCK_NOTIFICATIONS } from '@/data/mockData';

const funnelChartData = MOCK_FUNNEL_DATA.map((stage, idx) => ({
    value: stage.count,
    name: stage.name,
    fill: [
        '#E0DAFD', '#C1B6FC', '#9F8EF8', '#7F67F4', '#6750A4', '#4a3878'
    ][idx] || '#6750A4',
}));

// Stagger animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0, 0, 1] } },
};

const Dashboard: React.FC = () => {
    const { isDark } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('7d');

    const filteredCandidates = MOCK_CANDIDATES.filter(
        (c) =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const kpis = [
        { label: 'Active Jobs', val: '12', change: '+3', positive: true, icon: Briefcase, color: 'text-blue-600', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', iconBg: isDark ? 'bg-blue-500/20' : 'bg-blue-100' },
        { label: 'Total Candidates', val: '1,245', change: '+89', positive: true, icon: Users, color: 'text-purple-600', bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50', iconBg: isDark ? 'bg-purple-500/20' : 'bg-purple-100' },
        { label: 'Avg Time-to-Hire', val: '18 Days', change: '-2d', positive: true, icon: Clock, color: 'text-green-600', bg: isDark ? 'bg-green-500/10' : 'bg-green-50', iconBg: isDark ? 'bg-green-500/20' : 'bg-green-100' },
        { label: 'AI Interviews', val: '86', change: '+12', positive: true, icon: Zap, color: 'text-orange-600', bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', iconBg: isDark ? 'bg-orange-500/20' : 'bg-orange-100' },
    ];

    return (
        <motion.div
            className="p-8 max-w-[1400px] mx-auto space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Page Header */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recruitment Overview</h1>
                    <p className={cn('mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        Welcome back, Talent Acquisition Team
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={cn('flex items-center rounded-xl p-1 text-sm', isDark ? 'bg-white/5' : 'bg-white border border-slate-200')}>
                        {['24h', '7d', '30d', '90d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg font-medium transition-all',
                                    timeRange === range
                                        ? isDark ? 'bg-primary-600/20 text-primary-300' : 'bg-primary-50 text-primary-700'
                                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <button className="m3-btn-filled">
                        + Post New Job
                    </button>
                </div>
            </motion.div>

            {/* KPI Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={i}
                        variants={itemVariants}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className={cn(
                            'rounded-2xl p-5 flex items-start justify-between transition-shadow cursor-pointer group',
                            isDark
                                ? 'bg-[#1C1B20] border border-white/5 hover:border-white/10'
                                : 'bg-white shadow-sm hover:shadow-md border border-slate-100'
                        )}
                    >
                        <div>
                            <p className={cn('text-sm font-medium mb-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                {kpi.label}
                            </p>
                            <h3 className="text-2xl font-bold">{kpi.val}</h3>
                            <div className="flex items-center gap-1 mt-2">
                                {kpi.positive ? (
                                    <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                    <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span className={cn('text-xs font-semibold', kpi.positive ? 'text-green-500' : 'text-red-500')}>
                                    {kpi.change}
                                </span>
                                <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>vs last week</span>
                            </div>
                        </div>
                        <div className={cn('p-3 rounded-xl', kpi.iconBg)}>
                            <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funnel Chart */}
                <motion.div
                    variants={itemVariants}
                    className={cn(
                        'lg:col-span-2 rounded-2xl p-6',
                        isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100'
                    )}
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-semibold text-lg">Conversion Funnel</h3>
                            <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>Candidate pipeline progression</p>
                        </div>
                        <select className={cn(
                            'rounded-xl px-3 py-1.5 text-sm font-medium border-none',
                            isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-600'
                        )}>
                            <option>All Jobs</option>
                            <option>Engineering</option>
                            <option>Product</option>
                        </select>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        background: isDark ? '#2B2930' : '#fff',
                                        color: isDark ? '#E6E1E5' : '#1C1B1F',
                                    }}
                                    formatter={(value: number) => [`${value.toLocaleString()} candidates`, '']}
                                />
                                <Funnel dataKey="value" data={funnelChartData} isAnimationActive>
                                    <LabelList position="right" fill={isDark ? '#E6E1E5' : '#1C1B1F'} stroke="none" dataKey="name" className="text-sm font-medium" />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Conversion rates */}
                    <div className={cn('flex gap-4 mt-4 pt-4 border-t flex-wrap', isDark ? 'border-white/5' : 'border-slate-100')}>
                        {MOCK_FUNNEL_DATA.slice(1).map((stage) => (
                            <div key={stage.name} className="flex items-center gap-2 text-xs">
                                <span className={cn('font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>{stage.name}:</span>
                                <span className="font-bold text-primary-600">{stage.conversionRate}%</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Pending Actions */}
                <motion.div
                    variants={itemVariants}
                    className={cn(
                        'rounded-2xl p-6',
                        isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100'
                    )}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg">Pending Actions</h3>
                        <span className={cn('text-xs px-2 py-1 rounded-full font-semibold', isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')}>
                            {MOCK_NOTIFICATIONS.filter(n => !n.read).length} new
                        </span>
                    </div>
                    <div className="space-y-3">
                        {MOCK_NOTIFICATIONS.slice(0, 4).map((notif, i) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                className={cn(
                                    'flex items-start gap-3 p-3 rounded-xl cursor-pointer group transition-colors',
                                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                                )}
                            >
                                <div className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                                    getColorForString(notif.title)
                                )}>
                                    {getInitials(notif.title)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm font-medium group-hover:text-primary-600 transition-colors', isDark ? '' : 'text-slate-900')}>
                                        {notif.title}
                                    </p>
                                    <p className={cn('text-xs mt-0.5 truncate', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                        {notif.message}
                                    </p>
                                </div>
                                {!notif.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Daily Trend Chart */}
            <motion.div
                variants={itemVariants}
                className={cn(
                    'rounded-2xl p-6',
                    isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100'
                )}
            >
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-semibold text-lg">Activity Trends</h3>
                        <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>Applications, interviews &amp; offers over time</p>
                    </div>
                </div>
                <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_DAILY_METRICS}>
                            <defs>
                                <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6750A4" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6750A4" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2B2930' : '#f0f0f0'} />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: isDark ? '#938F99' : '#79747E' }} />
                            <YAxis tick={{ fontSize: 12, fill: isDark ? '#938F99' : '#79747E' }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    background: isDark ? '#2B2930' : '#fff',
                                    color: isDark ? '#E6E1E5' : '#1C1B1F',
                                }}
                            />
                            <Area type="monotone" dataKey="applications" stroke="#6750A4" fill="url(#colorApplications)" strokeWidth={2} />
                            <Area type="monotone" dataKey="interviews" stroke="#3b82f6" fill="url(#colorInterviews)" strokeWidth={2} />
                            <Area type="monotone" dataKey="offers" stroke="#22c55e" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex gap-6 justify-center mt-4">
                    {[
                        { label: 'Applications', color: '#6750A4' },
                        { label: 'Interviews', color: '#3b82f6' },
                        { label: 'Offers', color: '#22c55e' },
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-xs font-medium">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Candidate Table */}
            <motion.div
                variants={itemVariants}
                className={cn(
                    'rounded-2xl p-6',
                    isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100'
                )}
            >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="font-semibold text-lg">Recent Candidates</h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className={cn(
                            'relative flex-1 sm:flex-none',
                        )}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={cn(
                                    'pl-9 pr-4 py-2.5 rounded-xl text-sm w-full sm:w-64 border-none outline-none transition-all',
                                    isDark
                                        ? 'bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10'
                                        : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-slate-100 focus:ring-2 focus:ring-primary-200'
                                )}
                            />
                        </div>
                        <button className={cn(
                            'p-2.5 rounded-xl transition-colors',
                            isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        )}>
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className={cn(
                                'border-b text-xs uppercase tracking-wider',
                                isDark ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'
                            )}>
                                <th className="pb-3 pl-2 font-medium">Candidate</th>
                                <th className="pb-3 font-medium">Skills</th>
                                <th className="pb-3 font-medium">AI Score</th>
                                <th className="pb-3 font-medium">Stage</th>
                                <th className="pb-3 font-medium">Verification</th>
                                <th className="pb-3 font-medium text-right pr-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredCandidates.map((c, idx) => (
                                <motion.tr
                                    key={c.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={cn(
                                        'border-b last:border-none transition-colors cursor-pointer',
                                        isDark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-50 hover:bg-slate-50/50'
                                    )}
                                >
                                    <td className="py-4 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                                getColorForString(c.name)
                                            )}>
                                                {getInitials(c.name)}
                                            </div>
                                            <div>
                                                <span className="font-medium">{c.name}</span>
                                                <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                    {c.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                                            {c.skills.slice(0, 3).map((skill) => (
                                                <span
                                                    key={skill}
                                                    className={cn(
                                                        'px-2 py-0.5 rounded-md text-xs font-medium',
                                                        isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
                                                    )}
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {c.skills.length > 3 && (
                                                <span className={cn('text-xs font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                    +{c.skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className={cn(
                                            'px-2.5 py-1 rounded-lg text-xs font-bold',
                                            getScoreColor(c.score)
                                        )}>
                                            {c.score}%
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        <span className={cn(
                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                                            getStatusStyle(c.stage)
                                        )}>
                                            <span className={cn(
                                                'w-1.5 h-1.5 rounded-full',
                                                c.stage === 'Offer' ? 'bg-green-500' :
                                                    c.stage === 'Rejected' ? 'bg-red-500' : 'bg-current opacity-50'
                                            )} />
                                            {c.stage}
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        <span className={cn(
                                            'text-xs font-medium',
                                            c.verificationStatus === 'verified' ? 'text-green-600' :
                                                c.verificationStatus === 'disputed' ? 'text-red-500' :
                                                    c.verificationStatus === 'pending' ? 'text-amber-500' : 'text-slate-400'
                                        )}>
                                            {c.verificationStatus === 'verified' ? '✅ Verified' :
                                                c.verificationStatus === 'disputed' ? '❌ Disputed' :
                                                    c.verificationStatus === 'pending' ? '⏳ Pending' : '— Unverified'}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-2">
                                        <button className={cn(
                                            'p-1.5 rounded-lg transition-colors',
                                            isDark ? 'text-slate-500 hover:bg-white/5 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        )}>
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Need this for the kpi icon that uses Briefcase
const Briefcase = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

export default Dashboard;
