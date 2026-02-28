import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mic,
    Wifi,
    Globe,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    Headphones,
} from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';
import { useI18n } from '@hireflow/i18n/react';

type CheckStatus = 'checking' | 'success' | 'error';
type CheckKey = 'browser' | 'network' | 'microphone';

const DeviceCheckPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();

    const [checks, setChecks] = useState<Record<CheckKey, CheckStatus>>({
        microphone: 'checking',
        network: 'checking',
        browser: 'checking',
    });
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isChecking, setIsChecking] = useState(true);

    const updateCheck = useCallback((key: CheckKey, status: CheckStatus) => {
        setChecks((prev) => ({ ...prev, [key]: status }));
    }, []);

    const runChecks = useCallback(async () => {
        setIsChecking(true);
        setErrorMessage('');
        setChecks({
            microphone: 'checking',
            network: 'checking',
            browser: 'checking',
        });

        const mediaDevices = navigator.mediaDevices;
        const mediaDevicesSupported = Boolean(
            mediaDevices
            && typeof mediaDevices.getUserMedia === 'function'
        );
        updateCheck('browser', mediaDevicesSupported ? 'success' : 'error');

        const online = navigator.onLine;
        updateCheck('network', online ? 'success' : 'error');
        if (!online) {
            setErrorMessage('网络不可用，请检查网络连接后重试。');
        }

        if (!mediaDevicesSupported) {
            updateCheck('microphone', 'error');
            setErrorMessage('当前浏览器不支持麦克风能力，请使用最新版 Chrome。');
            setIsChecking(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            stream.getTracks().forEach((track) => track.stop());
            updateCheck('microphone', 'success');
        } catch {
            updateCheck('microphone', 'error');
            setErrorMessage('无法访问麦克风，请允许权限后重试。');
        } finally {
            setIsChecking(false);
        }
    }, [updateCheck]);

    useEffect(() => {
        void runChecks();
    }, [runChecks]);

    useEffect(() => {
        const handleOnline = () => updateCheck('network', 'success');
        const handleOffline = () => updateCheck('network', 'error');
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [updateCheck]);

    const allPassed = useMemo(
        () => Object.values(checks).every((status) => status === 'success'),
        [checks]
    );

    const checkConfig = [
        {
            key: 'browser' as const,
            label: t('interview.deviceCheck.browser'),
            icon: Globe,
            hint: '推荐使用最新版 Chrome。',
        },
        {
            key: 'network' as const,
            label: t('interview.deviceCheck.network'),
            icon: Wifi,
            hint: '保持稳定网络连接。',
        },
        {
            key: 'microphone' as const,
            label: t('interview.deviceCheck.microphone'),
            icon: Mic,
            hint: '允许麦克风权限用于语音对话。',
        },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-surface-dim)] font-sans animate-in fade-in duration-500">
            <div className="w-full max-w-md text-center mb-8">
                <div className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-2">Step 1 of 2</div>
                <h1 className="text-2xl font-light text-[var(--color-text-primary)]">{t('interview.deviceCheck.title')}</h1>
                <p className="text-[var(--color-text-secondary)] mt-1 text-sm">语音面试开始前，请完成麦克风环境检查。</p>
            </div>

            <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-lg)] overflow-hidden shadow-sm">
                <div className="h-44 bg-[var(--color-surface-dim)] relative flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[var(--color-primary-container)] text-[var(--color-primary)] flex items-center justify-center">
                        <Headphones size={24} />
                    </div>
                    <p className="text-sm text-[var(--color-on-surface-variant)]">仅需麦克风即可进入小梵语音面试</p>
                </div>

                <div className="p-6 space-y-4">
                    {checkConfig.map((item) => {
                        const status = checks[item.key];
                        return (
                            <div key={item.key} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-dim)]',
                                            status === 'success' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                                        )}
                                    >
                                        <item.icon size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-medium text-[var(--color-text-primary)]">{item.label}</span>
                                        <span className="block text-xs text-[var(--color-text-secondary)]">{item.hint}</span>
                                    </div>
                                </div>

                                <div>
                                    {status === 'checking' && <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />}
                                    {status === 'success' && <CheckCircle2 size={18} className="text-[var(--color-success)]" />}
                                    {status === 'error' && <XCircle size={18} className="text-[var(--color-error)]" />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {errorMessage && (
                    <div className="mx-6 mb-4 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error)]">
                        {errorMessage}
                    </div>
                )}

                <div className="p-6 pt-0">
                    <button
                        className={cn('btn btn-filled w-full h-12 text-base justify-center', (!allPassed || isChecking || !token) && 'opacity-50 cursor-not-allowed')}
                        disabled={!allPassed || isChecking || !token}
                        onClick={() => navigate(`/${token}/waiting`)}
                    >
                        {t('interview.deviceCheck.enterWaiting')}
                    </button>
                    <button
                        className="mt-3 btn btn-outlined w-full h-10 text-sm justify-center"
                        type="button"
                        onClick={() => void runChecks()}
                        disabled={isChecking}
                    >
                        {isChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        重新检测
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeviceCheckPage;
