// HireFlow AI — Add Job Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Briefcase, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

const jobSchema = z.object({
    title: z.string().min(2, '职位名称至少 2 个字符'),
    department: z.string().min(1, '请填写部门'),
    location: z.string().min(1, '请填写工作地点'),
    status: z.string().default('draft'),
    description: z.string().optional(),
    requirements: z.string().optional(), // comma-separated
    salaryMin: z.number().optional(),
    salaryMax: z.number().optional(),
});

type JobFormData = z.infer<typeof jobSchema>;

interface AddJobModalProps {
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

export const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(jobSchema),
        defaultValues: { status: 'draft', title: '', department: '', location: '', description: '', requirements: '' },
    });

    const createMutation = useMutation({
        mutationFn: async (data: JobFormData) => {
            const payload: any = {
                title: data.title,
                department: data.department,
                location: data.location,
                status: data.status,
                type: 'full-time',
                descriptionJd: data.description || '',
                requirements: data.requirements ? data.requirements.split(',').map(s => s.trim()).filter(Boolean) : [],
            };
            if (data.salaryMin && data.salaryMax) {
                payload.salaryRange = { min: data.salaryMin, max: data.salaryMax, currency: 'CNY' };
            } else {
                payload.salaryRange = { min: 0, max: 0, currency: 'CNY' };
            }
            const res = await api.post('/jobs', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('岗位创建成功！');
            reset();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '创建失败，请重试');
        },
    });

    useEffect(() => {
        if (isOpen) reset({ status: 'draft' });
    }, [isOpen, reset]);

    const onSubmit = (data: any) => {
        createMutation.mutate(data as JobFormData);
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
                                    <Briefcase size={20} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <h2 className="text-title-large">创建岗位</h2>
                            </div>
                            <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                            {/* Title */}
                            <div>
                                <label className="m3-label">职位名称 *</label>
                                <input {...register('title')} className={`m3-input ${errors.title ? 'm3-input--error' : ''}`} placeholder="例: 高级前端工程师" />
                                {errors.title && <p className="m3-error">{errors.title.message}</p>}
                            </div>

                            {/* Department + Location */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">部门 *</label>
                                    <input {...register('department')} className={`m3-input ${errors.department ? 'm3-input--error' : ''}`} placeholder="技术部" />
                                    {errors.department && <p className="m3-error">{errors.department.message}</p>}
                                </div>
                                <div>
                                    <label className="m3-label">工作地点 *</label>
                                    <input {...register('location')} className={`m3-input ${errors.location ? 'm3-input--error' : ''}`} placeholder="北京" />
                                    {errors.location && <p className="m3-error">{errors.location.message}</p>}
                                </div>
                            </div>

                            {/* Status + Requirements */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">状态</label>
                                    <select {...register('status')} className="m3-input">
                                        <option value="draft">草稿</option>
                                        <option value="active">招聘中</option>
                                        <option value="closed">已关闭</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="m3-label">技能要求 (逗号分隔)</label>
                                    <input {...register('requirements')} className="m3-input" placeholder="React, TypeScript" />
                                </div>
                            </div>

                            {/* Salary Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">最低薪资 (¥)</label>
                                    <input {...register('salaryMin', { valueAsNumber: true })} type="number" className="m3-input" placeholder="15000" />
                                </div>
                                <div>
                                    <label className="m3-label">最高薪资 (¥)</label>
                                    <input {...register('salaryMax', { valueAsNumber: true })} type="number" className="m3-input" placeholder="30000" />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="m3-label">岗位描述</label>
                                <textarea
                                    {...register('description')}
                                    className="m3-input"
                                    rows={3}
                                    placeholder="职位职责和要求..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-text" onClick={onClose}>取消</button>
                                <button type="submit" className="btn btn-filled" disabled={createMutation.isPending} style={{ minWidth: 120 }}>
                                    {createMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> 创建中...</>
                                    ) : (
                                        <><Briefcase size={16} /> 创建岗位</>
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
