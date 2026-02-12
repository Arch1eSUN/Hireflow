// HireFlow AI — 等候室页
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@hireflow/i18n/src/react';

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

    // 轮换提示
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTip((prev) => (prev + 1) % tips.length);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    // 模拟 3 秒后自动进入面试
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate(`/${token}/room`);
        }, 4000);
        return () => clearTimeout(timer);
    }, [token, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <motion.div
                className="text-center max-w-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
            >
                {/* 呼吸动画圆圈 */}
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
                        <span className="text-white text-3xl font-bold">H</span>
                    </div>
                </div>

                <h1 className="text-2xl font-semibold mb-2">{t('interview.waiting.title')}</h1>
                <p className="text-lg mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {t('interview.waiting.preparing')}
                </p>

                {/* 旋转提示 */}
                <motion.div
                    key={currentTip}
                    className="p-4 rounded-xl inline-block"
                    style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-outline)',
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                >
                    <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
                        💡 {t(tips[currentTip])}
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default WaitingRoomPage;
