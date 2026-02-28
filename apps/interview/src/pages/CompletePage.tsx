import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Star, Send, Loader2, AlertCircle } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { useLocation, useParams } from 'react-router-dom';
import { resolveApiBaseUrl } from '../lib/runtime';

type XiaofanResultPreview = {
    sessionId: string;
    summary: string;
    recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
    model?: string;
    savedAt?: string;
};

const CompletePage: React.FC = () => {
    const { t } = useI18n();
    const { token } = useParams<{ token: string }>();
    const location = useLocation();
    const locationState = (location.state as { reason?: string; xiaofan?: XiaofanResultPreview } | undefined);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [candidateName, setCandidateName] = useState('候选人');
    const [xiaofanResult, setXiaofanResult] = useState<XiaofanResultPreview | null>(locationState?.xiaofan || null);
    const apiBaseUrl = resolveApiBaseUrl();

    const terminateReason = locationState?.reason;
    const wasTerminated = terminateReason && terminateReason !== 'candidate_ended_interview';

    useEffect(() => {
        if (!token) return;
        let mounted = true;
        fetch(`${apiBaseUrl}/public/interview/${token}`)
            .then(async (res) => {
                if (!res.ok) return null;
                return res.json();
            })
            .then((payload) => {
                const name = payload?.data?.candidateName;
                if (mounted && typeof name === 'string' && name.trim().length > 0) {
                    setCandidateName(name.trim());
                }
            })
            .catch(() => {
                // Silent fallback to default name
            });

        if (!xiaofanResult) {
            fetch(`${apiBaseUrl}/public/interview/${token}/xiaofan-result`)
                .then(async (res) => {
                    if (!res.ok) return null;
                    return res.json();
                })
                .then((payload) => {
                    const result = payload?.data?.result;
                    if (
                        mounted
                        && result
                        && typeof result.sessionId === 'string'
                        && typeof result.summary === 'string'
                    ) {
                        setXiaofanResult({
                            sessionId: result.sessionId,
                            summary: result.summary,
                            recommendation: result.recommendation || 'maybe',
                            model: result.model,
                            savedAt: result.savedAt,
                        });
                    }
                })
                .catch(() => {
                    // Silent fallback when structured result is unavailable.
                });
        }

        return () => {
            mounted = false;
        };
    }, [apiBaseUrl, token, xiaofanResult]);

    const handleSubmitFeedback = async () => {
        if (!token || rating <= 0 || submitting) return;
        setSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`${apiBaseUrl}/public/interview/${token}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating,
                    comment: comment.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || '提交反馈失败');
            }

            setSubmitted(true);
        } catch (error: any) {
            setErrorMessage(error?.message || '提交反馈失败，请稍后重试。');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="text-center max-w-md w-full"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mb-6"
                >
                    <div
                        className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-success-container)' }}
                    >
                        <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />
                    </div>
                </motion.div>

                <h1 className="text-2xl font-semibold mb-2">{t('interview.complete.title')}</h1>
                <p className="text-lg mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('interview.complete.thanks', { name: candidateName })}
                </p>
                <p className="mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {wasTerminated
                        ? '本场面试已提前结束，团队会尽快复核并联系你。'
                        : t('interview.complete.feedback', { days: '3-5' })}
                </p>

                {xiaofanResult && (
                    <div
                        className="mb-6 rounded-2xl border p-4 text-left"
                        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}
                    >
                        <p className="text-sm font-semibold mb-2">{t('interview.complete.xiaofanSummaryTitle')}</p>
                        <p className="text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {xiaofanResult.summary}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {t('interview.complete.xiaofanSummaryHint', { sessionId: xiaofanResult.sessionId })}
                        </p>
                    </div>
                )}

                {!submitted ? (
                    <motion.div
                        className="p-6 rounded-2xl"
                        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3 className="text-lg font-medium mb-4">{t('interview.complete.survey')}</h3>

                        <div className="flex items-center justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <motion.button
                                    key={s}
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setRating(s)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                    disabled={submitting}
                                >
                                    <Star
                                        size={32}
                                        fill={s <= rating ? '#F9AB00' : 'none'}
                                        stroke={s <= rating ? '#F9AB00' : 'var(--color-outline)'}
                                        strokeWidth={1.5}
                                    />
                                </motion.button>
                            ))}
                        </div>

                        <textarea
                            placeholder={t('interview.complete.comment')}
                            className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                            rows={3}
                            style={{
                                backgroundColor: 'var(--color-surface-variant)',
                                border: '1px solid var(--color-outline)',
                                color: 'var(--color-on-surface)',
                            }}
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            disabled={submitting}
                        />

                        {errorMessage && (
                            <div className="mt-4 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-3 py-2 text-left text-xs text-[var(--color-error)] flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <button
                            className="mt-4 h-12 w-full rounded-full text-base font-medium flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: rating > 0 && !submitting ? 'var(--color-primary)' : 'var(--color-outline)',
                                color: rating > 0 && !submitting ? 'white' : 'var(--color-on-surface-variant)',
                                border: 'none',
                                cursor: rating > 0 && !submitting ? 'pointer' : 'not-allowed',
                            }}
                            disabled={rating === 0 || submitting}
                            onClick={() => void handleSubmitFeedback()}
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {t('interview.complete.submitFeedback')}
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-6 rounded-2xl"
                        style={{ backgroundColor: 'var(--color-success-container)' }}
                    >
                        <p className="text-lg" style={{ color: 'var(--color-success)' }}>
                            Thank you for your feedback. {t('interview.complete.closeWindow')}
                        </p>
                    </motion.div>
                )}

                <p className="mt-8 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('interview.brand.poweredBy')}
                </p>
            </motion.div>
        </div>
    );
};

export default CompletePage;
