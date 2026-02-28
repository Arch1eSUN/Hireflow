import React, { useState } from 'react';
import {
    Plus, Search, MapPin, Users, MoreHorizontal
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@hireflow/i18n/react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { AddJobModal } from '@/components/jobs/AddJobModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@hireflow/utils/src/index';

const JobsPage: React.FC = () => {
    const { t } = useI18n();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    const debouncedSearch = useDebounce(searchQuery, 300);

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ['jobs', debouncedSearch],
        queryFn: async () => {
            const params: any = {};
            if (debouncedSearch) params.search = debouncedSearch;
            const res = await api.get('/jobs', { params });
            return res.data.data || [];
        },
    });

    const filteredJobs = jobs.filter((job: any) => statusFilter === 'all' || job.status === statusFilter);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'chip-success';
            case 'closed': return 'chip-neutral';
            case 'draft': return 'chip-warning';
            default: return 'chip-neutral';
        }
    };

    return (
        <div className="page-shell">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('jobs.title')}</h1>
                    <p className="page-subtitle">{t('common.total')} {filteredJobs.length}</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-filled" onClick={() => setShowAddModal(true)}>
                        <Plus size={16} /> {t('jobs.createJob')}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <div className="toolbar-search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
                    <input
                        type="text"
                        placeholder={t('jobs.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="toolbar-separator" />
                <div className="segmented">
                    {['all', 'active', 'draft', 'closed'].map(s => (
                        <button
                            key={s}
                            className={cn("segmented-item capitalize", statusFilter === s && "active")}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'all' ? t('common.viewAll') : t(`jobs.status.${s}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-10"><input type="checkbox" /></th>
                            <th className="min-w-[250px]">{t('jobs.field.title')}</th>
                            <th>{t('jobs.field.status')}</th>
                            <th>{t('jobs.field.department')}</th>
                            <th>{t('jobs.field.location')}</th>
                            <th>{t('nav.candidates')}</th>
                            <th>{t('common.date')}</th>
                            <th className="w-[60px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={8} className="text-center py-12 text-[var(--color-text-secondary)]">{t('common.loading')}</td></tr>
                        ) : filteredJobs.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-12"><EmptyState title={t('common.noData')} subtitle={t('jobs.createJob')} /></td></tr>
                        ) : (
                            filteredJobs.map((job: any) => (
                                <tr key={job.id} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <td className="text-center"><input type="checkbox" /></td>
                                    <td>
                                        <div className="font-medium text-[var(--color-text-primary)]">{job.title}</div>
                                        {job.salaryRange && (
                                            <div className="text-[12px] text-[var(--color-text-secondary)]">
                                                ¥{(job.salaryRange.min / 1000).toFixed(0)}k - {(job.salaryRange.max / 1000).toFixed(0)}k
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`chip ${getStatusColor(job.status)} uppercase text-[10px] tracking-wider font-bold`}>
                                            {t(`jobs.status.${job.status}`)}
                                        </span>
                                    </td>
                                    <td className="text-[var(--color-text-secondary)]">{job.department}</td>
                                    <td className="text-[var(--color-text-secondary)] flex items-center gap-1">
                                        <MapPin size={12} /> {job.location}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1 text-[var(--color-text-primary)]">
                                            <Users size={14} className="text-[var(--color-text-secondary)]" />
                                            {job.candidateCount || 0}
                                        </div>
                                    </td>
                                    <td className="text-[var(--color-text-secondary)] tabular-nums text-[13px]">
                                        {new Date(job.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
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
            <AddJobModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
        </div>
    );
};

export default JobsPage;
