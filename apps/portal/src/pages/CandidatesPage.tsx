import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, UserPlus, MoreHorizontal,
    ArrowUpDown, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { AddCandidateModal } from '@/components/candidates/AddCandidateModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@hireflow/utils/src/index';

const STAGES = ['applied', 'screening', 'interview_1', 'interview_2', 'offer', 'hired', 'rejected'];

const CandidatesPage: React.FC = () => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStage, setSelectedStage] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const debouncedSearch = useDebounce(searchQuery, 300);

    const { data: payload, isLoading } = useQuery({
        queryKey: ['candidates', debouncedSearch, selectedStage, page],
        queryFn: async () => {
            const params: any = {};
            if (debouncedSearch) params.search = debouncedSearch;
            if (selectedStage !== 'all') params.stage = selectedStage;
            params.page = page;
            params.pageSize = pageSize;
            const res = await api.get('/candidates', { params });
            return {
                items: res.data?.data || [],
                meta: res.data?.meta || { page: 1, pageSize, total: 0 },
            };
        },
    });
    const candidates = payload?.items || [];
    const total = Number(payload?.meta?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canPrev = page > 1;
    const canNext = page < totalPages;

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedStage]);

    const currentRange = useMemo(() => {
        if (total === 0) return '0-0';
        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, total);
        return `${start}-${end}`;
    }, [page, pageSize, total]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === candidates.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(candidates.map((c: any) => c.id)));
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'offer': case 'hired': return 'chip-success';
            case 'rejected': return 'chip-error';
            case 'applied': return 'chip-neutral';
            default: return 'chip-primary';
        }
    };

    return (
        <div className="page-shell">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('candidates.title')}</h1>
                    <p className="page-subtitle">{t('common.total')} {total}</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outlined">
                        <Download size={16} /> {t('common.export')}
                    </button>
                    <button className="btn btn-filled" onClick={() => setShowAddModal(true)}>
                        <UserPlus size={16} />
                        {t('candidates.addCandidate')}
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="toolbar">
                <div className="toolbar-search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
                    <input
                        type="text"
                        placeholder={t('candidates.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="toolbar-separator" />
                <div className="segmented">
                    <button
                        className={cn("segmented-item", selectedStage === 'all' && "active")}
                        onClick={() => setSelectedStage('all')}
                    >
                        {t('common.viewAll')}
                    </button>
                    {STAGES.map(s => (
                        <button
                            key={s}
                            className={cn("segmented-item", selectedStage === s && "active")}
                            onClick={() => setSelectedStage(s)}
                        >
                            {t(`stage.${s}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedIds.size > 0 && (
                <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)] text-[var(--color-info)] px-4 py-2 rounded-[var(--radius-md)] flex items-center justify-between text-sm animate-in slide-in-from-top-2">
                    <span className="font-medium">{selectedIds.size} {t('common.selected')}</span>
                    <div className="flex gap-2">
                        <button className="hover:underline font-medium">{t('candidates.sendEmail')}</button>
                        <button className="hover:underline font-medium">{t('candidates.advanceStage')}</button>
                        <button className="hover:underline font-medium text-[var(--color-error)]">{t('common.delete')}</button>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-10 text-center">
                                <input type="checkbox" onChange={toggleSelectAll} checked={candidates.length > 0 && selectedIds.size === candidates.length} />
                            </th>
                            <th className="min-w-[200px] cursor-pointer hover:bg-[var(--color-surface-hover)]">
                                {t('common.name')} <ArrowUpDown size={12} className="inline ml-1 opacity-50" />
                            </th>
                            <th>{t('candidate.job')}</th>
                            <th>{t('common.status')}</th>
                            <th>{t('candidate.aiScore')}</th>
                            <th>{t('common.date')}</th>
                            <th className="w-[60px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={7} className="text-center py-12 text-[var(--color-text-secondary)]">{t('common.loading')}</td></tr>
                        ) : candidates.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-12"><EmptyState title={t('common.noData')} subtitle={t('candidates.searchPlaceholder')} /></td></tr>
                        ) : (
                            candidates.map((c: any) => (
                                <tr key={c.id} className="group hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                                    <td className="text-center" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-[var(--color-primary-container)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">
                                                {c.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
                                                <div className="text-[12px] text-[var(--color-text-secondary)]">{c.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{c.job?.title || <span className="text-[var(--color-text-disabled)]">General</span>}</td>
                                    <td>
                                        <span className={`chip ${getStageColor(c.stage)}`}>{t(`stage.${c.stage}`)}</span>
                                    </td>
                                    <td>
                                        {c.score ? (
                                            <span className={`font-medium tabular-nums px-2 py-0.5 rounded ${c.score >= 80 ? 'bg-green-100 text-green-700' : c.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {c.score}
                                            </span>
                                        ) : <span className="text-[var(--color-text-disabled)]">-</span>}
                                    </td>
                                    <td className="text-[var(--color-text-secondary)] tabular-nums text-[13px]">
                                        {new Date(c.createdAt).toLocaleDateString()}
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <button className="btn-icon w-8 h-8 table-action-reveal">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)] px-2">
                <span>{currentRange} / {total}</span>
                <div className="flex gap-1">
                    <button
                        className={cn("btn-icon w-8 h-8", !canPrev && "pointer-events-none opacity-50")}
                        onClick={() => canPrev && setPage((prev) => prev - 1)}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        className={cn("btn-icon w-8 h-8", !canNext && "pointer-events-none opacity-50")}
                        onClick={() => canNext && setPage((prev) => prev + 1)}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <AddCandidateModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
        </div>
    );
};

export default CandidatesPage;
