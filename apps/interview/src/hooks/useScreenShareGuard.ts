import { useState, useEffect, useCallback, useRef } from 'react';

type ScreenSurfaceType = 'monitor' | 'window' | 'browser' | 'application' | 'unknown';

type ScreenShareGuardOptions = {
    enabled?: boolean;
    requireEntireScreen?: boolean;
    onScreenShareStart?: (surface: ScreenSurfaceType) => void;
    onScreenShareStop?: (reason?: string) => void;
    onError?: (error: Error) => void;
};

export function useScreenShareGuard({
    enabled = true,
    requireEntireScreen = true,
    onScreenShareStart,
    onScreenShareStop,
    onError,
}: ScreenShareGuardOptions) {
    const [isSharing, setIsSharing] = useState(false);
    const [surfaceType, setSurfaceType] = useState<ScreenSurfaceType>('unknown');
    const streamRef = useRef<MediaStream | null>(null);

    const stopScreenShare = useCallback((reason = 'manual_stop') => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsSharing(false);
        setSurfaceType('unknown');
        if (onScreenShareStop) {
            onScreenShareStop(reason);
        }
    }, [onScreenShareStop]);

    const startScreenShare = useCallback(async () => {
        if (!enabled) return null;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: requireEntireScreen ? 'monitor' : undefined,
                },
                audio: false
            });

            const videoTrack = stream.getVideoTracks()[0];
            if (!videoTrack) {
                throw new Error('No video track acquired from display media');
            }

            const settings = videoTrack.getSettings() as any;
            const finalSurface = settings.displaySurface || 'unknown';

            if (requireEntireScreen && finalSurface !== 'monitor') {
                // If strictly requires entire screen but user selected a window/tab, reject it.
                stream.getTracks().forEach(t => t.stop());
                throw new Error('Entire screen share is required by policy.');
            }

            streamRef.current = stream;
            setSurfaceType(finalSurface);
            setIsSharing(true);

            if (onScreenShareStart) {
                onScreenShareStart(finalSurface);
            }

            videoTrack.onended = () => {
                stopScreenShare('system_terminated');
            };

            return stream;
        } catch (error: any) {
            if (onError) {
                onError(error);
            }
            return null;
        }
    }, [enabled, requireEntireScreen, onScreenShareStart, stopScreenShare, onError]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    return {
        isSharing,
        surfaceType,
        stream: streamRef.current,
        startScreenShare,
        stopScreenShare
    };
}
