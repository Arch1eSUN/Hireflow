// ================================================
// HireFlow AI - Jobs Management Page
// ================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, Plus, MapPin, Clock, Users, Filter,
    Search, MoreHorizontal, ChevronRight, DollarSign, Tag,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, getStatusStyle, timeAgo } from '@/lib/utils';
import { MOCK_JOBS, MOCK_CANDIDATES } from '@/data/mockData';

const JobsPage: React.FC = () => {
    const { isDark } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<string | null>(null);

    const filteredJobs = MOCK_JOBS.filter((j) =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="p-8 max-w-[1400px] mx-auto"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Job Openings</h1>
                    <p className={cn('mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {MOCK_JOBS.length} active positions across all departments
                    </p>
                </div>
                <button className="m3-btn-filled">
                    <Plus className="w-4 h-4" /> Create New Job
                </button>
            </div>

            {/* Search */}
            <div className="flex gap-3 mb-6">
                <div className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 max-w-sm',
                    isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-slate-200'
                )}>
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={cn('bg-transparent border-none outline-none text-sm w-full', isDark ? 'text-white' : 'text-slate-900')}
                    />
                </div>
                <button className={cn(
                    'p-2.5 rounded-xl transition-colors',
                    isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                )}>
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            {/* Job Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredJobs.map((job, idx) => {
                    const candidateCount = MOCK_CANDIDATES.filter((c) => c.jobId === job.id).length;
                    return (
                        <motion.div
                            key={job.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                            className={cn(
                                'rounded-2xl p-6 cursor-pointer transition-all border',
                                selectedJob === job.id ? 'ring-2 ring-primary-500' : '',
                                isDark
                                    ? 'bg-[#1C1B20] border-white/5 hover:border-white/10'
                                    : 'bg-white shadow-sm hover:shadow-md border-slate-100'
                            )}
                        >
                            {/* Status Badge */}
                            <div className="flex items-center justify-between mb-4">
                                <span className={cn(
                                    'px-3 py-1 rounded-full text-xs font-semibold',
                                    getStatusStyle(job.status)
                                )}>
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                </span>
                                <button className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'
                                )}>
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Title & Department */}
                            <h3 className="font-semibold text-lg mb-1">{job.title}</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <span className={cn('flex items-center gap-1 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    <Tag className="w-3.5 h-3.5" /> {job.department}
                                </span>
                                <span className={cn('flex items-center gap-1 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    <MapPin className="w-3.5 h-3.5" /> {job.location}
                                </span>
                            </div>

                            {/* Salary */}
                            {job.salaryRange && (
                                <div className={cn(
                                    'flex items-center gap-2 mb-4 text-sm',
                                    isDark ? 'text-slate-300' : 'text-slate-700'
                                )}>
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                    <span className="font-medium">
                                        ${(job.salaryRange.min / 1000).toFixed(0)}k - ${(job.salaryRange.max / 1000).toFixed(0)}k
                                    </span>
                                    <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                        {job.salaryRange.currency}/year
                                    </span>
                                </div>
                            )}

                            {/* Stats Row */}
                            <div className={cn('flex items-center justify-between pt-4 border-t', isDark ? 'border-white/5' : 'border-slate-100')}>
                                <div className="flex items-center gap-1.5">
                                    <Users className={cn('w-4 h-4', isDark ? 'text-slate-400' : 'text-slate-500')} />
                                    <span className={cn('text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>
                                        {candidateCount} candidates
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className={cn('w-3.5 h-3.5', isDark ? 'text-slate-500' : 'text-slate-400')} />
                                    <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                        {timeAgo(job.updatedAt)}
                                    </span>
                                </div>
                            </div>

                            {/* Pipeline Preview */}
                            <div className="mt-4">
                                <div className="flex gap-1">
                                    {job.pipeline.map((stage, i) => (
                                        <div
                                            key={stage.id}
                                            className={cn(
                                                'h-1.5 flex-1 rounded-full',
                                                i <= 2 ? 'bg-primary-500' : isDark ? 'bg-white/10' : 'bg-slate-200'
                                            )}
                                        />
                                    ))}
                                </div>
                                <p className={cn('text-[10px] mt-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                    {job.pipeline.length} stages configured
                                </p>
                            </div>
                        </motion.div>
                    );
                })}

                {/* Add New Job Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: filteredJobs.length * 0.08 }}
                    className={cn(
                        'rounded-2xl p-6 cursor-pointer transition-all border-2 border-dashed flex flex-col items-center justify-center min-h-[280px]',
                        isDark
                            ? 'border-white/10 hover:border-primary-500/30 hover:bg-primary-500/5'
                            : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/30'
                    )}
                >
                    <div className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center mb-3',
                        isDark ? 'bg-primary-500/10' : 'bg-primary-50'
                    )}>
                        <Plus className={cn('w-6 h-6', isDark ? 'text-primary-400' : 'text-primary-600')} />
                    </div>
                    <p className="font-semibold text-sm">Create New Job</p>
                    <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        Start hiring for a new position
                    </p>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default JobsPage;
