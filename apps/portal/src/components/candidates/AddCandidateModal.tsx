// HireFlow AI — Add Candidate Modal (React Hook Form + Zod + M3 Filled Inputs)
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
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
    const { t } = useI18n();

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
            toast.success(t('candidate.toast.success'));
            reset();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || t('candidate.toast.fail'));
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
                    // ...
                >
                    {/* ... */}
                    <motion.div
                        // ...
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-container)' }}>
                                    <UserPlus size={20} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <h2 className="text-title-large">{t('candidate.addTitle')}</h2>
                            </div>
                            <button className="btn-icon" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="m3-label">{t('candidate.field.name')} *</label>
                                <input
                                    {...register('name')}
                                    className={`m3-input ${errors.name ? 'm3-input--error' : ''}`}
                                    placeholder={t('candidate.placeholder.name')}
                                />
                                {errors.name && <p className="m3-error">{errors.name.message}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="m3-label">{t('candidate.field.email')} *</label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className={`m3-input ${errors.email ? 'm3-input--error' : ''}`}
                                    placeholder={t('candidate.placeholder.email')}
                                />
                                {errors.email && <p className="m3-error">{errors.email.message}</p>}
                            </div>

                            {/* Phone + Job (side by side) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="m3-label">{t('candidate.field.phone')}</label>
                                    <input
                                        {...register('phone')}
                                        className="m3-input"
                                        placeholder={t('candidate.placeholder.phone')}
                                    />
                                </div>
                                <div>
                                    <label className="m3-label">{t('candidate.field.job')} *</label>
                                    <select
                                        {...register('jobId')}
                                        className={`m3-input ${errors.jobId ? 'm3-input--error' : ''}`}
                                    >
                                        <option value="">{t('candidate.placeholder.job')}</option>
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
                                    <label className="m3-label">{t('candidate.field.source')}</label>
                                    <input
                                        {...register('source')}
                                        className="m3-input"
                                        placeholder={t('candidate.placeholder.source')}
                                    />
                                </div>
                                <div>
                                    <label className="m3-label">{t('candidate.field.skills')}</label>
                                    <input
                                        {...register('skills')}
                                        className="m3-input"
                                        placeholder={t('candidate.placeholder.skills')}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-text" onClick={onClose}>
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-filled"
                                    disabled={createMutation.isPending}
                                    style={{ minWidth: 120 }}
                                >
                                    {createMutation.isPending ? (
                                        <><Loader2 size={16} className="animate-spin" /> {t('common.submitting')}</>
                                    ) : (
                                        <><UserPlus size={16} /> {t('candidate.addAction')}</>
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
