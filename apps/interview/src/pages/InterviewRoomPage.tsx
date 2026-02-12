// HireFlow AI — 面试间
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Camera, CameraOff, PhoneOff, MessageCircle, Clock, Code } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import type { ChatMessage } from '@hireflow/types';

const InterviewRoomPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const [showChat, setShowChat] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 模拟对话
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'assistant', content: '你好！欢迎参加这次技术面试。我是 HireFlow AI 面试官。请先做一个简短的自我介绍吧。', timestamp: Date.now() },
    ]);

    // 计时器
    useEffect(() => {
        const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const handleEnd = () => {
        navigate(`/${token}/complete`);
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1a1a1a' }}>
            {/* 顶部信息栏 */}
            <div className="flex items-center justify-between px-6 py-3" style={{ backgroundColor: '#2a2a2a' }}>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-sm font-medium">AI 技术面试 · 高级前端工程师</span>
                </div>
                <div className="flex items-center gap-4 text-white text-sm">
                    <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatElapsed(elapsed)}
                    </span>
                    <span>{t('interview.room.question', { current: 1, total: 5 })}</span>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="flex-1 flex">
                {/* 视频 / 主区域 */}
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    {/* 候选人视频（模拟） */}
                    <div
                        className="w-[360px] h-[270px] rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: '#333' }}
                    >
                        <div className="text-center">
                            <div
                                className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary-container)' }}
                            >
                                <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>你</span>
                            </div>
                            {!cameraOn && (
                                <p className="text-gray-400 text-sm">摄像头已关闭</p>
                            )}
                        </div>
                    </div>

                    {/* AI 头像小窗 */}
                    <motion.div
                        className="absolute top-6 right-6 w-32 h-24 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#2a2a2a', border: '2px solid #444' }}
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <span className="text-white text-sm font-bold">AI</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">面试官</p>
                        </div>
                    </motion.div>
                </div>

                {/* 对话面板 */}
                <AnimatePresence>
                    {showChat && (
                        <motion.div
                            className="w-[380px] flex flex-col"
                            style={{ backgroundColor: '#262626', borderLeft: '1px solid #3a3a3a' }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 380, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                        >
                            <div className="px-4 py-3 text-white text-sm font-medium" style={{ borderBottom: '1px solid #3a3a3a' }}>
                                {t('interview.room.chatHistory')}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className="max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed"
                                            style={{
                                                backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : '#3a3a3a',
                                                color: msg.role === 'user' ? 'white' : '#e0e0e0',
                                                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                                                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : undefined,
                                            }}
                                        >
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-3" style={{ borderTop: '1px solid #3a3a3a' }}>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="输入文字回答..."
                                        className="flex-1 h-10 px-4 rounded-full text-sm outline-none"
                                        style={{ backgroundColor: '#3a3a3a', color: '#e0e0e0', border: 'none' }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                const val = (e.target as HTMLInputElement).value;
                                                setMessages((prev) => [
                                                    ...prev,
                                                    { id: Date.now().toString(), role: 'user' as const, content: val, timestamp: Date.now() },
                                                ]);
                                                (e.target as HTMLInputElement).value = '';
                                                // 模拟 AI 回复
                                                setTimeout(() => {
                                                    setMessages((prev) => [
                                                        ...prev,
                                                        {
                                                            id: (Date.now() + 1).toString(),
                                                            role: 'assistant' as const,
                                                            content: '很好，谢谢你的回答。让我来问下一个问题：请描述一下你在前端架构设计中最有成就感的一个项目？',
                                                            timestamp: Date.now(),
                                                        },
                                                    ]);
                                                }, 1500);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部控制栏 */}
            <div className="flex items-center justify-center gap-4 py-4" style={{ backgroundColor: '#2a2a2a' }}>
                <button
                    onClick={() => setMicOn(!micOn)}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    style={{
                        backgroundColor: micOn ? '#3a3a3a' : '#D93025',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                    onClick={() => setCameraOn(!cameraOn)}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    style={{
                        backgroundColor: cameraOn ? '#3a3a3a' : '#D93025',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
                </button>

                <button
                    onClick={() => setShowChat(!showChat)}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    style={{
                        backgroundColor: showChat ? 'var(--color-primary)' : '#3a3a3a',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <MessageCircle size={20} />
                </button>

                <button
                    onClick={handleEnd}
                    className="h-12 px-6 rounded-full flex items-center justify-center gap-2 font-medium transition-colors"
                    style={{
                        backgroundColor: '#D93025',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <PhoneOff size={18} />
                    {t('interview.room.endInterview')}
                </button>
            </div>
        </div>
    );
};

export default InterviewRoomPage;
