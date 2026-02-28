import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
    MonitorAlertType, MonitorAlertSeverity, MonitorAlertRecord,
    MonitorPolicy, RoomState, ScreenSurfaceType,
} from '@/types/monitor';

interface UseAutoGuardrailsOptions {
    interviewId: string | undefined;
    monitorPolicy: MonitorPolicy;
    roomState: RoomState;
    screenShareActive: boolean;
    screenSurface: ScreenSurfaceType;
    sessionTerminated: boolean;
    isConnected: boolean;
    sendMessage: (data: unknown) => void;
    resetScreenState: () => void;
}

export function useAutoGuardrails({
    interviewId,
    monitorPolicy,
    roomState,
    screenShareActive,
    screenSurface,
    sessionTerminated,
    isConnected,
    sendMessage,
    resetScreenState,
}: UseAutoGuardrailsOptions) {
    const queryClient = useQueryClient();
    const [terminating, setTerminating] = useState(false);
    const [requestingReshare, setRequestingReshare] = useState(false);
    const [monitorAlert, setMonitorAlert] = useState<string | null>(null);
    const [autoReshareCount, setAutoReshareCount] = useState(0);
    const [liveMonitorAlerts, setLiveMonitorAlerts] = useState<MonitorAlertRecord[]>([]);
    const [sessionTerminatedLocal, setSessionTerminatedLocal] = useState(false);

    const autoReshareCountRef = useRef(0);
    const autoReshareRequestedAtRef = useRef(0);
    const invalidSurfaceCountRef = useRef(0);
    const lastMonitorAlertAtRef = useRef<Record<string, number>>({});
    const autoTerminatingRef = useRef(false);

    useEffect(() => {
        autoReshareCountRef.current = autoReshareCount;
    }, [autoReshareCount]);

    const isTerminated = sessionTerminated || sessionTerminatedLocal;

    // ── Report alert with cooldown dedup ──
    const reportMonitorAlert = useCallback(async (
        payload: {
            type: MonitorAlertType;
            severity: MonitorAlertSeverity;
            message: string;
            metadata?: Record<string, unknown>;
        },
        options?: { cooldownMs?: number; notify?: boolean }
    ) => {
        if (!interviewId) return;
        const key = `${payload.type}:${payload.severity}`;
        const cooldownMs = options?.cooldownMs ?? 10000;
        const now = Date.now();
        const last = lastMonitorAlertAtRef.current[key] || 0;
        if (now - last < cooldownMs) return;
        lastMonitorAlertAtRef.current[key] = now;

        const optimistic: MonitorAlertRecord = {
            id: `local-${key}-${now}`,
            type: payload.type,
            severity: payload.severity,
            message: payload.message,
            metadata: payload.metadata,
            createdAt: new Date(now).toISOString(),
        };
        setLiveMonitorAlerts((prev) => [optimistic, ...prev].slice(0, 80));

        try {
            await api.post(`/interviews/${interviewId}/monitor-alerts`, payload);
            if (options?.notify) {
                toast.warning(payload.message);
            }
        } catch (error) {
            console.error('Failed to persist monitor alert', error);
        }
    }, [interviewId]);

    // ── Auto-terminate handler ──
    const handlePolicyTerminate = useCallback(async (
        reason: string,
        detailMessage: string
    ) => {
        if (!interviewId || isTerminated || autoTerminatingRef.current) return;
        autoTerminatingRef.current = true;
        setTerminating(true);
        const currentHeartbeatAgeMs = roomState.lastScreenShareAt
            ? Date.now() - new Date(roomState.lastScreenShareAt).getTime()
            : null;
        try {
            await reportMonitorAlert({
                type: 'auto_terminate',
                severity: 'high',
                message: detailMessage,
                metadata: {
                    reason,
                    autoReshareCount: autoReshareCountRef.current,
                    screenSurface,
                    heartbeatAgeMs: currentHeartbeatAgeMs,
                },
            }, { cooldownMs: 1000, notify: true });

            await api.post(`/interviews/${interviewId}/terminate`, { reason });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });

            setSessionTerminatedLocal(true);
            resetScreenState();
            toast.warning('Policy threshold reached. Interview auto-terminated.');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to auto-terminate interview.');
        } finally {
            setTerminating(false);
            autoTerminatingRef.current = false;
        }
    }, [interviewId, isTerminated, queryClient, reportMonitorAlert, roomState.lastScreenShareAt, screenSurface, resetScreenState]);

    // ── Manual terminate ──
    const handleTerminate = useCallback(async (reason = 'manual_terminate_from_monitor') => {
        if (!interviewId || terminating) return;
        setTerminating(true);
        try {
            if (reason === 'manual_terminate_from_monitor') {
                await reportMonitorAlert({
                    type: 'manual_intervention',
                    severity: 'high',
                    message: 'Monitor manually terminated the interview session.',
                    metadata: { reason },
                }, { cooldownMs: 1000 });
            }
            await api.post(`/interviews/${interviewId}/terminate`, { reason });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });
            setSessionTerminatedLocal(true);
            resetScreenState();
            toast.success('Interview terminated.');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to terminate interview.');
        } finally {
            setTerminating(false);
        }
    }, [interviewId, terminating, queryClient, reportMonitorAlert, resetScreenState]);

    // ── Manual reshare request ──
    const handleRequestReshare = useCallback(() => {
        if (!isConnected || isTerminated || requestingReshare) return;
        setRequestingReshare(true);
        sendMessage({
            type: 'monitor_request_reshare',
            reason: 'monitor_requested_reshare',
        });
        void reportMonitorAlert({
            type: 'manual_intervention',
            severity: 'medium',
            message: 'Monitor manually requested candidate to re-share screen.',
        }, { cooldownMs: 1000 });
        toast.success('Re-share request sent to candidate.');
        window.setTimeout(() => { setRequestingReshare(false); }, 800);
    }, [isConnected, isTerminated, reportMonitorAlert, requestingReshare, sendMessage]);

    // ── Heartbeat ──
    const heartbeatAgeMs = roomState.lastScreenShareAt ? Date.now() - new Date(roomState.lastScreenShareAt).getTime() : null;
    const isScreenHeartbeatHealthy = heartbeatAgeMs !== null && heartbeatAgeMs < 10000;

    // ── Monitor alert effect ──
    useEffect(() => {
        if (isTerminated) { setMonitorAlert('Session has been terminated.'); return; }
        if (!roomState.candidateOnline) {
            setMonitorAlert('Candidate is offline. Waiting for reconnect.');
            void reportMonitorAlert({ type: 'candidate_offline', severity: 'medium', message: 'Candidate is offline while monitor session is active.', metadata: { candidateOnline: roomState.candidateOnline } }, { cooldownMs: 15000 });
            return;
        }
        if (!screenShareActive) {
            setMonitorAlert('Screen share is not active. Request candidate to share entire screen.');
            void reportMonitorAlert({ type: 'screen_share_missing', severity: 'high', message: 'Screen share is inactive during monitored interview.' }, { cooldownMs: 12000 });
            return;
        }
        if (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') {
            setMonitorAlert(`Invalid share surface detected (${screenSurface}). Entire screen is required.`);
            invalidSurfaceCountRef.current += 1;
            void reportMonitorAlert({ type: 'screen_surface_invalid', severity: 'high', message: `Invalid screen surface detected: ${screenSurface}`, metadata: { surface: screenSurface, count: invalidSurfaceCountRef.current } }, { cooldownMs: 8000 });
            return;
        }
        if (!monitorPolicy.enforceEntireScreenShare || screenSurface === 'monitor') {
            invalidSurfaceCountRef.current = 0;
        }
        if (heartbeatAgeMs !== null && heartbeatAgeMs >= 10000) {
            setMonitorAlert(`Screen heartbeat delayed (${Math.floor(heartbeatAgeMs / 1000)}s).`);
            void reportMonitorAlert({ type: 'heartbeat_delayed', severity: heartbeatAgeMs >= monitorPolicy.heartbeatTerminateThresholdSec * 1000 ? 'high' : 'medium', message: `Screen heartbeat delayed for ${Math.floor(heartbeatAgeMs / 1000)}s.`, metadata: { heartbeatAgeMs } }, { cooldownMs: 12000 });
            return;
        }
        setMonitorAlert(null);
    }, [heartbeatAgeMs, monitorPolicy.heartbeatTerminateThresholdSec, monitorPolicy.enforceEntireScreenShare, reportMonitorAlert, roomState.candidateOnline, screenShareActive, screenSurface, isTerminated]);

    // ── Auto-reshare guardrail ──
    useEffect(() => {
        if (!isConnected || isTerminated || !roomState.candidateOnline || requestingReshare) return;
        const shouldAutoRequest =
            !screenShareActive ||
            (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') ||
            (heartbeatAgeMs !== null && heartbeatAgeMs >= 15000);
        if (!shouldAutoRequest) return;
        const now = Date.now();
        if (now - autoReshareRequestedAtRef.current < 20000) return;
        autoReshareRequestedAtRef.current = now;
        sendMessage({ type: 'monitor_request_reshare', reason: 'auto_monitor_guardrail' });
        const nextAutoReshareCount = autoReshareCountRef.current + 1;
        autoReshareCountRef.current = nextAutoReshareCount;
        setAutoReshareCount(nextAutoReshareCount);
        void reportMonitorAlert({
            type: (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') ? 'screen_surface_invalid' : 'screen_share_missing',
            severity: 'high',
            message: `Auto re-share requested (#${nextAutoReshareCount}) due to monitor guardrail.`,
            metadata: { screenShareActive, screenSurface, heartbeatAgeMs },
        }, { cooldownMs: 2000 });
        toast.warning('Monitor guardrail triggered. Requested candidate to re-share entire screen.');
        if (monitorPolicy.autoTerminateEnabled && nextAutoReshareCount >= monitorPolicy.maxAutoReshareAttempts && (!screenShareActive || (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') || (heartbeatAgeMs !== null && heartbeatAgeMs >= monitorPolicy.heartbeatTerminateThresholdSec * 1000))) {
            void handlePolicyTerminate('auto_monitor_guardrail_terminate', `Auto terminate triggered after ${nextAutoReshareCount} failed re-share attempts.`);
        }
    }, [heartbeatAgeMs, handlePolicyTerminate, isConnected, monitorPolicy.autoTerminateEnabled, monitorPolicy.enforceEntireScreenShare, monitorPolicy.heartbeatTerminateThresholdSec, monitorPolicy.maxAutoReshareAttempts, requestingReshare, reportMonitorAlert, roomState.candidateOnline, screenShareActive, screenSurface, sendMessage, isTerminated]);

    // ── Invalid surface threshold terminate ──
    useEffect(() => {
        if (!monitorPolicy.autoTerminateEnabled || isTerminated) return;
        if (!monitorPolicy.enforceEntireScreenShare) return;
        if (screenSurface === 'monitor') return;
        if (invalidSurfaceCountRef.current < monitorPolicy.invalidSurfaceTerminateThreshold) return;
        void handlePolicyTerminate('auto_monitor_guardrail_terminate', `Auto terminate triggered: invalid share surface repeated ${invalidSurfaceCountRef.current} times.`);
    }, [handlePolicyTerminate, monitorPolicy.autoTerminateEnabled, monitorPolicy.enforceEntireScreenShare, monitorPolicy.invalidSurfaceTerminateThreshold, screenSurface, isTerminated]);

    // ── WS handler for alert/termination messages ──
    const handleGuardrailWsMessage = useCallback((data: any): boolean => {
        if (data.type === 'monitor_alert' && data.alert) {
            setLiveMonitorAlerts((prev) => [data.alert as MonitorAlertRecord, ...prev].slice(0, 80));
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });
            return true;
        }
        if (data.type === 'session_terminated') {
            setSessionTerminatedLocal(true);
            resetScreenState();
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });
            toast.warning('Interview session terminated.');
            return true;
        }
        return false;
    }, [interviewId, queryClient, resetScreenState]);

    /** Reset state (e.g. when interviewId changes) */
    const resetGuardrailState = useCallback(() => {
        setAutoReshareCount(0);
        setLiveMonitorAlerts([]);
        setMonitorAlert(null);
        setTerminating(false);
        setRequestingReshare(false);
        setSessionTerminatedLocal(false);
        autoReshareCountRef.current = 0;
        invalidSurfaceCountRef.current = 0;
    }, []);

    return {
        terminating,
        requestingReshare,
        monitorAlert,
        autoReshareCount,
        liveMonitorAlerts,
        sessionTerminatedLocal,
        heartbeatAgeMs,
        isScreenHeartbeatHealthy,
        reportMonitorAlert,
        handlePolicyTerminate,
        handleTerminate,
        handleRequestReshare,
        handleGuardrailWsMessage,
        resetGuardrailState,
    };
}
