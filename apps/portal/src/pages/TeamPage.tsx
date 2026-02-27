// HireFlow AI — 团队管理页 (Real API)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Shield, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@hireflow/types';

const roleOptions = [
    { value: 'admin', label: '管理员' },
    { value: 'hr_manager', label: 'HR 主管' },
    { value: 'interviewer', label: '面试官' },
    { value: 'viewer', label: '只读成员' },
];

const TeamPage: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const { data: members, isLoading, error } = useQuery<User[]>({
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
            toast.success('角色已更新');
            setEditingRole(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '更新失败');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`/team/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team'] });
            toast.success('成员已移除');
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '移除失败');
        },
    });

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-headline-large">{t('team.title')}</h1>
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

    if (error) {
        return (
            <div className="space-y-5">
                <h1 className="text-headline-large">{t('team.title')}</h1>
                <div className="text-center py-16" style={{ color: 'var(--color-error)' }}>
                    加载团队数据失败
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('team.title')}</h1>
                <button className="btn btn-filled">
                    <UserPlus size={18} />
                    {t('team.inviteMember')}
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th>{t('common.name')}</th>
                            <th>{t('common.email')}</th>
                            <th>{t('common.role')}</th>
                            <th>加入时间</th>
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
                                                <span className="text-label-small ml-2" style={{ color: 'var(--color-on-surface-variant)' }}>(你)</span>
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
                                                <option key={r.value} value={r.value}>{r.label}</option>
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
                                            <button
                                                className="btn-icon"
                                                style={{ color: 'var(--color-error)' }}
                                                onClick={() => setDeleteTarget({ id: m.id, name: m.name })}
                                            >
                                                <Trash2 size={16} />
                                            </button>
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
                            <h3 className="text-title-large mb-2">确认移除</h3>
                            <p className="text-body-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                                确定要从团队中移除 <strong>{deleteTarget.name}</strong> 吗？
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
                                    移除
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
