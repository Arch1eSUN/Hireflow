import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderProps {
    onAudioData: (base64: string, mimeType?: string) => void;
    onVadChange: (isSpeaking: boolean) => void;
}

export const useAudioRecorder = ({ onAudioData, onVadChange }: UseAudioRecorderProps) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // VAD State
    const isSpeakingRef = useRef(false);
    const silenceStartRef = useRef<number | null>(null);
    const smoothedRmsRef = useRef(0);
    const SILENCE_THRESHOLD_MS = 950;
    const SPEECH_RMS_THRESHOLD = 0.014;
    const CHUNK_TIMESLICE_MS = 320;

    const startRecording = useCallback(async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            return;
        }
        if (streamRef.current) {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Audio Analysis
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.78;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Media Recorder
            const mimeCandidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
            ];
            const supportedMimeType = mimeCandidates.find((candidate) => (
                typeof MediaRecorder !== 'undefined'
                && typeof MediaRecorder.isTypeSupported === 'function'
                && MediaRecorder.isTypeSupported(candidate)
            ));
            const mediaRecorder = supportedMimeType
                ? new MediaRecorder(stream, { mimeType: supportedMimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        if (base64) {
                            onAudioData(
                                base64,
                                event.data.type || mediaRecorder.mimeType || supportedMimeType || undefined
                            );
                        }
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            mediaRecorder.start(CHUNK_TIMESLICE_MS);
            setIsRecording(true);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            setIsRecording(false);
        }
    }, [onAudioData]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
            analyserRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsRecording(false);
        smoothedRmsRef.current = 0;
        isSpeakingRef.current = false;
        silenceStartRef.current = null;
        onVadChange(false);
    }, [onVadChange]);

    useEffect(() => {
        if (!isRecording) return;

        const checkVolume = () => {
            if (!analyserRef.current) return;

            const dataArray = new Float32Array(analyserRef.current.fftSize);
            analyserRef.current.getFloatTimeDomainData(dataArray);

            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i += 1) {
                const sample = dataArray[i];
                sumSquares += sample * sample;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            const smoothedRms = (smoothedRmsRef.current * 0.72) + (rms * 0.28);
            smoothedRmsRef.current = smoothedRms;
            const isLouder = smoothedRms > SPEECH_RMS_THRESHOLD;

            if (isLouder) {
                if (!isSpeakingRef.current) {
                    isSpeakingRef.current = true;
                    onVadChange(true);
                }
                silenceStartRef.current = null;
            } else {
                if (isSpeakingRef.current) {
                    if (!silenceStartRef.current) {
                        silenceStartRef.current = Date.now();
                    } else if (Date.now() - silenceStartRef.current > SILENCE_THRESHOLD_MS) {
                        isSpeakingRef.current = false;
                        onVadChange(false);
                        silenceStartRef.current = null;
                    }
                }
            }

            animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isRecording, onVadChange]);

    return { isRecording, startRecording, stopRecording };
};
