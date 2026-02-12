// ================================================
// HireFlow AI — 候选人列表页
// ================================================
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, UserPlus, Grid3X3, List, ChevronDown, X } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import { MOCK_CANDIDATES, MOCK_JOBS } from '@/data/mockData';
import type { CandidateStage } from '@hireflow/types';

const STAGES: CandidateStage[] = ['applied', 'screening', 'interview_1', 'interview_2', 'offer', 'hired', 'rejected'];

const CandidatesPage: React.FC = () => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStage, setSelectedStage] = useState<CandidateStage | 'all'>('all');
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredCandidates = useMemo(() => {
        return MOCK_CANDIDATES.filter((c) => {
            const matchSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchStage = selectedStage === 'all' || c.stage === selectedStage;
            return matchSearch && matchStage;
        });
    }, [searchQuery, selectedStage]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-5">
            {/* 页头 */}
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('candidates.title')}</h1>
                <button className="btn btn-filled">
                    <UserPlus size={18} />
                    {t('candidates.addCandidate')}
                </button>
            </div>

            {/* 搜索 + 筛选 + 视图切换 */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-on-surface-variant)' }} />
                    <input
                        type="text"
                        className="input-compact w-full pl-10"
                        placeholder={t('candidates.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-outline)',
                            color: 'var(--color-on-surface)',
                        }}
                    />
                </div>
                <div className="flex gap-1">
                    <button
                        className={`chip cursor-pointer ${selectedStage === 'all' ? 'chip-primary' : 'chip-neutral'}`}
                        onClick={() => setSelectedStage('all')}
                        style={{ cursor: 'pointer' }}
                    >
                        全部
                    </button>
                    {STAGES.map((s) => (
                        <button
                            key={s}
                            className={`chip cursor-pointer ${selectedStage === s ? 'chip-primary' : 'chip-neutral'}`}
                            onClick={() => setSelectedStage(s)}
                            style={{ cursor: 'pointer' }}
                        >
                            {t(`stage.${s}`)}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 ml-auto">
                    <button
                        className={`btn-icon ${viewMode === 'list' ? '' : ''}`}
                        onClick={() => setViewMode('list')}
                        style={{ backgroundColor: viewMode === 'list' ? 'var(--color-primary-container)' : undefined, color: viewMode === 'list' ? 'var(--color-primary)' : undefined }}
                    >
                        <List size={18} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={() => setViewMode('kanban')}
                        style={{ backgroundColor: viewMode === 'kanban' ? 'var(--color-primary-container)' : undefined, color: viewMode === 'kanban' ? 'var(--color-primary)' : undefined }}
                    >
                        <Grid3X3 size={18} />
                    </button>
                </div>
            </div>

            {/* 批量操作栏 */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--color-info-container)' }}
                    >
                        <span className="text-label-large" style={{ color: 'var(--color-primary)' }}>
                            已选择 {selectedIds.size} 位候选人
                        </span>
                        <button className="btn btn-tonal text-sm" style={{ height: 32 }}>{t('candidates.advanceStage')}</button>
                        <button className="btn btn-outlined text-sm" style={{ height: 32 }}>{t('candidates.schedule')}</button>
                        <button className="btn btn-text text-sm" style={{ height: 32, color: 'var(--color-error)' }}>{t('candidates.reject')}</button>
                        <button className="btn-icon ml-auto" onClick={() => setSelectedIds(new Set())}>
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 候选人列表 */}
            <div className="card p-0 overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                                    onChange={() => {
                                        if (selectedIds.size === filteredCandidates.length) setSelectedIds(new Set());
                                        else setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
                                    }}
                                />
                            </th>
                            <th>{t('common.name')}</th>
                            <th>岗位</th>
                            <th>{t('common.status')}</th>
                            <th>匹配分</th>
                            <th>来源</th>
                            <th>投递时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCandidates.map((c, i) => {
                            const job = MOCK_JOBS.find((j) => j.id === c.jobId);
                            return (
                                <motion.tr
                                    key={c.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    onClick={() => navigate(`/candidates/${c.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onChange={() => toggleSelect(c.id)}
                                        />
                                    </td>
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
                                                <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{c.email}</p>
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
                                    <td className="text-body-medium">{c.source || '-'}</td>
                                    <td className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{c.appliedDate}</td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredCandidates.length === 0 && (
                    <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <p className="text-body-large">{t('common.noData')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CandidatesPage;
