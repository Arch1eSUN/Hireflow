import { MonitorPolicy, EvidenceChainPolicy, EvidenceTimelineItem, EvidenceExportPolicyReason, RoomState } from '@/types/monitor';

const monitorPolicyFieldLabels: Record<keyof MonitorPolicy, string> = {
    autoTerminateEnabled: 'Auto terminate',
    maxAutoReshareAttempts: 'Max auto re-share attempts',
    heartbeatTerminateThresholdSec: 'Heartbeat terminate threshold',
    invalidSurfaceTerminateThreshold: 'Invalid surface tolerance',
    enforceFullscreen: 'Enforce fullscreen',
    enforceEntireScreenShare: 'Require entire screen share',
    strictClipboardProtection: 'Strict clipboard protection',
    codeSyncIntervalMs: 'Code sync interval',
};

const evidenceChainPolicyFieldLabels: Record<keyof EvidenceChainPolicy, string> = {
    blockOnBrokenChain: 'Block export on broken chain',
    blockOnPartialChain: 'Block export on partial chain',
};

export function formatMonitorPolicyValue(key: keyof MonitorPolicy, value: MonitorPolicy[keyof MonitorPolicy]) {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
    if (key === 'heartbeatTerminateThresholdSec') return `${value}s`;
    if (key === 'codeSyncIntervalMs') return `${value}ms`;
    return String(value);
}

export function diffMonitorPolicy(base: MonitorPolicy, target: MonitorPolicy) {
    const changed: Array<{
        key: keyof MonitorPolicy;
        label: string;
        from: string;
        to: string;
    }> = [];

    (Object.keys(monitorPolicyFieldLabels) as Array<keyof MonitorPolicy>).forEach((key) => {
        if (base[key] === target[key]) return;
        changed.push({
            key,
            label: monitorPolicyFieldLabels[key],
            from: formatMonitorPolicyValue(key, base[key]),
            to: formatMonitorPolicyValue(key, target[key]),
        });
    });

    return changed;
}

export function formatEvidenceChainPolicyValue(value: boolean) {
    return value ? 'Enabled' : 'Disabled';
}

export function diffEvidenceChainPolicy(base: EvidenceChainPolicy, target: EvidenceChainPolicy) {
    const changed: Array<{
        key: keyof EvidenceChainPolicy;
        label: string;
        from: string;
        to: string;
    }> = [];

    (Object.keys(evidenceChainPolicyFieldLabels) as Array<keyof EvidenceChainPolicy>).forEach((key) => {
        if (base[key] === target[key]) return;
        changed.push({
            key,
            label: evidenceChainPolicyFieldLabels[key],
            from: formatEvidenceChainPolicyValue(base[key]),
            to: formatEvidenceChainPolicyValue(target[key]),
        });
    });

    return changed;
}

export function normalizeAuditReasonInput(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length >= 2 ? trimmed : undefined;
}

export function createIdempotencyKey(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTimelineReason(details?: Record<string, unknown>): string | null {
    if (!details) return null;
    const raw = details.reason;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function escapeCsvField(value: unknown): string {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

export function summarizePolicyReasons(
    timeline: EvidenceTimelineItem[],
    limit = 5
): {
    events: number;
    unique: number;
    topReasons: EvidenceExportPolicyReason[];
} {
    const buckets = new Map<string, EvidenceExportPolicyReason>();
    let events = 0;

    timeline.forEach((item) => {
        if (item.category !== 'policy') return;
        const reason = getTimelineReason(item.details);
        if (!reason) return;
        events += 1;
        const normalized = reason.trim().toLocaleLowerCase();
        const current = buckets.get(normalized);
        if (current) {
            current.count += 1;
            return;
        }
        buckets.set(normalized, { reason, count: 1 });
    });

    const topReasons = Array.from(buckets.values())
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
        .slice(0, Math.max(1, limit));

    return {
        events,
        unique: buckets.size,
        topReasons,
    };
}

export function normalizeReason(value: string): string {
    return value.trim().toLocaleLowerCase();
}

export function normalizeAction(value: string): string {
    return value.trim().toLocaleLowerCase();
}

export const createEmptyRoomState = (interviewId?: string): RoomState => ({
    interviewId: interviewId || '',
    participantCount: 0,
    candidateCount: 0,
    monitorCount: 0,
    candidateOnline: false,
    monitorOnline: false,
    screenShareActive: false,
    screenSurface: 'unknown',
    screenMuted: false,
    lastScreenShareAt: null,
    updatedAt: new Date().toISOString(),
});

export const DEV_STUN_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export function calculateCodeDelta(previousCode: string, nextCode: string) {
    const prevLines = previousCode.split('\n');
    const nextLines = nextCode.split('\n');
    const maxLines = Math.max(prevLines.length, nextLines.length);
    let addedLines = 0;
    let removedLines = 0;
    let changedLines = 0;

    for (let i = 0; i < maxLines; i += 1) {
        const prev = prevLines[i];
        const next = nextLines[i];
        if (prev === undefined && next !== undefined) {
            addedLines += 1;
            continue;
        }
        if (prev !== undefined && next === undefined) {
            removedLines += 1;
            continue;
        }
        if (prev !== next) {
            changedLines += 1;
        }
    }

    return {
        addedLines,
        removedLines,
        changedLines,
        charDelta: nextCode.length - previousCode.length,
        totalLines: nextLines.length,
    };
}
