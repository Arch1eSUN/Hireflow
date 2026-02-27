// HireFlow AI — 岗位管理页 (Full CRUD with Delete)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MapPin, Users, ChevronDown, Trash2, Loader2, Briefcase } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { AddJobModal } from '@/components/jobs/AddJobModal';
import { EmptyState } from '@/components/ui/EmptyState';

const JobsPage: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

    const debouncedSearch = useDebounce(searchQuery, 300);

    const { data, isLoading, error } = useQuery({
        queryKey: ['jobs', debouncedSearch],
        queryFn: async () => {
            const params: any = {};
            if (debouncedSearch) params.search = debouncedSearch;
            const res = await api.get('/jobs', { params });
            return res.data.data;
        },
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await api.put(`/jobs/${id}`, { status });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('岗位状态已更新');
            setOpenDropdown(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '更新失败');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`/jobs/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('岗位已删除');
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '删除失败');
        },
    });

    const jobs = data || [];

    const statusLabels: Record<string, string> = {
        active: '招聘中',
        draft: '草稿',
        closed: '已关闭',
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('jobs.title')}</h1>
                <button className="btn btn-filled" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} />
                    {t('jobs.createJob')}
                </button>
            </div>

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-on-surface-variant)' }} />
                <input
                    type="text"
                    className="input-compact w-full pl-10"
                    placeholder={t('jobs.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 rounded-full border-4 animate-spin"
                        style={{ borderColor: 'var(--color-outline)', borderTopColor: 'var(--color-primary)' }} />
                </div>
            )}

            {error && (
                <div className="text-center py-8" style={{ color: 'var(--color-error)' }}>加载失败: {(error as any).message}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {jobs.map((job: any, i: number) => (
                    <motion.div
                        key={job.id}
                        className="card card-hover cursor-pointer"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-title-large">{job.title}</h3>
                                <p className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{job.department}</p>
                            </div>
                            {/* Status dropdown */}
                            <div className="relative">
                                <button
                                    className={`chip chip-${job.status === 'active' ? 'success' : job.status === 'draft' ? 'neutral' : 'warning'} flex items-center gap-1`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdown(openDropdown === job.id ? null : job.id);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {statusLabels[job.status] || t(`jobs.status.${job.status}`)}
                                    <ChevronDown size={12} />
                                </button>
                                {openDropdown === job.id && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="absolute right-0 top-full mt-1 z-20 min-w-[120px] py-1 rounded-xl overflow-hidden"
                                        style={{
                                            backgroundColor: 'var(--color-surface)',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
                                            border: '1px solid var(--color-outline-variant)',
                                        }}
                                    >
                                        {['active', 'draft', 'closed'].map((s) => (
                                            <button
                                                key={s}
                                                className="w-full text-left px-4 py-2.5 text-body-medium hover:opacity-80"
                                                style={{
                                                    backgroundColor: job.status === s ? 'var(--color-primary-container)' : 'transparent',
                                                    color: job.status === s ? 'var(--color-primary)' : 'var(--color-on-surface)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (s !== job.status) {
                                                        statusMutation.mutate({ id: job.id, status: s });
                                                    } else {
                                                        setOpenDropdown(null);
                                                    }
                                                }}
                                            >
                                                {statusLabels[s]}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-body-medium mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="flex items-center gap-1"><MapPin size={14} /> {job.location}</span>
                            <span className="flex items-center gap-1"><Users size={14} /> {t('jobs.candidates', { count: job.candidateCount || 0 })}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {(job.requirements || []).slice(0, 2).map((r: string) => (
                                <span key={r} className="chip chip-neutral text-xs" style={{ height: 24, padding: '0 8px', fontSize: 12 }}>{r}</span>
                            ))}
                        </div>
                        {job.salaryRange && (
                            <p className="text-label-large" style={{ color: 'var(--color-primary)' }}>
                                ¥{(job.salaryRange.min / 1000).toFixed(0)}K - ¥{(job.salaryRange.max / 1000).toFixed(0)}K
                            </p>
                        )}

                        {job.pipeline && job.pipeline.length > 0 && (
                            <div className="flex gap-1 mt-4">
                                {job.pipeline.map((stage: any, si: number) => (
                                    <div
                                        key={stage.id}
                                        className="flex-1 h-1.5 rounded-full"
                                        style={{
                                            backgroundColor: si <= 2 ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Delete Button */}
                        <div className="flex justify-end mt-4 pt-3" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                            <button
                                className="btn btn-text"
                                style={{ height: 28, fontSize: 12, color: 'var(--color-error)', gap: 4 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget({ id: job.id, title: job.title });
                                }}
                            >
                                <Trash2 size={14} />
                                删除
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {!isLoading && !error && jobs.length === 0 && (
                <EmptyState
                    icon={Briefcase}
                    title={t('jobs.emptyTitle') || '暂无岗位'}
                    subtitle={t('jobs.emptySubtitle') || '创建您的第一个岗位，开始招聘优秀人才'}
                    actionLabel={t('jobs.createJob')}
                    actionIcon={Plus}
                    onAction={() => setShowAddModal(true)}
                />
            )}

            {/* Add Job Modal */}
            <AddJobModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

            {/* Delete Confirmation */}
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div
                            className="absolute inset-0"
                            style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                            onClick={() => setDeleteTarget(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative p-6 rounded-3xl max-w-sm mx-4"
                            style={{
                                backgroundColor: 'var(--color-surface)',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
                            }}
                        >
                            <h3 className="text-title-large mb-2">确认删除</h3>
                            <p className="text-body-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                                确定要删除岗位 <strong>{deleteTarget.title}</strong> 吗？此操作不可撤销。
                            </p>
                            <div className="flex justify-end gap-3">
                                <button className="btn btn-text" onClick={() => setDeleteTarget(null)}>取消</button>
                                <button
                                    className="btn btn-filled"
                                    style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                                    onClick={() => deleteMutation.mutate(deleteTarget.id)}
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    删除
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default JobsPage;
