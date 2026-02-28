/**
 * useSessionRecorder — 面试全程录制 hook
 *
 * 功能：
 *   1. 录制用户麦克风的完整音频（不做 chunking，持续录制）
 *   2. 面试结束时生成 Blob 并上传到后端
 *   3. 自动在组件卸载时清理资源
 *
 * 用法：
 *   const recorder = useSessionRecorder(interviewId);
 *   // 面试开始后
 *   await recorder.startRecording();
 *   // 面试结束后
 *   const url = await recorder.stopAndUpload();
 */
import { useState, useRef, useCallback } from 'react';

interface SessionRecorderState {
    isRecording: boolean;
    isUploading: boolean;
    duration: number;
    error: string | null;
}

export function useSessionRecorder(interviewId: string, apiBaseUrl: string) {
    const [state, setState] = useState<SessionRecorderState>({
        isRecording: false,
        isUploading: false,
        duration: 0,
        error: null,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startRecording = useCallback(async () => {
        if (mediaRecorderRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });
            streamRef.current = stream;
            chunksRef.current = [];

            const mimeCandidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
            ];
            const supportedMime = mimeCandidates.find(
                (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
            );

            const recorder = supportedMime
                ? new MediaRecorder(stream, { mimeType: supportedMime })
                : new MediaRecorder(stream);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.start(5000); // 每 5s 存一个 chunk
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();

            // 计时器
            timerRef.current = setInterval(() => {
                setState((prev) => ({
                    ...prev,
                    duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
                }));
            }, 1000);

            setState((prev) => ({
                ...prev,
                isRecording: true,
                error: null,
                duration: 0,
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : '无法访问麦克风';
            setState((prev) => ({ ...prev, error: message }));
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                resolve(null);
                return;
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || 'audio/webm',
                });
                chunksRef.current = [];

                // 释放流
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                }
                mediaRecorderRef.current = null;

                setState((prev) => ({
                    ...prev,
                    isRecording: false,
                }));

                resolve(blob);
            };

            recorder.stop();
        });
    }, []);

    const uploadRecording = useCallback(
        async (blob: Blob): Promise<string | null> => {
            setState((prev) => ({ ...prev, isUploading: true, error: null }));

            try {
                const formData = new FormData();
                const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
                formData.append('file', blob, `interview-${interviewId}.${ext}`);
                formData.append('interviewId', interviewId);

                const response = await fetch(`${apiBaseUrl}/api/media/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const data = (await response.json()) as { data?: { url?: string } };
                setState((prev) => ({ ...prev, isUploading: false }));
                return data.data?.url || null;
            } catch (err) {
                const message = err instanceof Error ? err.message : '上传失败';
                setState((prev) => ({ ...prev, isUploading: false, error: message }));
                return null;
            }
        },
        [interviewId, apiBaseUrl],
    );

    const stopAndUpload = useCallback(async (): Promise<string | null> => {
        const blob = await stopRecording();
        if (!blob || blob.size < 1024) {
            return null; // 录制太短或无数据
        }
        return uploadRecording(blob);
    }, [stopRecording, uploadRecording]);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        chunksRef.current = [];
    }, []);

    return {
        ...state,
        startRecording,
        stopRecording,
        stopAndUpload,
        cleanup,
    };
}
