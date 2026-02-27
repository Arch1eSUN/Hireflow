// HireFlow AI — 面试管理页 (Full CRUD)
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Video, Copy, Clock, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';
import { CreateInterviewModal } from '@/components/interviews/CreateInterviewModal';
import { EmptyState } from '@/components/ui/EmptyState';

const statusConfig: Record<string, { label: string; chip: string; icon: any }> = {
    pending: { label: '待开始', chip: 'chip-neutral', icon: Clock },
    upcoming: { label: '待开始', chip: 'chip-neutral', icon: Clock },
    active: { label: '进行中', chip: 'chip-warning', icon: Video },
    in_progress: { label: '进行中', chip: 'chip-warning', icon: Video },
    completed: { label: '已完成', chip: 'chip-success', icon: CheckCircle2 },
};

const InterviewsPage: React.FC = () => {
    const { t } = useI18n();
    const [tab, setTab] = useState<'upcoming' | 'in_progress' | 'completed'>('upcoming');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ['interviews', tab],
        queryFn: async () => {
            const params: any = {};
            if (tab === 'upcoming') params.status = 'upcoming';
            else if (tab === 'in_progress') params.status = 'active';
            else params.status = 'completed';
            const res = await api.get('/interviews', { params });
            return res.data.data;
        },
    });

    const interviews = data || [];

    const handleCopyLink = (token: string) => {
        const link = `${window.location.origin}/interview/${token}`;
        navigator.clipboard.writeText(link).then(() => {
            toast.success('面试链接已复制到剪贴板！');
        }).catch(() => {
            toast.error('复制失败，请手动复制');
        });
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('interviews.title')}</h1>
                <button className="btn btn-filled" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    {t('interviews.create')}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid var(--color-outline)' }}>
                {(['upcoming', 'in_progress', 'completed'] as const).map((key) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className="px-4 py-3 text-label-large relative"
                        style={{
                            color: tab === key ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                            transition: 'color var(--duration-micro)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {t(`interviews.${key === 'upcoming' ? 'upcoming' : key === 'in_progress' ? 'inProgress' : 'completed'}`)}
                        {tab === key && (
                            <motion.div
                                layoutId="tab-indicator"
                                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 rounded-full border-4 animate-spin"
                        style={{ borderColor: 'var(--color-outline)', borderTopColor: 'var(--color-primary)' }} />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="text-center py-8" style={{ color: 'var(--color-error)' }}>加载失败: {(error as any).message}</div>
            )}

            {/* Interview List */}
            {!isLoading && !error && (
                <div className="space-y-3">
                    {interviews.map((iv: any, i: number) => {
                        const cfg = statusConfig[iv.status] || statusConfig.pending;
                        return (
                            <motion.div
                                key={iv.id}
                                className="card card-hover cursor-pointer"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}
                                        >
                                            {iv.candidate?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-title-medium">{iv.candidate?.name || 'Unknown'}</p>
                                            <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                                {iv.job?.title || '-'} · {iv.type === 'ai_interview' ? 'AI 面试' : iv.type === 'technical' ? '技术面试' : iv.type === 'behavioral' ? '行为面试' : iv.type === 'hr_interview' ? 'HR 面试' : iv.type}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            {iv.startTime ? new Date(iv.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {iv.duration ? ` · ${iv.duration}min` : ''}
                                        </span>
                                        <span className={`chip ${cfg.chip}`}>
                                            <cfg.icon size={14} />
                                            {cfg.label}
                                        </span>
                                        {(iv.status === 'active' || iv.status === 'in_progress') && (
                                            <button
                                                className="btn btn-tonal"
                                                style={{ height: 32, fontSize: 13 }}
                                                onClick={() => window.open(`/interviews/${iv.id}/monitor`, '_blank')}
                                            >
                                                {t('interviews.monitor')}
                                            </button>
                                        )}
                                        {(iv.status === 'pending' || iv.status === 'upcoming') && iv.token && (
                                            <button
                                                className="btn btn-outlined"
                                                style={{ height: 32, fontSize: 13 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyLink(iv.token);
                                                }}
                                            >
                                                <Copy size={14} />
                                                {t('interviews.copyLink')}
                                            </button>
                                        )}
                                        {iv.status === 'completed' && (
                                            <button className="btn btn-text" style={{ height: 32, fontSize: 13 }}>
                                                {t('interviews.viewReport')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                    {interviews.length === 0 && (
                        <EmptyState
                            icon={Video}
                            title={t('interviews.emptyTitle') || '暂无面试'}
                            subtitle={t('interviews.emptySubtitle') || '创建 AI 面试，自动生成候选人面试链接'}
                            actionLabel={t('interviews.create')}
                            actionIcon={Plus}
                            onAction={() => setShowCreateModal(true)}
                        />
                    )}
                </div>
            )}

            {/* Create Interview Modal */}
            <CreateInterviewModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    );
};

export default InterviewsPage;
