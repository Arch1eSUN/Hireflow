// ================================================
// HireFlow AI - Candidates Page (Kanban Board)
// Drag and drop Kanban + list view for candidate management
// ================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Filter, Grid3X3, List, MoreHorizontal,
    ChevronDown, MapPin, Calendar, Star, Mail, Phone,
    Radar,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, getInitials, getColorForString, getScoreColor, getStatusStyle, timeAgo } from '@/lib/utils';
import { MOCK_CANDIDATES } from '@/data/mockData';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Radar as RechartsRadar, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { Candidate } from '@/types';

const STAGES = ['Applied', 'Screening', 'Interview 1', 'Interview 2', 'Offer', 'Rejected'];

const CandidatesPage: React.FC = () => {
    const { isDark } = useTheme();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareList, setCompareList] = useState<Candidate[]>([]);

    const filteredCandidates = useMemo(() => {
        return MOCK_CANDIDATES.filter(
            (c) =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm]);

    const groupedByStage = useMemo(() => {
        const map: Record<string, Candidate[]> = {};
        STAGES.forEach((s) => (map[s] = []));
        filteredCandidates.forEach((c) => {
            if (map[c.stage]) map[c.stage].push(c);
        });
        return map;
    }, [filteredCandidates]);

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
            >
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
                    <p className={cn('mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {MOCK_CANDIDATES.length} candidates across {STAGES.length - 1} active stages
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className={cn('flex items-center rounded-xl p-1', isDark ? 'bg-white/5' : 'bg-white border border-slate-200')}>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                viewMode === 'kanban'
                                    ? isDark ? 'bg-primary-600/20 text-primary-300' : 'bg-primary-50 text-primary-700'
                                    : isDark ? 'text-slate-400' : 'text-slate-500'
                            )}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                viewMode === 'list'
                                    ? isDark ? 'bg-primary-600/20 text-primary-300' : 'bg-primary-50 text-primary-700'
                                    : isDark ? 'text-slate-400' : 'text-slate-500'
                            )}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl w-64',
                        isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-slate-200'
                    )}>
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={cn('bg-transparent border-none outline-none text-sm w-full', isDark ? 'text-white' : 'text-slate-900')}
                        />
                    </div>

                    {/* Compare Button */}
                    <button
                        onClick={() => setCompareMode(!compareMode)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                            compareMode
                                ? 'bg-primary-600 text-white'
                                : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                    >
                        <Radar className="w-4 h-4" />
                        Compare {compareList.length > 0 && `(${compareList.length})`}
                    </button>
                </div>
            </motion.div>

            {/* Compare Panel */}
            <AnimatePresence>
                {compareMode && compareList.length >= 2 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn('rounded-2xl p-6 mb-8 overflow-hidden', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}
                    >
                        <h3 className="font-semibold text-lg mb-4">Candidate Comparison</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={[
                                    { dimension: 'Score', ...Object.fromEntries(compareList.map(c => [c.name, c.score])) },
                                    { dimension: 'Skills', ...Object.fromEntries(compareList.map(c => [c.name, c.skills.length * 25])) },
                                    { dimension: 'Experience', ...Object.fromEntries(compareList.map(c => [c.name, 80])) },
                                    { dimension: 'Culture Fit', ...Object.fromEntries(compareList.map(c => [c.name, 75 + Math.random() * 20])) },
                                    { dimension: 'Communication', ...Object.fromEntries(compareList.map(c => [c.name, 70 + Math.random() * 25])) },
                                ]}>
                                    <PolarGrid stroke={isDark ? '#2B2930' : '#e0e0e0'} />
                                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: isDark ? '#938F99' : '#79747E' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                                    {compareList.map((c, idx) => (
                                        <RechartsRadar
                                            key={c.id}
                                            name={c.name}
                                            dataKey={c.name}
                                            stroke={['#6750A4', '#3b82f6', '#22c55e'][idx % 3]}
                                            fill={['#6750A4', '#3b82f6', '#22c55e'][idx % 3]}
                                            fillOpacity={0.15}
                                            strokeWidth={2}
                                        />
                                    ))}
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Kanban View */}
            {viewMode === 'kanban' && (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {STAGES.map((stage) => (
                        <motion.div
                            key={stage}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                'min-w-[280px] flex-1 rounded-2xl p-4 kanban-column',
                                isDark ? 'bg-[#1C1B20]/50' : 'bg-slate-50/80'
                            )}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={cn('font-semibold text-sm', isDark ? 'text-slate-200' : 'text-slate-800')}>
                                        {stage}
                                    </span>
                                    <span className={cn(
                                        'text-xs font-bold px-2 py-0.5 rounded-full',
                                        isDark ? 'bg-white/5 text-slate-400' : 'bg-white text-slate-500'
                                    )}>
                                        {groupedByStage[stage]?.length || 0}
                                    </span>
                                </div>
                            </div>

                            {/* Cards */}
                            <div className="space-y-3">
                                {groupedByStage[stage]?.map((candidate, idx) => (
                                    <motion.div
                                        key={candidate.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                        onClick={() => {
                                            if (compareMode) {
                                                setCompareList((prev) =>
                                                    prev.find((c) => c.id === candidate.id)
                                                        ? prev.filter((c) => c.id !== candidate.id)
                                                        : [...prev.slice(0, 2), candidate]
                                                );
                                            } else {
                                                setSelectedCandidate(candidate);
                                            }
                                        }}
                                        className={cn(
                                            'rounded-xl p-4 cursor-pointer transition-all border',
                                            compareMode && compareList.find((c) => c.id === candidate.id)
                                                ? 'ring-2 ring-primary-500 border-primary-500'
                                                : isDark
                                                    ? 'bg-[#211F26] border-white/5 hover:border-white/10'
                                                    : 'bg-white border-slate-200/80 hover:border-primary-200 shadow-sm hover:shadow-md'
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={cn(
                                                'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                                getColorForString(candidate.name)
                                            )}>
                                                {getInitials(candidate.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{candidate.name}</p>
                                                <p className={cn('text-xs truncate', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                    {candidate.email}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-md', getScoreColor(candidate.score))}>
                                                {candidate.score}% Match
                                            </span>
                                            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                {timeAgo(candidate.appliedDate)}
                                            </span>
                                        </div>

                                        {/* Skills */}
                                        <div className="flex flex-wrap gap-1">
                                            {candidate.skills.slice(0, 3).map((skill) => (
                                                <span
                                                    key={skill}
                                                    className={cn(
                                                        'px-2 py-0.5 rounded text-[10px] font-medium',
                                                        isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                                                    )}
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Tags */}
                                        {candidate.tags && candidate.tags.length > 0 && (
                                            <div className="flex gap-1 mt-2">
                                                {candidate.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className={cn(
                                                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                                                            tag === 'top-talent' ? 'bg-amber-50 text-amber-700' :
                                                                tag === 'referral' ? 'bg-blue-50 text-blue-700' :
                                                                    tag === 'urgent' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                                                        )}
                                                    >
                                                        {tag === 'top-talent' ? '⭐ Top' : tag === 'referral' ? '👋 Referred' : tag === 'urgent' ? '🔥 Urgent' : tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn('rounded-2xl overflow-hidden', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400')}>
                                    <th className="px-6 py-4 font-medium">Candidate</th>
                                    <th className="px-4 py-4 font-medium">Skills</th>
                                    <th className="px-4 py-4 font-medium">Score</th>
                                    <th className="px-4 py-4 font-medium">Stage</th>
                                    <th className="px-4 py-4 font-medium">Applied</th>
                                    <th className="px-4 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCandidates.map((c, idx) => (
                                    <motion.tr
                                        key={c.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={cn('border-b last:border-none transition-colors cursor-pointer', isDark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-50 hover:bg-slate-50/50')}
                                        onClick={() => setSelectedCandidate(c)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', getColorForString(c.name))}>
                                                    {getInitials(c.name)}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-sm">{c.name}</span>
                                                    <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{c.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex gap-1 flex-wrap max-w-[200px]">
                                                {c.skills.slice(0, 3).map((s) => (
                                                    <span key={s} className={cn('px-2 py-0.5 rounded text-[10px] font-medium', isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold', getScoreColor(c.score))}>
                                                {c.score}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', getStatusStyle(c.stage))}>
                                                {c.stage}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>{timeAgo(c.appliedDate)}</span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100')}>
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* Candidate Detail Slide-in */}
            <AnimatePresence>
                {selectedCandidate && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
                            onClick={() => setSelectedCandidate(null)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                            className={cn(
                                'fixed right-0 top-0 bottom-0 w-[480px] z-50 overflow-y-auto',
                                isDark ? 'bg-[#1C1B20] border-l border-white/5' : 'bg-white border-l border-slate-200 shadow-2xl'
                            )}
                        >
                            <div className="p-8">
                                {/* Header */}
                                <div className="flex items-center gap-4 mb-8">
                                    <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold', getColorForString(selectedCandidate.name))}>
                                        {getInitials(selectedCandidate.name)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{selectedCandidate.name}</h2>
                                        <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>{selectedCandidate.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', getStatusStyle(selectedCandidate.stage))}>
                                                {selectedCandidate.stage}
                                            </span>
                                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-md', getScoreColor(selectedCandidate.score))}>
                                                {selectedCandidate.score}% Match
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact */}
                                <div className={cn('rounded-xl p-4 mb-6', isDark ? 'bg-white/5' : 'bg-slate-50')}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm">{selectedCandidate.email}</span>
                                    </div>
                                    {selectedCandidate.phone && (
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm">{selectedCandidate.phone}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Skills */}
                                <div className="mb-6">
                                    <h3 className="font-semibold text-sm mb-3">Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCandidate.skills.map((skill) => (
                                            <span key={skill} className={cn('px-3 py-1.5 rounded-xl text-xs font-medium', isDark ? 'bg-white/5 text-slate-300' : 'bg-primary-50 text-primary-700')}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-3">
                                    <button className="m3-btn-filled w-full justify-center">
                                        Schedule Interview
                                    </button>
                                    <button className="m3-btn-tonal w-full justify-center">
                                        View Resume
                                    </button>
                                    <button className="m3-btn-outlined w-full justify-center">
                                        Send Email
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CandidatesPage;
