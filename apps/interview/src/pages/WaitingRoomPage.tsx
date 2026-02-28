import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { resolveApiBaseUrl } from '../lib/runtime';

const tips = [
    'interview.waiting.tip1',
    'interview.waiting.tip2',
    'interview.waiting.tip3',
];

const WaitingRoomPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const [currentTip, setCurrentTip] = useState(0);
    const [starting, setStarting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const apiBaseUrl = resolveApiBaseUrl();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTip((prev) => (prev + 1) % tips.length);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    const handleEnterInterview = async () => {
        if (!token || starting) return;
        setStarting(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`${apiBaseUrl}/public/interview/${token}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                if (payload?.code === 'AI_KEY_REQUIRED') {
                    throw new Error(payload?.error || '后端尚未连接 AI key，当前无法开始正式面试。');
                }
                throw new Error(payload?.error || 'Unable to start interview');
            }

            const payload = await response.json().catch(() => ({}));
            const sessionId = payload?.data?.sessionId;
            if (token && typeof sessionId === 'string' && sessionId.trim().length > 0) {
                window.sessionStorage.setItem(`xiaofan-session:${token}`, sessionId.trim());
            }

            navigate(`/${token}/room`);
        } catch (error: any) {
            setErrorMessage(error?.message || '无法开始面试，请稍后重试。');
        } finally {
            setStarting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="text-center max-w-lg w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
            >
                <div className="mb-6">
                    <div className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest">Step 2 of 2</div>
                    <div className="w-full mt-3 h-1.5 bg-[var(--color-outline)] rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-[var(--color-primary)] rounded-full" />
                    </div>
                </div>

                <div className="relative mx-auto mb-8" style={{ width: 120, height: 120 }}>
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute inset-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-primary)', opacity: 0.2 }}
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    />
                    <div className="absolute inset-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                        <span className="text-white text-lg font-bold tracking-wide">{t('interview.brand.name')}</span>
                    </div>
                </div>

                <h1 className="text-2xl font-semibold mb-2">{t('interview.waiting.title')}</h1>
                <p className="text-lg mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('interview.waiting.preparing')}
                </p>

                <motion.div
                    key={currentTip}
                    className="p-4 rounded-xl inline-block w-full text-left mb-4"
                    style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-outline)',
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                >
                    <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Interview Tip
                    </p>
                    <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {t(tips[currentTip])}
                    </p>
                </motion.div>

                {errorMessage && (
                    <div className="mb-4 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-3 py-2 text-left text-sm text-[var(--color-error)] flex items-start gap-2">
                        <AlertCircle size={14} className="mt-1 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <button
                    className="btn btn-filled h-12 px-6 text-base justify-center mx-auto"
                    disabled={starting || !token}
                    onClick={() => void handleEnterInterview()}
                >
                    {starting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    进入面试
                </button>
            </motion.div>
        </div>
    );
};

export default WaitingRoomPage;
