import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
    EvidenceExportMode, EvidenceExportSummary, EvidenceExportHistoryItem,
    EvidenceTimelineCategory, EvidenceTimelineSeverity, EvidenceTimelineItem,
    EvidenceChainStatus, EvidenceChainPolicy,
    MonitorPolicy, MonitorAlertRecord, RoomState, IntegrityItem,
    LiveCodeSnapshot, CodeChangeEvent, ScreenSurfaceType,
} from '@/types/monitor';
import {
    escapeCsvField, normalizeAction, normalizeReason, getTimelineReason,
    summarizePolicyReasons,
} from '@/utils/monitorUtils';
import {
    applyTimelineQueryState,
    getTimelineSearchParam,
    hasLegacyTimelineSearchParams,
    parseTimelineCategoryParam,
    parseTimelineSeverityParam,
} from '@/lib/timelineQueryParams';

// ── File download helper ──
function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function toEvidenceTimelineCsv(timeline: EvidenceTimelineItem[]) {
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
}

interface UseEvidenceActionsOptions {
    interviewId: string | undefined;
    interview: any;
    // Data queries
    evidenceExportHistoryQuery: any;
    evidenceTimelineQuery: any;
    evidenceChainQuery: any;
    evidenceChainPolicyQuery: any;
    // State from other hooks
    monitorPolicy: MonitorPolicy;
    stats: { latency: number; quality: string; duration: number };
    screenConnection: string;
    screenShareActive: boolean;
    screenSurface: ScreenSurfaceType;
    roomState: RoomState;
    integrity: any;
    mergedTimeline: IntegrityItem[];
    mergedMonitorAlerts: MonitorAlertRecord[];
    highRiskIntegrityCount: number;
    highSeverityMonitorAlertCount: number;
    liveCodeSnapshot: LiveCodeSnapshot;
    codeChangeTimeline: CodeChangeEvent[];
    transcripts: any[];
    // Alert callback
    reportMonitorAlert: (payload: any, options?: any) => void;
}

export function useEvidenceActions({
    interviewId,
    interview,
    evidenceExportHistoryQuery,
    evidenceTimelineQuery,
    evidenceChainQuery,
    evidenceChainPolicyQuery,
    monitorPolicy,
    stats,
    screenConnection,
    screenShareActive,
    screenSurface,
    roomState,
    integrity,
    mergedTimeline,
    mergedMonitorAlerts,
    highRiskIntegrityCount,
    highSeverityMonitorAlertCount,
    liveCodeSnapshot,
    codeChangeTimeline,
    transcripts,
    reportMonitorAlert,
}: UseEvidenceActionsOptions) {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Export state ──
    const [lastEvidenceExportAt, setLastEvidenceExportAt] = useState<string | null>(null);
    const [lastEvidenceExportMode, setLastEvidenceExportMode] = useState<EvidenceExportMode | null>(null);
    const [evidenceExportCount, setEvidenceExportCount] = useState(0);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoPlaybackTime, setVideoPlaybackTime] = useState<number | undefined>(undefined);

    // ── Timeline filter state ──
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

    const evidenceTimelineItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const evidenceExportItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const legacyTimelineLinkNoticeShownRef = useRef(false);

    // ── Sync filter state with search params ──
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
    }, [evidenceTimelineFilter, evidenceTimelineSeverityFilter, evidenceTimelineActionFilter, evidenceTimelineReasonFilter, selectedEvidenceTimelineId, selectedEvidenceExportId, searchParams, setSearchParams]);

    // ── Derived data ──
    const allEvidenceExports: EvidenceExportHistoryItem[] = evidenceExportHistoryQuery.data || [];
    const allEvidenceTimeline: EvidenceTimelineItem[] = evidenceTimelineQuery.data || [];

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

    const filteredEvidenceTimeline = useMemo(() => {
        let filtered = allEvidenceTimeline;
        if (evidenceTimelineFilter !== 'all') filtered = filtered.filter((item) => item.category === evidenceTimelineFilter);
        if (evidenceTimelineSeverityFilter !== 'all') filtered = filtered.filter((item) => item.severity === evidenceTimelineSeverityFilter);
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
    }, [allEvidenceTimeline, evidenceTimelineFilter, evidenceTimelineSeverityFilter, evidenceTimelineActionFilter, evidenceTimelineReasonFilter]);

    const visibleEvidenceTimeline = useMemo(() => {
        const sliced = filteredEvidenceTimeline.slice(0, 20);
        if (!selectedEvidenceTimelineId) return sliced;
        if (sliced.some((item) => item.id === selectedEvidenceTimelineId)) return sliced;
        const selected = filteredEvidenceTimeline.find((item) => item.id === selectedEvidenceTimelineId);
        if (!selected) return sliced;
        return [selected, ...sliced.slice(0, 19)];
    }, [filteredEvidenceTimeline, selectedEvidenceTimelineId]);

    const evidenceTimelineCategoryCounts = useMemo(() => {
        const counts: Record<'all' | EvidenceTimelineCategory, number> = { all: 0, alert: 0, export: 0, policy: 0, termination: 0, unknown: 0 };
        allEvidenceTimeline.forEach((item) => { counts.all += 1; counts[item.category] += 1; });
        return counts;
    }, [allEvidenceTimeline]);

    const evidenceTimelineSeverityCounts = useMemo(() => {
        const counts: Record<EvidenceTimelineSeverity, number> = { low: 0, medium: 0, high: 0 };
        allEvidenceTimeline.forEach((item) => { counts[item.severity] += 1; });
        return counts;
    }, [allEvidenceTimeline]);

    const timelineActionQuickFilters = useMemo(() => {
        const buckets = new Map<string, { action: string; count: number }>();
        allEvidenceTimeline.forEach((item) => {
            const action = String(item.action || '').trim();
            if (!action) return;
            const key = normalizeAction(action);
            const current = buckets.get(key);
            if (current) { current.count += 1; return; }
            buckets.set(key, { action, count: 1 });
        });
        return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.action.localeCompare(b.action)).slice(0, 8);
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
            if (current) { current.count += row.count; return; }
            merged.set(key, { reason: row.reason, count: row.count });
        });
        return Array.from(merged.values()).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)).slice(0, 6);
    }, [policyReasonSummary.topReasons, selectedEvidenceExportTopReasons]);

    const activeTimelineFilters = useMemo(() => {
        const active: string[] = [];
        if (evidenceTimelineFilter !== 'all') active.push(`category:${evidenceTimelineFilter}`);
        if (evidenceTimelineSeverityFilter !== 'all') active.push(`severity:${evidenceTimelineSeverityFilter}`);
        if (evidenceTimelineActionFilter) active.push(`action:${evidenceTimelineActionFilter}`);
        if (evidenceTimelineReasonFilter) active.push(`reason:${evidenceTimelineReasonFilter}`);
        return active;
    }, [evidenceTimelineFilter, evidenceTimelineSeverityFilter, evidenceTimelineActionFilter, evidenceTimelineReasonFilter]);

    // ── Evidence chain ──
    const evidenceChain = evidenceChainQuery.data;
    const evidenceChainStatus: EvidenceChainStatus = evidenceChain?.status || 'not_initialized';
    const evidenceChainStatusLabel = evidenceChainStatus === 'valid' ? 'Chain Verified'
        : evidenceChainStatus === 'partial' ? 'Chain Partial'
            : evidenceChainStatus === 'broken' ? 'Chain Broken' : 'Chain Pending';
    const evidenceChainStatusClass = evidenceChainStatus === 'valid' ? 'chip-success'
        : evidenceChainStatus === 'partial' ? 'chip-warning'
            : evidenceChainStatus === 'broken' ? 'chip-error' : 'chip-neutral';
    const evidenceChainPolicy: EvidenceChainPolicy | undefined = evidenceChainPolicyQuery.data?.policy;
    const exportBlockedReason = useMemo(() => {
        if (!evidenceChainPolicy) return null;
        if (evidenceChainPolicy.blockOnBrokenChain && evidenceChainStatus === 'broken') return 'Evidence export blocked by company policy: chain is broken.';
        if (evidenceChainPolicy.blockOnPartialChain && evidenceChainStatus === 'partial') return 'Evidence export blocked by company policy: chain is partial.';
        return null;
    }, [evidenceChainPolicy, evidenceChainStatus]);
    const isEvidenceExportBlocked = Boolean(exportBlockedReason);

    // ── Video playback sync ──
    useEffect(() => {
        if (selectedEvidenceTimelineItem && interview?.startTime) {
            const start = new Date(interview.startTime).getTime();
            const eventTime = new Date(selectedEvidenceTimelineItem.createdAt).getTime();
            const offsetSeconds = Math.max(0, (eventTime - start) / 1000);
            setVideoPlaybackTime(offsetSeconds);
        }
    }, [selectedEvidenceTimelineItem, interview?.startTime]);

    // ── Selection sync ──
    useEffect(() => {
        if (allEvidenceExports.length === 0) { setSelectedEvidenceExportId(null); return; }
        if (selectedEvidenceExportId && allEvidenceExports.some((item) => item.id === selectedEvidenceExportId)) return;
        setSelectedEvidenceExportId(allEvidenceExports[0].id);
    }, [allEvidenceExports, selectedEvidenceExportId]);

    useEffect(() => {
        if (filteredEvidenceTimeline.length === 0) { setSelectedEvidenceTimelineId(null); return; }
        if (selectedEvidenceTimelineId && filteredEvidenceTimeline.some((item) => item.id === selectedEvidenceTimelineId)) return;
        setSelectedEvidenceTimelineId(filteredEvidenceTimeline[0].id);
    }, [filteredEvidenceTimeline, selectedEvidenceTimelineId]);

    // ── Scroll into view ──
    useEffect(() => {
        if (!selectedEvidenceExportId) return;
        const node = evidenceExportItemRefs.current[selectedEvidenceExportId];
        node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedEvidenceExportId, visibleEvidenceExports]);

    useEffect(() => {
        if (!selectedEvidenceTimelineId) return;
        const node = evidenceTimelineItemRefs.current[selectedEvidenceTimelineId];
        node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedEvidenceTimelineId, visibleEvidenceTimeline]);

    // ── Log export mutation ──
    const logEvidenceExportMutation = useMutation({
        mutationFn: async (payload: { mode: EvidenceExportMode; files: string[]; exportedAt: string; summary: EvidenceExportSummary }) => {
            const res = await api.post(`/interviews/${interviewId}/evidence-exports`, payload);
            return res.data.data as EvidenceExportHistoryItem;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-exports', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Evidence export saved locally, but failed to sync audit history.');
        },
    });

    // ── Export actions ──
    const buildEvidenceArtifacts = useCallback(() => {
        const exportedAt = new Date().toISOString();
        const safeId = interviewId || 'unknown-session';
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
        const timelineJson = { interviewId: safeId, exportedAt, total: allEvidenceTimeline.length, timeline: allEvidenceTimeline };
        const evidenceJson = {
            interviewId: safeId, exportedAt,
            monitorStats: stats,
            screen: { connection: screenConnection, active: screenShareActive, surface: screenSurface, lastHeartbeatAt: roomState.lastScreenShareAt },
            roomState, integritySnapshot: integrity || null, integrityTimeline: mergedTimeline,
            monitorPolicy, monitorAlerts: mergedMonitorAlerts, liveCodeSnapshot, codeChangeTimeline,
            evidenceTimeline: allEvidenceTimeline, evidenceChainVerification: evidenceChain || null, exportSummary, transcripts,
        };
        const csvHeader = 'timestamp,type,severity,message';
        const csvRows = mergedTimeline.map((event) => `${event.timestamp},${event.type},${event.severity},"${String(event.message || '').replace(/"/g, '""')}"`);
        const codeCsvHeader = 'timestamp,language,addedLines,removedLines,changedLines,charDelta,totalLines';
        const codeCsvRows = codeChangeTimeline.map((event) => `${new Date(event.timestamp).toISOString()},${event.language},${event.addedLines},${event.removedLines},${event.changedLines},${event.charDelta},${event.totalLines}`);
        const integrityCsv = [csvHeader, ...csvRows].join('\n');
        const codeDiffCsv = [codeCsvHeader, ...codeCsvRows].join('\n');
        const bundle = { interviewId: safeId, exportedAt, summary: exportSummary, files: { evidence: evidenceJson, integrityTimelineCsv: integrityCsv, codeDiffTimelineCsv: codeDiffCsv, evidenceTimelineJson: timelineJson, evidenceTimelineCsv: timelineCsv, evidenceChainVerification: evidenceChain || null } };
        return { exportedAt, safeId, filenameSuffix, evidenceJson, integrityCsv, codeDiffCsv, timelineJson, timelineCsv, exportSummary, bundle };
    }, [interviewId, allEvidenceTimeline, mergedTimeline, highRiskIntegrityCount, mergedMonitorAlerts, highSeverityMonitorAlertCount, codeChangeTimeline, policyReasonSummary, evidenceChainStatus, evidenceChain, stats, screenConnection, screenShareActive, screenSurface, roomState, integrity, monitorPolicy, liveCodeSnapshot, transcripts]);

    const handleExportEvidence = useCallback((mode: EvidenceExportMode = 'all') => {
        if (!interviewId) { toast.error('Missing interview id.'); return; }
        if (isEvidenceExportBlocked) { toast.error(exportBlockedReason || 'Evidence export is blocked by policy.'); return; }
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
            exportedFiles.push(`integrity-timeline-${artifacts.filenameSuffix}.csv`, `code-diff-timeline-${artifacts.filenameSuffix}.csv`, `evidence-timeline-${artifacts.filenameSuffix}.csv`);
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
        logEvidenceExportMutation.mutate({ mode, files: exportedFiles, exportedAt: artifacts.exportedAt, summary: artifacts.exportSummary });
        void reportMonitorAlert({ type: 'manual_intervention', severity: 'low', message: `Monitor exported evidence package (${modeLabel}).`, metadata: { exportMode: mode, interviewId: artifacts.safeId, exportedFiles, highRiskIntegrityCount, highSeverityMonitorAlertCount, codeDiffEvents: codeChangeTimeline.length, timelineEventCount: allEvidenceTimeline.length, evidenceChainStatus, policyReasonEvents: policyReasonSummary.events, policyReasonUnique: policyReasonSummary.unique } }, { cooldownMs: 0 });
        toast.success(mode === 'all' ? 'Evidence exported (bundle + JSON + CSV + timeline).' : `Evidence exported (${modeLabel}).`);
    }, [interviewId, isEvidenceExportBlocked, exportBlockedReason, buildEvidenceArtifacts, logEvidenceExportMutation, reportMonitorAlert, highRiskIntegrityCount, highSeverityMonitorAlertCount, codeChangeTimeline.length, allEvidenceTimeline.length, evidenceChainStatus, policyReasonSummary]);

    const handleExportEvidenceTimeline = useCallback((format: 'json' | 'csv' = 'json') => {
        if (!interviewId) { toast.error('Missing interview id.'); return; }
        const exportedAt = new Date().toISOString();
        if (format === 'csv') {
            downloadTextFile(`evidence-timeline-${interviewId}-${Date.now()}.csv`, toEvidenceTimelineCsv(filteredEvidenceTimeline), 'text/csv;charset=utf-8');
            toast.success('Evidence timeline CSV exported.');
            return;
        }
        const payload = { interviewId, exportedAt, filter: { category: evidenceTimelineFilter, severity: evidenceTimelineSeverityFilter, action: evidenceTimelineActionFilter, reason: evidenceTimelineReasonFilter }, total: filteredEvidenceTimeline.length, timeline: filteredEvidenceTimeline };
        downloadTextFile(`evidence-timeline-${interviewId}-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
        toast.success('Evidence timeline exported.');
    }, [interviewId, filteredEvidenceTimeline, evidenceTimelineFilter, evidenceTimelineSeverityFilter, evidenceTimelineActionFilter, evidenceTimelineReasonFilter]);

    const handleCopyTimelineFilterLink = useCallback(async () => {
        if (typeof window === 'undefined') return;
        try {
            const href = window.location.href;
            if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(href); }
            else {
                const input = document.createElement('textarea');
                input.value = href; input.style.position = 'fixed'; input.style.opacity = '0';
                document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
            }
            toast.success('Timeline filter link copied.');
        } catch { toast.error('Failed to copy filter link.'); }
    }, []);

    const handleDownloadPDF = useCallback(async () => {
        if (!interviewId) return;
        try {
            const res = await api.post(`/interviews/${interviewId}/evidence/export`, {}, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `evidence-report-${interviewId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            toast.success('PDF report downloaded successfully');
        } catch { toast.error('Failed to download PDF report'); }
    }, [interviewId]);

    // ── WS handler for evidence messages ──
    const handleEvidenceWsMessage = useCallback((data: any): boolean => {
        if (data.type === 'evidence_export_logged') {
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-exports', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-chain', interviewId] });
            const currentUserId = data.record?.userId;
            if (currentUserId) toast.info('Another reviewer exported an evidence package.');
            return true;
        }
        return false;
    }, [interviewId, queryClient]);

    /** Reset evidence state (e.g. when interviewId changes) */
    const resetEvidenceState = useCallback(() => {
        setLastEvidenceExportAt(null);
        setLastEvidenceExportMode(null);
        setEvidenceExportCount(0);
        setVideoUrl(null);
        setVideoPlaybackTime(undefined);
    }, []);

    return {
        // Export state
        lastEvidenceExportAt,
        lastEvidenceExportMode,
        evidenceExportCount,
        videoUrl,
        setVideoUrl,
        videoPlaybackTime,
        // Timeline filter state
        evidenceTimelineFilter,
        setEvidenceTimelineFilter,
        evidenceTimelineSeverityFilter,
        setEvidenceTimelineSeverityFilter,
        evidenceTimelineActionFilter,
        setEvidenceTimelineActionFilter,
        evidenceTimelineReasonFilter,
        setEvidenceTimelineReasonFilter,
        selectedEvidenceTimelineId,
        setSelectedEvidenceTimelineId,
        selectedEvidenceExportId,
        setSelectedEvidenceExportId,
        evidenceTimelineItemRefs,
        evidenceExportItemRefs,
        // Derived
        allEvidenceExports,
        allEvidenceTimeline,
        visibleEvidenceExports,
        selectedEvidenceExportItem,
        selectedEvidenceExportTopReasons,
        filteredEvidenceTimeline,
        visibleEvidenceTimeline,
        evidenceTimelineCategoryCounts,
        evidenceTimelineSeverityCounts,
        timelineActionQuickFilters,
        selectedEvidenceTimelineItem,
        selectedEvidenceTimelineReason,
        policyReasonSummary,
        timelineReasonQuickFilters,
        activeTimelineFilters,
        evidenceChain,
        evidenceChainStatus,
        evidenceChainStatusLabel,
        evidenceChainStatusClass,
        evidenceChainPolicy,
        exportBlockedReason,
        isEvidenceExportBlocked,
        // Actions
        handleExportEvidence,
        handleExportEvidenceTimeline,
        handleCopyTimelineFilterLink,
        handleDownloadPDF,
        logEvidenceExportMutation,
        handleEvidenceWsMessage,
        resetEvidenceState,
    };
}
