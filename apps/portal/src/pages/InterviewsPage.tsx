import React, { useState } from 'react';
import {
    Plus, Video, Copy, Clock, CheckCircle2, MoreHorizontal,
    Calendar, ArrowUpRight, Search, ShieldCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { CreateInterviewModal } from '@/components/interviews/CreateInterviewModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { InterviewTableSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@hireflow/utils/src/index';

const InterviewsPage: React.FC = () => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'upcoming' | 'in_progress' | 'completed'>('upcoming');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: interviews = [], isLoading } = useQuery({
        queryKey: ['interviews', tab],
        queryFn: async () => {
            const params: any = {};
            if (tab === 'upcoming') params.status = 'upcoming';
            else if (tab === 'in_progress') params.status = 'active'; // Map 'in_progress' tab to 'active' status
            else params.status = 'completed';
            const res = await api.get('/interviews', { params });
            return res.data.data || [];
        },
    });

    const getInterviewAppOrigin = () => {
        if (import.meta.env.VITE_INTERVIEW_APP_URL) {
            return String(import.meta.env.VITE_INTERVIEW_APP_URL).replace(/\/$/, '');
        }
        if (window.location.port === '3000') {
            return `${window.location.protocol}//${window.location.hostname}:3001`;
        }
        return window.location.origin;
    };

    const handleCopyLink = (token: string) => {
        const link = `${getInterviewAppOrigin()}/${token}`;
        navigator.clipboard.writeText(link).then(() => {
            toast.success('Interview link copied');
        }).catch(() => toast.error('Failed to copy'));
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'active': case 'in_progress':
                return { label: 'Live', color: 'chip-warning', icon: Video };
            case 'completed':
                return { label: 'Done', color: 'chip-success', icon: CheckCircle2 };
            default:
                return { label: 'Scheduled', color: 'chip-neutral', icon: Clock };
        }
    };

    const filteredInterviews = interviews.filter((iv: any) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const candidate = String(iv.candidate?.name || '').toLowerCase();
        const job = String(iv.job?.title || '').toLowerCase();
        const type = String(iv.type || '').toLowerCase();
        return candidate.includes(query) || job.includes(query) || type.includes(query);
    });

    return (
        <div className="page-shell">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('interviews.title')}</h1>
                    <p className="page-subtitle">{t('common.total')} {filteredInterviews.length}</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outlined" onClick={() => navigate('/integrity')}>
                        <ShieldCheck size={16} /> {t('nav.integrity')}
                    </button>
                    <button className="btn btn-filled" onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} /> {t('interviews.create')}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <div className="toolbar-search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
                    <input
                        type="text"
                        placeholder={t('interviews.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="toolbar-separator" />
                <div className="segmented">
                    {(['upcoming', 'in_progress', 'completed'] as const).map(key => (
                        <button
                            key={key}
                            className={cn(
                                "segmented-item capitalize",
                                tab === key && "active"
                            )}
                            onClick={() => setTab(key)}
                        >
                            {t(`interviews.${key === 'in_progress' ? 'inProgress' : key}`)}
                            {/* In a real app, badges could go here */}
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
                            <th className="min-w-[200px]">{t('interviews.field.candidate')}</th>
                            <th>{t('common.status')}</th>
                            <th>{t('interviews.field.type')}</th>
                            <th>{t('common.date')}</th>
                            <th>{t('interviews.duration')}</th>
                            <th className="w-[140px] text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <InterviewTableSkeleton />
                        ) : filteredInterviews.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-12"><EmptyState title={t('common.noData')} subtitle={t('interviews.create')} /></td></tr>
                        ) : (
                            filteredInterviews.map((iv: any) => {
                                const status = getStatusChip(iv.status);
                                return (
                                    <tr key={iv.id} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                                        <td className="text-center"><input type="checkbox" /></td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-container)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">
                                                    {iv.candidate?.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-[var(--color-text-primary)]">{iv.candidate?.name || 'Unknown'}</div>
                                                    <div className="text-[12px] text-[var(--color-text-secondary)]">{iv.job?.title || 'General Interview'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`chip ${status.color} flex items-center gap-1 w-fit`}>
                                                <status.icon size={10} /> {status.label}
                                            </span>
                                        </td>
                                        <td className="capitalize text-[13px]">
                                            {iv.type?.replace('_', ' ') || 'AI Screen'}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
                                                <Calendar size={14} />
                                                {iv.startTime ? new Date(iv.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                            </div>
                                        </td>
                                        <td className="text-[13px] text-[var(--color-text-secondary)] tabular-nums">
                                            {iv.duration ? `${iv.duration}m` : '-'}
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-end gap-2 table-action-reveal">
                                                {(iv.status === 'active' || iv.status === 'in_progress') && (
                                                    <button
                                                        className="btn btn-filled h-[28px] px-2 text-xs"
                                                        onClick={() => window.open(`/interviews/${iv.id}/monitor`, '_blank')}
                                                    >
                                                        {t('interviews.monitor')} <ArrowUpRight size={12} />
                                                    </button>
                                                )}
                                                {(iv.status === 'pending' || iv.status === 'upcoming') && iv.token && (
                                                    <button
                                                        className="btn btn-outlined h-[28px] px-2 text-xs"
                                                        onClick={() => handleCopyLink(iv.token)}
                                                        title={t('interviews.copyLink')}
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                )}
                                                <button className="btn-icon w-7 h-7">
                                                    <MoreHorizontal size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <CreateInterviewModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    );
};

export default InterviewsPage;
