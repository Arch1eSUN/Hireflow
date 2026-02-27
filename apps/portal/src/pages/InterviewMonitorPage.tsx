import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@hireflow/i18n/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Signal, Wifi, Clock, MessageSquare, BrainCircuit, ShieldCheck,
    Mic, MoreVertical, LogOut, Monitor, Download, RefreshCcw, Users, AlertTriangle,
    Files, FileText, Database, Link2,
} from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { resolveInterviewWsUrl } from '@/lib/runtime';
import {
    applyTimelineQueryState,
    getTimelineSearchParam,
    hasLegacyTimelineSearchParams,
    parseTimelineCategoryParam,
    parseTimelineSeverityParam,
} from '@/lib/timelineQueryParams';

import {
    IntegrityItem, IntegrityInsight, WebRtcSignalPayload, ScreenSurfaceType,
    RoomState, MonitorAlertType, MonitorAlertSeverity, MonitorAlertRecord,
    MonitorPolicy, MonitorPolicyPayload, MonitorPolicyHistoryItem,
    CompanyMonitorPolicyPayload, LiveCodeSnapshot, CodeChangeEvent,
    EvidenceExportMode, EvidenceExportPolicyReason, EvidenceExportSummary,
    EvidenceExportHistoryItem, EvidenceTimelineCategory, EvidenceTimelineSeverity,
    EvidenceTimelineItem, EvidenceChainStatus, EvidenceChainVerification,
    EvidenceChainPolicy, EvidenceChainPolicyResponse, EvidenceChainPolicyHistoryItem,
    PolicyMutationResult
} from '@/types/monitor';
import { useMonitorState } from '@/hooks/useMonitorState';
import { InterviewLivePanel } from '@/components/monitor/InterviewLivePanel';
import { InterviewPolicyPanel } from '@/components/monitor/InterviewPolicyPanel';
import { InterviewTimelinePanel } from '@/components/monitor/InterviewTimelinePanel';
import { InterviewEvidenceCenter } from '@/components/monitor/InterviewEvidenceCenter';

const DEFAULT_MONITOR_POLICY: MonitorPolicy = {
    autoTerminateEnabled: false,
    maxAutoReshareAttempts: 3,
    heartbeatTerminateThresholdSec: 45,
    invalidSurfaceTerminateThreshold: 2,
    enforceFullscreen: true,
    enforceEntireScreenShare: true,
    strictClipboardProtection: true,
    codeSyncIntervalMs: 300,
};

import {
    diffMonitorPolicy, diffEvidenceChainPolicy, normalizeAuditReasonInput, createEmptyRoomState,
    calculateCodeDelta, createIdempotencyKey, escapeCsvField, summarizePolicyReasons,
    DEV_STUN_SERVERS, normalizeAction, normalizeReason, getTimelineReason
} from '@/utils/monitorUtils';

const InterviewMonitorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useI18n();
    const token = useAuthStore((s) => s.token);
    const currentUserId = useAuthStore((s) => s.user?.id);
    const currentRole = useAuthStore((s) => s.user?.role);
    const queryClient = useQueryClient();
    const canManageEvidenceChainPolicy = currentRole === 'owner' || currentRole === 'admin';

    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [liveIntegrityEvents, setLiveIntegrityEvents] = useState<IntegrityItem[]>([]);
    const [stats, setStats] = useState({ latency: 0, quality: 'Unknown', duration: 0 });
    const [screenConnection, setScreenConnection] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
    const [screenShareActive, setScreenShareActive] = useState(false);
    const [screenSurface, setScreenSurface] = useState<ScreenSurfaceType>('unknown');
    const [roomState, setRoomState] = useState<RoomState>(createEmptyRoomState(id));
    const [sessionTerminated, setSessionTerminated] = useState(false);
    const [terminating, setTerminating] = useState(false);
    const [requestingReshare, setRequestingReshare] = useState(false);
    const [monitorAlert, setMonitorAlert] = useState<string | null>(null);
    const [autoReshareCount, setAutoReshareCount] = useState(0);
    const [liveMonitorAlerts, setLiveMonitorAlerts] = useState<MonitorAlertRecord[]>([]);
    const [monitorPolicy, setMonitorPolicy] = useState<MonitorPolicy>(DEFAULT_MONITOR_POLICY);
    const [monitorPolicyDirty, setMonitorPolicyDirty] = useState(false);
    const [monitorPolicyReason, setMonitorPolicyReason] = useState('');
    const [monitorPolicyRollbackReason, setMonitorPolicyRollbackReason] = useState('');
    const [selectedPolicyHistoryId, setSelectedPolicyHistoryId] = useState<string | null>(null);
    const [policyDiffBaseline, setPolicyDiffBaseline] = useState<'current' | 'previous'>('current');
    const [evidenceChainPolicyDraft, setEvidenceChainPolicyDraft] = useState<EvidenceChainPolicy>({
        blockOnBrokenChain: true,
        blockOnPartialChain: false,
    });
    const [evidenceChainPolicyDirty, setEvidenceChainPolicyDirty] = useState(false);
    const [selectedEvidenceChainPolicyHistoryId, setSelectedEvidenceChainPolicyHistoryId] = useState<string | null>(null);
    const [evidenceChainPolicyReason, setEvidenceChainPolicyReason] = useState('');
    const [evidenceChainPolicyRollbackReason, setEvidenceChainPolicyRollbackReason] = useState('');
    const [liveCodeSnapshot, setLiveCodeSnapshot] = useState<LiveCodeSnapshot>({
        code: '',
        language: 'javascript',
        timestamp: null,
    });
    const [codeChangeTimeline, setCodeChangeTimeline] = useState<CodeChangeEvent[]>([]);
    const [lastEvidenceExportAt, setLastEvidenceExportAt] = useState<string | null>(null);
    const [lastEvidenceExportMode, setLastEvidenceExportMode] = useState<EvidenceExportMode | null>(null);
    const [evidenceExportCount, setEvidenceExportCount] = useState(0);
    const [evidenceTimelineFilter, setEvidenceTimelineFilter] = useState<'all' | EvidenceTimelineCategory>(
        () => parseTimelineCategoryParam(getTimelineSearchParam(searchParams, 'category'))
    );
    const [evidenceTimelineSeverityFilter, setEvidenceTimelineSeverityFilter] = useState<'all' | EvidenceTimelineSeverity>(
        () => parseTimelineSeverityParam(getTimelineSearchParam(searchParams, 'severity'))
    );
    const [evidenceTimelineActionFilter, setEvidenceTimelineActionFilter] = useState<string | null>(
        () => getTimelineSearchParam(searchParams, 'action')
    );
    const [evidenceTimelineReasonFilter, setEvidenceTimelineReasonFilter] = useState<string | null>(
        () => getTimelineSearchParam(searchParams, 'reason')
    );
    const [selectedEvidenceTimelineId, setSelectedEvidenceTimelineId] = useState<string | null>(
        () => getTimelineSearchParam(searchParams, 'event')
    );
    const [selectedEvidenceExportId, setSelectedEvidenceExportId] = useState<string | null>(
        () => getTimelineSearchParam(searchParams, 'export')
    );

    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsSendRef = useRef<(data: unknown) => void>(() => { });
    const evidenceTimelineItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const evidenceExportItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const legacyTimelineLinkNoticeShownRef = useRef(false);
    const autoReshareRequestedAtRef = useRef(0);
    const autoReshareCountRef = useRef(0);
    const invalidSurfaceCountRef = useRef(0);
    const lastMonitorAlertAtRef = useRef<Record<string, number>>({});
    const autoTerminatingRef = useRef(false);
    const hasInitializedPolicyRef = useRef(false);
    const hasInitializedEvidenceChainPolicyRef = useRef(false);
    const lastCodeRef = useRef('');

    const {
        integrityQuery,
        roomStateQuery: monitorStateQuery,
        monitorAlertsQuery,
        monitorPolicyQuery,
        monitorPolicyHistoryQuery,
        evidenceExportHistoryQuery,
        evidenceTimelineQuery,
        evidenceChainQuery,
        companyMonitorPolicyQuery,
        evidenceChainPolicyQuery,
        evidenceChainPolicyHistoryQuery,
    } = useMonitorState(id, token);
    const integrity = integrityQuery.data;

    const policyHistoryItems = monitorPolicyHistoryQuery.data || [];
    const selectedPolicyHistory = useMemo(
        () => policyHistoryItems.find((item) => item.id === selectedPolicyHistoryId) || null,
        [policyHistoryItems, selectedPolicyHistoryId]
    );
    const selectedPolicyHistoryIndex = useMemo(
        () => policyHistoryItems.findIndex((item) => item.id === selectedPolicyHistoryId),
        [policyHistoryItems, selectedPolicyHistoryId]
    );
    const selectedPolicyHistoryPrevious = useMemo(() => {
        if (selectedPolicyHistoryIndex < 0) return null;
        return policyHistoryItems[selectedPolicyHistoryIndex + 1] || null;
    }, [policyHistoryItems, selectedPolicyHistoryIndex]);
    const policyHistoryDiffCountById = useMemo(() => {
        const diffById: Record<string, number> = {};
        policyHistoryItems.forEach((item, index) => {
            const previous = policyHistoryItems[index + 1];
            const baselinePolicy = previous?.policy || DEFAULT_MONITOR_POLICY;
            diffById[item.id] = diffMonitorPolicy(baselinePolicy, item.policy).length;
        });
        return diffById;
    }, [policyHistoryItems]);
    const policyDiffBasePolicy = useMemo(() => {
        if (policyDiffBaseline === 'previous' && selectedPolicyHistoryPrevious?.policy) {
            return selectedPolicyHistoryPrevious.policy;
        }
        return monitorPolicy;
    }, [monitorPolicy, policyDiffBaseline, selectedPolicyHistoryPrevious?.policy]);
    const policyDiffRows = useMemo(
        () => (selectedPolicyHistory ? diffMonitorPolicy(policyDiffBasePolicy, selectedPolicyHistory.policy) : []),
        [policyDiffBasePolicy, selectedPolicyHistory]
    );
    const policyDiffBaselineLabel = policyDiffBaseline === 'previous' && selectedPolicyHistoryPrevious
        ? 'Previous version'
        : 'Current active policy';

    const evidenceChainPolicyHistoryItems = evidenceChainPolicyHistoryQuery.data || [];
    const selectedEvidenceChainPolicyHistory = useMemo(
        () => evidenceChainPolicyHistoryItems.find((item) => item.id === selectedEvidenceChainPolicyHistoryId) || null,
        [evidenceChainPolicyHistoryItems, selectedEvidenceChainPolicyHistoryId]
    );
    const evidenceChainPolicyDiffCountById = useMemo(() => {
        const diffById: Record<string, number> = {};
        evidenceChainPolicyHistoryItems.forEach((item, index) => {
            const previous = evidenceChainPolicyHistoryItems[index + 1];
            const baselinePolicy = previous?.policy || {
                blockOnBrokenChain: true,
                blockOnPartialChain: false,
            };
            diffById[item.id] = diffEvidenceChainPolicy(baselinePolicy, item.policy).length;
        });
        return diffById;
    }, [evidenceChainPolicyHistoryItems]);
    const evidenceChainPolicyDiffRows = useMemo(
        () => (
            selectedEvidenceChainPolicyHistory
                ? diffEvidenceChainPolicy(evidenceChainPolicyDraft, selectedEvidenceChainPolicyHistory.policy)
                : []
        ),
        [evidenceChainPolicyDraft, selectedEvidenceChainPolicyHistory]
    );

    useEffect(() => {
        if (monitorStateQuery.data) {
            setRoomState(monitorStateQuery.data);
        }
    }, [monitorStateQuery.data]);

    useEffect(() => {
        hasInitializedPolicyRef.current = false;
        hasInitializedEvidenceChainPolicyRef.current = false;
        setMonitorPolicy(DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(false);
        setMonitorPolicyReason('');
        setMonitorPolicyRollbackReason('');
        setSelectedPolicyHistoryId(null);
        setPolicyDiffBaseline('current');
        setEvidenceChainPolicyDraft({
            blockOnBrokenChain: true,
            blockOnPartialChain: false,
        });
        setEvidenceChainPolicyDirty(false);
        setSelectedEvidenceChainPolicyHistoryId(null);
        setEvidenceChainPolicyReason('');
        setEvidenceChainPolicyRollbackReason('');
        setCodeChangeTimeline([]);
        setLastEvidenceExportAt(null);
        setLastEvidenceExportMode(null);
        setEvidenceExportCount(0);
        setEvidenceTimelineFilter(parseTimelineCategoryParam(getTimelineSearchParam(searchParams, 'category')));
        setEvidenceTimelineSeverityFilter(parseTimelineSeverityParam(getTimelineSearchParam(searchParams, 'severity')));
        setEvidenceTimelineActionFilter(getTimelineSearchParam(searchParams, 'action'));
        setEvidenceTimelineReasonFilter(getTimelineSearchParam(searchParams, 'reason'));
        setSelectedEvidenceTimelineId(getTimelineSearchParam(searchParams, 'event'));
        setSelectedEvidenceExportId(getTimelineSearchParam(searchParams, 'export'));
        setLiveCodeSnapshot({
            code: '',
            language: 'javascript',
            timestamp: null,
        });
        lastCodeRef.current = '';
    }, [id, searchParams]);

    useEffect(() => {
        const nextCategory = parseTimelineCategoryParam(getTimelineSearchParam(searchParams, 'category'));
        const nextSeverity = parseTimelineSeverityParam(getTimelineSearchParam(searchParams, 'severity'));
        const nextAction = getTimelineSearchParam(searchParams, 'action');
        const nextReason = getTimelineSearchParam(searchParams, 'reason');
        const nextEvent = getTimelineSearchParam(searchParams, 'event');
        const nextExport = getTimelineSearchParam(searchParams, 'export');

        setEvidenceTimelineFilter((prev) => (prev === nextCategory ? prev : nextCategory));
        setEvidenceTimelineSeverityFilter((prev) => (prev === nextSeverity ? prev : nextSeverity));
        setEvidenceTimelineActionFilter((prev) => (prev === nextAction ? prev : nextAction));
        setEvidenceTimelineReasonFilter((prev) => (prev === nextReason ? prev : nextReason));
        setSelectedEvidenceTimelineId((prev) => (prev === nextEvent ? prev : nextEvent));
        setSelectedEvidenceExportId((prev) => (prev === nextExport ? prev : nextExport));
    }, [searchParams]);

    useEffect(() => {
        const hadLegacyParams = hasLegacyTimelineSearchParams(searchParams);
        const next = applyTimelineQueryState(searchParams, {
            category: evidenceTimelineFilter,
            severity: evidenceTimelineSeverityFilter,
            action: evidenceTimelineActionFilter,
            reason: evidenceTimelineReasonFilter,
            event: selectedEvidenceTimelineId,
            exportId: selectedEvidenceExportId,
        });

        const nextText = next.toString();
        const currentText = searchParams.toString();
        if (nextText === currentText) return;
        setSearchParams(next, { replace: true });
        if (hadLegacyParams && !legacyTimelineLinkNoticeShownRef.current) {
            legacyTimelineLinkNoticeShownRef.current = true;
            toast.info('Legacy timeline link upgraded to v2 query format.');
        }
    }, [
        evidenceTimelineFilter,
        evidenceTimelineSeverityFilter,
        evidenceTimelineActionFilter,
        evidenceTimelineReasonFilter,
        selectedEvidenceTimelineId,
        selectedEvidenceExportId,
        searchParams,
        setSearchParams,
    ]);

    useEffect(() => {
        if (!monitorPolicyQuery.data || hasInitializedPolicyRef.current) return;
        setMonitorPolicy(monitorPolicyQuery.data.policy || DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(false);
        hasInitializedPolicyRef.current = true;
    }, [monitorPolicyQuery.data]);

    useEffect(() => {
        const payload = evidenceChainPolicyQuery.data;
        if (!payload) return;
        if (hasInitializedEvidenceChainPolicyRef.current && evidenceChainPolicyDirty) return;
        setEvidenceChainPolicyDraft(payload.policy || {
            blockOnBrokenChain: true,
            blockOnPartialChain: false,
        });
        setEvidenceChainPolicyDirty(false);
        hasInitializedEvidenceChainPolicyRef.current = true;
    }, [evidenceChainPolicyDirty, evidenceChainPolicyQuery.data]);

    useEffect(() => {
        const history = monitorPolicyHistoryQuery.data || [];
        if (history.length === 0) {
            setSelectedPolicyHistoryId(null);
            return;
        }
        if (selectedPolicyHistoryId && history.some((item) => item.id === selectedPolicyHistoryId)) {
            return;
        }
        setSelectedPolicyHistoryId(history[0].id);
    }, [monitorPolicyHistoryQuery.data, selectedPolicyHistoryId]);

    useEffect(() => {
        const history = evidenceChainPolicyHistoryItems;
        if (history.length === 0) {
            setSelectedEvidenceChainPolicyHistoryId(null);
            return;
        }
        if (selectedEvidenceChainPolicyHistoryId && history.some((item) => item.id === selectedEvidenceChainPolicyHistoryId)) {
            return;
        }
        setSelectedEvidenceChainPolicyHistoryId(history[0].id);
    }, [evidenceChainPolicyHistoryItems, selectedEvidenceChainPolicyHistoryId]);

    useEffect(() => {
        autoReshareCountRef.current = autoReshareCount;
    }, [autoReshareCount]);

    const saveMonitorPolicyMutation = useMutation({
        mutationFn: async ({ nextPolicy, reason }: { nextPolicy: MonitorPolicy; reason?: string }) => {
            const res = await api.put(`/interviews/${id}/monitor-policy`, {
                ...nextPolicy,
                reason,
                idempotencyKey: createIdempotencyKey('interview-monitor-policy-save'),
            });
            return res.data?.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicy(payload?.policy || DEFAULT_MONITOR_POLICY);
            setMonitorPolicyDirty(false);
            setMonitorPolicyReason('');
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', id] });
            if (payload?.idempotentReplay) {
                toast.info('Duplicate request ignored. Existing interview policy kept.');
            } else {
                toast.success('Monitor policy saved.');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to save monitor policy.');
        },
    });

    const rollbackMonitorPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post(`/interviews/${id}/monitor-policy/rollback`, {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('interview-monitor-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicy(payload?.policy || DEFAULT_MONITOR_POLICY);
            setMonitorPolicyDirty(false);
            setMonitorPolicyRollbackReason('');
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', id] });
            if (payload?.idempotentReplay) {
                toast.info('Duplicate rollback ignored. Existing interview policy kept.');
            } else {
                toast.success('Monitor policy rolled back.');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to roll back monitor policy.');
        },
    });
    const saveEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ nextPolicy, reason }: { nextPolicy: EvidenceChainPolicy; reason?: string }) => {
            const res = await api.put('/settings/evidence-chain-policy', {
                ...nextPolicy,
                reason,
                idempotencyKey: createIdempotencyKey('monitor-evidence-policy-save'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload?.policy || {
                blockOnBrokenChain: true,
                blockOnPartialChain: false,
            });
            setEvidenceChainPolicyDirty(false);
            setEvidenceChainPolicyReason('');
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            if (payload?.idempotentReplay) {
                toast.info('Duplicate request ignored. Existing evidence chain policy kept.');
            } else {
                toast.success('Evidence chain policy saved.');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to save evidence chain policy.');
        },
    });
    const rollbackEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post('/settings/evidence-chain-policy/rollback', {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('monitor-evidence-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload?.policy || {
                blockOnBrokenChain: true,
                blockOnPartialChain: false,
            });
            setEvidenceChainPolicyDirty(false);
            setEvidenceChainPolicyRollbackReason('');
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            if (payload?.idempotentReplay) {
                toast.info('Duplicate rollback ignored. Existing evidence chain policy kept.');
            } else {
                toast.success('Evidence chain policy rolled back.');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to roll back evidence chain policy.');
        },
    });
    const logEvidenceExportMutation = useMutation({
        mutationFn: async (payload: {
            mode: EvidenceExportMode;
            files: string[];
            exportedAt: string;
            summary: EvidenceExportSummary;
        }) => {
            const res = await api.post(`/interviews/${id}/evidence-exports`, payload);
            return res.data.data as EvidenceExportHistoryItem;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-exports', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Evidence export saved locally, but failed to sync audit history.');
        },
    });

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

    const reportMonitorAlert = useCallback(async (
        payload: {
            type: MonitorAlertType;
            severity: MonitorAlertSeverity;
            message: string;
            metadata?: Record<string, unknown>;
        },
        options?: { cooldownMs?: number; notify?: boolean }
    ) => {
        if (!id) return;
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
            await api.post(`/interviews/${id}/monitor-alerts`, payload);
            if (options?.notify) {
                toast.warning(payload.message);
            }
        } catch (error) {
            console.error('Failed to persist monitor alert', error);
        }
    }, [id]);

    const handlePolicyTerminate = useCallback(async (
        reason: string,
        detailMessage: string
    ) => {
        if (!id || sessionTerminated || autoTerminatingRef.current) return;
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

            await api.post(`/interviews/${id}/terminate`, {
                reason,
            });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });

            setSessionTerminated(true);
            setScreenShareActive(false);
            setScreenConnection('idle');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            toast.warning('Policy threshold reached. Interview auto-terminated.');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to auto-terminate interview.');
        } finally {
            setTerminating(false);
            autoTerminatingRef.current = false;
        }
    }, [id, queryClient, reportMonitorAlert, roomState.lastScreenShareAt, screenSurface, sessionTerminated]);

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

    const handleMessage = useCallback((data: any) => {
        if (data.type === 'transcript') {
            setTranscripts((prev) => [...prev, { role: 'user', content: data.text, time: new Date().toLocaleTimeString() }]);
            return;
        }

        if (data.type === 'ai_text') {
            setTranscripts((prev) => [...prev, { role: 'ai', content: data.text, time: new Date().toLocaleTimeString() }]);
            return;
        }

        if (data.type === 'integrity_event' && data.event) {
            setLiveIntegrityEvents((prev) => [data.event, ...prev].slice(0, 30));
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
            return;
        }

        if (data.type === 'monitor_alert' && data.alert) {
            setLiveMonitorAlerts((prev) => [data.alert as MonitorAlertRecord, ...prev].slice(0, 80));
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
            return;
        }

        if (data.type === 'monitor_policy_updated' && data.policy) {
            setMonitorPolicy(data.policy as MonitorPolicy);
            setMonitorPolicyDirty(false);
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', id] });
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (data.updatedBy && data.updatedBy !== currentUserId) {
                toast.info(reason ? `Monitor policy updated: ${reason}` : 'Monitor policy updated by another reviewer.');
            }
            return;
        }

        if (data.type === 'company_monitor_policy_template_updated' && data.policy) {
            const updatedPolicy = data.policy as MonitorPolicy;
            const updatedAt = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();
            const updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : null;

            queryClient.setQueryData<CompanyMonitorPolicyPayload>(
                ['company-monitor-policy-template'],
                {
                    policy: updatedPolicy,
                    source: 'saved',
                    updatedAt,
                    updatedBy,
                }
            );

            if (!monitorPolicyDirty && monitorPolicyQuery.data?.source === 'company_default') {
                setMonitorPolicy(updatedPolicy);
                setMonitorPolicyDirty(false);
            }

            void queryClient.invalidateQueries({ queryKey: ['company-monitor-policy-template'] });
            if (!monitorPolicyDirty) {
                void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', id] });
            }
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (updatedBy && updatedBy !== currentUserId) {
                toast.info(reason ? `Company monitor template updated: ${reason}` : 'Company monitor policy template updated.');
            }
            return;
        }

        if (data.type === 'company_evidence_chain_policy_updated' && data.policy) {
            const updatedPolicy = data.policy as EvidenceChainPolicy;
            const updatedAt = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();
            const updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : null;

            queryClient.setQueryData<EvidenceChainPolicyResponse>(
                ['company-evidence-chain-policy'],
                {
                    policy: updatedPolicy,
                    source: 'saved',
                    updatedAt,
                    updatedBy,
                }
            );

            if (!evidenceChainPolicyDirty) {
                setEvidenceChainPolicyDraft(updatedPolicy);
                setEvidenceChainPolicyDirty(false);
            }

            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (updatedBy && updatedBy !== currentUserId) {
                toast.info(reason ? `Company evidence export policy updated: ${reason}` : 'Company evidence export policy updated.');
            }
            return;
        }

        if (data.type === 'evidence_export_logged') {
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-exports', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
            if (data.record?.userId && data.record.userId !== currentUserId) {
                toast.info('Another reviewer exported an evidence package.');
            }
            return;
        }

        if (data.type === 'code_sync') {
            const nextCode = typeof data.code === 'string' ? data.code.slice(0, 16000) : '';
            const language = typeof data.language === 'string' ? data.language : 'javascript';
            const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
            const previousCode = lastCodeRef.current;
            if (previousCode !== nextCode) {
                const delta = calculateCodeDelta(previousCode, nextCode);
                setCodeChangeTimeline((prev) => [
                    {
                        id: `${timestamp}-${Math.abs(delta.charDelta)}-${delta.totalLines}`,
                        timestamp,
                        language,
                        ...delta,
                    },
                    ...prev,
                ].slice(0, 120));
            }
            lastCodeRef.current = nextCode;
            setLiveCodeSnapshot({
                code: nextCode,
                language,
                timestamp,
            });
            return;
        }

        if (data.type === 'session_terminated') {
            setSessionTerminated(true);
            setScreenShareActive(false);
            setScreenConnection('idle');
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', id] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
            setRoomState((prev) => ({
                ...prev,
                screenShareActive: false,
                screenSurface: 'unknown',
                updatedAt: new Date().toISOString(),
            }));
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            toast.warning('Interview session terminated.');
            return;
        }

        if (data.type === 'room_state' && data.state) {
            setRoomState(data.state as RoomState);
            return;
        }

        if (data.type === 'screen_share_status') {
            const active = !!data.active;
            setScreenShareActive(active);
            const nextSurface = (data.surface || 'unknown') as ScreenSurfaceType;
            setScreenSurface(nextSurface);
            setRoomState((prev) => ({
                ...prev,
                screenShareActive: active,
                screenSurface: nextSurface,
                screenMuted: !!data.muted,
                lastScreenShareAt: new Date((data.timestamp as number | undefined) || Date.now()).toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            if (!active) {
                setScreenConnection('idle');
                setScreenSurface('unknown');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                }
            }
            return;
        }

        if (data.type === 'monitor_request_reshare') {
            toast.info('Requested candidate to re-share entire screen.');
            return;
        }

        if (data.type === 'webrtc_signal' && data.payload) {
            void handleWebRtcSignal(data.payload as WebRtcSignalPayload);
        }
    }, [
        currentUserId,
        evidenceChainPolicyDirty,
        handleWebRtcSignal,
        id,
        monitorPolicyDirty,
        monitorPolicyQuery.data?.source,
        queryClient,
    ]);

    const wsUrl = resolveInterviewWsUrl();

    const { isConnected, sendMessage } = useWebSocket(
        wsUrl,
        token || '',
        { interviewId: id || '' },
        handleMessage
    );

    useEffect(() => {
        wsSendRef.current = sendMessage;
    }, [sendMessage]);

    useEffect(() => {
        if (isConnected && id && !sessionTerminated) {
            setScreenConnection('connecting');
            sendMessage({ type: 'room_state_request' });
            sendMessage({ type: 'webrtc_request_offer' });
        }
    }, [id, isConnected, sendMessage, sessionTerminated]);

    useEffect(() => {
        setRoomState((prev) => ({
            ...prev,
            interviewId: id || prev.interviewId,
        }));
    }, [id]);

    useEffect(() => {
        setScreenShareActive(roomState.screenShareActive);
        setScreenSurface(roomState.screenSurface || 'unknown');
        if (!roomState.screenShareActive && screenConnection === 'live') {
            setScreenConnection('idle');
        }
    }, [roomState.screenShareActive, roomState.screenSurface, screenConnection]);

    useEffect(() => {
        const timer = setInterval(() => setStats((prev) => ({ ...prev, duration: prev.duration + 1 })), 1000);
        return () => clearInterval(timer);
    }, []);

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

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${sec}`;
    };

    const riskColorClass =
        integrity?.level === 'high'
            ? 'text-[var(--color-error)]'
            : integrity?.level === 'medium'
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-success)]';

    const mergedTimeline = [...liveIntegrityEvents, ...(integrity?.timeline || [])]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 60);
    const mergedMonitorAlerts = [...liveMonitorAlerts, ...(monitorAlertsQuery.data || [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80);
    const highRiskIntegrityCount = useMemo(
        () => mergedTimeline.filter((event) => event.severity === 'high').length,
        [mergedTimeline]
    );
    const highSeverityMonitorAlertCount = useMemo(
        () => mergedMonitorAlerts.filter((alert) => alert.severity === 'high').length,
        [mergedMonitorAlerts]
    );
    const autoTerminateAlertCount = useMemo(
        () => mergedMonitorAlerts.filter((alert) => alert.type === 'auto_terminate').length,
        [mergedMonitorAlerts]
    );
    const allEvidenceExports = evidenceExportHistoryQuery.data || [];
    const visibleEvidenceExports = useMemo(() => {
        const sliced = allEvidenceExports.slice(0, 10);
        if (!selectedEvidenceExportId) return sliced;
        if (sliced.some((item) => item.id === selectedEvidenceExportId)) return sliced;
        const selected = allEvidenceExports.find((item) => item.id === selectedEvidenceExportId);
        if (!selected) return sliced;
        return [selected, ...sliced.slice(0, 9)];
    }, [allEvidenceExports, selectedEvidenceExportId]);
    const selectedEvidenceExportItem = useMemo(
        () => allEvidenceExports.find((item) => item.id === selectedEvidenceExportId) || null,
        [allEvidenceExports, selectedEvidenceExportId]
    );
    const selectedEvidenceExportTopReasons = useMemo(
        () => selectedEvidenceExportItem?.summary?.policyTopReasons || [],
        [selectedEvidenceExportItem]
    );
    const allEvidenceTimeline = evidenceTimelineQuery.data || [];
    const filteredEvidenceTimeline = useMemo(() => {
        let filtered = allEvidenceTimeline;
        if (evidenceTimelineFilter !== 'all') {
            filtered = filtered.filter((item) => item.category === evidenceTimelineFilter);
        }
        if (evidenceTimelineSeverityFilter !== 'all') {
            filtered = filtered.filter((item) => item.severity === evidenceTimelineSeverityFilter);
        }
        if (evidenceTimelineActionFilter) {
            const targetAction = normalizeAction(evidenceTimelineActionFilter);
            filtered = filtered.filter((item) => normalizeAction(item.action || '') === targetAction);
        }
        if (!evidenceTimelineReasonFilter) return filtered;
        const targetReason = normalizeReason(evidenceTimelineReasonFilter);
        return filtered.filter((item) => {
            const reason = getTimelineReason(item.details);
            if (!reason) return false;
            return normalizeReason(reason) === targetReason;
        });
    }, [
        allEvidenceTimeline,
        evidenceTimelineFilter,
        evidenceTimelineSeverityFilter,
        evidenceTimelineActionFilter,
        evidenceTimelineReasonFilter,
    ]);
    const visibleEvidenceTimeline = useMemo(() => {
        const sliced = filteredEvidenceTimeline.slice(0, 20);
        if (!selectedEvidenceTimelineId) return sliced;
        if (sliced.some((item) => item.id === selectedEvidenceTimelineId)) return sliced;
        const selected = filteredEvidenceTimeline.find((item) => item.id === selectedEvidenceTimelineId);
        if (!selected) return sliced;
        return [selected, ...sliced.slice(0, 19)];
    }, [filteredEvidenceTimeline, selectedEvidenceTimelineId]);
    const evidenceTimelineCategoryCounts = useMemo(() => {
        const counts: Record<'all' | EvidenceTimelineCategory, number> = {
            all: 0,
            alert: 0,
            export: 0,
            policy: 0,
            termination: 0,
            unknown: 0,
        };
        allEvidenceTimeline.forEach((item) => {
            counts.all += 1;
            counts[item.category] += 1;
        });
        return counts;
    }, [allEvidenceTimeline]);
    const evidenceTimelineSeverityCounts = useMemo(() => {
        const counts: Record<EvidenceTimelineSeverity, number> = {
            low: 0,
            medium: 0,
            high: 0,
        };
        allEvidenceTimeline.forEach((item) => {
            counts[item.severity] += 1;
        });
        return counts;
    }, [allEvidenceTimeline]);
    const timelineActionQuickFilters = useMemo(() => {
        const buckets = new Map<string, { action: string; count: number }>();
        allEvidenceTimeline.forEach((item) => {
            const action = String(item.action || '').trim();
            if (!action) return;
            const key = normalizeAction(action);
            const current = buckets.get(key);
            if (current) {
                current.count += 1;
                return;
            }
            buckets.set(key, { action, count: 1 });
        });
        return Array.from(buckets.values())
            .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action))
            .slice(0, 8);
    }, [allEvidenceTimeline]);
    const selectedEvidenceTimelineItem = useMemo(
        () => allEvidenceTimeline.find((item) => item.id === selectedEvidenceTimelineId) || null,
        [allEvidenceTimeline, selectedEvidenceTimelineId]
    );
    const selectedEvidenceTimelineReason = useMemo(
        () => getTimelineReason(selectedEvidenceTimelineItem?.details),
        [selectedEvidenceTimelineItem]
    );
    const policyReasonSummary = useMemo(
        () => summarizePolicyReasons(allEvidenceTimeline, 5),
        [allEvidenceTimeline]
    );
    const timelineReasonQuickFilters = useMemo(() => {
        const merged = new Map<string, { reason: string; count: number }>();
        [...selectedEvidenceExportTopReasons, ...policyReasonSummary.topReasons].forEach((row) => {
            const key = normalizeReason(row.reason);
            const current = merged.get(key);
            if (current) {
                current.count += row.count;
                return;
            }
            merged.set(key, { reason: row.reason, count: row.count });
        });
        return Array.from(merged.values())
            .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
            .slice(0, 6);
    }, [policyReasonSummary.topReasons, selectedEvidenceExportTopReasons]);
    const activeTimelineFilters = useMemo(() => {
        const active: string[] = [];
        if (evidenceTimelineFilter !== 'all') active.push(`category:${evidenceTimelineFilter}`);
        if (evidenceTimelineSeverityFilter !== 'all') active.push(`severity:${evidenceTimelineSeverityFilter}`);
        if (evidenceTimelineActionFilter) active.push(`action:${evidenceTimelineActionFilter}`);
        if (evidenceTimelineReasonFilter) active.push(`reason:${evidenceTimelineReasonFilter}`);
        return active;
    }, [
        evidenceTimelineFilter,
        evidenceTimelineSeverityFilter,
        evidenceTimelineActionFilter,
        evidenceTimelineReasonFilter,
    ]);
    const codeChangeSummary = useMemo(() => (
        codeChangeTimeline.reduce((acc, event) => {
            acc.added += event.addedLines;
            acc.removed += event.removedLines;
            acc.changed += event.changedLines;
            return acc;
        }, {
            added: 0,
            removed: 0,
            changed: 0,
        })
    ), [codeChangeTimeline]);
    const audioWaveHeights = useMemo(
        () => Array.from({ length: 120 }, (_, index) => (
            Math.round(18 + (Math.abs(Math.sin(index * 0.44)) * 58) + ((index % 9) * 1.6))
        )),
        []
    );
    const evidenceChain = evidenceChainQuery.data;
    const evidenceChainStatus: EvidenceChainStatus = evidenceChain?.status || 'not_initialized';
    const evidenceChainStatusLabel = evidenceChainStatus === 'valid'
        ? 'Chain Verified'
        : evidenceChainStatus === 'partial'
            ? 'Chain Partial'
            : evidenceChainStatus === 'broken'
                ? 'Chain Broken'
                : 'Chain Pending';
    const evidenceChainStatusClass = evidenceChainStatus === 'valid'
        ? 'chip-success'
        : evidenceChainStatus === 'partial'
            ? 'chip-warning'
            : evidenceChainStatus === 'broken'
                ? 'chip-error'
                : 'chip-neutral';
    const evidenceChainPolicy = evidenceChainPolicyQuery.data?.policy;
    const exportBlockedReason = useMemo(() => {
        if (!evidenceChainPolicy) return null;
        if (evidenceChainPolicy.blockOnBrokenChain && evidenceChainStatus === 'broken') {
            return 'Evidence export blocked by company policy: chain is broken.';
        }
        if (evidenceChainPolicy.blockOnPartialChain && evidenceChainStatus === 'partial') {
            return 'Evidence export blocked by company policy: chain is partial.';
        }
        return null;
    }, [evidenceChainPolicy, evidenceChainStatus]);
    const isEvidenceExportBlocked = Boolean(exportBlockedReason);

    const heartbeatAgeMs = roomState.lastScreenShareAt ? Date.now() - new Date(roomState.lastScreenShareAt).getTime() : null;
    const isScreenHeartbeatHealthy = heartbeatAgeMs !== null && heartbeatAgeMs < 10000;

    useEffect(() => {
        if (allEvidenceExports.length === 0) {
            setSelectedEvidenceExportId(null);
            return;
        }
        if (selectedEvidenceExportId && allEvidenceExports.some((item) => item.id === selectedEvidenceExportId)) {
            return;
        }
        setSelectedEvidenceExportId(allEvidenceExports[0].id);
    }, [allEvidenceExports, selectedEvidenceExportId]);

    useEffect(() => {
        if (filteredEvidenceTimeline.length === 0) {
            setSelectedEvidenceTimelineId(null);
            return;
        }
        if (selectedEvidenceTimelineId && filteredEvidenceTimeline.some((item) => item.id === selectedEvidenceTimelineId)) {
            return;
        }
        setSelectedEvidenceTimelineId(filteredEvidenceTimeline[0].id);
    }, [filteredEvidenceTimeline, selectedEvidenceTimelineId]);

    useEffect(() => {
        if (!selectedEvidenceExportId) return;
        const node = evidenceExportItemRefs.current[selectedEvidenceExportId];
        if (!node) return;
        node.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
        });
    }, [selectedEvidenceExportId, visibleEvidenceExports]);

    useEffect(() => {
        if (!selectedEvidenceTimelineId) return;
        const node = evidenceTimelineItemRefs.current[selectedEvidenceTimelineId];
        if (!node) return;
        node.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
        });
    }, [selectedEvidenceTimelineId, visibleEvidenceTimeline]);

    useEffect(() => {
        if (sessionTerminated) {
            setMonitorAlert('Session has been terminated.');
            return;
        }
        if (!roomState.candidateOnline) {
            setMonitorAlert('Candidate is offline. Waiting for reconnect.');
            void reportMonitorAlert({
                type: 'candidate_offline',
                severity: 'medium',
                message: 'Candidate is offline while monitor session is active.',
                metadata: { candidateOnline: roomState.candidateOnline },
            }, { cooldownMs: 15000 });
            return;
        }
        if (!screenShareActive) {
            setMonitorAlert('Screen share is not active. Request candidate to share entire screen.');
            void reportMonitorAlert({
                type: 'screen_share_missing',
                severity: 'high',
                message: 'Screen share is inactive during monitored interview.',
            }, { cooldownMs: 12000 });
            return;
        }
        if (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') {
            setMonitorAlert(`Invalid share surface detected (${screenSurface}). Entire screen is required.`);
            invalidSurfaceCountRef.current += 1;
            void reportMonitorAlert({
                type: 'screen_surface_invalid',
                severity: 'high',
                message: `Invalid screen surface detected: ${screenSurface}`,
                metadata: { surface: screenSurface, count: invalidSurfaceCountRef.current },
            }, { cooldownMs: 8000 });
            return;
        }
        if (!monitorPolicy.enforceEntireScreenShare || screenSurface === 'monitor') {
            invalidSurfaceCountRef.current = 0;
        }
        if (heartbeatAgeMs !== null && heartbeatAgeMs >= 10000) {
            setMonitorAlert(`Screen heartbeat delayed (${Math.floor(heartbeatAgeMs / 1000)}s).`);
            void reportMonitorAlert({
                type: 'heartbeat_delayed',
                severity: heartbeatAgeMs >= monitorPolicy.heartbeatTerminateThresholdSec * 1000 ? 'high' : 'medium',
                message: `Screen heartbeat delayed for ${Math.floor(heartbeatAgeMs / 1000)}s.`,
                metadata: { heartbeatAgeMs },
            }, { cooldownMs: 12000 });
            return;
        }
        setMonitorAlert(null);
    }, [
        heartbeatAgeMs,
        monitorPolicy.heartbeatTerminateThresholdSec,
        monitorPolicy.enforceEntireScreenShare,
        reportMonitorAlert,
        roomState.candidateOnline,
        screenShareActive,
        screenSurface,
        sessionTerminated,
    ]);

    useEffect(() => {
        if (!isConnected || sessionTerminated || !roomState.candidateOnline || requestingReshare) return;

        const shouldAutoRequest =
            !screenShareActive ||
            (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') ||
            (heartbeatAgeMs !== null && heartbeatAgeMs >= 15000);

        if (!shouldAutoRequest) return;

        const now = Date.now();
        if (now - autoReshareRequestedAtRef.current < 20000) return;
        autoReshareRequestedAtRef.current = now;

        sendMessage({
            type: 'monitor_request_reshare',
            reason: 'auto_monitor_guardrail',
        });
        const nextAutoReshareCount = autoReshareCountRef.current + 1;
        autoReshareCountRef.current = nextAutoReshareCount;
        setAutoReshareCount(nextAutoReshareCount);
        void reportMonitorAlert({
            type: (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor')
                ? 'screen_surface_invalid'
                : 'screen_share_missing',
            severity: 'high',
            message: `Auto re-share requested (#${nextAutoReshareCount}) due to monitor guardrail.`,
            metadata: {
                screenShareActive,
                screenSurface,
                heartbeatAgeMs,
            },
        }, { cooldownMs: 2000 });
        toast.warning('Monitor guardrail triggered. Requested candidate to re-share entire screen.');

        if (
            monitorPolicy.autoTerminateEnabled &&
            nextAutoReshareCount >= monitorPolicy.maxAutoReshareAttempts &&
            (
                !screenShareActive ||
                (monitorPolicy.enforceEntireScreenShare && screenSurface !== 'monitor') ||
                (heartbeatAgeMs !== null && heartbeatAgeMs >= monitorPolicy.heartbeatTerminateThresholdSec * 1000)
            )
        ) {
            void handlePolicyTerminate(
                'auto_monitor_guardrail_terminate',
                `Auto terminate triggered after ${nextAutoReshareCount} failed re-share attempts.`
            );
        }
    }, [
        heartbeatAgeMs,
        handlePolicyTerminate,
        isConnected,
        monitorPolicy.autoTerminateEnabled,
        monitorPolicy.enforceEntireScreenShare,
        monitorPolicy.heartbeatTerminateThresholdSec,
        monitorPolicy.maxAutoReshareAttempts,
        requestingReshare,
        reportMonitorAlert,
        roomState.candidateOnline,
        screenShareActive,
        screenSurface,
        sendMessage,
        sessionTerminated,
    ]);

    useEffect(() => {
        if (!monitorPolicy.autoTerminateEnabled || sessionTerminated) return;
        if (!monitorPolicy.enforceEntireScreenShare) return;
        if (screenSurface === 'monitor') return;
        if (invalidSurfaceCountRef.current < monitorPolicy.invalidSurfaceTerminateThreshold) return;

        void handlePolicyTerminate(
            'auto_monitor_guardrail_terminate',
            `Auto terminate triggered: invalid share surface repeated ${invalidSurfaceCountRef.current} times.`
        );
    }, [
        handlePolicyTerminate,
        monitorPolicy.autoTerminateEnabled,
        monitorPolicy.enforceEntireScreenShare,
        monitorPolicy.invalidSurfaceTerminateThreshold,
        screenSurface,
        sessionTerminated,
    ]);

    const downloadTextFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const toEvidenceTimelineCsv = (timeline: EvidenceTimelineItem[]) => {
        const header = 'createdAt,category,severity,title,message,reason,action,userId';
        const rows = timeline.map((item) => {
            const reason = getTimelineReason(item.details) || '';
            return [
                escapeCsvField(item.createdAt),
                escapeCsvField(item.category),
                escapeCsvField(item.severity),
                escapeCsvField(item.title || ''),
                escapeCsvField(item.message || ''),
                escapeCsvField(reason),
                escapeCsvField(item.action || ''),
                escapeCsvField(item.userId || ''),
            ].join(',');
        });
        return [header, ...rows].join('\n');
    };

    const handleCopyTimelineFilterLink = useCallback(async () => {
        if (typeof window === 'undefined') return;
        try {
            const href = window.location.href;
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(href);
            } else {
                const input = document.createElement('textarea');
                input.value = href;
                input.style.position = 'fixed';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                input.remove();
            }
            toast.success('Timeline filter link copied.');
        } catch {
            toast.error('Failed to copy filter link.');
        }
    }, []);

    const handleExportEvidenceTimeline = (format: 'json' | 'csv' = 'json') => {
        if (!id) {
            toast.error('Missing interview id.');
            return;
        }
        const exportedAt = new Date().toISOString();
        if (format === 'csv') {
            const csv = toEvidenceTimelineCsv(filteredEvidenceTimeline);
            downloadTextFile(
                `evidence-timeline-${id}-${Date.now()}.csv`,
                csv,
                'text/csv;charset=utf-8'
            );
            toast.success('Evidence timeline CSV exported.');
            return;
        }
        const payload = {
            interviewId: id,
            exportedAt,
            filter: {
                category: evidenceTimelineFilter,
                severity: evidenceTimelineSeverityFilter,
                action: evidenceTimelineActionFilter,
                reason: evidenceTimelineReasonFilter,
            },
            total: filteredEvidenceTimeline.length,
            timeline: filteredEvidenceTimeline,
        };
        downloadTextFile(
            `evidence-timeline-${id}-${Date.now()}.json`,
            JSON.stringify(payload, null, 2),
            'application/json;charset=utf-8'
        );
        toast.success('Evidence timeline exported.');
    };

    const buildEvidenceArtifacts = () => {
        const exportedAt = new Date().toISOString();
        const safeId = id || 'unknown-session';
        const filenameSuffix = `${safeId}-${Date.now()}`;
        const timelineCsv = toEvidenceTimelineCsv(allEvidenceTimeline);
        const exportSummary: EvidenceExportSummary = {
            integrityEventCount: mergedTimeline.length,
            highRiskIntegrityCount,
            monitorAlertCount: mergedMonitorAlerts.length,
            highSeverityMonitorAlertCount,
            codeDiffEvents: codeChangeTimeline.length,
            timelineEventCount: allEvidenceTimeline.length,
            policyReasonEvents: policyReasonSummary.events,
            policyReasonUnique: policyReasonSummary.unique,
            policyTopReasons: policyReasonSummary.topReasons,
            chainStatus: evidenceChainStatus,
            chainLinkedEvents: evidenceChain?.linkedEvents || 0,
            chainCheckedEvents: evidenceChain?.checkedEvents || 0,
            chainLatestHash: evidenceChain?.latestHash || undefined,
        };
        const timelineJson = {
            interviewId: safeId,
            exportedAt,
            total: allEvidenceTimeline.length,
            timeline: allEvidenceTimeline,
        };

        const evidenceJson = {
            interviewId: safeId,
            exportedAt,
            monitorStats: stats,
            screen: {
                connection: screenConnection,
                active: screenShareActive,
                surface: screenSurface,
                lastHeartbeatAt: roomState.lastScreenShareAt,
            },
            roomState,
            integritySnapshot: integrity || null,
            integrityTimeline: mergedTimeline,
            monitorPolicy,
            monitorAlerts: mergedMonitorAlerts,
            liveCodeSnapshot,
            codeChangeTimeline,
            evidenceTimeline: allEvidenceTimeline,
            evidenceChainVerification: evidenceChain || null,
            exportSummary,
            transcripts,
        };

        const csvHeader = 'timestamp,type,severity,message';
        const csvRows = mergedTimeline.map((event) => {
            const sanitizedMessage = String(event.message || '').replace(/"/g, '""');
            return `${event.timestamp},${event.type},${event.severity},"${sanitizedMessage}"`;
        });
        const codeCsvHeader = 'timestamp,language,addedLines,removedLines,changedLines,charDelta,totalLines';
        const codeCsvRows = codeChangeTimeline.map((event) => (
            `${new Date(event.timestamp).toISOString()},${event.language},${event.addedLines},${event.removedLines},${event.changedLines},${event.charDelta},${event.totalLines}`
        ));
        const integrityCsv = [csvHeader, ...csvRows].join('\n');
        const codeDiffCsv = [codeCsvHeader, ...codeCsvRows].join('\n');
        const bundle = {
            interviewId: safeId,
            exportedAt,
            summary: exportSummary,
            files: {
                evidence: evidenceJson,
                integrityTimelineCsv: integrityCsv,
                codeDiffTimelineCsv: codeDiffCsv,
                evidenceTimelineJson: timelineJson,
                evidenceTimelineCsv: timelineCsv,
                evidenceChainVerification: evidenceChain || null,
            },
        };

        return {
            exportedAt,
            safeId,
            filenameSuffix,
            evidenceJson,
            integrityCsv,
            codeDiffCsv,
            timelineJson,
            timelineCsv,
            exportSummary,
            bundle,
        };
    };

    const handleExportEvidence = (mode: EvidenceExportMode = 'all') => {
        if (!id) {
            toast.error('Missing interview id.');
            return;
        }
        if (isEvidenceExportBlocked) {
            toast.error(exportBlockedReason || 'Evidence export is blocked by policy.');
            return;
        }
        const artifacts = buildEvidenceArtifacts();
        const modeLabel = mode.toUpperCase();
        const exportedFiles: string[] = [];

        if (mode === 'all' || mode === 'json') {
            exportedFiles.push(`evidence-${artifacts.filenameSuffix}.json`);
            downloadTextFile(`evidence-${artifacts.filenameSuffix}.json`, JSON.stringify(artifacts.evidenceJson, null, 2), 'application/json;charset=utf-8');
            exportedFiles.push(`evidence-timeline-${artifacts.filenameSuffix}.json`);
            downloadTextFile(`evidence-timeline-${artifacts.filenameSuffix}.json`, JSON.stringify(artifacts.timelineJson, null, 2), 'application/json;charset=utf-8');
        }
        if (mode === 'all' || mode === 'csv') {
            exportedFiles.push(`integrity-timeline-${artifacts.filenameSuffix}.csv`);
            exportedFiles.push(`code-diff-timeline-${artifacts.filenameSuffix}.csv`);
            exportedFiles.push(`evidence-timeline-${artifacts.filenameSuffix}.csv`);
            downloadTextFile(`integrity-timeline-${artifacts.filenameSuffix}.csv`, artifacts.integrityCsv, 'text/csv;charset=utf-8');
            downloadTextFile(`code-diff-timeline-${artifacts.filenameSuffix}.csv`, artifacts.codeDiffCsv, 'text/csv;charset=utf-8');
            downloadTextFile(`evidence-timeline-${artifacts.filenameSuffix}.csv`, artifacts.timelineCsv, 'text/csv;charset=utf-8');
        }
        if (mode === 'all' || mode === 'bundle') {
            exportedFiles.push(`evidence-bundle-${artifacts.filenameSuffix}.json`);
            downloadTextFile(`evidence-bundle-${artifacts.filenameSuffix}.json`, JSON.stringify(artifacts.bundle, null, 2), 'application/json;charset=utf-8');
        }

        setLastEvidenceExportAt(artifacts.exportedAt);
        setLastEvidenceExportMode(mode);
        setEvidenceExportCount((prev) => prev + 1);
        logEvidenceExportMutation.mutate({
            mode,
            files: exportedFiles,
            exportedAt: artifacts.exportedAt,
            summary: artifacts.exportSummary,
        });
        void reportMonitorAlert({
            type: 'manual_intervention',
            severity: 'low',
            message: `Monitor exported evidence package (${modeLabel}).`,
            metadata: {
                exportMode: mode,
                interviewId: artifacts.safeId,
                exportedFiles,
                highRiskIntegrityCount,
                highSeverityMonitorAlertCount,
                codeDiffEvents: codeChangeTimeline.length,
                timelineEventCount: allEvidenceTimeline.length,
                evidenceChainStatus,
                policyReasonEvents: policyReasonSummary.events,
                policyReasonUnique: policyReasonSummary.unique,
            },
        }, { cooldownMs: 0 });

        toast.success(mode === 'all'
            ? 'Evidence exported (bundle + JSON + CSV + timeline).'
            : `Evidence exported (${modeLabel}).`
        );
    };

    const handleTerminate = async (reason = 'manual_terminate_from_monitor') => {
        if (!id || terminating) return;
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
            await api.post(`/interviews/${id}/terminate`, {
                reason,
            });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', id] });
            setSessionTerminated(true);
            setScreenShareActive(false);
            setScreenConnection('idle');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            toast.success('Interview terminated.');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to terminate interview.');
        } finally {
            setTerminating(false);
        }
    };

    const handleRequestReshare = () => {
        if (!isConnected || sessionTerminated || requestingReshare) return;
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
        window.setTimeout(() => {
            setRequestingReshare(false);
        }, 800);
    };

    const updateMonitorPolicy = (patch: Partial<MonitorPolicy>) => {
        setMonitorPolicy((prev) => ({ ...prev, ...patch }));
        setMonitorPolicyDirty(true);
    };

    const handleSaveMonitorPolicy = () => {
        if (!id || saveMonitorPolicyMutation.isPending) return;
        saveMonitorPolicyMutation.mutate({
            nextPolicy: monitorPolicy,
            reason: normalizeAuditReasonInput(monitorPolicyReason),
        });
    };

    const handleResetMonitorPolicy = () => {
        setMonitorPolicy(DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(true);
    };

    const handleApplyCompanyTemplate = () => {
        const policy = companyMonitorPolicyQuery.data?.policy;
        if (!policy) {
            toast.error('Failed to load company monitor template.');
            return;
        }
        setMonitorPolicy(policy);
        setMonitorPolicyDirty(true);
        toast.success('Applied company monitor template.');
    };

    const updateEvidenceChainPolicy = (patch: Partial<EvidenceChainPolicy>) => {
        setEvidenceChainPolicyDraft((prev) => ({ ...prev, ...patch }));
        setEvidenceChainPolicyDirty(true);
    };

    const handleSaveEvidenceChainPolicy = () => {
        if (!canManageEvidenceChainPolicy || saveEvidenceChainPolicyMutation.isPending) return;
        saveEvidenceChainPolicyMutation.mutate({
            nextPolicy: evidenceChainPolicyDraft,
            reason: normalizeAuditReasonInput(evidenceChainPolicyReason),
        });
    };

    const handleResetEvidenceChainPolicyDraft = () => {
        setEvidenceChainPolicyDraft(
            evidenceChainPolicyQuery.data?.policy || {
                blockOnBrokenChain: true,
                blockOnPartialChain: false,
            }
        );
        setEvidenceChainPolicyDirty(false);
    };

    return (
        <div className="h-screen w-screen bg-[var(--color-surface-dim)] p-4 md:p-5 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <header className="bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-md)] p-3 mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse', isConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]')} />
                        <span className="font-bold text-[var(--color-success)] uppercase tracking-wider text-xs">
                            {isConnected ? 'Live Monitor' : 'Disconnected'}
                        </span>
                    </div>
                    <div className="h-4 w-[1px] bg-[var(--color-outline)]" />
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">Session: {id || 'SESSION-8821'}</span>
                    <span className={cn('chip', screenShareActive ? 'chip-success' : 'chip-warning')}>
                        {screenShareActive ? 'Screen Share Active' : 'Waiting for Share'}
                    </span>
                    <span className={cn('chip', !monitorPolicy.enforceEntireScreenShare || screenSurface === 'monitor' ? 'chip-success' : 'chip-warning')}>
                        {monitorPolicy.enforceEntireScreenShare
                            ? (screenSurface === 'monitor' ? 'Entire Screen Shared' : `Surface ${screenSurface}`)
                            : `Surface ${screenSurface}`}
                    </span>
                    <span className={cn('chip', roomState.candidateOnline ? 'chip-success' : 'chip-error')}>
                        Candidate {roomState.candidateOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="chip chip-warning">
                        <Users size={12} className="inline mr-1" />
                        Monitors {roomState.monitorCount}
                    </span>
                    {autoReshareCount > 0 && (
                        <span className="chip chip-warning">
                            Auto Re-share {autoReshareCount}
                        </span>
                    )}
                    {evidenceExportCount > 0 && (
                        <span className="chip chip-neutral">
                            Evidence Exports {evidenceExportCount}
                        </span>
                    )}
                    <span className={cn('chip', isScreenHeartbeatHealthy ? 'chip-success' : 'chip-warning')}>
                        {roomState.lastScreenShareAt
                            ? (isScreenHeartbeatHealthy ? 'Screen heartbeat healthy' : 'Screen heartbeat delayed')
                            : 'Waiting heartbeat'}
                    </span>
                    {sessionTerminated && (
                        <span className="chip chip-error">Session Terminated</span>
                    )}
                </div>

                <div className="flex items-center gap-2 xl:gap-3 text-xs font-mono text-[var(--color-text-secondary)] flex-wrap xl:justify-end">
                    <div className="flex items-center gap-1.5" title="Connection Quality">
                        <Signal size={14} className={cn(isConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]')} />
                        <span>{isConnected ? 'Excellent' : 'Offline'}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Latency">
                        <Wifi size={14} />
                        <span>{stats.latency}ms</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Duration">
                        <Clock size={14} />
                        <span>{formatDuration(stats.duration)}</span>
                    </div>
                    <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={handleRequestReshare} disabled={!isConnected || sessionTerminated || requestingReshare}>
                        <RefreshCcw size={12} className="mr-1" /> {requestingReshare ? 'Sending...' : 'Request Re-share'}
                    </button>
                    <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={() => handleExportEvidence('all')}>
                        <Download size={12} className="mr-1" /> Quick Export
                    </button>
                    <button className="btn btn-danger h-[28px] text-xs px-3" onClick={() => void handleTerminate()} disabled={terminating || sessionTerminated}>
                        <LogOut size={12} className="mr-1" /> {terminating ? 'Terminating...' : 'Terminate'}
                    </button>
                </div>
            </header>

            {monitorAlert && (
                <div className={cn(
                    'mb-3 rounded-xl border px-3 py-2 flex items-center justify-between gap-3',
                    monitorAlert.includes('terminated')
                        ? 'border-[var(--color-error)]/30 bg-[var(--color-error-bg)] text-[var(--color-error)]'
                        : 'border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                )}>
                    <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} />
                        <span>{monitorAlert}</span>
                    </div>
                    {!sessionTerminated && (
                        <div className="flex items-center gap-2">
                            <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={handleRequestReshare} disabled={!isConnected || requestingReshare}>
                                {requestingReshare ? 'Sending...' : 'Request Re-share'}
                            </button>
                            <button className="btn btn-danger h-[28px] text-xs px-3" onClick={() => void handleTerminate()} disabled={terminating}>
                                {terminating ? 'Terminating...' : 'Terminate'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
                <InterviewLivePanel
                    remoteVideoRef={remoteVideoRef}
                    screenConnection={screenConnection}
                    screenShareActive={screenShareActive}
                    screenSurface={screenSurface}
                    monitorPolicy={monitorPolicy}
                    audioWaveHeights={audioWaveHeights}
                />

                <div className="xl:col-span-4 flex flex-col gap-4 min-h-0 h-full">
                    <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-md)] flex flex-col min-h-0 shadow-sm">
                        <div className="p-3 border-b border-[var(--color-outline)] flex justify-between items-center bg-[var(--color-surface-dim)]">
                            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase flex items-center gap-2">
                                <MessageSquare size={14} /> Live Transcript
                            </h3>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border border-opacity-20 animate-pulse', isConnected ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]' : 'bg-[var(--color-error)] text-white')}>
                                {isConnected ? 'Running' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-mono leading-relaxed bg-[var(--color-surface)]">
                            {transcripts.length === 0 && (
                                <div className="text-center text-[var(--color-text-secondary)] mt-10">No messages yet...</div>
                            )}
                            {transcripts.map((msg, i) => (
                                <div key={i} className={cn('pl-3 border-l-2', msg.role === 'ai' ? 'border-[var(--color-primary)]' : 'border-[var(--color-text-secondary)]')}>
                                    <span className="text-[10px] font-bold text-[var(--color-text-secondary)] block mb-1 uppercase">{msg.role === 'ai' ? 'AI Interviewer' : 'Candidate'} • {msg.time}</span>
                                    <p className={cn(msg.role === 'ai' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]')}>{msg.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-[360px] xl:h-[300px] flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-md)] flex flex-col shadow-sm">
                        <div className="p-3 border-b border-[var(--color-outline)] bg-[var(--color-surface-dim)]">
                            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase flex items-center gap-2">
                                <BrainCircuit size={14} /> Signals & Analysis
                            </h3>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[var(--color-surface-dim)] p-3 rounded border border-[var(--color-outline)]">
                                    <div className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase">Technical</div>
                                    <div className="text-xl font-bold text-[var(--color-primary)] mt-1">Calculating...</div>
                                </div>
                                <div className="bg-[var(--color-surface-dim)] p-3 rounded border border-[var(--color-outline)]">
                                    <div className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase">Communication</div>
                                    <div className="text-xl font-bold text-[var(--color-success)] mt-1">Calculating...</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
                                <ShieldCheck size={20} className="text-[var(--color-success)]" />
                                <div>
                                    <div className="text-xs font-bold text-[var(--color-text-primary)]">Anti-Cheat Monitor</div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">Realtime fullscreen lock, clipboard blocking, and full-screen sharing checks enabled.</div>
                                </div>
                            </div>

                            <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Live Code Mirror</div>
                                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                                        {liveCodeSnapshot.timestamp
                                            ? `Updated ${new Date(liveCodeSnapshot.timestamp).toLocaleTimeString()}`
                                            : 'Waiting'}
                                    </span>
                                </div>
                                {liveCodeSnapshot.code ? (
                                    <pre className="max-h-[180px] overflow-auto rounded border border-[var(--color-outline)] bg-[#0b1220] p-2 text-[11px] leading-5 text-[#dbe6ff]">
                                        {liveCodeSnapshot.code}
                                    </pre>
                                ) : (
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                                        Waiting for candidate editor sync...
                                    </div>
                                )}

                                <div className="mt-2 border-t border-[var(--color-outline)] pt-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)] mb-1">
                                        Code Diff Timeline
                                    </div>
                                    {codeChangeTimeline.length === 0 ? (
                                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                                            No code delta captured yet.
                                        </div>
                                    ) : (
                                        <div className="max-h-[120px] overflow-auto space-y-1 pr-1">
                                            {codeChangeTimeline.slice(0, 10).map((event) => (
                                                <div key={event.id} className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1 text-[10px]">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[var(--color-text-secondary)]">
                                                            {new Date(event.timestamp).toLocaleTimeString()}
                                                        </span>
                                                        <span className="text-[var(--color-text-secondary)]">{event.language}</span>
                                                    </div>
                                                    <div className="mt-0.5">
                                                        +{event.addedLines} / -{event.removedLines} / ~{event.changedLines} lines · Δ{event.charDelta} chars
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <InterviewEvidenceCenter
                                evidenceExportHistoryQuery={evidenceExportHistoryQuery}
                                evidenceChainStatusClass={evidenceChainStatusClass}
                                evidenceChainStatusLabel={evidenceChainStatusLabel}
                                highRiskIntegrityCount={highRiskIntegrityCount}
                                highSeverityMonitorAlertCount={highSeverityMonitorAlertCount}
                                codeChangeTimeline={codeChangeTimeline}
                                autoTerminateAlertCount={autoTerminateAlertCount}
                                evidenceChainQuery={evidenceChainQuery}
                                evidenceChain={evidenceChain}
                                evidenceChainPolicy={evidenceChainPolicy}
                                exportBlockedReason={exportBlockedReason}
                                evidenceChainPolicyQuery={evidenceChainPolicyQuery}
                                evidenceChainPolicyDraft={evidenceChainPolicyDraft}
                                updateEvidenceChainPolicy={updateEvidenceChainPolicy}
                                canManageEvidenceChainPolicy={canManageEvidenceChainPolicy}
                                evidenceChainPolicyDirty={evidenceChainPolicyDirty}
                                handleResetEvidenceChainPolicyDraft={handleResetEvidenceChainPolicyDraft}
                                handleSaveEvidenceChainPolicy={handleSaveEvidenceChainPolicy}
                                saveEvidenceChainPolicyMutation={saveEvidenceChainPolicyMutation}
                                evidenceChainPolicyReason={evidenceChainPolicyReason}
                                setEvidenceChainPolicyReason={setEvidenceChainPolicyReason}
                                evidenceChainPolicyRollbackReason={evidenceChainPolicyRollbackReason}
                                setEvidenceChainPolicyRollbackReason={setEvidenceChainPolicyRollbackReason}
                                rollbackEvidenceChainPolicyMutation={rollbackEvidenceChainPolicyMutation}
                                evidenceChainPolicyHistoryQuery={evidenceChainPolicyHistoryQuery}
                                evidenceChainPolicyHistoryItems={evidenceChainPolicyHistoryItems}
                                selectedEvidenceChainPolicyHistoryId={selectedEvidenceChainPolicyHistoryId}
                                setSelectedEvidenceChainPolicyHistoryId={setSelectedEvidenceChainPolicyHistoryId}
                                evidenceChainPolicyDiffCountById={evidenceChainPolicyDiffCountById}
                                selectedEvidenceChainPolicyHistory={selectedEvidenceChainPolicyHistory}
                                evidenceChainPolicyDiffRows={evidenceChainPolicyDiffRows}
                                handleExportEvidence={handleExportEvidence}
                                logEvidenceExportMutation={logEvidenceExportMutation}
                                isEvidenceExportBlocked={isEvidenceExportBlocked}
                                lastEvidenceExportAt={lastEvidenceExportAt}
                                lastEvidenceExportMode={lastEvidenceExportMode}
                                mergedTimeline={mergedTimeline}
                                codeChangeSummary={codeChangeSummary}
                                policyReasonSummary={policyReasonSummary}
                                allEvidenceExports={allEvidenceExports}
                                visibleEvidenceExports={visibleEvidenceExports}
                                evidenceExportItemRefs={evidenceExportItemRefs}
                                selectedEvidenceExportId={selectedEvidenceExportId}
                                setSelectedEvidenceExportId={setSelectedEvidenceExportId}
                                selectedEvidenceExportItem={selectedEvidenceExportItem}
                                selectedEvidenceExportTopReasons={selectedEvidenceExportTopReasons}
                                evidenceTimelineQuery={evidenceTimelineQuery}
                                handleExportEvidenceTimeline={handleExportEvidenceTimeline}
                                handleCopyTimelineFilterLink={handleCopyTimelineFilterLink}
                                evidenceTimelineCategoryCounts={evidenceTimelineCategoryCounts}
                                evidenceTimelineFilter={evidenceTimelineFilter}
                                setEvidenceTimelineFilter={setEvidenceTimelineFilter}
                                setEvidenceTimelineReasonFilter={setEvidenceTimelineReasonFilter}
                                allEvidenceTimeline={allEvidenceTimeline}
                                evidenceTimelineSeverityCounts={evidenceTimelineSeverityCounts}
                                evidenceTimelineSeverityFilter={evidenceTimelineSeverityFilter}
                                setEvidenceTimelineSeverityFilter={setEvidenceTimelineSeverityFilter}
                                activeTimelineFilters={activeTimelineFilters}
                                setEvidenceTimelineActionFilter={setEvidenceTimelineActionFilter}
                                evidenceTimelineActionFilter={evidenceTimelineActionFilter}
                                timelineActionQuickFilters={timelineActionQuickFilters}
                                timelineReasonQuickFilters={timelineReasonQuickFilters}
                                evidenceTimelineReasonFilter={evidenceTimelineReasonFilter}
                                filteredEvidenceTimeline={filteredEvidenceTimeline}
                                visibleEvidenceTimeline={visibleEvidenceTimeline}
                                evidenceTimelineItemRefs={evidenceTimelineItemRefs}
                                selectedEvidenceTimelineId={selectedEvidenceTimelineId}
                                setSelectedEvidenceTimelineId={setSelectedEvidenceTimelineId}
                                selectedEvidenceTimelineItem={selectedEvidenceTimelineItem}
                                selectedEvidenceTimelineReason={selectedEvidenceTimelineReason}
                            />

                            <InterviewPolicyPanel
                                monitorPolicy={monitorPolicy}
                                updateMonitorPolicy={updateMonitorPolicy}
                                handleResetMonitorPolicy={handleResetMonitorPolicy}
                                handleApplyCompanyTemplate={handleApplyCompanyTemplate}
                                handleSaveMonitorPolicy={handleSaveMonitorPolicy}
                                saveMonitorPolicyMutation={saveMonitorPolicyMutation}
                                companyMonitorPolicyQuery={companyMonitorPolicyQuery}
                                monitorPolicyDirty={monitorPolicyDirty}
                                monitorPolicyQuery={monitorPolicyQuery}
                                autoReshareCount={autoReshareCount}
                                monitorPolicyReason={monitorPolicyReason}
                                setMonitorPolicyReason={setMonitorPolicyReason}
                                monitorPolicyRollbackReason={monitorPolicyRollbackReason}
                                setMonitorPolicyRollbackReason={setMonitorPolicyRollbackReason}
                                rollbackMonitorPolicyMutation={rollbackMonitorPolicyMutation}
                                policyHistoryItems={policyHistoryItems}
                                selectedPolicyHistoryId={selectedPolicyHistoryId}
                                setSelectedPolicyHistoryId={setSelectedPolicyHistoryId}
                                policyHistoryDiffCountById={policyHistoryDiffCountById}
                                policyDiffBaseline={policyDiffBaseline}
                                setPolicyDiffBaseline={setPolicyDiffBaseline}
                                selectedPolicyHistoryPrevious={selectedPolicyHistoryPrevious}
                                selectedPolicyHistory={selectedPolicyHistory}
                                policyDiffBaselineLabel={policyDiffBaselineLabel}
                                policyDiffRows={policyDiffRows}
                            />

                            <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Integrity Score</div>
                                    <span className={cn('text-xs font-bold uppercase', riskColorClass)}>
                                        {integrity?.level || 'low'} risk
                                    </span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className={cn('text-2xl font-bold tabular-nums', riskColorClass)}>
                                        {integrity?.score ?? 100}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">/100</div>
                                </div>
                                <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                                    {integrity?.recommendation || 'Low risk. Proceed with standard review flow.'}
                                </div>
                                {mergedTimeline.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {mergedTimeline.slice(0, 12).map((event, index) => (
                                            <div key={`${event.type}-${event.timestamp}-${index}`} className="text-[11px] border-l-2 border-[var(--color-outline)] pl-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium text-[var(--color-text-primary)]">{event.type}</span>
                                                    <span className={cn(
                                                        'uppercase text-[10px] font-bold',
                                                        event.severity === 'high'
                                                            ? 'text-[var(--color-error)]'
                                                            : event.severity === 'medium'
                                                                ? 'text-[var(--color-warning)]'
                                                                : 'text-[var(--color-success)]'
                                                    )}>
                                                        {event.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[var(--color-text-secondary)]">{event.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Monitor Alerts</div>
                                    <span className="text-[10px] text-[var(--color-text-secondary)]">{mergedMonitorAlerts.length}</span>
                                </div>
                                {mergedMonitorAlerts.length === 0 ? (
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">No monitor alerts yet.</div>
                                ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {mergedMonitorAlerts.slice(0, 30).map((alert) => (
                                            <div key={`${alert.id}-${alert.createdAt}`} className="text-[11px] border-l-2 border-[var(--color-outline)] pl-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium text-[var(--color-text-primary)]">{alert.type}</span>
                                                    <span className={cn(
                                                        'uppercase text-[10px] font-bold',
                                                        alert.severity === 'high'
                                                            ? 'text-[var(--color-error)]'
                                                            : alert.severity === 'medium'
                                                                ? 'text-[var(--color-warning)]'
                                                                : 'text-[var(--color-success)]'
                                                    )}>
                                                        {alert.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[var(--color-text-secondary)]">{alert.message}</div>
                                                <div className="text-[10px] text-[var(--color-text-secondary)]">
                                                    {new Date(alert.createdAt).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewMonitorPage;
