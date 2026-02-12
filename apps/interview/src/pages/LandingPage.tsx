// HireFlow AI — 候选人面试落地页
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Mic, Wifi, Chrome, CheckCircle2, ArrowRight } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

const LandingPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();

    const checklistItems = [
        { icon: Monitor, text: t('interview.landing.checklist.quiet') },
        { icon: Mic, text: t('interview.landing.checklist.camera') },
        { icon: Chrome, text: t('interview.landing.checklist.browser') },
        { icon: Wifi, text: t('interview.landing.checklist.network') },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="w-full max-w-lg"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                            <span className="text-white text-xl font-bold">H</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                        {t('interview.landing.title')}
                    </h1>
                    <p className="mt-2 text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
                        高级前端工程师 — 技术面试
                    </p>
                    <p className="mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {t('interview.landing.duration', { minutes: 30 })}
                    </p>
                </div>

                {/* 面试准备清单 */}
                <div
                    className="p-6 rounded-2xl mb-6"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                >
                    <h3 className="text-lg font-medium mb-4">准备事项</h3>
                    <div className="space-y-4">
                        {checklistItems.map((item, i) => (
                            <motion.div
                                key={i}
                                className="flex items-center gap-3"
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                            >
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: 'var(--color-surface-variant)' }}
                                >
                                    <item.icon size={20} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <span className="text-base">{item.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* 开始按钮 */}
                <motion.button
                    className="w-full h-14 rounded-full text-lg font-medium flex items-center justify-center gap-2"
                    style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(26, 115, 232, 0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/${token}/device-check`)}
                >
                    {t('interview.landing.startCheck')}
                    <ArrowRight size={20} />
                </motion.button>

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('common.poweredBy')}
                </p>
            </motion.div>
        </div>
    );
};

export default LandingPage;
