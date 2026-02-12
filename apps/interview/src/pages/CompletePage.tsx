// HireFlow AI — 面试完成页
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Star, Send } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

const CompletePage: React.FC = () => {
    const { t } = useI18n();
    const [rating, setRating] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="text-center max-w-md w-full"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* 成功图标 */}
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
                    {t('interview.complete.thanks', { name: '候选人' })}
                </p>
                <p className="mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('interview.complete.feedback', { days: '3-5' })}
                </p>

                {!submitted ? (
                    <motion.div
                        className="p-6 rounded-2xl"
                        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3 className="text-lg font-medium mb-4">{t('interview.complete.survey')}</h3>

                        {/* 星评 */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <motion.button
                                    key={s}
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setRating(s)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
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

                        {/* 评论 */}
                        <textarea
                            placeholder={t('interview.complete.comment')}
                            className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                            rows={3}
                            style={{
                                backgroundColor: 'var(--color-surface-variant)',
                                border: '1px solid var(--color-outline)',
                                color: 'var(--color-on-surface)',
                            }}
                        />

                        <button
                            className="mt-4 h-12 w-full rounded-full text-base font-medium flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: rating > 0 ? 'var(--color-primary)' : 'var(--color-outline)',
                                color: rating > 0 ? 'white' : 'var(--color-on-surface-variant)',
                                border: 'none',
                                cursor: rating > 0 ? 'pointer' : 'not-allowed',
                            }}
                            disabled={rating === 0}
                            onClick={() => setSubmitted(true)}
                        >
                            <Send size={18} />
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
                            感谢您的反馈！{t('interview.complete.closeWindow')}
                        </p>
                    </motion.div>
                )}

                <p className="mt-8 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('common.poweredBy')}
                </p>
            </motion.div>
        </div>
    );
};

export default CompletePage;
