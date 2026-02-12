// HireFlow AI — 面试管理页
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Video, Copy, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

const MOCK_INTERVIEWS = [
    { id: 'iv1', candidate: '陈思远', job: '高级前端工程师', type: '技术面试', status: 'in_progress' as const, time: '2026-02-12 09:00', duration: 45 },
    { id: 'iv2', candidate: '李明辉', job: '高级前端工程师', type: 'AI 一面', status: 'pending' as const, time: '2026-02-12 10:30', duration: 30 },
    { id: 'iv3', candidate: '吴子涵', job: '产品经理', type: '案例分析', status: 'pending' as const, time: '2026-02-12 14:00', duration: 60 },
    { id: 'iv4', candidate: '王芳菲', job: '产品经理', type: 'HR 面试', status: 'completed' as const, time: '2026-02-11 15:00', duration: 40, score: 92 },
    { id: 'iv5', candidate: '孙婉莹', job: '高级前端工程师', type: 'AI 筛选', status: 'completed' as const, time: '2026-02-10 11:00', duration: 25, score: 88 },
];

const statusConfig = {
    pending: { label: '待开始', chip: 'chip-neutral', icon: Clock },
    in_progress: { label: '进行中', chip: 'chip-warning', icon: Video },
    completed: { label: '已完成', chip: 'chip-success', icon: CheckCircle2 },
};

const InterviewsPage: React.FC = () => {
    const { t } = useI18n();
    const [tab, setTab] = useState<'upcoming' | 'in_progress' | 'completed'>('upcoming');

    const filtered = MOCK_INTERVIEWS.filter((iv) => {
        if (tab === 'upcoming') return iv.status === 'pending';
        if (tab === 'in_progress') return iv.status === 'in_progress';
        return iv.status === 'completed';
    });

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('interviews.title')}</h1>
                <button className="btn btn-filled">
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

            {/* 面试列表 */}
            <div className="space-y-3">
                {filtered.map((iv, i) => {
                    const cfg = statusConfig[iv.status];
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
                                        {iv.candidate.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-title-medium">{iv.candidate}</p>
                                        <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            {iv.job} · {iv.type}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                        {iv.time} · {iv.duration}min
                                    </span>
                                    <span className={`chip ${cfg.chip}`}>
                                        <cfg.icon size={14} />
                                        {cfg.label}
                                    </span>
                                    {iv.status === 'in_progress' && (
                                        <button className="btn btn-tonal" style={{ height: 32, fontSize: 13 }}>
                                            {t('interviews.monitor')}
                                        </button>
                                    )}
                                    {iv.status === 'pending' && (
                                        <button className="btn btn-outlined" style={{ height: 32, fontSize: 13 }}>
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
                {filtered.length === 0 && (
                    <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <p className="text-body-large">{t('common.noData')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InterviewsPage;
