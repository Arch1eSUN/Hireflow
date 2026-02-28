import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '@hireflow/i18n/react';
import { Clock, Mic, MicOff, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';
import AIAudioVisualizer from '../components/AIAudioVisualizer';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSecureMode } from '../hooks/useSecureMode';
import { useScreenShareGuard } from '../hooks/useScreenShareGuard';
import { SecureOverlay } from '../components/SecureOverlay';
import { resolveApiBaseUrl, resolveInterviewWsUrl } from '../lib/runtime';
import { useInterviewVoice } from '../hooks/useInterviewVoice';
import { useInterviewSession } from '../hooks/useInterviewSession';
import { useSessionRecorder } from '../hooks/useSessionRecorder';

const InterviewRoomPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const wsUrl = resolveInterviewWsUrl();
    const apiBaseUrl = resolveApiBaseUrl();

    const { playChunk, isPlaying: isAudioPlaying, initAudio } = useAudioPlayer();

    // ── WS 消息分发 ref（hooks 需要在 WS 连接前引用） ──
    const sendMessageRef = useRef<(data: unknown) => void>(() => { });

    // ── Hook 1: 语音控制 ──
    const voice = useInterviewVoice({
        sendMessage: (...args) => sendMessageRef.current(...args),
        isConnected: false, // 将在 WS 连接后更新
        playChunk,
        isAudioPlaying,
    });

    // ── Hook 2: 会话管理 ──
    const { startRecording, stopRecording, isRecording } = useAudioRecorder({
        onAudioData: (base64, mimeType) => {
            if (voice.inputAllowedRef.current) {
                sendMessageRef.current({ type: 'audio', data: base64, mimeType });
            }
        },
        onVadChange: (isSpeaking) => {
            if (voice.inputAllowedRef.current) {
                sendMessageRef.current({ type: 'vad_event', status: isSpeaking ? 'speaking_start' : 'speaking_stop' });
            }
        },
    });

    const session = useInterviewSession({
        token,
        apiBaseUrl,
        sendMessage: (...args) => sendMessageRef.current(...args),
        isConnected: false,
        stopRecording,
        navigate,
    });

    // ── Hook 3: 全程录制 ──
    const sessionRecorder = useSessionRecorder(token || '', apiBaseUrl);

    // ── 输入可用判定 ──
    const canAcceptCandidateInput = Boolean(
        token
        && true // isConnected — 会在 WS 效果中真正检查
        && (voice.needsMicCapture ? voice.micOn : true)
        && !session.terminationReason
        && voice.turnState === 'listening'
        && !isAudioPlaying
        && !voice.browserSpeaking
        && !voice.inputCooldownActive
    );

    useEffect(() => { voice.inputAllowedRef.current = canAcceptCandidateInput; }, [canAcceptCandidateInput]);

    // ── WS 消息分发 ──
    const handleMessage = useCallback((data: any) => {
        // 会话事件（transcript/system/terminate）
        if (session.handleSessionWsMessage(data)) {
            // ai_text 返回 false 让 voice 也能处理
        }
        // 语音事件（turn_state/voice_mode/audio）
        if (voice.handleVoiceWsMessage(data)) return;
        // ai_text 需要 voice 的 TTS 回退处理
        if (data.type === 'ai_text') {
            voice.handleAiTextForVoice(typeof data.text === 'string' ? data.text : '');
            return;
        }
    }, [session, voice]);

    const { isConnected, sendMessage } = useWebSocket(wsUrl, token || '', handleMessage);
    useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

    // ── 安全模式 ──
    useSecureMode({
        enabled: true,
        onViolation: useCallback((event: any) => {
            if (isConnected) sendMessage({ type: 'security_violation', ...event });
        }, [isConnected, sendMessage])
    });

    const { startScreenShare } = useScreenShareGuard({
        enabled: true,
        requireEntireScreen: false,
        onScreenShareStart: useCallback((surface: string) => {
            session.setSecureOverlayConfig(null);
            if (isConnected) sendMessage({ type: 'screen_share_status', active: true, surface });
        }, [isConnected, sendMessage, session]),
        onScreenShareStop: useCallback((reason?: string) => {
            if (isConnected) sendMessage({ type: 'screen_share_status', active: false, reason });
            session.setSecureOverlayConfig({
                isOpen: true, title: '屏幕共享已中断',
                description: '为了保证面试的公平性，当前安全策略要求您保持屏幕共享。',
                actionLabel: '重新共享',
            });
        }, [isConnected, sendMessage, session])
    });

    // Overlay action 绑定到屏幕共享
    useEffect(() => {
        if (session.secureOverlayConfig?.isOpen && !session.secureOverlayConfig.onAction) {
            session.setSecureOverlayConfig(prev => prev ? { ...prev, onAction: startScreenShare } : null);
        }
    }, [session.secureOverlayConfig?.isOpen, startScreenShare, session]);

    // ── 连接后初始化 ──
    useEffect(() => {
        if (isConnected) {
            session.hasConnectedRef.current = true;
            void initAudio().catch(() => { });
            session.loadMessageHistory().catch(() => { });
            // 启动全程录制
            if (!sessionRecorder.isRecording) {
                sessionRecorder.startRecording().catch(() => { });
            }
        }
    }, [isConnected, initAudio, session, sessionRecorder]);

    // ── 面试结束时上传录制 ──
    useEffect(() => {
        if (session.terminationReason && sessionRecorder.isRecording) {
            sessionRecorder.stopAndUpload().catch(() => { });
        }
    }, [session.terminationReason, sessionRecorder]);

    // ── 断连提示 ──
    useEffect(() => {
        if (session.hasConnectedRef.current && !isConnected && !session.terminationReason) {
            // setSessionError handled in session hook
        }
    }, [isConnected, session]);

    // ── 浏览器语音识别 ──
    const speechRecognitionRef = useRef<any>(null);
    const recognitionShouldRunRef = useRef(false);

    useEffect(() => {
        if (!voice.browserSpeechRecognitionSupported || !voice.browserRecognitionCtor) return;
        const recognition = new voice.browserRecognitionCtor();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
            let finalTexts = '';
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (result?.isFinal) finalTexts += ` ${result?.[0]?.transcript || ''}`;
            }
            finalTexts = finalTexts.trim();
            if (finalTexts && voice.inputAllowedRef.current) {
                sendMessage({ type: 'user_text', text: finalTexts });
            }
        };
        recognition.onerror = () => { /* ignore */ };
        recognition.onend = () => {
            if (recognitionShouldRunRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
            }
        };
        speechRecognitionRef.current = recognition;
        return () => {
            recognitionShouldRunRef.current = false;
            recognition.onend = null;
            try { recognition.stop(); } catch { /* ignore */ }
            speechRecognitionRef.current = null;
        };
    }, [voice.browserRecognitionCtor, voice.browserSpeechRecognitionSupported, sendMessage]);

    useEffect(() => {
        if (!voice.browserSpeechRecognitionSupported || !speechRecognitionRef.current) return;
        const shouldRun = voice.useBrowserSpeechRecognition && canAcceptCandidateInput;
        recognitionShouldRunRef.current = shouldRun;
        if (shouldRun) {
            try { speechRecognitionRef.current.start(); } catch { /* ignore */ }
        } else {
            try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
        }
    }, [voice.browserSpeechRecognitionSupported, canAcceptCandidateInput, voice.useBrowserSpeechRecognition]);

    // ── 录音控制 ──
    useEffect(() => {
        if (voice.useBrowserSpeechRecognition || voice.usingTextFallbackInput) { stopRecording(); return; }
        if (!canAcceptCandidateInput) { stopRecording(); return; }
        void startRecording().catch(() => { /* 麦克风访问失败 */ });
        return () => { stopRecording(); };
    }, [canAcceptCandidateInput, startRecording, stopRecording, voice.useBrowserSpeechRecognition, voice.usingTextFallbackInput]);

    // ── 组件卸载清理 ──
    useEffect(() => {
        return () => {
            stopRecording();
            sessionRecorder.cleanup();
        };
    }, [stopRecording, sessionRecorder]);

    // ── 计算值 ──
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const isListening = voice.turnState === 'listening' && (voice.useBrowserSpeechRecognition ? canAcceptCandidateInput : isRecording);
    const turnLabel = voice.turnState === 'thinking' ? 'Thinking' : voice.isAssistantSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Idle';

    // ── JSX ──
    return (
        <div className="h-screen flex flex-col bg-[var(--color-surface-dim)] text-[var(--color-text-primary)] font-sans overflow-hidden animate-in fade-in duration-500">
            <header className="h-14 bg-[var(--color-surface)] border-b border-[var(--color-outline)] flex items-center justify-between px-4 flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-surface-dim)] rounded-full border border-[var(--color-outline)]">
                        <div className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-error)]')} />
                        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {isConnected ? t('interviews.inProgress') : 'Disconnected'}
                        </span>
                    </div>
                    {sessionRecorder.isRecording && (
                        <span className="chip chip-error flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            REC {formatTime(sessionRecorder.duration)}
                        </span>
                    )}
                    <span className={cn('chip', voice.micOn ? 'chip-success' : 'chip-warning')}>
                        {voice.micOn ? 'Microphone On' : 'Microphone Off'}
                    </span>
                    <span className={cn('chip', isListening ? 'chip-success' : 'chip-warning')}>
                        {turnLabel}
                    </span>
                </div>

                <div className="flex items-center gap-6 text-xs text-[var(--color-text-secondary)] font-mono">
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{formatTime(session.elapsed)}</span>
                    </div>
                    <button
                        className="btn btn-danger h-8 px-3 text-xs ml-2"
                        onClick={() => session.setTerminationReason('candidate_ended_interview')}
                        disabled={Boolean(session.terminationReason)}
                    >
                        {t('interview.room.endInterview')}
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] overflow-hidden">
                <section className="bg-[var(--color-surface)] border-r border-[var(--color-outline)] flex flex-col items-center justify-center p-8">
                    <div className="w-36 h-36 rounded-full bg-[var(--color-surface-dim)] border-4 border-[var(--color-outline)] shadow-inner flex items-center justify-center relative mb-7">
                        <div className={cn('absolute inset-0 rounded-full border-2 border-[var(--color-primary)] opacity-0 transition-opacity duration-300', isAudioPlaying && 'opacity-100 animate-ping')} />
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[var(--color-primary-container)] to-[var(--color-info-bg)] flex items-center justify-center overflow-hidden">
                            <Mic className={cn('text-[var(--color-primary)] transition-transform duration-300', isAudioPlaying && 'scale-110')} size={36} />
                        </div>
                    </div>

                    <AIAudioVisualizer isSpeaking={isAudioPlaying} />

                    <div className="mt-5 text-xs font-mono text-[var(--color-primary)] uppercase tracking-widest bg-[var(--color-primary-container)] px-2 py-1 rounded">
                        {voice.turnState === 'thinking' ? 'Thinking...' : (voice.isAssistantSpeaking ? t('interview.room.aiSpeaking') : (isListening ? t('interview.room.listening') : 'Idle'))}
                    </div>

                    <p className="mt-5 max-w-md text-center text-sm text-[var(--color-on-surface-variant)]">
                        小梵将通过语音与你进行完整面试对话，请在安静环境中直接口述你的答案。
                    </p>
                    {voice.useBrowserSpeechRecognition && (
                        <p className="mt-2 max-w-md text-center text-xs text-[var(--color-text-secondary)]">
                            当前启用浏览器语音识别模式。仅在小梵说完后，系统才会开始收录你的回答。
                        </p>
                    )}
                    {!voice.useBrowserSpeechRecognition && (
                        <p className="mt-2 max-w-md text-center text-xs text-[var(--color-text-secondary)]">
                            当前启用小梵高精度语音识别模式，回答会在你说完后自动转写。
                        </p>
                    )}
                    {voice.usingTextFallbackInput && (
                        <div className="mt-3 w-full max-w-md rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                            当前浏览器不支持语音识别，已切换为文本答复兜底模式。你可以输入回答，小梵会继续语音追问。
                        </div>
                    )}
                    {voice.inputGateHint && (
                        <div className="mt-4 w-full max-w-md rounded-xl border border-[var(--color-info)]/20 bg-[var(--color-info-bg)] px-3 py-2 text-sm text-[var(--color-info)]">
                            {voice.inputGateHint}
                        </div>
                    )}
                    {session.sessionError && (
                        <div className="mt-5 w-full max-w-md rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error)] flex items-start gap-2">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <span>{session.sessionError}</span>
                        </div>
                    )}
                </section>

                <section className="bg-[var(--color-surface-dim)] min-h-0 flex flex-col">
                    <div className="p-3 border-b border-[var(--color-outline)] flex items-center gap-2">
                        <MessageSquare size={14} className="text-[var(--color-text-secondary)]" />
                        <span className="text-label-large text-[var(--color-text-secondary)] uppercase tracking-wider">
                            {t('interview.room.transcript')}
                        </span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                        {session.messages.length === 0 && (
                            <div className="rounded-xl border border-dashed border-[var(--color-outline)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-on-surface-variant)]">
                                面试开始后，小梵与候选人的对话会实时显示在这里。
                            </div>
                        )}
                        {session.messages.map((msg, index) => (
                            <div
                                key={`${msg.role}-${index}`}
                                className={cn(
                                    'text-sm p-3 rounded-xl max-w-[92%] leading-6',
                                    msg.role === 'ai'
                                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] mr-auto border border-[var(--color-outline)]'
                                        : 'bg-[var(--color-primary-container)] text-[var(--color-primary)] ml-auto'
                                )}
                            >
                                <span className="block text-[10px] font-bold opacity-70 mb-1 uppercase">{msg.role}</span>
                                {msg.content}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-[var(--color-outline)] bg-[var(--color-surface)] flex items-center justify-center gap-4">
                        <button
                            className={cn(
                                'w-11 h-11 rounded-full flex items-center justify-center border transition-all',
                                voice.micOn
                                    ? 'bg-[var(--color-surface)] border-[var(--color-outline)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-dim)]'
                                    : 'bg-[var(--color-error)] border-[var(--color-error)] text-white'
                            )}
                            onClick={voice.handleMicToggle}
                            title="Toggle Microphone"
                        >
                            {voice.micOn ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                        {voice.usingTextFallbackInput && (
                            <div className="flex-1 max-w-lg flex items-center gap-2">
                                <input
                                    type="text"
                                    className="m3-input h-10 flex-1"
                                    placeholder="输入你的回答后回车提交..."
                                    value={voice.textFallbackInput}
                                    onChange={(event) => voice.setTextFallbackInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') { event.preventDefault(); voice.handleTextFallbackSubmit(); }
                                    }}
                                    disabled={!canAcceptCandidateInput}
                                />
                                <button
                                    className="btn btn-filled h-10 px-3"
                                    onClick={voice.handleTextFallbackSubmit}
                                    disabled={!canAcceptCandidateInput || voice.textFallbackInput.trim().length === 0}
                                >
                                    发送
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <SecureOverlay {...(session.secureOverlayConfig || { isOpen: false, title: '', description: '' })} />
        </div>
    );
};

export default InterviewRoomPage;
