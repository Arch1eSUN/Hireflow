import React from 'react';
import { Mic, MoreVertical, Monitor } from 'lucide-react';
import { MonitorPolicy, ScreenSurfaceType } from '@/types/monitor';

type InterviewLivePanelProps = {
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    screenConnection: 'idle' | 'connecting' | 'live' | 'error';
    screenShareActive: boolean;
    screenSurface: ScreenSurfaceType;
    monitorPolicy: MonitorPolicy;
    audioWaveHeights: number[];
};

export const InterviewLivePanel: React.FC<InterviewLivePanelProps> = ({
    remoteVideoRef,
    screenConnection,
    screenShareActive,
    screenSurface,
    monitorPolicy,
    audioWaveHeights
}) => {
    return (
        <div className="xl:col-span-8 flex flex-col gap-4 min-h-0">
            <div className="flex-1 bg-black rounded-[var(--radius-md)] relative overflow-hidden group border border-[var(--color-outline)] shadow-lg flex flex-col">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full object-contain bg-black"
                />

                {(screenConnection !== 'live' || !screenShareActive) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center mx-auto mb-2">
                                <Monitor size={32} className="text-[rgba(255,255,255,0.6)]" />
                            </div>
                            <p className="text-[rgba(255,255,255,0.72)] text-sm">
                                {screenConnection === 'error'
                                    ? 'Screen stream connection failed'
                                    : screenConnection === 'connecting'
                                        ? 'Connecting to candidate screen...'
                                        : 'Waiting for candidate screen share...'}
                            </p>
                        </div>
                    </div>
                )}

                {screenShareActive && monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor' && (
                    <div className="absolute top-3 left-3 rounded-full border border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] px-3 py-1 text-xs font-medium">
                        Warning: non-monitor surface ({screenSurface})
                    </div>
                )}

                <div className="mt-auto p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="bg-[rgba(0,0,0,0.6)] px-3 py-1 rounded text-white text-xs backdrop-blur-sm border border-white/10">
                        Candidate Screen (Live)
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 bg-[rgba(0,0,0,0.6)] rounded-full text-white hover:bg-[rgba(255,255,255,0.2)] transition-colors"><Mic size={16} /></button>
                        <button className="p-2 bg-[rgba(0,0,0,0.6)] rounded-full text-white hover:bg-[rgba(255,255,255,0.2)] transition-colors"><MoreVertical size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="h-[100px] flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-md)] p-2 relative overflow-hidden flex flex-col">
                <div className="text-[10px] text-[var(--color-text-secondary)] font-medium mb-1">Audio Waveform (Live)</div>
                <div className="flex items-end flex-1 gap-[2px] opacity-40">
                    {audioWaveHeights.map((height, index) => (
                        <div
                            key={index}
                            className="flex-1 bg-[var(--color-primary)] rounded-t-sm"
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
