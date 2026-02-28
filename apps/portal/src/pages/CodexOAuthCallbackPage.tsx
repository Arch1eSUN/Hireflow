import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, CircleAlert } from 'lucide-react';
import api from '@/lib/api';

type CallbackState = 'processing' | 'success' | 'error';

const CodexOAuthCallbackPage: React.FC = () => {
    const [state, setState] = useState<CallbackState>('processing');
    const [message, setMessage] = useState('正在处理 Codex OAuth 授权结果...');
    const executedRef = useRef(false);

    useEffect(() => {
        if (executedRef.current) return;
        executedRef.current = true;

        const params = new URLSearchParams(window.location.search);
        const oauthState = params.get('state') || '';
        const code = params.get('code') || '';
        const error = params.get('error') || '';
        const errorDescription = params.get('error_description') || '';

        if (!oauthState) {
            setState('error');
            setMessage('OAuth 回调缺少 state，无法继续。');
            return;
        }

        const notifyOpener = (payload: Record<string, unknown>) => {
            if (!window.opener) return;
            window.opener.postMessage(payload, window.location.origin);
        };

        const finalizeSuccess = () => {
            setState('success');
            setMessage('Codex OAuth 已连接成功，窗口将自动关闭。');
            notifyOpener({
                type: 'codex_oauth_complete',
                success: true,
            });
            window.setTimeout(() => {
                window.close();
            }, 1200);
        };

        const finalizeError = (errorMessage: string) => {
            setState('error');
            setMessage(errorMessage);
            notifyOpener({
                type: 'codex_oauth_complete',
                success: false,
                error: errorMessage,
            });
        };

        void api.post('/settings/integrations/codex-oauth/callback', {
            state: oauthState,
            code: code || undefined,
            error: error || undefined,
            errorDescription: errorDescription || undefined,
        }).then(() => {
            finalizeSuccess();
        }).catch((err: any) => {
            const errorMessage = String(
                err?.response?.data?.error
                || err?.message
                || 'Codex OAuth 连接失败，请返回设置页重试。'
            );
            finalizeError(errorMessage);
        });
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-dim)] p-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-[var(--color-primary)]">
                        {state === 'processing' && <Loader2 size={20} className="animate-spin" />}
                        {state === 'success' && <CheckCircle2 size={20} className="text-[var(--color-success)]" />}
                        {state === 'error' && <CircleAlert size={20} className="text-[var(--color-error)]" />}
                    </div>
                    <div>
                        <div className="text-base font-semibold text-[var(--color-text-primary)]">
                            {state === 'processing' ? 'Codex OAuth 授权中' : state === 'success' ? '连接成功' : '连接失败'}
                        </div>
                        <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {message}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodexOAuthCallbackPage;
