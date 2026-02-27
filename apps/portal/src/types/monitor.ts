export type IntegrityItem = {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    timestamp: string;
};

export type IntegrityInsight = {
    interviewId: string;
    score: number;
    level: 'low' | 'medium' | 'high';
    eventCount: number;
    topSignals: Array<{ type: string; count: number; severity: 'low' | 'medium' | 'high' }>;
    timeline: IntegrityItem[];
    recommendation: string;
};

export type WebRtcSignalPayload = {
    kind: 'offer' | 'answer' | 'candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
};

export type ScreenSurfaceType = 'monitor' | 'window' | 'browser' | 'application' | 'unknown';

export type RoomState = {
    interviewId: string;
    participantCount: number;
    candidateCount: number;
    monitorCount: number;
    candidateOnline: boolean;
    monitorOnline: boolean;
    screenShareActive: boolean;
    screenSurface: ScreenSurfaceType;
    screenMuted: boolean;
    lastScreenShareAt: string | null;
    updatedAt: string;
};

export type MonitorAlertType =
    | 'screen_share_missing'
    | 'screen_surface_invalid'
    | 'heartbeat_delayed'
    | 'candidate_offline'
    | 'auto_terminate'
    | 'manual_intervention';

export type MonitorAlertSeverity = 'low' | 'medium' | 'high';

export type MonitorAlertRecord = {
    id: string;
    userId?: string | null;
    type: MonitorAlertType;
    severity: MonitorAlertSeverity;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
};

export type MonitorPolicy = {
    autoTerminateEnabled: boolean;
    maxAutoReshareAttempts: number;
    heartbeatTerminateThresholdSec: number;
    invalidSurfaceTerminateThreshold: number;
    enforceFullscreen: boolean;
    enforceEntireScreenShare: boolean;
    strictClipboardProtection: boolean;
    codeSyncIntervalMs: number;
};

export type MonitorPolicyPayload = {
    policy: MonitorPolicy;
    source: string;
    updatedAt: string | null;
    updatedBy: string | null;
};

export type MonitorPolicyHistoryItem = {
    id: string;
    policy: MonitorPolicy;
    source: string;
    rollbackFrom?: string | null;
    reason?: string | null;
    updatedAt: string;
    updatedBy: string | null;
};

export type CompanyMonitorPolicyPayload = {
    policy: MonitorPolicy;
    source: 'saved' | 'default';
    updatedAt: string | null;
    updatedBy: string | null;
};

export type LiveCodeSnapshot = {
    code: string;
    language: string;
    timestamp: number | null;
};

export type CodeChangeEvent = {
    id: string;
    timestamp: number;
    language: string;
    addedLines: number;
    removedLines: number;
    changedLines: number;
    charDelta: number;
    totalLines: number;
};

export type EvidenceExportMode = 'all' | 'bundle' | 'json' | 'csv';

export type EvidenceExportPolicyReason = {
    reason: string;
    count: number;
};

export type EvidenceExportSummary = {
    integrityEventCount?: number;
    highRiskIntegrityCount?: number;
    monitorAlertCount?: number;
    highSeverityMonitorAlertCount?: number;
    codeDiffEvents?: number;
    timelineEventCount?: number;
    policyReasonEvents?: number;
    policyReasonUnique?: number;
    policyTopReasons?: EvidenceExportPolicyReason[];
    chainStatus?: EvidenceChainStatus;
    chainLinkedEvents?: number;
    chainCheckedEvents?: number;
    chainLatestHash?: string;
};

export type EvidenceExportHistoryItem = {
    id: string;
    userId?: string | null;
    mode: EvidenceExportMode;
    files: string[];
    summary?: EvidenceExportSummary;
    exportedAt: string;
    createdAt: string;
};

export type EvidenceTimelineCategory = 'alert' | 'export' | 'policy' | 'termination' | 'unknown';
export type EvidenceTimelineSeverity = 'low' | 'medium' | 'high';

export type EvidenceTimelineItem = {
    id: string;
    action: string;
    category: EvidenceTimelineCategory;
    severity: EvidenceTimelineSeverity;
    title: string;
    message: string;
    details?: Record<string, unknown>;
    createdAt: string;
    userId?: string | null;
};

export type EvidenceChainStatus = 'valid' | 'broken' | 'partial' | 'not_initialized';

export type EvidenceChainVerification = {
    interviewId: string;
    generatedAt: string;
    limit: number;
    totalFetched: number;
    supportedActions: string[];
    status: EvidenceChainStatus;
    checkedEvents: number;
    linkedEvents: number;
    legacyUnlinkedEvents: number;
    unlinkedAfterChainStart: number;
    latestHash: string | null;
    firstHash: string | null;
    latestSeq: number;
    brokenAt: {
        id: string;
        action: string;
        createdAt: string;
        reason: string;
    } | null;
};

export type EvidenceChainPolicy = {
    blockOnBrokenChain: boolean;
    blockOnPartialChain: boolean;
};

export type EvidenceChainPolicyResponse = {
    policy: EvidenceChainPolicy;
    source: 'saved' | 'default';
    updatedAt: string | null;
    updatedBy: string | null;
};

export type EvidenceChainPolicyHistoryItem = {
    id: string;
    policy: EvidenceChainPolicy;
    source: string;
    rollbackFrom?: string | null;
    reason?: string | null;
    updatedAt: string;
    updatedBy: string | null;
};

export type PolicyMutationResult<TPolicy> = {
    policy: TPolicy;
    reason?: string | null;
    savedAt?: string;
    idempotentReplay?: boolean;
};
