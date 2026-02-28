// HireFlow AI — 团队管理页 (Real API)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Shield, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@hireflow/types';
import { ErrorState } from '@/components/ui/ErrorState';

const roleOptions = [
    { value: 'admin', label: 'team.role.admin' },
    { value: 'hr_manager', label: 'team.role.hr_manager' },
    { value: 'interviewer', label: 'team.role.interviewer' },
    { value: 'viewer', label: 'team.role.viewer' },
];

const TeamPage: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const { data: members, isLoading, isError, refetch } = useQuery<User[]>({
        queryKey: ['team'],
        queryFn: async () => {
            const res = await api.get<{ data: User[] }>('/team');
            return res.data.data;
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ id, role }: { id: string; role: string }) => {
            const res = await api.put(`/team/${id}`, { role });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team'] });
            toast.success(t('team.toast.roleUpdated'));
            setEditingRole(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || t('team.toast.updateFailed'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`/team/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team'] });
            toast.success(t('team.toast.memberRemoved'));
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || t('team.toast.removeFailed'));
        },
    });

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

    if (isLoading) {
        return (
            <div className="page-shell">
                <div className="page-header">
                    <h1 className="page-title">{t('team.title')}</h1>
                </div>
                <div className="card p-0 overflow-hidden animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                            <div className="w-8 h-8 rounded-full bg-gray-200" />
                            <div className="flex-1 space-y-2">
                                <div className="w-24 h-4 rounded bg-gray-200" />
                                <div className="w-40 h-3 rounded bg-gray-200" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <ErrorState
                title={t('analytics.loadFailed')}
                message={t('error.network')}
                onRetry={() => {
                    void refetch();
                }}
            />
        );
    }

    return (
        <div className="page-shell">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('team.title')}</h1>
                    <p className="page-subtitle">{t('common.total')} {members?.length || 0}</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-filled">
                        <UserPlus size={18} />
                        {t('team.inviteMember')}
                    </button>
                </div>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th>{t('common.name')}</th>
                            <th>{t('common.email')}</th>
                            <th>{t('common.role')}</th>
                            <th>{t('team.joinedAt')}</th>
                            {isAdmin && <th style={{ width: 48 }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {(members || []).map((m: any, i: number) => (
                            <motion.tr
                                key={m.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                                            {m.name.charAt(0)}
                                        </div>
                                        <span className="text-label-large">
                                            {m.name}
                                            {m.id === currentUser?.id && (
                                                <span className="text-label-small ml-2" style={{ color: 'var(--color-on-surface-variant)' }}>({t('team.you')})</span>
                                            )}
                                        </span>
                                    </div>
                                </td>
                                <td className="text-body-medium">{m.email}</td>
                                <td>
                                    {editingRole === m.id && isAdmin ? (
                                        <select
                                            defaultValue={m.role}
                                            onChange={(e) => {
                                                updateRoleMutation.mutate({ id: m.id, role: e.target.value });
                                            }}
                                            onBlur={() => setEditingRole(null)}
                                            autoFocus
                                            className="input-compact"
                                            style={{
                                                width: 'auto',
                                                backgroundColor: 'var(--color-surface)',
                                                border: '1px solid var(--color-primary)',
                                                color: 'var(--color-on-surface)',
                                                fontSize: 13,
                                            }}
                                        >
                                            {roleOptions.map((r) => (
                                                <option key={r.value} value={r.value}>{t(r.label)}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span
                                            className={`chip ${m.role === 'owner' ? 'chip-primary' :
                                                m.role === 'admin' ? 'chip-primary' :
                                                    m.role === 'hr_manager' ? 'chip-success' :
                                                        m.role === 'interviewer' ? 'chip-warning' :
                                                            'chip-neutral'
                                                }`}
                                            style={{ cursor: isAdmin && m.id !== currentUser?.id ? 'pointer' : 'default' }}
                                            onClick={() => {
                                                if (isAdmin && m.id !== currentUser?.id) {
                                                    setEditingRole(m.id);
                                                }
                                            }}
                                        >
                                            <Shield size={12} />
                                            {t(`team.role.${m.role}`)}
                                        </span>
                                    )}
                                </td>
                                <td className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '-'}
                                </td>
                                {isAdmin && (
                                    <td>
                                        {m.id !== currentUser?.id && (
                                            <div className="table-action-reveal justify-end">
                                                <button
                                                    className="btn-icon"
                                                    style={{ color: 'var(--color-error)' }}
                                                    onClick={() => setDeleteTarget({ id: m.id, name: m.name })}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
                            <h3 className="text-title-large mb-2">{t('team.removeConfirmTitle')}</h3>
                            <p className="text-body-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {t('team.removeConfirmDesc', { name: deleteTarget.name })}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button className="btn btn-text" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
                                <button
                                    className="btn btn-filled"
                                    style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                                    onClick={() => deleteMutation.mutate(deleteTarget.id)}
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {t('team.action.remove')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TeamPage;
