import React, { useEffect, useState } from 'react';
import { Eye, AlertTriangle, ShieldCheck, MonitorX } from 'lucide-react';

interface AntiCheatProps {
  onViolation: (type: string, message: string) => void;
}

const AntiCheatMonitor: React.FC<AntiCheatProps> = ({ onViolation }) => {
  const [status, setStatus] = useState<'secure' | 'warning'>('secure');
  const [lastEvent, setLastEvent] = useState<string>('');

  useEffect(() => {
    // 1. Visibility Change Detection (Tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStatus('warning');
        setLastEvent('Tab switch detected');
        onViolation('VISIBILITY', 'Candidate switched tabs or minimized window.');
      }
    };

    // 2. Focus Loss Detection
    const handleBlur = () => {
      setStatus('warning');
      setLastEvent('Window focus lost');
      onViolation('FOCUS_LOST', 'Candidate clicked outside the interview window.');
    };

    const handleFocus = () => {
       // Optional: Auto-recover state
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [onViolation]);

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl backdrop-blur-md border shadow-lg transition-colors duration-300 flex items-center gap-3 ${
      status === 'secure' 
        ? 'bg-green-50/90 border-green-200 text-green-800' 
        : 'bg-red-50/90 border-red-200 text-red-800'
    }`}>
      {status === 'secure' ? (
        <>
            <ShieldCheck className="w-5 h-5" />
            <div className="flex flex-col">
                <span className="text-sm font-semibold">Proctoring Active</span>
                <span className="text-xs opacity-70">Environment Secure</span>
            </div>
        </>
      ) : (
        <>
            <AlertTriangle className="w-5 h-5 animate-pulse" />
             <div className="flex flex-col">
                <span className="text-sm font-semibold">Anomaly Detected</span>
                <span className="text-xs opacity-70">{lastEvent}</span>
            </div>
        </>
      )}
      
      {/* Simulated Face Tracking Indicator */}
      <div className="h-8 w-px bg-current opacity-20 mx-1"></div>
      <div className="flex items-center gap-2" title="Face Tracking Active">
        <Eye className="w-4 h-4" />
        <span className="text-xs font-mono">LIVE</span>
      </div>
    </div>
  );
};

export default AntiCheatMonitor;
