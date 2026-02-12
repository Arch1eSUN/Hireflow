// HireFlow AI — 设备检测页
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Mic, Wifi, Globe, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

type CheckStatus = 'checking' | 'ready' | 'error';

const DeviceCheckPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();

    const [statuses, setStatuses] = useState<Record<string, CheckStatus>>({
        camera: 'checking',
        microphone: 'checking',
        network: 'checking',
        browser: 'checking',
    });

    // 模拟设备检测
    useEffect(() => {
        const checks = ['browser', 'network', 'camera', 'microphone'];
        checks.forEach((key, i) => {
            setTimeout(() => {
                setStatuses((prev) => ({ ...prev, [key]: 'ready' }));
            }, 800 + i * 600);
        });
    }, []);

    const allReady = Object.values(statuses).every((s) => s === 'ready');

    const items = [
        { key: 'camera', icon: Camera, label: t('interview.deviceCheck.camera') },
        { key: 'microphone', icon: Mic, label: t('interview.deviceCheck.microphone') },
        { key: 'network', icon: Wifi, label: t('interview.deviceCheck.network') },
        { key: 'browser', icon: Globe, label: t('interview.deviceCheck.browser') },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="w-full max-w-md"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold">{t('interview.deviceCheck.title')}</h1>
                    <p className="mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {t('interview.deviceCheck.subtitle')}
                    </p>
                </div>

                <div
                    className="p-6 rounded-2xl space-y-4"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                >
                    {items.map((item) => {
                        const status = statuses[item.key];
                        return (
                            <motion.div
                                key={item.key}
                                className="flex items-center justify-between p-4 rounded-xl"
                                style={{ backgroundColor: 'var(--color-surface-variant)' }}
                                animate={{
                                    backgroundColor: status === 'ready' ? 'var(--color-success-container)' : 'var(--color-surface-variant)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={22} style={{ color: status === 'ready' ? 'var(--color-success)' : 'var(--color-on-surface-variant)' }} />
                                    <span className="text-base font-medium">{item.label}</span>
                                </div>
                                {status === 'checking' && (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <Loader2 size={20} style={{ color: 'var(--color-primary)' }} />
                                    </motion.div>
                                )}
                                {status === 'ready' && <Check size={20} style={{ color: 'var(--color-success)' }} />}
                                {status === 'error' && <X size={20} style={{ color: 'var(--color-error)' }} />}
                            </motion.div>
                        );
                    })}
                </div>

                <motion.button
                    className="w-full h-14 rounded-full text-lg font-medium flex items-center justify-center gap-2 mt-6"
                    style={{
                        backgroundColor: allReady ? 'var(--color-primary)' : 'var(--color-outline)',
                        color: allReady ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                        border: 'none',
                        cursor: allReady ? 'pointer' : 'not-allowed',
                        transition: 'all var(--duration-standard)',
                    }}
                    whileHover={allReady ? { scale: 1.01 } : {}}
                    whileTap={allReady ? { scale: 0.98 } : {}}
                    disabled={!allReady}
                    onClick={() => navigate(`/${token}/waiting`)}
                >
                    {t('interview.deviceCheck.enterWaiting')}
                    <ArrowRight size={20} />
                </motion.button>
            </motion.div>
        </div>
    );
};

export default DeviceCheckPage;
