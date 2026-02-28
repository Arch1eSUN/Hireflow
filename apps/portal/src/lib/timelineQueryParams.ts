export type TimelineCategoryParam = 'all' | 'alert' | 'export' | 'policy' | 'termination' | 'unknown';
export type TimelineSeverityParam = 'all' | 'low' | 'medium' | 'high';
export type TimelineQueryField = 'category' | 'severity' | 'action' | 'reason' | 'event' | 'export';

export const TIMELINE_QUERY_VERSION = '2';

export const timelineQueryKeysV2: Record<TimelineQueryField | 'version', string> = {
    version: 'tlv',
    category: 'tlc',
    severity: 'tls',
    action: 'tla',
    reason: 'tlr',
    event: 'tle',
    export: 'tlx',
};

export const timelineQueryKeysLegacy: Record<TimelineQueryField, string> = {
    category: 'tlCategory',
    severity: 'tlSeverity',
    action: 'tlAction',
    reason: 'tlReason',
    event: 'tlEvent',
    export: 'tlExport',
};

export function normalizeSearchParamValue(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function parseTimelineCategoryParam(value: string | null): TimelineCategoryParam {
    if (value === 'alert' || value === 'export' || value === 'policy' || value === 'termination' || value === 'unknown') {
        return value;
    }
    return 'all';
}

export function parseTimelineSeverityParam(value: string | null): TimelineSeverityParam {
    if (value === 'low' || value === 'medium' || value === 'high') {
        return value;
    }
    return 'all';
}

export function getTimelineSearchParam(searchParams: URLSearchParams, field: TimelineQueryField): string | null {
    const v2 = normalizeSearchParamValue(searchParams.get(timelineQueryKeysV2[field]));
    if (v2) return v2;
    return normalizeSearchParamValue(searchParams.get(timelineQueryKeysLegacy[field]));
}

export function hasLegacyTimelineSearchParams(searchParams: URLSearchParams): boolean {
    return (Object.values(timelineQueryKeysLegacy) as string[])
        .some((key) => normalizeSearchParamValue(searchParams.get(key)) !== null);
}

export function setTimelineSearchParam(
    searchParams: URLSearchParams,
    field: TimelineQueryField,
    value: string | null
) {
    searchParams.delete(timelineQueryKeysV2[field]);
    searchParams.delete(timelineQueryKeysLegacy[field]);
    if (value) {
        searchParams.set(timelineQueryKeysV2[field], value);
    }
}

export function applyTimelineQueryState(searchParams: URLSearchParams, state: {
    category: TimelineCategoryParam;
    severity: TimelineSeverityParam;
    action: string | null;
    reason: string | null;
    event: string | null;
    exportId: string | null;
}): URLSearchParams {
    const next = new URLSearchParams(searchParams);
    setTimelineSearchParam(next, 'category', state.category === 'all' ? null : state.category);
    setTimelineSearchParam(next, 'severity', state.severity === 'all' ? null : state.severity);
    setTimelineSearchParam(next, 'action', state.action);
    setTimelineSearchParam(next, 'reason', state.reason);
    setTimelineSearchParam(next, 'event', state.event);
    setTimelineSearchParam(next, 'export', state.exportId);

    const hasTimelineState = (
        getTimelineSearchParam(next, 'category') ||
        getTimelineSearchParam(next, 'severity') ||
        getTimelineSearchParam(next, 'action') ||
        getTimelineSearchParam(next, 'reason') ||
        getTimelineSearchParam(next, 'event') ||
        getTimelineSearchParam(next, 'export')
    );

    if (hasTimelineState) {
        next.set(timelineQueryKeysV2.version, TIMELINE_QUERY_VERSION);
    } else {
        next.delete(timelineQueryKeysV2.version);
    }

    return next;
}
