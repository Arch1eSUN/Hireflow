// HireFlow AI — 面试间 (AI Interviewer Mode)
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Code } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import AIAudioVisualizer from '../components/AIAudioVisualizer';

const InterviewRoomPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const [elapsed, setElapsed] = useState(0);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [aiText, setAiText] = useState("AI Interviewer is listening...");
    const ws = useRef<WebSocket | null>(null);

    // 计时器
    useEffect(() => {
        const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // WebSocket 连接
    useEffect(() => {
        const socket = new WebSocket('ws://localhost:4000/api/ws/interview/stream');
        ws.current = socket;

        socket.onopen = () => {
            console.log('Connected to AI Stream');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'AI_SPEAKING') {
                    setIsAISpeaking(true);
                    setAiText(data.text);
                } else if (data.type === 'AI_SILENT') {
                    setIsAISpeaking(false);
                    // setAiText("AI Interviewer is listening..."); // Optional: Reset text or keep last spoken
                }
            } catch (err) {
                console.error('Failed to parse WS message', err);
            }
        };

        return () => {
            socket.close();
        };
    }, []);

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 font-sans text-slate-200">
            {/* 顶部信息栏 */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium tracking-wide text-white">AI Interview Session</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">LIVE</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-mono opacity-60">
                    <Clock size={14} />
                    {formatElapsed(elapsed)}
                </div>
            </div>

            {/* 主内容区 (Split Layout) */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Code Editor (Mock) */}
                <div className="flex-1 border-r border-white/5 bg-slate-900/50 p-6 flex flex-col relative group">
                    {/* Label */}
                    <div className="absolute top-4 right-4 text-xs font-medium text-white/20 uppercase tracking-widest flex items-center gap-2">
                        <Code size={14} /> Python 3.10
                    </div>

                    <div className="flex-1 bg-black/40 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-hidden relative shadow-inner border border-white/5">
                        <div className="text-emerald-400">
                            <span className="text-pink-400">def</span> <span className="text-blue-400">solution</span>(arr):<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># Two pointer approach</span><br />
                            &nbsp;&nbsp;&nbsp;&nbsp;left, right = 0, len(arr) - 1<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">while</span> left &lt; right:<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;current_sum = arr[left] + arr[right]<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">if</span> current_sum == target:<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">return</span> [left, right]<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">elif</span> current_sum &lt; target:<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;left += 1<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">else</span>:<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;right -= 1<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">return</span> []
                        </div>
                        <div className="animate-pulse w-2 h-4 bg-white/50 inline-block ml-1 align-middle" />
                    </div>
                </div>

                {/* RIGHT: AI Avatar & Interaction */}
                <div className="flex-1 flex flex-col items-center justify-center relative p-8 bg-gradient-to-b from-slate-950 to-slate-900">
                    <div className="relative mb-8 flex flex-col items-center gap-6">
                        {/* Avatar Glow */}
                        <div className="relative w-32 h-32">
                            <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 blur-xl opacity-80 transition-all duration-500 ${isAISpeaking ? 'scale-110' : 'animate-pulse'}`} />
                            {/* Avatar Sphere */}
                            <div className="absolute inset-0 rounded-full bg-slate-900 z-10 flex items-center justify-center ring-1 ring-white/10 shadow-2xl overflow-hidden">
                                <div className="w-full h-full bg-gradient-to-tr from-blue-600/20 to-purple-600/20" />
                            </div>

                            {/* Audio Visualizer Overlay */}
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                                <AIAudioVisualizer isSpeaking={isAISpeaking} />
                            </div>
                        </div>

                        <div className="text-center space-y-3 max-w-md">
                            <p className="text-lg font-light tracking-wide text-white/90 min-h-[3rem]">
                                {aiText}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewRoomPage;
