// HireFlow AI — Add Candidate Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

const candidateSchema = z.object({
    name: z.string().min(2, '姓名至少 2 个字符'),
    email: z.string().email('请输入有效的邮箱地址'),
    phone: z.string().optional(),
    jobId: z.string().min(1, '请选择应聘岗位'),
    stage: z.string().default('applied'),
    source: z.string().optional(),
    skills: z.string().optional(), // comma-separated, parsed before submit
    score: z.number().min(0).max(100).optional(),
});

type CandidateFormData = z.infer<typeof candidateSchema>;

interface AddCandidateModalProps {
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

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(candidateSchema),
        defaultValues: { stage: 'applied', name: '', email: '', jobId: '', phone: '', source: '', skills: '' },
    });

    // Fetch jobs for the dropdown
    const { data: jobsData } = useQuery({
        queryKey: ['jobs-list'],
        queryFn: async () => {
            const res = await api.get('/jobs', { params: { pageSize: 100 } });
            return res.data.data;
        },
        enabled: isOpen,
    });

    const createMutation = useMutation({
        mutationFn: async (data: CandidateFormData) => {
            const payload = {
                ...data,
                skills: data.skills ? data.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
                score: data.score || undefined,
            };
            const res = await api.post('/candidates', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            toast.success('候选人添加成功！');
            reset();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '添加失败，请重试');
        },
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) reset({ stage: 'applied' });
    }, [isOpen, reset]);

    const onSubmit = (data: any) => {
        createMutation.mutate(data as CandidateFormData);
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
                    {/* Overlay */}
                    <motion.div
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                        onClick={onClose}
                    />

                    {/* Modal */}
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
                                    <UserPlus size={20} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <h2 className="text-title-large">添加候选人</h2>
                            </div>
                            <button className="btn-icon" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="m3-label">姓名 *</label>
                                <input
                                    {...register('name')}
                                    className={`m3-input ${errors.name ? 'm3-input--error' : ''}`}
                                    placeholder="例: 张三"
                                />
                                {errors.name && <p className="m3-error">{errors.name.message}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="m3-label">邮箱 *</label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className={`m3-input ${errors.email ? 'm3-input--error' : ''}`}
                                    placeholder="candidate@example.com"
                                />
                                {errors.email && <p className="m3-error">{errors.email.message}</p>}
                            </div>

                            {/* Phone + Job (side by side) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">电话</label>
                                    <input
                                        {...register('phone')}
                                        className="m3-input"
                                        placeholder="138xxxx"
                                    />
                                </div>
                                <div>
                                    <label className="m3-label">应聘岗位 *</label>
                                    <select
                                        {...register('jobId')}
                                        className={`m3-input ${errors.jobId ? 'm3-input--error' : ''}`}
                                    >
                                        <option value="">选择岗位</option>
                                        {(jobsData || []).map((j: any) => (
                                            <option key={j.id} value={j.id}>{j.title}</option>
                                        ))}
                                    </select>
                                    {errors.jobId && <p className="m3-error">{errors.jobId.message}</p>}
                                </div>
                            </div>

                            {/* Source + Skills */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">来源</label>
                                    <input
                                        {...register('source')}
                                        className="m3-input"
                                        placeholder="例: BOSS直聘"
                                    />
                                </div>
                                <div>
                                    <label className="m3-label">技能 (逗号分隔)</label>
                                    <input
                                        {...register('skills')}
                                        className="m3-input"
                                        placeholder="React, Node.js"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-text" onClick={onClose}>
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-filled"
                                    disabled={createMutation.isPending}
                                    style={{ minWidth: 120 }}
                                >
                                    {createMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> 提交中...</>
                                    ) : (
                                        <><UserPlus size={16} /> 添加候选人</>
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
