// HireFlow AI — 候选人详情页
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Download } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import { MOCK_CANDIDATES, MOCK_JOBS } from '@/data/mockData';

const CandidateDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();

    const candidate = MOCK_CANDIDATES.find((c) => c.id === id);
    const job = candidate ? MOCK_JOBS.find((j) => j.id === candidate.jobId) : undefined;

    if (!candidate) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-body-large" style={{ color: 'var(--color-on-surface-variant)' }}>
                    候选人不存在
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 返回按钮 */}
            <button
                onClick={() => navigate('/candidates')}
                className="btn btn-text"
                style={{ padding: '0 8px', height: 32, gap: 4 }}
            >
                <ArrowLeft size={16} />
                {t('candidates.detail.backToList')}
            </button>

            {/* 候选人头部 */}
            <motion.div
                className="card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex items-start gap-5">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold shrink-0"
                        style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}
                    >
                        {candidate.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-headline-large">{candidate.name}</h1>
                            <span className={`chip chip-${candidate.stage === 'offer' || candidate.stage === 'hired' ? 'success' :
                                    candidate.stage === 'rejected' ? 'error' : 'primary'
                                }`}>
                                {t(`stage.${candidate.stage}`)}
                            </span>
                            <span className={`chip ${candidate.verificationStatus === 'verified' ? 'chip-success' :
                                    candidate.verificationStatus === 'disputed' ? 'chip-warning' : 'chip-neutral'
                                }`}>
                                {t(`verification.${candidate.verificationStatus}`)}
                            </span>
                        </div>
                        <p className="text-body-medium mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {job?.title} · {job?.department}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="flex items-center gap-1"><Mail size={14} /> {candidate.email}</span>
                            {candidate.phone && <span className="flex items-center gap-1"><Phone size={14} /> {candidate.phone}</span>}
                            <span className="flex items-center gap-1"><Calendar size={14} /> 投递于 {candidate.appliedDate}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button className="btn btn-outlined">{t('candidates.detail.scheduleInterview')}</button>
                        <button className="btn btn-filled">{t('candidates.detail.advanceStage')}</button>
                    </div>
                </div>
            </motion.div>

            {/* 信息网格 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* 技能 */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h3 className="text-title-medium mb-3">技能标签</h3>
                    <div className="flex flex-wrap gap-2">
                        {candidate.skills.map((s) => (
                            <span key={s} className="chip chip-primary">{s}</span>
                        ))}
                    </div>
                </motion.div>

                {/* 匹配评分 */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h3 className="text-title-medium mb-3">AI 匹配分数</h3>
                    <div className="flex items-center gap-4">
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                            style={{
                                borderColor: candidate.score >= 90 ? 'var(--color-success)' :
                                    candidate.score >= 75 ? 'var(--color-primary)' :
                                        candidate.score >= 60 ? 'var(--color-warning)' : 'var(--color-error)',
                            }}
                        >
                            <span className="text-display-medium">{candidate.score}</span>
                        </div>
                        <div className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {candidate.score >= 90 ? '强烈推荐' :
                                candidate.score >= 75 ? '推荐' :
                                    candidate.score >= 60 ? '待考虑' : '不推荐'}
                        </div>
                    </div>
                </motion.div>

                {/* 来源 */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-title-medium mb-3">基本信息</h3>
                    <div className="space-y-2 text-body-medium">
                        <div className="flex justify-between">
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>来源</span>
                            <span>{candidate.source || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>标签</span>
                            <span>{candidate.tags?.join(', ') || '-'}</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default CandidateDetailPage;
