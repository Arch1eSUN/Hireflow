import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebRtcSignalPayload, ScreenSurfaceType } from '@/types/monitor';
import { DEV_STUN_SERVERS } from '@/utils/monitorUtils';

export type ScreenConnectionState = 'idle' | 'connecting' | 'live' | 'error';

interface UseWebRtcMonitorOptions {
    /** Stable send-message callback from the WS hook */
    sendMessage: (data: unknown) => void;
    isConnected: boolean;
    sessionTerminated: boolean;
    interviewId: string | undefined;
}

export function useWebRtcMonitor({
    sendMessage,
    isConnected,
    sessionTerminated,
    interviewId,
}: UseWebRtcMonitorOptions) {
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsSendRef = useRef<(data: unknown) => void>(() => { });

    const [screenConnection, setScreenConnection] = useState<ScreenConnectionState>('idle');
    const [screenShareActive, setScreenShareActive] = useState(false);
    const [screenSurface, setScreenSurface] = useState<ScreenSurfaceType>('unknown');

    // Keep wsSendRef in sync
    useEffect(() => {
        wsSendRef.current = sendMessage;
    }, [sendMessage]);

    const ensurePeerConnection = useCallback(() => {
        if (peerConnectionRef.current) return peerConnectionRef.current;

        const pc = new RTCPeerConnection({ iceServers: DEV_STUN_SERVERS });

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
            setScreenConnection('live');
            setScreenShareActive(true);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                wsSendRef.current({
                    type: 'webrtc_signal',
                    payload: {
                        kind: 'candidate',
                        candidate: event.candidate.toJSON(),
                    } satisfies WebRtcSignalPayload,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setScreenConnection('live');
            } else if (pc.connectionState === 'connecting') {
                setScreenConnection('connecting');
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setScreenConnection('error');
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, []);

    const handleWebRtcSignal = useCallback(async (payload: WebRtcSignalPayload) => {
        const pc = ensurePeerConnection();

        try {
            if (payload.kind === 'offer' && payload.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                wsSendRef.current({
                    type: 'webrtc_signal',
                    payload: {
                        kind: 'answer',
                        sdp: answer,
                    } satisfies WebRtcSignalPayload,
                });
                setScreenConnection('connecting');
                return;
            }

            if (payload.kind === 'candidate' && payload.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        } catch (error) {
            console.error('Failed to handle WebRTC signal on monitor side', error);
            setScreenConnection('error');
        }
    }, [ensurePeerConnection]);

    /** Handle screen_share_status WS messages (called from parent handleMessage) */
    const handleScreenShareStatus = useCallback((data: any) => {
        const active = !!data.active;
        setScreenShareActive(active);
        const nextSurface = (data.surface || 'unknown') as ScreenSurfaceType;
        setScreenSurface(nextSurface);
        if (!active) {
            setScreenConnection('idle');
            setScreenSurface('unknown');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        }
    }, []);

    /** Reset screen state on session termination */
    const resetScreenState = useCallback(() => {
        setScreenShareActive(false);
        setScreenConnection('idle');
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    }, []);

    // Request WebRTC offer when connected
    useEffect(() => {
        if (isConnected && interviewId && !sessionTerminated) {
            setScreenConnection('connecting');
            sendMessage({ type: 'room_state_request' });
            sendMessage({ type: 'webrtc_request_offer' });
        }
    }, [interviewId, isConnected, sendMessage, sessionTerminated]);

    // Cleanup peer connection on unmount
    useEffect(() => {
        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        };
    }, []);

    return {
        remoteVideoRef,
        screenConnection,
        setScreenConnection,
        screenShareActive,
        setScreenShareActive,
        screenSurface,
        setScreenSurface,
        handleWebRtcSignal,
        handleScreenShareStatus,
        resetScreenState,
    };
}
