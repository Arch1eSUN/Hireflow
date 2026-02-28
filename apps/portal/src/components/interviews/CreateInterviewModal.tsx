// HireFlow AI — Create Interview Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Video,
    Loader2,
    ChevronDown,
    Calendar,
    Briefcase,
    User,
    Sparkles,
    RefreshCw,
    AlertCircle,
    ListChecks,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
import { cn } from '@hireflow/utils/src/index';
import api from '@/lib/api';

const interviewSchema = z.object({
    candidateId: z.string().min(1, 'Please select a candidate'),
    jobId: z.string().min(1, 'Please select a job'),
    type: z.string().default('ai_interview'),
    startTime: z.string().min(1, 'Please select a start time'),
});

type InterviewFormData = z.infer<typeof interviewSchema>;

interface CreateInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type XiaofanQuestionPlan = {
    source: 'ai' | 'fallback';
    roleSummary: string;
    focusAreas: string[];
    coreQuestions: string[];
    followups: string[];
    model?: string;
};

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, damping: 25, stiffness: 350 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
};

export const CreateInterviewModal: React.FC<CreateInterviewModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const { t } = useI18n();
    const [questionPlan, setQuestionPlan] = useState<XiaofanQuestionPlan | null>(null);
    const [questionPlanError, setQuestionPlanError] = useState<string | null>(null);
    const [questionPlanMeta, setQuestionPlanMeta] = useState<{ provider?: string | null; model?: string | null }>({});

    // Queries need to be defined before they are used
    const { data: jobsData } = useQuery({
        queryKey: ['jobs-list'],
        queryFn: async () => {
            const res = await api.get('/jobs', { params: { pageSize: 100 } });
            return res.data.data;
        },
        enabled: isOpen,
    });

    const { data: candidatesData } = useQuery({
        queryKey: ['candidates-list'],
        queryFn: async () => {
            const res = await api.get('/candidates', { params: { pageSize: 100 } });
            return res.data.data;
        },
        enabled: isOpen,
    });

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(interviewSchema),
        defaultValues: { type: 'ai_interview', candidateId: '', jobId: '', startTime: '' },
    });
    const watchCandidateId = watch('candidateId');
    const watchJobId = watch('jobId');
    const watchType = watch('type');

    const selectedCandidate = useMemo(
        () => (candidatesData || []).find((c: any) => c.id === watchCandidateId) || null,
        [candidatesData, watchCandidateId]
    );
    const selectedJob = useMemo(
        () => (jobsData || []).find((j: any) => j.id === watchJobId) || null,
        [jobsData, watchJobId]
    );

    const previewPlanMutation = useMutation({
        mutationFn: async () => {
            const candidateId = String(watchCandidateId || '').trim();
            const jobId = String(watchJobId || '').trim();
            const type = String(watchType || 'ai_interview').trim();
            if (!candidateId || !jobId) {
                throw new Error('请先选择候选人与岗位，再生成小梵面试问题。');
            }
            const res = await api.post('/interviews/question-plan-preview', {
                candidateId,
                jobId,
                type,
            });
            return res.data.data as {
                plan: XiaofanQuestionPlan;
                runtime?: { provider?: string | null; model?: string | null };
            };
        },
        onSuccess: (payload) => {
            setQuestionPlan(payload?.plan || null);
            setQuestionPlanError(null);
            setQuestionPlanMeta({
                provider: payload?.runtime?.provider || null,
                model: payload?.runtime?.model || null,
            });
            toast.success('小梵问题计划已生成');
        },
        onError: (err: any) => {
            const message = err?.response?.data?.error || err?.message || '小梵问题计划生成失败';
            setQuestionPlanError(typeof message === 'string' ? message : '小梵问题计划生成失败');
            setQuestionPlan(null);
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: InterviewFormData) => {
            const payload = {
                ...data,
                startTime: new Date(data.startTime).toISOString(),
                questionPlanSnapshot: data.type === 'ai_interview' ? (questionPlan || undefined) : undefined,
            };
            const res = await api.post('/interviews', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
            toast.success(t('interviews.toast.success'));
            reset();
            setQuestionPlan(null);
            setQuestionPlanError(null);
            setQuestionPlanMeta({});
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || t('interviews.toast.fail'));
        },
    });

    useEffect(() => {
        if (isOpen) {
            reset({ type: 'ai_interview', candidateId: '', jobId: '', startTime: '' });
            setQuestionPlan(null);
            setQuestionPlanError(null);
            setQuestionPlanMeta({});
        }
    }, [isOpen, reset]);

    useEffect(() => {
        setQuestionPlan(null);
        setQuestionPlanError(null);
        setQuestionPlanMeta({});
    }, [watchCandidateId, watchJobId, watchType]);

    const onSubmit = (data: any) => {
        createMutation.mutate(data as InterviewFormData);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="absolute inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 sm:p-6"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <motion.div
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                        variants={overlayVariants}
                        onClick={onClose}
                    />

                    <motion.div
                        className="relative w-full max-w-2xl bg-[var(--color-surface)] rounded-[16px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        variants={modalVariants}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline)] bg-[var(--color-surface-dim)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-primary-container)] text-[var(--color-primary)]">
                                    <Video size={20} />
                                </div>
                                <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">{t('interviews.createTitle')}</h2>
                            </div>
                            <button className="btn-icon w-8 h-8 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <form id="create-interview-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Candidate */}
                                <div>
                                    <label className="m3-label flex items-center gap-2">
                                        <User size={14} /> {t('interviews.field.candidate')} <span className="text-[var(--color-error)]">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            {...register('candidateId')}
                                            className={cn("m3-input h-10 appearance-none bg-inherit pr-8 cursor-pointer", errors.candidateId && "m3-input--error")}
                                        >
                                            <option value="">{t('interviews.placeholder.candidate')}</option>
                                            {(candidatesData || []).map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                                    </div>
                                    {errors.candidateId && <p className="m3-error">{errors.candidateId.message}</p>}
                                </div>

                                {/* Job */}
                                <div>
                                    <label className="m3-label flex items-center gap-2">
                                        <Briefcase size={14} /> {t('interviews.field.job')} <span className="text-[var(--color-error)]">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            {...register('jobId')}
                                            className={cn("m3-input h-10 appearance-none bg-inherit pr-8 cursor-pointer", errors.jobId && "m3-input--error")}
                                        >
                                            <option value="">{t('interviews.placeholder.job')}</option>
                                            {(jobsData || []).map((j: any) => (
                                                <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                                    </div>
                                    {errors.jobId && <p className="m3-error">{errors.jobId.message}</p>}
                                </div>

                                {/* Type + Time */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="m3-label">{t('interviews.field.type')}</label>
                                        <div className="relative">
                                            <select {...register('type')} className="m3-input h-10 appearance-none bg-inherit pr-8 cursor-pointer">
                                                <option value="ai_interview">{t('interviews.type.ai')}</option>
                                                <option value="technical">{t('interviews.type.technical')}</option>
                                                <option value="behavioral">{t('interviews.type.behavioral')}</option>
                                                <option value="hr_interview">{t('interviews.type.hr')}</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="m3-label flex items-center gap-2">
                                            <Calendar size={14} /> {t('interviews.field.time')} <span className="text-[var(--color-error)]">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                {...register('startTime')}
                                                type="datetime-local"
                                                className={cn("m3-input h-10", errors.startTime && "m3-input--error")}
                                            />
                                        </div>
                                        {errors.startTime && <p className="m3-error">{errors.startTime.message}</p>}
                                    </div>
                                </div>

                                {/* XiaoFan Question Plan */}
                                <div className="rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface-dim)] p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-[var(--color-primary-container)] text-[var(--color-primary)] flex items-center justify-center">
                                                <ListChecks size={14} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">小梵语音面试问题计划</p>
                                                <p className="text-xs text-[var(--color-text-secondary)]">
                                                    根据岗位与候选人自动生成，供面试前校准方向
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-outlined h-8 px-3 text-xs"
                                            onClick={() => previewPlanMutation.mutate()}
                                            disabled={previewPlanMutation.isPending || !watchCandidateId || !watchJobId}
                                        >
                                            {previewPlanMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            {questionPlan ? '刷新计划' : '生成计划'}
                                        </button>
                                    </div>

                                    {!watchCandidateId || !watchJobId ? (
                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                            请先选择候选人与岗位，再生成小梵问题计划。
                                        </div>
                                    ) : null}

                                    {questionPlanError && (
                                        <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error)] flex items-start gap-2">
                                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                            <span>{questionPlanError}</span>
                                        </div>
                                    )}

                                    {questionPlan && (
                                        <div className="space-y-2">
                                            <div className="text-xs text-[var(--color-text-secondary)] flex flex-wrap items-center gap-2">
                                                <span className="chip chip-info">{questionPlan.source === 'ai' ? 'AI生成' : 'Fallback'}</span>
                                                {questionPlanMeta.provider ? <span>provider: {questionPlanMeta.provider}</span> : null}
                                                {questionPlan.model || questionPlanMeta.model ? (
                                                    <span>model: {questionPlan.model || questionPlanMeta.model}</span>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-[var(--color-text-primary)]">
                                                {questionPlan.roleSummary}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-3">
                                                    <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                                        Core Questions
                                                    </p>
                                                    <ol className="text-xs text-[var(--color-text-primary)] space-y-1 list-decimal list-inside">
                                                        {questionPlan.coreQuestions.map((item, idx) => (
                                                            <li key={`q-${idx}`}>{item}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                                <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-3">
                                                    <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                                        Focus Areas
                                                    </p>
                                                    <ul className="text-xs text-[var(--color-text-primary)] space-y-1 list-disc list-inside">
                                                        {questionPlan.focusAreas.map((item, idx) => (
                                                            <li key={`f-${idx}`}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {watchType !== 'ai_interview' && (
                                        <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                                            <Sparkles size={12} />
                                            当前面试类型不是 AI Interview，题目计划仅作为参考，不会注入到小梵语音流程。
                                        </div>
                                    )}
                                    {selectedCandidate && selectedJob && (
                                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                                            当前对象：{selectedCandidate.name} · {selectedJob.title}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--color-outline)] bg-[var(--color-surface-dim)] flex justify-end gap-3 shrink-0 rounded-b-[16px]">
                            <button type="button" className="btn btn-text hover:bg-[var(--color-surface-active)]" onClick={onClose}>
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                form="create-interview-form"
                                className="btn btn-filled min-w-[100px]"
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <><Loader2 size={16} className="animate-spin" /> {t('common.creating')}</>
                                ) : (
                                    <><Video size={16} /> {t('interviews.addAction')}</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
