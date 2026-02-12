import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Video, VideoOff, MicOff, PhoneOff, MessageSquare } from 'lucide-react';
import AntiCheatMonitor from './AntiCheatMonitor';
import { AIGateway } from '../services/ai/aiProvider';
import { AIModelType, ChatMessage } from '../types';

const InterviewRoom: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your AI Interviewer today. Could you start by introducing yourself?", timestamp: Date.now() }
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState(""); // Simulate speech-to-text input

  // Start Camera
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (err) {
        console.error("Media Access Denied", err);
        alert("Camera/Mic permissions are required for the interview.");
      }
    };
    startMedia();

    return () => {
       // Cleanup stream
       if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
       }
    };
  }, []);

  // Handle User Input (Simulated Speech-to-Text submission)
  const handleSendMessage = async () => {
    if (!currentTranscript.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: currentTranscript, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setCurrentTranscript("");
    setIsAiThinking(true);

    try {
      const ai = AIGateway.getInstance();
      const context = messages.map(m => `${m.role}: ${m.content}`).join('\n') + `\nuser: ${userMsg.content}`;
      
      const response = await ai.generate(
        context,
        "You are a professional HR interviewer. Keep responses concise (under 50 words). Focus on validating engineering skills."
      );

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.text,
        timestamp: Date.now()
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleCheatEvent = (type: string, msg: string) => {
    console.warn(`[CHEAT_LOG] ${type}: ${msg}`);
    // In production, this would send a beacon to the server
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden flex flex-col">
      <AntiCheatMonitor onViolation={handleCheatEvent} />

      {/* Main Content Area */}
      <div className="flex-1 flex p-6 gap-6 h-[calc(100vh-80px)]">
        
        {/* Left: Video Feed */}
        <div className="flex-[2] relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
          {!hasPermission && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Requesting Camera Access...
            </div>
          )}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`} 
          />
          {!isVideoOn && (
             <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <VideoOff className="w-16 h-16 text-slate-600" />
             </div>
          )}
          
          {/* Overlay Stats */}
          <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm">
            Rec: <span className="text-red-400 animate-pulse">●</span> 04:23
          </div>
        </div>

        {/* Right: AI Interaction / Transcript */}
        <div className="flex-1 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700 flex flex-col p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <span className="font-bold text-white">AI</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Interview Assistant</h3>
              <p className="text-xs text-slate-400">Powered by Gemini 2.5</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-br-none' 
                    : 'bg-slate-700 text-slate-200 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex justify-start">
                 <div className="bg-slate-700 rounded-2xl px-4 py-3 rounded-bl-none flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                 </div>
              </div>
            )}
          </div>

          {/* Simulation Input */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="relative">
              <input 
                type="text" 
                value={currentTranscript}
                onChange={(e) => setCurrentTranscript(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Simulate speech..."
                className="w-full bg-slate-900 border border-slate-600 rounded-full px-4 py-3 pr-12 text-sm focus:outline-none focus:border-primary-500 transition-all"
              />
              <button 
                onClick={handleSendMessage}
                className="absolute right-2 top-2 p-1.5 bg-primary-600 rounded-full hover:bg-primary-500 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-20 bg-slate-800 border-t border-slate-700 flex items-center justify-center gap-6 px-8">
        <button 
            onClick={() => setIsMicOn(!isMicOn)}
            className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        
        <button 
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-4 rounded-2xl transition-all ${isVideoOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>

        <button className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-medium flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-red-900/20">
          <PhoneOff className="w-5 h-5" />
          End Interview
        </button>
      </div>
    </div>
  );
};

export default InterviewRoom;
