import { useRef, useCallback, useState } from 'react';

export const useAudioPlayer = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const scheduledTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const initAudio = useCallback(async () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
    }, []);

    const playChunk = useCallback(async (base64Data: string) => {
        await initAudio();
        const ctx = audioContextRef.current!;

        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        try {
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            const now = ctx.currentTime;
            const start = Math.max(now, scheduledTimeRef.current);
            source.start(start);
            scheduledTimeRef.current = start + audioBuffer.duration;

            if (!isPlayingRef.current) {
                isPlayingRef.current = true;
                setIsPlaying(true);
            }

            // Check if queue is empty when this source ends
            source.onended = () => {
                // If current time is close to scheduled time, queue is empty
                if (ctx.currentTime >= scheduledTimeRef.current - 0.1) {
                    isPlayingRef.current = false;
                    setIsPlaying(false);
                }
            };
        } catch (e) {
            console.error('Audio decode error', e);
        }
    }, [initAudio]);

    return { playChunk, isPlaying, initAudio };
};
