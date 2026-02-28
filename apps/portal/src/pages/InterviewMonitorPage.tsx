import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@hireflow/i18n/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    IntegrityItem, WebRtcSignalPayload, ScreenSurfaceType,
    RoomState, MonitorAlertRecord,
    LiveCodeSnapshot, CodeChangeEvent,
} from '@/types/monitor';
import { useMonitorState } from '@/hooks/useMonitorState';
import { InterviewLivePanel } from '@/components/monitor/InterviewLivePanel';
import { VideoPlayer } from '@/components/monitor/VideoPlayer';
import { InterviewPolicyPanel } from '@/components/monitor/InterviewPolicyPanel';
import { InterviewEvidenceCenter } from '@/components/monitor/InterviewEvidenceCenter';
import { InterviewSecondOpinionPanel } from '@/components/monitor/InterviewSecondOpinionPanel';
import { calculateCodeDelta, createEmptyRoomState } from '@/utils/monitorUtils';

// ── Extracted hooks ──
import { useWebRtcMonitor } from '@/hooks/useWebRtcMonitor';
import { useMonitorPolicies, DEFAULT_MONITOR_POLICY } from '@/hooks/useMonitorPolicies';
import { useAutoGuardrails } from '@/hooks/useAutoGuardrails';
import { useEvidenceActions } from '@/hooks/useEvidenceActions';

const InterviewMonitorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useI18n();
    const token = useAuthStore((s) => s.token);
    const currentUserId = useAuthStore((s) => s.user?.id);
    const queryClient = useQueryClient();

    // ── Core state ──
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [liveIntegrityEvents, setLiveIntegrityEvents] = useState<IntegrityItem[]>([]);
    const [stats, setStats] = useState({ latency: 0, quality: 'Unknown', duration: 0 });
    const [roomState, setRoomState] = useState<RoomState>(createEmptyRoomState(id));
    const [sessionTerminated, setSessionTerminated] = useState(false);
    const [liveCodeSnapshot, setLiveCodeSnapshot] = useState<LiveCodeSnapshot>({ code: '', language: 'javascript', timestamp: null });
    const [codeChangeTimeline, setCodeChangeTimeline] = useState<CodeChangeEvent[]>([]);
    const lastCodeRef = useRef('');

    // ── Queries ──
    const {
        interviewQuery, integrityQuery,
        roomStateQuery: monitorStateQuery, monitorAlertsQuery,
        monitorPolicyQuery, monitorPolicyHistoryQuery,
        evidenceExportHistoryQuery, evidenceTimelineQuery,
        evidenceChainQuery, companyMonitorPolicyQuery,
        evidenceChainPolicyQuery, evidenceChainPolicyHistoryQuery,
    } = useMonitorState(id, token);
    const integrity = integrityQuery.data;
    const interview = interviewQuery.data;

    // ── WebSocket setup ──
    const wsUrl = resolveInterviewWsUrl();

    // Create a temporary sendMessage ref for hooks that need it before WS is ready
    const sendMessageRef = useRef<(data: unknown) => void>(() => { });

    // ── Hook 1: WebRTC ──
    const webRtc = useWebRtcMonitor({
        sendMessage: sendMessageRef.current,
        isConnected: false, // will update after WS connects
        sessionTerminated,
        interviewId: id,
    });

    // ── Hook 2: Monitor Policies ──
    const policies = useMonitorPolicies({
        interviewId: id,
        monitorPolicyQuery,
        monitorPolicyHistoryQuery,
        companyMonitorPolicyQuery,
        evidenceChainPolicyQuery,
        evidenceChainPolicyHistoryQuery,
    });

    // ── Hook 3: Auto Guardrails ──
    const guardrails = useAutoGuardrails({
        interviewId: id,
        monitorPolicy: policies.monitorPolicy,
        roomState,
        screenShareActive: webRtc.screenShareActive,
        screenSurface: webRtc.screenSurface,
        sessionTerminated: sessionTerminated,
        isConnected: false, // will be set by WS effect
        sendMessage: sendMessageRef.current,
        resetScreenState: webRtc.resetScreenState,
    });

    const isTerminated = sessionTerminated || guardrails.sessionTerminatedLocal;

    // ── Merged data ──
    const mergedTimeline = [...liveIntegrityEvents, ...(integrity?.timeline || [])]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 60);
    const mergedMonitorAlerts = [...guardrails.liveMonitorAlerts, ...(monitorAlertsQuery.data || [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80);
    const highRiskIntegrityCount = useMemo(() => mergedTimeline.filter((e) => e.severity === 'high').length, [mergedTimeline]);
    const highSeverityMonitorAlertCount = useMemo(() => mergedMonitorAlerts.filter((a) => a.severity === 'high').length, [mergedMonitorAlerts]);
    const autoTerminateAlertCount = useMemo(() => mergedMonitorAlerts.filter((a) => a.type === 'auto_terminate').length, [mergedMonitorAlerts]);

    // ── Hook 4: Evidence Actions ──
    const evidence = useEvidenceActions({
        interviewId: id,
        interview,
        evidenceExportHistoryQuery,
        evidenceTimelineQuery,
        evidenceChainQuery,
        evidenceChainPolicyQuery,
        monitorPolicy: policies.monitorPolicy,
        stats,
        screenConnection: webRtc.screenConnection,
        screenShareActive: webRtc.screenShareActive,
        screenSurface: webRtc.screenSurface,
        roomState,
        integrity,
        mergedTimeline,
        mergedMonitorAlerts,
        highRiskIntegrityCount,
        highSeverityMonitorAlertCount,
        liveCodeSnapshot,
        codeChangeTimeline,
        transcripts,
        reportMonitorAlert: guardrails.reportMonitorAlert,
    });

    // ── Fetch video URL on termination ──
    useEffect(() => {
        if (!id || !isTerminated) return;
        let isMounted = true;
        api.get(`/interviews/${id}/media/playback`)
            .then(res => { if (isMounted && res.data?.data?.url) evidence.setVideoUrl(res.data.data.url); })
            .catch(console.error);
        return () => { isMounted = false; };
    }, [id, isTerminated]);

    // ── Second opinion mutation ──
    const secondOpinionMutation = useMutation({
        mutationFn: async () => { const res = await api.post(`/interviews/${id}/second-opinion`); return res.data; },
        onSuccess: () => { toast.success('Second opinion generated.'); queryClient.invalidateQueries({ queryKey: ['interview-detail', id] }); },
        onError: (err: any) => { toast.error(err.response?.data?.error || 'Failed to generate second opinion'); },
    });

    // ── Room state sync ──
    useEffect(() => { if (monitorStateQuery.data) setRoomState(monitorStateQuery.data); }, [monitorStateQuery.data]);
    useEffect(() => { setRoomState((prev) => ({ ...prev, interviewId: id || prev.interviewId })); }, [id]);
    useEffect(() => {
        webRtc.setScreenShareActive(roomState.screenShareActive);
        webRtc.setScreenSurface(roomState.screenSurface || 'unknown');
        if (!roomState.screenShareActive && webRtc.screenConnection === 'live') webRtc.setScreenConnection('idle');
    }, [roomState.screenShareActive, roomState.screenSurface, webRtc.screenConnection]);

    // ── Duration timer ──
    useEffect(() => {
        const timer = setInterval(() => setStats((prev) => ({ ...prev, duration: prev.duration + 1 })), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Reset on id change ──
    useEffect(() => {
        policies.resetPolicyState();
        guardrails.resetGuardrailState();
        evidence.resetEvidenceState();
        setCodeChangeTimeline([]);
        setLiveCodeSnapshot({ code: '', language: 'javascript', timestamp: null });
        lastCodeRef.current = '';
    }, [id]);

    // ── WS message dispatcher ──
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
        if (data.type === 'code_sync') {
            const nextCode = typeof data.code === 'string' ? data.code.slice(0, 16000) : '';
            const language = typeof data.language === 'string' ? data.language : 'javascript';
            const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
            const previousCode = lastCodeRef.current;
            if (previousCode !== nextCode) {
                const delta = calculateCodeDelta(previousCode, nextCode);
                setCodeChangeTimeline((prev) => [{ id: `${timestamp}-${Math.abs(delta.charDelta)}-${delta.totalLines}`, timestamp, language, ...delta }, ...prev].slice(0, 120));
            }
            lastCodeRef.current = nextCode;
            setLiveCodeSnapshot({ code: nextCode, language, timestamp });
            return;
        }
        if (data.type === 'room_state' && data.state) {
            setRoomState(data.state as RoomState);
            return;
        }
        if (data.type === 'screen_share_status') {
            webRtc.handleScreenShareStatus(data);
            setRoomState((prev) => ({
                ...prev,
                screenShareActive: !!data.active,
                screenSurface: (data.surface || 'unknown') as ScreenSurfaceType,
                screenMuted: !!data.muted,
                lastScreenShareAt: new Date((data.timestamp as number | undefined) || Date.now()).toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            return;
        }
        if (data.type === 'monitor_request_reshare') {
            toast.info('Requested candidate to re-share entire screen.');
            return;
        }
        if (data.type === 'webrtc_signal' && data.payload) {
            void webRtc.handleWebRtcSignal(data.payload as WebRtcSignalPayload);
            return;
        }
        // Delegate to policy/guardrail/evidence hooks
        if (policies.handlePolicyWsMessage(data)) return;
        if (guardrails.handleGuardrailWsMessage(data)) return;
        if (evidence.handleEvidenceWsMessage(data)) return;
    }, [id, queryClient, webRtc, policies, guardrails, evidence]);

    const { isConnected, sendMessage } = useWebSocket(wsUrl, token || '', { interviewId: id || '' }, handleMessage);

    // Keep send ref in sync for hooks
    useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

    // Re-request WebRTC when connected
    useEffect(() => {
        if (isConnected && id && !isTerminated) {
            webRtc.setScreenConnection('connecting');
            sendMessage({ type: 'room_state_request' });
            sendMessage({ type: 'webrtc_request_offer' });
        }
    }, [id, isConnected, sendMessage, isTerminated]);

    // ── Computed values ──
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${sec}`;
    };

    const riskColorClass = integrity?.level === 'high' ? 'text-[var(--color-error)]' : integrity?.level === 'medium' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]';
    const codeChangeSummary = useMemo(() => codeChangeTimeline.reduce((acc, e) => { acc.added += e.addedLines; acc.removed += e.removedLines; acc.changed += e.changedLines; return acc; }, { added: 0, removed: 0, changed: 0 }), [codeChangeTimeline]);
    const audioWaveHeights = useMemo(() => Array.from({ length: 120 }, (_, i) => Math.round(18 + (Math.abs(Math.sin(i * 0.44)) * 58) + ((i % 9) * 1.6))), []);

    // ── JSX ──
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
                    <span className={cn('chip', webRtc.screenShareActive ? 'chip-success' : 'chip-warning')}>
                        {webRtc.screenShareActive ? 'Screen Share Active' : 'Waiting for Share'}
                    </span>
                    <span className={cn('chip', !policies.monitorPolicy.enforceEntireScreenShare || webRtc.screenSurface === 'monitor' ? 'chip-success' : 'chip-warning')}>
                        {policies.monitorPolicy.enforceEntireScreenShare
                            ? (webRtc.screenSurface === 'monitor' ? 'Entire Screen Shared' : `Surface ${webRtc.screenSurface}`)
                            : `Surface ${webRtc.screenSurface}`}
                    </span>
                    <span className={cn('chip', roomState.candidateOnline ? 'chip-success' : 'chip-error')}>
                        Candidate {roomState.candidateOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="chip chip-warning">
                        <Users size={12} className="inline mr-1" />
                        Monitors {roomState.monitorCount}
                    </span>
                    {guardrails.autoReshareCount > 0 && (
                        <span className="chip chip-warning">Auto Re-share {guardrails.autoReshareCount}</span>
                    )}
                    {evidence.evidenceExportCount > 0 && (
                        <span className="chip chip-neutral">Evidence Exports {evidence.evidenceExportCount}</span>
                    )}
                    <span className={cn('chip', guardrails.isScreenHeartbeatHealthy ? 'chip-success' : 'chip-warning')}>
                        {roomState.lastScreenShareAt
                            ? (guardrails.isScreenHeartbeatHealthy ? 'Screen heartbeat healthy' : 'Screen heartbeat delayed')
                            : 'Waiting heartbeat'}
                    </span>
                    {isTerminated && (<span className="chip chip-error">Session Terminated</span>)}
                </div>

                <div className="flex items-center gap-2 xl:gap-3 text-xs font-mono text-[var(--color-text-secondary)] flex-wrap xl:justify-end">
                    <div className="flex items-center gap-1.5" title="Connection Quality">
                        <Signal size={14} className={cn(isConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]')} />
                        <span>{isConnected ? 'Excellent' : 'Offline'}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Latency">
                        <Wifi size={14} /><span>{stats.latency}ms</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Duration">
                        <Clock size={14} /><span>{formatDuration(stats.duration)}</span>
                    </div>
                    <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={guardrails.handleRequestReshare} disabled={!isConnected || isTerminated || guardrails.requestingReshare}>
                        <RefreshCcw size={12} className="mr-1" /> {guardrails.requestingReshare ? 'Sending...' : 'Request Re-share'}
                    </button>
                    <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={() => evidence.handleExportEvidence('all')}>
                        <Download size={12} className="mr-1" /> Quick Export
                    </button>
                    <button className="btn btn-danger h-[28px] text-xs px-3" onClick={() => void guardrails.handleTerminate()} disabled={guardrails.terminating || isTerminated}>
                        <LogOut size={12} className="mr-1" /> {guardrails.terminating ? 'Terminating...' : 'Terminate'}
                    </button>
                </div>
            </header>

            {guardrails.monitorAlert && (
                <div className={cn(
                    'mb-3 rounded-xl border px-3 py-2 flex items-center justify-between gap-3',
                    guardrails.monitorAlert.includes('terminated')
                        ? 'border-[var(--color-error)]/30 bg-[var(--color-error-bg)] text-[var(--color-error)]'
                        : 'border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                )}>
                    <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} /><span>{guardrails.monitorAlert}</span>
                    </div>
                    {!isTerminated && (
                        <div className="flex items-center gap-2">
                            <button className="btn btn-outlined h-[28px] text-xs px-3" onClick={guardrails.handleRequestReshare} disabled={!isConnected || guardrails.requestingReshare}>
                                {guardrails.requestingReshare ? 'Sending...' : 'Request Re-share'}
                            </button>
                            <button className="btn btn-danger h-[28px] text-xs px-3" onClick={() => void guardrails.handleTerminate()} disabled={guardrails.terminating}>
                                {guardrails.terminating ? 'Terminating...' : 'Terminate'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
                {isTerminated && evidence.videoUrl ? (
                    <div className="xl:col-span-8 flex flex-col bg-black rounded-[var(--radius-md)] overflow-hidden shadow-xl min-h-[400px]">
                        <VideoPlayer src={evidence.videoUrl} seekToTime={evidence.videoPlaybackTime} autoPlay={true} />
                    </div>
                ) : (
                    <InterviewLivePanel
                        remoteVideoRef={webRtc.remoteVideoRef}
                        screenConnection={webRtc.screenConnection}
                        screenShareActive={webRtc.screenShareActive}
                        screenSurface={webRtc.screenSurface}
                        monitorPolicy={policies.monitorPolicy}
                        audioWaveHeights={audioWaveHeights}
                    />
                )}

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
                                        {liveCodeSnapshot.timestamp ? `Updated ${new Date(liveCodeSnapshot.timestamp).toLocaleTimeString()}` : 'Waiting'}
                                    </span>
                                </div>
                                {liveCodeSnapshot.code ? (
                                    <pre className="max-h-[180px] overflow-auto rounded border border-[var(--color-outline)] bg-[#0b1220] p-2 text-[11px] leading-5 text-[#dbe6ff]">
                                        {liveCodeSnapshot.code}
                                    </pre>
                                ) : (
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">Waiting for candidate editor sync...</div>
                                )}
                                <div className="mt-2 border-t border-[var(--color-outline)] pt-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)] mb-1">Code Diff Timeline</div>
                                    {codeChangeTimeline.length === 0 ? (
                                        <div className="text-[11px] text-[var(--color-text-secondary)]">No code delta captured yet.</div>
                                    ) : (
                                        <div className="max-h-[120px] overflow-auto space-y-1 pr-1">
                                            {codeChangeTimeline.slice(0, 10).map((event) => (
                                                <div key={event.id} className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1 text-[10px]">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[var(--color-text-secondary)]">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                        <span className="text-[var(--color-text-secondary)]">{event.language}</span>
                                                    </div>
                                                    <div className="mt-0.5">+{event.addedLines} / -{event.removedLines} / ~{event.changedLines} lines · Δ{event.charDelta} chars</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <InterviewEvidenceCenter
                                evidenceExportHistoryQuery={evidenceExportHistoryQuery}
                                evidenceChainStatusClass={evidence.evidenceChainStatusClass}
                                evidenceChainStatusLabel={evidence.evidenceChainStatusLabel}
                                highRiskIntegrityCount={highRiskIntegrityCount}
                                highSeverityMonitorAlertCount={highSeverityMonitorAlertCount}
                                codeChangeTimeline={codeChangeTimeline}
                                autoTerminateAlertCount={autoTerminateAlertCount}
                                evidenceChainQuery={evidenceChainQuery}
                                evidenceChain={evidence.evidenceChain}
                                evidenceChainPolicy={evidence.evidenceChainPolicy}
                                exportBlockedReason={evidence.exportBlockedReason}
                                evidenceChainPolicyQuery={evidenceChainPolicyQuery}
                                evidenceChainPolicyDraft={policies.evidenceChainPolicyDraft}
                                updateEvidenceChainPolicy={policies.updateEvidenceChainPolicy}
                                canManageEvidenceChainPolicy={policies.canManageEvidenceChainPolicy}
                                evidenceChainPolicyDirty={policies.evidenceChainPolicyDirty}
                                handleResetEvidenceChainPolicyDraft={policies.handleResetEvidenceChainPolicyDraft}
                                handleSaveEvidenceChainPolicy={policies.handleSaveEvidenceChainPolicy}
                                saveEvidenceChainPolicyMutation={policies.saveEvidenceChainPolicyMutation}
                                evidenceChainPolicyReason={policies.evidenceChainPolicyReason}
                                setEvidenceChainPolicyReason={policies.setEvidenceChainPolicyReason}
                                evidenceChainPolicyRollbackReason={policies.evidenceChainPolicyRollbackReason}
                                setEvidenceChainPolicyRollbackReason={policies.setEvidenceChainPolicyRollbackReason}
                                rollbackEvidenceChainPolicyMutation={policies.rollbackEvidenceChainPolicyMutation}
                                evidenceChainPolicyHistoryQuery={evidenceChainPolicyHistoryQuery}
                                evidenceChainPolicyHistoryItems={policies.evidenceChainPolicyHistoryItems}
                                selectedEvidenceChainPolicyHistoryId={policies.selectedEvidenceChainPolicyHistoryId}
                                setSelectedEvidenceChainPolicyHistoryId={policies.setSelectedEvidenceChainPolicyHistoryId}
                                evidenceChainPolicyDiffCountById={policies.evidenceChainPolicyDiffCountById}
                                selectedEvidenceChainPolicyHistory={policies.selectedEvidenceChainPolicyHistory}
                                evidenceChainPolicyDiffRows={policies.evidenceChainPolicyDiffRows}
                                handleExportEvidence={evidence.handleExportEvidence}
                                handleDownloadPDF={evidence.handleDownloadPDF}
                                logEvidenceExportMutation={evidence.logEvidenceExportMutation}
                                isEvidenceExportBlocked={evidence.isEvidenceExportBlocked}
                                lastEvidenceExportAt={evidence.lastEvidenceExportAt}
                                lastEvidenceExportMode={evidence.lastEvidenceExportMode}
                                mergedTimeline={mergedTimeline}
                                codeChangeSummary={codeChangeSummary}
                                policyReasonSummary={evidence.policyReasonSummary}
                                allEvidenceExports={evidence.allEvidenceExports}
                                visibleEvidenceExports={evidence.visibleEvidenceExports}
                                evidenceExportItemRefs={evidence.evidenceExportItemRefs}
                                selectedEvidenceExportId={evidence.selectedEvidenceExportId}
                                setSelectedEvidenceExportId={evidence.setSelectedEvidenceExportId}
                                selectedEvidenceExportItem={evidence.selectedEvidenceExportItem}
                                selectedEvidenceExportTopReasons={evidence.selectedEvidenceExportTopReasons}
                                evidenceTimelineQuery={evidenceTimelineQuery}
                                handleExportEvidenceTimeline={evidence.handleExportEvidenceTimeline}
                                handleCopyTimelineFilterLink={evidence.handleCopyTimelineFilterLink}
                                evidenceTimelineCategoryCounts={evidence.evidenceTimelineCategoryCounts}
                                evidenceTimelineFilter={evidence.evidenceTimelineFilter}
                                setEvidenceTimelineFilter={evidence.setEvidenceTimelineFilter}
                                setEvidenceTimelineReasonFilter={evidence.setEvidenceTimelineReasonFilter}
                                allEvidenceTimeline={evidence.allEvidenceTimeline}
                                evidenceTimelineSeverityCounts={evidence.evidenceTimelineSeverityCounts}
                                evidenceTimelineSeverityFilter={evidence.evidenceTimelineSeverityFilter}
                                setEvidenceTimelineSeverityFilter={evidence.setEvidenceTimelineSeverityFilter}
                                activeTimelineFilters={evidence.activeTimelineFilters}
                                setEvidenceTimelineActionFilter={evidence.setEvidenceTimelineActionFilter}
                                evidenceTimelineActionFilter={evidence.evidenceTimelineActionFilter}
                                timelineActionQuickFilters={evidence.timelineActionQuickFilters}
                                timelineReasonQuickFilters={evidence.timelineReasonQuickFilters}
                                evidenceTimelineReasonFilter={evidence.evidenceTimelineReasonFilter}
                                filteredEvidenceTimeline={evidence.filteredEvidenceTimeline}
                                visibleEvidenceTimeline={evidence.visibleEvidenceTimeline}
                                evidenceTimelineItemRefs={evidence.evidenceTimelineItemRefs}
                                selectedEvidenceTimelineId={evidence.selectedEvidenceTimelineId}
                                setSelectedEvidenceTimelineId={evidence.setSelectedEvidenceTimelineId}
                                selectedEvidenceTimelineItem={evidence.selectedEvidenceTimelineItem}
                                selectedEvidenceTimelineReason={evidence.selectedEvidenceTimelineReason}
                            />

                            <InterviewPolicyPanel
                                monitorPolicy={policies.monitorPolicy}
                                updateMonitorPolicy={policies.updateMonitorPolicy}
                                handleResetMonitorPolicy={policies.handleResetMonitorPolicy}
                                handleApplyCompanyTemplate={policies.handleApplyCompanyTemplate}
                                handleSaveMonitorPolicy={policies.handleSaveMonitorPolicy}
                                saveMonitorPolicyMutation={policies.saveMonitorPolicyMutation}
                                companyMonitorPolicyQuery={companyMonitorPolicyQuery}
                                monitorPolicyDirty={policies.monitorPolicyDirty}
                                monitorPolicyQuery={monitorPolicyQuery}
                                autoReshareCount={guardrails.autoReshareCount}
                                monitorPolicyReason={policies.monitorPolicyReason}
                                setMonitorPolicyReason={policies.setMonitorPolicyReason}
                                monitorPolicyRollbackReason={policies.monitorPolicyRollbackReason}
                                setMonitorPolicyRollbackReason={policies.setMonitorPolicyRollbackReason}
                                rollbackMonitorPolicyMutation={policies.rollbackMonitorPolicyMutation}
                                policyHistoryItems={policies.policyHistoryItems}
                                selectedPolicyHistoryId={policies.selectedPolicyHistoryId}
                                setSelectedPolicyHistoryId={policies.setSelectedPolicyHistoryId}
                                policyHistoryDiffCountById={policies.policyHistoryDiffCountById}
                                policyDiffBaseline={policies.policyDiffBaseline}
                                setPolicyDiffBaseline={policies.setPolicyDiffBaseline}
                                selectedPolicyHistoryPrevious={policies.selectedPolicyHistoryPrevious}
                                selectedPolicyHistory={policies.selectedPolicyHistory}
                                policyDiffBaselineLabel={policies.policyDiffBaselineLabel}
                                policyDiffRows={policies.policyDiffRows}
                            />

                            <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Integrity Score</div>
                                    <span className={cn('text-xs font-bold uppercase', riskColorClass)}>
                                        {integrity?.level || 'low'} risk
                                    </span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className={cn('text-2xl font-bold tabular-nums', riskColorClass)}>{integrity?.score ?? 100}</div>
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
                                                    <span className={cn('uppercase text-[10px] font-bold', event.severity === 'high' ? 'text-[var(--color-error)]' : event.severity === 'medium' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')}>
                                                        {event.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[var(--color-text-secondary)]">{event.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <InterviewSecondOpinionPanel interview={interview} secondOpinionMutation={secondOpinionMutation} />

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
                                                    <span className={cn('uppercase text-[10px] font-bold', alert.severity === 'high' ? 'text-[var(--color-error)]' : alert.severity === 'medium' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')}>
                                                        {alert.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[var(--color-text-secondary)]">{alert.message}</div>
                                                <div className="text-[10px] text-[var(--color-text-secondary)]">{new Date(alert.createdAt).toLocaleTimeString()}</div>
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
