import { useState, useCallback, useRef, useEffect } from 'react';

type TurnState = 'listening' | 'thinking' | 'speaking';
type VoiceMode = 'server' | 'browser';

export interface UseInterviewVoiceOptions {
    sendMessage: (data: unknown) => void;
    isConnected: boolean;
    playChunk: (data: string) => void;
    isAudioPlaying: boolean;
}

/**
 * 管理面试语音逻辑：
 * - TTS（服务端 / 浏览器回退）
 * - STT（服务端 / 浏览器 / 文本回退）
 * - 输入冷却门
 * - Turn 状态
 */
export function useInterviewVoice(opts: UseInterviewVoiceOptions) {
    const { sendMessage, isConnected, playChunk, isAudioPlaying } = opts;

    const [turnState, setTurnState] = useState<TurnState>('listening');
    const [browserSpeaking, setBrowserSpeaking] = useState(false);
    const [inputGateHint, setInputGateHint] = useState<string | null>(null);
    const [inputCooldownActive, setInputCooldownActive] = useState(false);
    const [sttMode, setSttMode] = useState<VoiceMode>('server');
    const [ttsMode, setTtsMode] = useState<VoiceMode>('browser');
    const [micOn, setMicOn] = useState(true);
    const [textFallbackInput, setTextFallbackInput] = useState('');

    const lastServerAudioAtRef = useRef(0);
    const inputAllowedRef = useRef(true);
    const inputCooldownTimerRef = useRef<number | null>(null);
    const turnStateRef = useRef<TurnState>('listening');
    const browserFallbackTimerRef = useRef<number | null>(null);

    const browserRecognitionCtor = typeof window !== 'undefined'
        ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
        : null;
    const browserSpeechRecognitionSupported = Boolean(browserRecognitionCtor);
    const useBrowserSpeechRecognition = browserSpeechRecognitionSupported && sttMode === 'browser';
    const usingTextFallbackInput = sttMode === 'browser' && !browserSpeechRecognitionSupported;

    const isAssistantSpeaking = turnState === 'speaking' || isAudioPlaying || browserSpeaking;
    const needsMicCapture = !usingTextFallbackInput;

    // ── Turn state ref sync ──
    useEffect(() => { turnStateRef.current = turnState; }, [turnState]);

    // ── Input gate hint auto-dismiss ──
    useEffect(() => {
        if (!inputGateHint) return;
        const timer = window.setTimeout(() => setInputGateHint(null), 2200);
        return () => { window.clearTimeout(timer); };
    }, [inputGateHint]);

    // ── Browser TTS ──
    const pickBrowserVoice = useCallback((voices: SpeechSynthesisVoice[]) => {
        const patterns = [/natural/i, /premium/i, /siri/i, /tingting/i, /mei-jia/i, /zh-cn/i, /mandarin/i, /chinese/i];
        for (const p of patterns) {
            const m = voices.find((v) => p.test(`${v.name} ${v.lang}`));
            if (m) return m;
        }
        return voices[0] || null;
    }, []);

    const speakWithBrowser = useCallback((text: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.94;
        utterance.pitch = 0.98;
        const v = pickBrowserVoice(window.speechSynthesis.getVoices());
        if (v) utterance.voice = v;
        utterance.onstart = () => setBrowserSpeaking(true);
        utterance.onend = () => setBrowserSpeaking(false);
        utterance.onerror = () => setBrowserSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, [pickBrowserVoice]);

    // ── Input cooldown ──
    const armInputCooldown = useCallback((durationMs: number) => {
        setInputCooldownActive(true);
        if (inputCooldownTimerRef.current) {
            window.clearTimeout(inputCooldownTimerRef.current);
            inputCooldownTimerRef.current = null;
        }
        inputCooldownTimerRef.current = window.setTimeout(() => {
            setInputCooldownActive(false);
            inputCooldownTimerRef.current = null;
        }, Math.max(0, durationMs));
    }, []);

    // ── Text fallback submit ──
    const handleTextFallbackSubmit = useCallback(() => {
        const text = textFallbackInput.trim();
        if (!text || !inputAllowedRef.current) return;
        sendMessage({ type: 'user_text', text });
        setTextFallbackInput('');
    }, [textFallbackInput, sendMessage]);

    // ── Mic toggle ──
    const handleMicToggle = useCallback(() => { setMicOn((p) => !p); }, []);

    // ── WS message handler for voice events ──
    const handleVoiceWsMessage = useCallback((data: any): boolean => {
        if (data.type === 'interview_turn_state') {
            const s = data?.state;
            if (s === 'listening' || s === 'thinking' || s === 'speaking') setTurnState(s);
            return true;
        }
        if (data.type === 'voice_mode') {
            const nextStt = data?.stt;
            const nextTts = data?.tts;
            if (nextStt === 'server' || nextStt === 'browser') setSttMode(nextStt);
            if (nextTts === 'server' || nextTts === 'browser') setTtsMode(nextTts);
            if (data?.fallbackReason && nextStt === 'browser') {
                setInputGateHint('服务器语音识别波动，已自动切换到浏览器语音识别，请在小梵说完后继续回答。');
            } else if (data?.recovered && nextStt === 'server') {
                setInputGateHint('语音识别已恢复高精度模式。');
            }
            return true;
        }
        if (data.type === 'audio_playback') {
            lastServerAudioAtRef.current = Date.now();
            if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                setBrowserSpeaking(false);
            }
            playChunk(data.data);
            return true;
        }
        if (data.type === 'assistant_audio_done') {
            armInputCooldown(320);
            if (!browserSpeaking) setTurnState('listening');
            return true;
        }
        if (data.type === 'speech_capture_hint') {
            const hint = typeof data?.text === 'string' ? data.text.trim() : '';
            if (hint) setInputGateHint(hint);
            return true;
        }
        if (data.type === 'input_gate') {
            setInputGateHint('请等待小梵说完当前问题后再开始回答。');
            return true;
        }
        return false;
    }, [armInputCooldown, browserSpeaking, playChunk]);

    // ── Handle AI text with browser TTS fallback ──
    const handleAiTextForVoice = useCallback((text: string) => {
        setInputGateHint(null);
        armInputCooldown(650);

        const aiTextTimestamp = Date.now();
        if (browserFallbackTimerRef.current) {
            window.clearTimeout(browserFallbackTimerRef.current);
            browserFallbackTimerRef.current = null;
        }
        const fallbackDelay = ttsMode === 'browser' ? 260 : 2200;
        browserFallbackTimerRef.current = window.setTimeout(() => {
            const noServerAudioArrived = lastServerAudioAtRef.current < aiTextTimestamp;
            const stillAssistantTurn = turnStateRef.current !== 'listening';
            if (noServerAudioArrived && stillAssistantTurn) {
                speakWithBrowser(text);
            }
            browserFallbackTimerRef.current = null;
        }, fallbackDelay);
    }, [armInputCooldown, speakWithBrowser, ttsMode]);

    // ── Cleanup ──
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (inputCooldownTimerRef.current) window.clearTimeout(inputCooldownTimerRef.current);
            if (browserFallbackTimerRef.current) window.clearTimeout(browserFallbackTimerRef.current);
        };
    }, []);

    return {
        // State
        turnState,
        micOn,
        browserSpeaking,
        inputGateHint,
        inputCooldownActive,
        sttMode,
        ttsMode,
        textFallbackInput,
        setTextFallbackInput,
        // Derived
        isAssistantSpeaking,
        useBrowserSpeechRecognition,
        usingTextFallbackInput,
        browserSpeechRecognitionSupported,
        browserRecognitionCtor,
        needsMicCapture,
        inputAllowedRef,
        // Actions
        handleMicToggle,
        handleTextFallbackSubmit,
        handleVoiceWsMessage,
        handleAiTextForVoice,
        armInputCooldown,
        setTurnState,
        sendMessage,
    };
}
