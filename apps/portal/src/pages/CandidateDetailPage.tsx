// HireFlow AI — 候选人详情页 (Full CRUD with Timeline)
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, Calendar, Briefcase, Loader2, AlertTriangle, Trash2, Video, Clock, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';

const STAGE_ORDER = ['applied', 'screening', 'interview_1', 'interview_2', 'offer', 'hired'];

const CandidateDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'profile' | 'timeline'>('profile');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { data: candidate, isLoading, error } = useQuery({
        queryKey: ['candidate', id],
        queryFn: async () => {
            const res = await api.get(`/candidates/${id}`);
            return res.data.data;
        },
        enabled: !!id,
    });

    // Fetch interviews for this candidate
    const { data: interviews } = useQuery({
        queryKey: ['candidate-interviews', id],
        queryFn: async () => {
            const res = await api.get('/interviews');
            // Filter to this candidate's interviews
            return (res.data.data || []).filter((iv: any) => iv.candidateId === id);
        },
        enabled: !!id && activeTab === 'timeline',
    });

    const advanceStageMutation = useMutation({
        mutationFn: async (newStage: string) => {
            const res = await api.put(`/candidates/${id}`, { stage: newStage });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidate', id] });
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            toast.success('候选人阶段已更新');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '更新失败');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await api.delete(`/candidates/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            toast.success('候选人已删除');
            navigate('/candidates');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '删除失败');
        },
    });

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-gray-200 animate-pulse" />
                    <div className="w-24 h-4 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="card animate-pulse">
                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-full bg-gray-200" />
                        <div className="flex-1 space-y-3">
                            <div className="w-48 h-6 rounded bg-gray-200" />
                            <div className="w-64 h-4 rounded bg-gray-200" />
                            <div className="w-80 h-4 rounded bg-gray-200" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="w-24 h-4 rounded bg-gray-200 mb-3" />
                            <div className="w-full h-12 rounded bg-gray-200" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error / 404
    if (error || !candidate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <AlertTriangle size={48} style={{ color: 'var(--color-error)' }} />
                <p className="text-body-large" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {error ? '加载失败，请重试' : '候选人不存在'}
                </p>
                <button className="btn btn-outlined" onClick={() => navigate('/candidates')}>
                    返回列表
                </button>
            </div>
        );
    }

    const currentStageIdx = STAGE_ORDER.indexOf(candidate.stage);
    const nextStage = currentStageIdx >= 0 && currentStageIdx < STAGE_ORDER.length - 1
        ? STAGE_ORDER[currentStageIdx + 1] : null;

    const interviewStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />;
            case 'active':
            case 'in_progress': return <Video size={16} style={{ color: 'var(--color-warning)' }} />;
            default: return <Clock size={16} style={{ color: 'var(--color-on-surface-variant)' }} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Back */}
            <button
                onClick={() => navigate('/candidates')}
                className="btn btn-text"
                style={{ padding: '0 8px', height: 32, gap: 4 }}
            >
                <ArrowLeft size={16} />
                {t('candidates.detail.backToList')}
            </button>

            {/* Header Card */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-start gap-5">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold shrink-0"
                        style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}
                    >
                        {candidate.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-headline-large">{candidate.name}</h1>
                            <span className={`chip chip-${candidate.stage === 'offer' || candidate.stage === 'hired' ? 'success' :
                                candidate.stage === 'rejected' ? 'error' : 'primary'
                                }`}>
                                {t(`stage.${candidate.stage}`)}
                            </span>
                        </div>
                        <p className="text-body-medium mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {candidate.job?.title || '-'} · {candidate.job?.department || '-'}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-body-medium flex-wrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="flex items-center gap-1"><Mail size={14} /> {candidate.email}</span>
                            {candidate.phone && <span className="flex items-center gap-1"><Phone size={14} /> {candidate.phone}</span>}
                            <span className="flex items-center gap-1">
                                <Calendar size={14} /> 投递于 {candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : '-'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {candidate.stage !== 'rejected' && nextStage && (
                            <button
                                className="btn btn-filled"
                                onClick={() => advanceStageMutation.mutate(nextStage)}
                                disabled={advanceStageMutation.isPending}
                            >
                                {advanceStageMutation.isPending ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : null}
                                推进至 {t(`stage.${nextStage}`)}
                            </button>
                        )}
                        {candidate.stage !== 'rejected' && (
                            <button
                                className="btn btn-outlined"
                                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                                onClick={() => advanceStageMutation.mutate('rejected')}
                                disabled={advanceStageMutation.isPending}
                            >
                                淘汰
                            </button>
                        )}
                        <button
                            className="btn btn-outlined"
                            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Stage Progress Bar */}
                <div className="flex gap-2 mt-6">
                    {STAGE_ORDER.map((stage, idx) => (
                        <div key={stage} className="flex-1">
                            <div
                                className="h-1.5 rounded-full transition-colors"
                                style={{
                                    backgroundColor: idx <= currentStageIdx ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                                }}
                            />
                            <p className="text-label-small mt-1 text-center" style={{
                                color: idx <= currentStageIdx ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                                fontWeight: idx === currentStageIdx ? 600 : 400,
                            }}>
                                {t(`stage.${stage}`)}
                            </p>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid var(--color-outline)' }}>
                {(['profile', 'timeline'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="px-4 py-3 text-label-large relative"
                        style={{
                            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                    >
                        {tab === 'profile' ? '个人资料' : '面试记录'}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="candidate-tab"
                                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* Skills */}
                    <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <h3 className="text-title-medium mb-3">技能标签</h3>
                        <div className="flex flex-wrap gap-2">
                            {(candidate.skills || []).length > 0 ? (
                                candidate.skills.map((s: string) => (
                                    <span key={s} className="chip chip-primary">{s}</span>
                                ))
                            ) : (
                                <p className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>暂无技能标签</p>
                            )}
                        </div>
                    </motion.div>

                    {/* AI Score */}
                    <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <h3 className="text-title-medium mb-3">AI 匹配分数</h3>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                                style={{
                                    borderColor: (candidate.score || 0) >= 90 ? 'var(--color-success)' :
                                        (candidate.score || 0) >= 75 ? 'var(--color-primary)' :
                                            (candidate.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-error)',
                                }}
                            >
                                <span className="text-display-medium">{candidate.score || '-'}</span>
                            </div>
                            <div className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {(candidate.score || 0) >= 90 ? '强烈推荐' :
                                    (candidate.score || 0) >= 75 ? '推荐' :
                                        (candidate.score || 0) >= 60 ? '待考虑' :
                                            candidate.score ? '不推荐' : '暂未评分'}
                            </div>
                        </div>
                    </motion.div>

                    {/* Basic Info */}
                    <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <h3 className="text-title-medium mb-3">基本信息</h3>
                        <div className="space-y-2 text-body-medium">
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--color-on-surface-variant)' }}>来源</span>
                                <span>{candidate.source || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--color-on-surface-variant)' }}>岗位</span>
                                <span>{candidate.job?.title || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--color-on-surface-variant)' }}>简历</span>
                                <span>{candidate.resumeUrl ? (
                                    <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>查看简历</a>
                                ) : '-'}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {activeTab === 'timeline' && (
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="text-title-medium mb-4">面试记录</h3>
                    {(interviews && interviews.length > 0) ? (
                        <div className="space-y-4">
                            {interviews.map((iv: any) => (
                                <div key={iv.id} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
                                    <div className="mt-0.5">
                                        {interviewStatusIcon(iv.status)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-label-large">
                                                {iv.type === 'ai_interview' ? 'AI 面试' : iv.type === 'technical' ? '技术面试' : iv.type === 'behavioral' ? '行为面试' : iv.type === 'hr_interview' ? 'HR 面试' : iv.type}
                                            </p>
                                            <span className={`chip chip-${iv.status === 'completed' ? 'success' : iv.status === 'active' ? 'warning' : 'neutral'}`} style={{ height: 22, fontSize: 11 }}>
                                                {iv.status === 'completed' ? '已完成' : iv.status === 'active' ? '进行中' : '待开始'}
                                            </span>
                                        </div>
                                        <p className="text-body-medium mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            {iv.job?.title || '-'} · {iv.startTime ? new Date(iv.startTime).toLocaleString() : '-'}
                                        </p>
                                        {iv.endTime && (
                                            <p className="text-label-small mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                                                结束于 {new Date(iv.endTime).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                    {iv.status === 'completed' && (
                                        <button className="btn btn-text" style={{ height: 32, fontSize: 13 }}>查看报告</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <div className="text-center">
                                <Briefcase size={40} className="mx-auto mb-3" style={{ opacity: 0.4 }} />
                                <p className="text-body-large">暂无面试记录</p>
                                <p className="text-body-medium mt-1">当候选人参加面试后，记录会自动出现</p>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setShowDeleteConfirm(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative p-6 rounded-3xl max-w-sm mx-4"
                        style={{
                            backgroundColor: 'var(--color-surface)',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
                        }}
                    >
                        <h3 className="text-title-large mb-2">确认删除</h3>
                        <p className="text-body-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                            确定要删除候选人 <strong>{candidate.name}</strong> 吗？此操作不可撤销。
                        </p>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-text" onClick={() => setShowDeleteConfirm(false)}>取消</button>
                            <button
                                className="btn btn-filled"
                                style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                                onClick={() => deleteMutation.mutate()}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                删除
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default CandidateDetailPage;
