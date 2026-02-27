// HireFlow AI — Create Interview Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

const interviewSchema = z.object({
    candidateId: z.string().min(1, '请选择候选人'),
    jobId: z.string().min(1, '请选择关联岗位'),
    type: z.string().default('ai_interview'),
    startTime: z.string().min(1, '请选择面试时间'),
});

type InterviewFormData = z.infer<typeof interviewSchema>;

interface CreateInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

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

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(interviewSchema),
        defaultValues: { type: 'ai_interview', candidateId: '', jobId: '', startTime: '' },
    });

    // Fetch jobs for dropdown
    const { data: jobsData } = useQuery({
        queryKey: ['jobs-list'],
        queryFn: async () => {
            const res = await api.get('/jobs', { params: { pageSize: 100 } });
            return res.data.data;
        },
        enabled: isOpen,
    });

    // Fetch candidates for dropdown
    const { data: candidatesData } = useQuery({
        queryKey: ['candidates-list'],
        queryFn: async () => {
            const res = await api.get('/candidates', { params: { pageSize: 100 } });
            return res.data.data;
        },
        enabled: isOpen,
    });

    const createMutation = useMutation({
        mutationFn: async (data: InterviewFormData) => {
            const payload = {
                ...data,
                startTime: new Date(data.startTime).toISOString(),
            };
            const res = await api.post('/interviews', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
            toast.success('面试已创建！面试链接已生成。');
            reset();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '创建失败，请重试');
        },
    });

    useEffect(() => {
        if (isOpen) reset({ type: 'ai_interview', candidateId: '', jobId: '', startTime: '' });
    }, [isOpen, reset]);

    const onSubmit = (data: any) => {
        createMutation.mutate(data as InterviewFormData);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                >
                    <motion.div
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="relative w-full max-w-lg mx-4 overflow-hidden"
                        style={{
                            backgroundColor: 'var(--color-surface)',
                            borderRadius: '24px',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
                        }}
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-container)' }}>
                                    <Video size={20} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <h2 className="text-title-large">创建面试</h2>
                            </div>
                            <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                            {/* Candidate */}
                            <div>
                                <label className="m3-label">候选人 *</label>
                                <select {...register('candidateId')} className={`m3-input ${errors.candidateId ? 'm3-input--error' : ''}`}>
                                    <option value="">选择候选人</option>
                                    {(candidatesData || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                                    ))}
                                </select>
                                {errors.candidateId && <p className="m3-error">{errors.candidateId.message}</p>}
                            </div>

                            {/* Job */}
                            <div>
                                <label className="m3-label">关联岗位 *</label>
                                <select {...register('jobId')} className={`m3-input ${errors.jobId ? 'm3-input--error' : ''}`}>
                                    <option value="">选择岗位</option>
                                    {(jobsData || []).map((j: any) => (
                                        <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
                                    ))}
                                </select>
                                {errors.jobId && <p className="m3-error">{errors.jobId.message}</p>}
                            </div>

                            {/* Type + Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">面试类型</label>
                                    <select {...register('type')} className="m3-input">
                                        <option value="ai_interview">AI 面试</option>
                                        <option value="technical">技术面试</option>
                                        <option value="behavioral">行为面试</option>
                                        <option value="hr_interview">HR 面试</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="m3-label">面试时间 *</label>
                                    <input
                                        {...register('startTime')}
                                        type="datetime-local"
                                        className={`m3-input ${errors.startTime ? 'm3-input--error' : ''}`}
                                    />
                                    {errors.startTime && <p className="m3-error">{errors.startTime.message}</p>}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-text" onClick={onClose}>取消</button>
                                <button type="submit" className="btn btn-filled" disabled={createMutation.isPending} style={{ minWidth: 120 }}>
                                    {createMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> 创建中...</>
                                    ) : (
                                        <><Video size={16} /> 创建面试</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
