// HireFlow AI — 岗位管理页
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, MapPin, Users, Clock } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import { MOCK_JOBS } from '@/data/mockData';

const JobsPage: React.FC = () => {
    const { t } = useI18n();

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('jobs.title')}</h1>
                <button className="btn btn-filled">
                    <Plus size={18} />
                    {t('jobs.createJob')}
                </button>
            </div>

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-on-surface-variant)' }} />
                <input
                    type="text"
                    className="input-compact w-full pl-10"
                    placeholder={t('jobs.searchPlaceholder')}
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {MOCK_JOBS.map((job, i) => (
                    <motion.div
                        key={job.id}
                        className="card card-hover cursor-pointer"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-title-large">{job.title}</h3>
                                <p className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{job.department}</p>
                            </div>
                            <span className={`chip chip-${job.status === 'active' ? 'success' : job.status === 'draft' ? 'neutral' : 'warning'}`}>
                                {t(`jobs.status.${job.status}`)}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-body-medium mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="flex items-center gap-1"><MapPin size={14} /> {job.location}</span>
                            <span className="flex items-center gap-1"><Users size={14} /> {t('jobs.candidates', { count: job.candidateCount || 0 })}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {job.requirements.slice(0, 2).map((r) => (
                                <span key={r} className="chip chip-neutral text-xs" style={{ height: 24, padding: '0 8px', fontSize: 12 }}>{r}</span>
                            ))}
                        </div>
                        {job.salaryRange && (
                            <p className="text-label-large" style={{ color: 'var(--color-primary)' }}>
                                ¥{(job.salaryRange.min / 1000).toFixed(0)}K - ¥{(job.salaryRange.max / 1000).toFixed(0)}K
                            </p>
                        )}

                        {/* Pipeline progress */}
                        <div className="flex gap-1 mt-4">
                            {job.pipeline.map((stage, si) => (
                                <div
                                    key={stage.id}
                                    className="flex-1 h-1.5 rounded-full"
                                    style={{
                                        backgroundColor: si <= 2 ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default JobsPage;
