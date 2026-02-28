// HireFlow AI — Add Job Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Briefcase, Loader2, ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
import { cn } from '@hireflow/utils/src/index';
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
    const { t } = useI18n();

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
            toast.success(t('jobs.toast.success'));
            reset();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || t('jobs.toast.fail'));
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
                                    <Briefcase size={20} />
                                </div>
                                <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">{t('jobs.addTitle')}</h2>
                            </div>
                            <button className="btn-icon w-8 h-8 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <form id="add-job-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Title */}
                                <div>
                                    <label className="m3-label">{t('jobs.field.title')} <span className="text-[var(--color-error)]">*</span></label>
                                    <input
                                        {...register('title')}
                                        className={cn("m3-input h-10", errors.title && "m3-input--error")}
                                        placeholder={t('jobs.placeholder.title')}
                                    />
                                    {errors.title && <p className="m3-error">{errors.title.message}</p>}
                                </div>

                                {/* Department + Location */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="m3-label">{t('jobs.field.department')} <span className="text-[var(--color-error)]">*</span></label>
                                        <input
                                            {...register('department')}
                                            className={cn("m3-input h-10", errors.department && "m3-input--error")}
                                            placeholder={t('jobs.placeholder.department')}
                                        />
                                        {errors.department && <p className="m3-error">{errors.department.message}</p>}
                                    </div>
                                    <div>
                                        <label className="m3-label">{t('jobs.field.location')} <span className="text-[var(--color-error)]">*</span></label>
                                        <input
                                            {...register('location')}
                                            className={cn("m3-input h-10", errors.location && "m3-input--error")}
                                            placeholder={t('jobs.placeholder.location')}
                                        />
                                        {errors.location && <p className="m3-error">{errors.location.message}</p>}
                                    </div>
                                </div>

                                {/* Status + Requirements */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="m3-label">{t('jobs.field.status')}</label>
                                        <div className="relative">
                                            <select {...register('status')} className="m3-input h-10 appearance-none bg-transparent pr-8 cursor-pointer">
                                                <option value="draft">{t('jobs.status.draft')}</option>
                                                <option value="active">{t('jobs.status.active')}</option>
                                                <option value="closed">{t('jobs.status.closed')}</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="m3-label">{t('jobs.field.requirements')}</label>
                                        <input
                                            {...register('requirements')}
                                            className="m3-input h-10"
                                            placeholder={t('jobs.placeholder.requirements')}
                                        />
                                    </div>
                                </div>

                                {/* Salary Range */}
                                <div>
                                    <label className="m3-label">{t('jobs.salary')}</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-2.5 text-[var(--color-text-secondary)] text-sm">¥</span>
                                            <input
                                                {...register('salaryMin', { valueAsNumber: true })}
                                                type="number"
                                                className="m3-input h-10 pl-7"
                                                placeholder={t('jobs.placeholder.salaryMin')}
                                            />
                                        </div>
                                        <span className="text-[var(--color-text-secondary)]">-</span>
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-2.5 text-[var(--color-text-secondary)] text-sm">¥</span>
                                            <input
                                                {...register('salaryMax', { valueAsNumber: true })}
                                                type="number"
                                                className="m3-input h-10 pl-7"
                                                placeholder={t('jobs.placeholder.salaryMax')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="m3-label">{t('jobs.field.description')}</label>
                                    <textarea
                                        {...register('description')}
                                        className="m3-input min-h-[120px] py-3 resize-y"
                                        placeholder={t('jobs.placeholder.description')}
                                    />
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
                                form="add-job-form"
                                className="btn btn-filled min-w-[100px]"
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <><Loader2 size={16} className="animate-spin" /> {t('common.creating')}</>
                                ) : (
                                    <><Briefcase size={16} /> {t('jobs.addAction')}</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
