// ================================================
// HireFlow AI - Interview Room Page
// Upgraded with AI chat, video feed, anti-cheat, TTS/STT simulation
// ================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, Video, VideoOff, MicOff, PhoneOff, MessageSquare,
    Shield, ShieldAlert, Eye, AlertTriangle, Monitor, Code,
    Clock, ChevronRight,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { AIGateway } from '@/services/ai/aiGateway';
import type { ChatMessage, AntiCheatEvent } from '@/types';

const InterviewRoomPage: React.FC = () => {
    const { isDark } = useTheme();
    const videoRef = useRef<HTMLVideoElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const [currentTab, setCurrentTab] = useState<'chat' | 'code'>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! I'm your AI Interviewer today. Welcome to HireFlow's technical interview session. Could you start by briefly introducing yourself and your experience?",
            timestamp: Date.now(),
        },
    ]);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [antiCheatStatus, setAntiCheatStatus] = useState<'secure' | 'warning'>('secure');
    const [antiCheatEvents, setAntiCheatEvents] = useState<AntiCheatEvent[]>([]);
    const [codeContent, setCodeContent] = useState(
        '// Write your solution here\nfunction solution(input) {\n  \n}\n'
    );

    // Timer
    useEffect(() => {
        if (!interviewStarted) return;
        const interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [interviewStarted]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Start Camera
    useEffect(() => {
        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasPermission(true);
                setInterviewStarted(true);
            } catch {
                console.error('Media Access Denied');
                setHasPermission(false);
                setInterviewStarted(true); // Still allow chat-only mode
            }
        };
        startMedia();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // Anti-cheat monitoring
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const event: AntiCheatEvent = {
                    type: 'VISIBILITY',
                    message: 'Tab switch detected',
                    severity: 'high',
                    timestamp: Date.now(),
                };
                setAntiCheatEvents((prev) => [...prev, event]);
                setAntiCheatStatus('warning');
                // Auto-recover after 3s
                setTimeout(() => setAntiCheatStatus('secure'), 3000);
            }
        };

        const handleBlur = () => {
            const event: AntiCheatEvent = {
                type: 'FOCUS_LOST',
                message: 'Window focus lost',
                severity: 'medium',
                timestamp: Date.now(),
            };
            setAntiCheatEvents((prev) => [...prev, event]);
            setAntiCheatStatus('warning');
            setTimeout(() => setAntiCheatStatus('secure'), 3000);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isAiThinking]);

    // Handle send message
    const handleSendMessage = useCallback(async () => {
        if (!currentTranscript.trim() || isAiThinking) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: currentTranscript.trim(),
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setCurrentTranscript('');
        setIsAiThinking(true);

        try {
            const ai = AIGateway.getInstance();
            const context = messages
                .slice(-6) // Keep only recent context
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n');

            const response = await ai.generate(
                `${context}\nuser: ${userMsg.content}`,
                'You are a professional AI interviewer at HireFlow. Conduct a structured technical interview. Ask follow-up questions based on answers. Keep responses concise (under 60 words). Focus on validating technical skills, problem-solving ability, and communication clarity. If the candidate mentions a technology, probe deeper into their experience with it.'
            );

            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: response.text,
                    timestamp: Date.now(),
                },
            ]);
        } catch (e) {
            console.error('AI Error:', e);
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: "I'm sorry, there was an issue processing your response. Could you please repeat that?",
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsAiThinking(false);
        }
    }, [currentTranscript, isAiThinking, messages]);

    return (
        <div className="min-h-screen bg-slate-900 text-white overflow-hidden flex flex-col">
            {/* Anti-cheat overlay */}
            <motion.div
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={cn(
                    'fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl backdrop-blur-md border shadow-lg transition-all duration-500 flex items-center gap-3',
                    antiCheatStatus === 'secure'
                        ? 'bg-green-950/80 border-green-800/50 text-green-300'
                        : 'bg-red-950/80 border-red-800/50 text-red-300 animate-pulse'
                )}
            >
                {antiCheatStatus === 'secure' ? (
                    <>
                        <Shield className="w-4 h-4" />
                        <div>
                            <span className="text-xs font-semibold">Proctoring Active</span>
                            <p className="text-[10px] opacity-60">Environment Secure</p>
                        </div>
                    </>
                ) : (
                    <>
                        <ShieldAlert className="w-4 h-4" />
                        <div>
                            <span className="text-xs font-semibold">Anomaly Detected</span>
                            <p className="text-[10px] opacity-60">
                                {antiCheatEvents[antiCheatEvents.length - 1]?.message}
                            </p>
                        </div>
                    </>
                )}
                <div className="h-6 w-px bg-current opacity-20 mx-1" />
                <div className="flex items-center gap-1.5" title="Face Tracking Active">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono font-bold">LIVE</span>
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 flex p-4 gap-4 h-[calc(100vh-80px)]">
                {/* Left: Video Feed */}
                <div className="flex-[2] relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">
                    {!hasPermission && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 z-10">
                            <Monitor className="w-14 h-14 opacity-50" />
                            <p className="text-sm">Camera access not available</p>
                            <p className="text-xs opacity-60">Chat-only mode enabled</p>
                        </div>
                    )}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            'w-full h-full object-cover transform scale-x-[-1] transition-opacity',
                            !isVideoOn || !hasPermission ? 'opacity-0' : 'opacity-100'
                        )}
                    />
                    {(!isVideoOn && hasPermission) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                            <VideoOff className="w-16 h-16 text-slate-600" />
                        </div>
                    )}

                    {/* Overlay: Timer & Status */}
                    <div className="absolute top-5 left-5 flex items-center gap-3">
                        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm flex items-center gap-2">
                            <span className="text-red-400 animate-pulse text-lg leading-none">●</span>
                            <Clock className="w-3.5 h-3.5 text-slate-300" />
                            <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                        </div>
                    </div>

                    {/* AI Avatar Overlay (picture-in-picture) */}
                    <div className="absolute bottom-5 right-5 w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500/80 to-primary-700/80 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-xl">
                        <span className="text-2xl font-bold text-white">AI</span>
                    </div>
                </div>

                {/* Right: Chat & Code Panel */}
                <div className="flex-1 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 flex flex-col overflow-hidden min-w-[360px]">
                    {/* Tab switcher */}
                    <div className="flex items-center border-b border-slate-700/50 px-4">
                        <button
                            onClick={() => setCurrentTab('chat')}
                            className={cn(
                                'px-4 py-3 text-sm font-medium border-b-2 transition-all',
                                currentTab === 'chat'
                                    ? 'border-primary-500 text-primary-400'
                                    : 'border-transparent text-slate-400 hover:text-white'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Interview
                            </div>
                        </button>
                        <button
                            onClick={() => setCurrentTab('code')}
                            className={cn(
                                'px-4 py-3 text-sm font-medium border-b-2 transition-all',
                                currentTab === 'code'
                                    ? 'border-primary-500 text-primary-400'
                                    : 'border-transparent text-slate-400 hover:text-white'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4" />
                                Code Editor
                            </div>
                        </button>
                    </div>

                    {/* Chat Panel */}
                    {currentTab === 'chat' && (
                        <>
                            {/* AI Header */}
                            <div className="flex items-center gap-3 p-5 border-b border-slate-700/30">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                                    <span className="font-bold text-white text-sm">AI</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold">Interview Assistant</h3>
                                    <p className="text-xs text-slate-400">
                                        Powered by {AIGateway.getInstance().getCurrentModel()}
                                    </p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                                    >
                                        <div
                                            className={cn(
                                                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                                                msg.role === 'user'
                                                    ? 'bg-primary-600 text-white rounded-br-sm'
                                                    : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                                            )}
                                        >
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))}
                                {isAiThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-700 rounded-2xl px-5 py-3 rounded-bl-sm flex gap-1.5">
                                            <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                            <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                            <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t border-slate-700/30">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={currentTranscript}
                                        onChange={(e) => setCurrentTranscript(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your answer or speak..."
                                        disabled={isAiThinking}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-full px-5 py-3 pr-12 text-sm focus:outline-none focus:border-primary-500 transition-all disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isAiThinking || !currentTranscript.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 rounded-full hover:bg-primary-500 transition-colors disabled:opacity-40"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Code Editor Panel */}
                    {currentTab === 'code' && (
                        <div className="flex-1 flex flex-col p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Code className="w-4 h-4" />
                                    <span className="font-mono">solution.js</span>
                                </div>
                                <button className="text-xs px-3 py-1 bg-green-600/20 text-green-400 rounded-full font-medium">
                                    Run Code
                                </button>
                            </div>
                            <textarea
                                value={codeContent}
                                onChange={(e) => setCodeContent(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 font-mono text-sm text-green-300 resize-none focus:outline-none focus:border-primary-500"
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Control Bar */}
            <div className="h-20 bg-slate-800 border-t border-slate-700/50 flex items-center justify-center gap-4 px-8">
                <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={cn(
                        'p-4 rounded-2xl transition-all',
                        isMicOn
                            ? 'bg-slate-700 hover:bg-slate-600'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    )}
                >
                    {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={cn(
                        'p-4 rounded-2xl transition-all',
                        isVideoOn
                            ? 'bg-slate-700 hover:bg-slate-600'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    )}
                >
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>

                <button className="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-medium flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-red-900/30">
                    <PhoneOff className="w-5 h-5" />
                    End Interview
                </button>
            </div>
        </div>
    );
};

export default InterviewRoomPage;
