import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, AlertCircle } from 'lucide-react';
import { cn } from '@hireflow/utils';

interface VideoPlayerProps {
    src: string;
    seekToTime?: number; // In seconds
    autoPlay?: boolean;
    onError?: (error: any) => void;
    className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, seekToTime, autoPlay = true, onError, className }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (videoRef.current && seekToTime !== undefined) {
            videoRef.current.currentTime = seekToTime;
            if (autoPlay) {
                videoRef.current.play().catch(console.error);
            }
        }
    }, [seekToTime, autoPlay]);

    const handlePlayPause = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
        } else {
            videoRef.current.pause();
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
    };

    const handleFullscreen = () => {
        if (!videoRef.current) return;
        if (videoRef.current.requestFullscreen) {
            videoRef.current.requestFullscreen().catch(console.error);
        }
    };

    const handleVideoError = (e: any) => {
        console.error('Video error:', e);
        setError('Failed to load video or the video has expired.');
        if (onError) onError(e);
    };

    if (error) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-6 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)] h-full w-full", className)}>
                <AlertCircle className="text-[var(--color-error)] mb-2" size={24} />
                <span className="text-[12px] text-[var(--color-text-secondary)] text-center">{error}</span>
            </div>
        );
    }

    return (
        <div className={cn("relative group overflow-hidden rounded border border-[var(--color-outline)] bg-black", className)}>
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={handleVideoError}
                autoPlay={autoPlay}
                controls={false} // Custom controls
            />

            {/* Controls Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                <button
                    onClick={handlePlayPause}
                    className="text-white hover:text-[var(--color-primary)] transition-colors focus:outline-none"
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <div className="flex-1" />

                <button
                    onClick={toggleMute}
                    className="text-white hover:text-[var(--color-primary)] transition-colors focus:outline-none"
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <button
                    onClick={handleFullscreen}
                    className="text-white hover:text-[var(--color-primary)] transition-colors focus:outline-none"
                    title="Fullscreen"
                >
                    <Maximize size={16} />
                </button>
            </div>
        </div>
    );
};
