import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { cn } from '@hireflow/utils/src/index';

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    actionUrl?: string;
}

const TYPE_COLORS: Record<string, string> = {
    success: 'bg-green-400',
    warning: 'bg-amber-400',
    error: 'bg-red-400',
    info: 'bg-blue-400',
};

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return new Date(iso).toLocaleDateString();
}

export const NotificationPopover: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    // 后台轮询未读计数（每 30s，始终开启）
    const { data: unreadData } = useQuery<{ count: number }>({
        queryKey: ['notifications', 'unread-count'],
        queryFn: async () => {
            const res = await api.get('/notifications/unread-count');
            return res.data.data || { count: 0 };
        },
        refetchInterval: 30000,
    });
    const unreadCount = unreadData?.count ?? 0;

    // 面板打开时获取通知列表
    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications');
            return res.data.data || [];
        },
        enabled: isOpen,
        refetchInterval: isOpen ? 10000 : false,
    });

    const markReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.post(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        },
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        },
    });

    return (
        <div className="relative">
            <button
                className="btn-icon w-9 h-9 relative"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="通知"
            >
                <Bell
                    size={18}
                    className={cn(
                        'transition-colors',
                        isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]',
                    )}
                />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-[var(--color-error)] rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[var(--z-mask)]"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-12 w-80 bg-[var(--color-surface)] border border-[var(--color-outline)] shadow-[var(--shadow-dropdown)] rounded-[var(--radius-md)] z-[var(--z-popover)] overflow-hidden origin-top-right flex flex-col max-h-[480px]"
                        >
                            {/* Header */}
                            <div className="p-3 border-b border-[var(--color-outline)] flex items-center justify-between bg-[var(--color-surface-dim)]">
                                <h3 className="text-sm font-medium">通知</h3>
                                {unreadCount > 0 && (
                                    <button
                                        className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 disabled:opacity-50"
                                        onClick={() => markAllReadMutation.mutate()}
                                        disabled={markAllReadMutation.isPending}
                                    >
                                        <CheckCheck size={12} />
                                        全部已读
                                    </button>
                                )}
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
                                        暂无新通知
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                'p-3 border-b border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-hover)] transition-colors relative group cursor-pointer',
                                                !n.read && 'bg-[var(--color-primary-container)] bg-opacity-10',
                                            )}
                                            onClick={() => {
                                                if (!n.read) markReadMutation.mutate(n.id);
                                                if (n.actionUrl) {
                                                    setIsOpen(false);
                                                    window.location.href = n.actionUrl;
                                                }
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={cn(
                                                        'w-2 h-2 mt-1.5 rounded-full flex-shrink-0',
                                                        !n.read
                                                            ? TYPE_COLORS[n.type] || 'bg-[var(--color-primary)]'
                                                            : 'bg-transparent',
                                                    )}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        className={cn(
                                                            'text-xs font-medium truncate',
                                                            !n.read
                                                                ? 'text-[var(--color-text-primary)]'
                                                                : 'text-[var(--color-text-secondary)]',
                                                        )}
                                                    >
                                                        {n.title}
                                                    </p>
                                                    <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                                                        {n.message}
                                                    </p>
                                                    <span className="text-[10px] text-[var(--color-text-disabled)] mt-1 block">
                                                        {relativeTime(n.time)}
                                                    </span>
                                                </div>
                                                {!n.read && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markReadMutation.mutate(n.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-outline)] rounded text-[var(--color-text-secondary)] transition-all"
                                                        title="标记已读"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
