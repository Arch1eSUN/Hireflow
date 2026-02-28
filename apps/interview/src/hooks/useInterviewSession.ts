import { useState, useCallback, useRef, useEffect } from 'react';

type TranscriptMessage = { role: 'ai' | 'user'; content: string };

export interface UseInterviewSessionOptions {
    token: string | undefined;
    apiBaseUrl: string;
    sendMessage: (data: unknown) => void;
    isConnected: boolean;
    stopRecording: () => void;
    navigate: (path: string, options?: any) => void;
}

type XiaofanResultPreview = {
    sessionId: string;
    summary: string;
    recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
    model?: string;
    savedAt?: string;
};

/**
 * 管理面试会话生命周期：
 * - 消息 transcript（追加 + 去重）
 * - 消息历史加载
 * - 终止流程
 * - 会话错误
 * - secure overlay 配置
 * - elapsed timer
 */
export function useInterviewSession(opts: UseInterviewSessionOptions) {
    const { token, apiBaseUrl, stopRecording, navigate } = opts;

    const [messages, setMessages] = useState<TranscriptMessage[]>([]);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [terminationReason, setTerminationReason] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [secureOverlayConfig, setSecureOverlayConfig] = useState<{
        isOpen: boolean; title: string; description: string;
        actionLabel?: string; onAction?: () => void;
    } | null>(null);

    const hasConnectedRef = useRef(false);
    const isFinalizingRef = useRef(false);

    // ── Transcript helpers ──
    const appendTranscriptMessage = useCallback((next: TranscriptMessage) => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === next.role && last.content.trim() === next.content.trim()) return prev;
            return [...prev, next];
        });
    }, []);

    // ── Message history ──
    const loadMessageHistory = useCallback(async () => {
        if (!token) return;
        const response = await fetch(`${apiBaseUrl}/public/interview/${token}/messages`);
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error || '面试消息加载失败');
        }
        const payload = await response.json();
        const nextMessages = Array.isArray(payload?.data?.messages)
            ? payload.data.messages
                .map((item: any) => {
                    const role = item?.role === 'assistant' ? 'ai' : 'user';
                    const content = typeof item?.content === 'string' ? item.content : '';
                    return { role, content } as TranscriptMessage;
                })
                .filter((item: TranscriptMessage) => item.content.trim().length > 0)
            : [];
        setMessages(nextMessages);
    }, [apiBaseUrl, token]);

    // ── Finalize interview ──
    const finalizeInterview = useCallback(async (reason: string) => {
        if (!token || isFinalizingRef.current) return;
        isFinalizingRef.current = true;
        stopRecording();

        let xiaofan: XiaofanResultPreview | null = null;
        try {
            const response = await fetch(`${apiBaseUrl}/public/interview/${token}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            if (response.ok) {
                const payload = await response.json().catch(() => ({}));
                const candidate = payload?.data?.xiaofan;
                if (candidate && typeof candidate.sessionId === 'string' && typeof candidate.summary === 'string') {
                    xiaofan = {
                        sessionId: candidate.sessionId,
                        summary: candidate.summary,
                        recommendation: candidate.recommendation || 'maybe',
                        model: candidate.model,
                        savedAt: candidate.savedAt,
                    };
                }
            }
        } catch {
            // 终止过程中的网络错误忽略
        }

        navigate(`/${token}/complete`, { replace: true, state: { reason, xiaofan } });
    }, [apiBaseUrl, navigate, stopRecording, token]);

    // ── Effects ──

    // 自动终止
    useEffect(() => {
        if (terminationReason) void finalizeInterview(terminationReason);
    }, [finalizeInterview, terminationReason]);

    // Token 校验
    useEffect(() => {
        if (!token) {
            setMessages([]);
            setSessionError('当前页面缺少面试 Token，请使用邀请链接打开。');
            return;
        }
        setSessionError(null);
    }, [token]);

    // 加载历史
    useEffect(() => {
        let mounted = true;
        loadMessageHistory().catch(() => { if (!mounted) return; });
        return () => { mounted = false; };
    }, [loadMessageHistory]);

    // 计时器
    useEffect(() => {
        const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── WS message handler for session events ──
    const handleSessionWsMessage = useCallback((data: any): boolean => {
        if (data.type === 'transcript') {
            appendTranscriptMessage({ role: 'user', content: typeof data.text === 'string' ? data.text : '' });
            return true;
        }
        if (data.type === 'ai_text') {
            appendTranscriptMessage({ role: 'ai', content: typeof data.text === 'string' ? data.text : '' });
            // 注意：voice hook 也需要处理 ai_text，所以返回 false 让它继续传播
            return false;
        }
        if (data.type === 'system_blocked') {
            const message = typeof data?.error === 'string' && data.error.trim().length > 0
                ? data.error : '当前面试不可用，请返回等待页重新开始。';
            setSessionError(message);
            return true;
        }
        if (data.type === 'force_terminate') {
            setTerminationReason(data.reason || 'terminated_by_monitor');
            return true;
        }
        if (data.type === 'intervention_warning') {
            const warningMsg = data?.event?.message || '系统检测到异常行为，请遵守面试纪律。';
            setSecureOverlayConfig({
                isOpen: true,
                title: '行为警告 (Warning)',
                description: warningMsg,
                actionLabel: '我已知晓并继续',
                onAction: () => setSecureOverlayConfig(null),
            });
            return true;
        }
        return false;
    }, [appendTranscriptMessage]);

    return {
        messages,
        sessionError,
        terminationReason,
        setTerminationReason,
        elapsed,
        secureOverlayConfig,
        setSecureOverlayConfig,
        hasConnectedRef,
        appendTranscriptMessage,
        loadMessageHistory,
        handleSessionWsMessage,
    };
}
