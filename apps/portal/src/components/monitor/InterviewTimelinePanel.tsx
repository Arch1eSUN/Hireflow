import React from 'react';
import { cn } from '@hireflow/utils';
import { RefreshCcw, Download, Link2 } from 'lucide-react';
import { UseQueryResult } from '@tanstack/react-query';
import { EvidenceTimelineItem, EvidenceTimelineCategory, EvidenceTimelineSeverity } from '@/types/monitor';
import { normalizeAction, normalizeReason, getTimelineReason } from '@/utils/monitorUtils';

export interface InterviewTimelinePanelProps {
    evidenceTimelineQuery: UseQueryResult<any, any>;
    handleExportEvidenceTimeline: (format: 'csv' | 'json') => void;
    handleCopyTimelineFilterLink: () => void;
    evidenceTimelineCategoryCounts: Record<string, number>;
    evidenceTimelineFilter: string;
    setEvidenceTimelineFilter: (f: any) => void;
    setEvidenceTimelineReasonFilter: (f: string | null) => void;
    allEvidenceTimeline: EvidenceTimelineItem[];
    evidenceTimelineSeverityCounts: Record<string, number>;
    evidenceTimelineSeverityFilter: string;
    setEvidenceTimelineSeverityFilter: (f: any) => void;
    activeTimelineFilters: string[];
    setEvidenceTimelineActionFilter: (f: string | null) => void;
    evidenceTimelineActionFilter: string | null;
    timelineActionQuickFilters: Array<{ action: string; count: number }>;
    timelineReasonQuickFilters: Array<{ reason: string; count: number }>;
    evidenceTimelineReasonFilter: string | null;
    filteredEvidenceTimeline: EvidenceTimelineItem[];
    visibleEvidenceTimeline: EvidenceTimelineItem[];
    evidenceTimelineItemRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
    selectedEvidenceTimelineId: string | null;
    setSelectedEvidenceTimelineId: (id: string | null) => void;
    selectedEvidenceTimelineItem: EvidenceTimelineItem | null;
    selectedEvidenceTimelineReason: string | null;
}

export const InterviewTimelinePanel: React.FC<InterviewTimelinePanelProps> = ({
    evidenceTimelineQuery,
    handleExportEvidenceTimeline,
    handleCopyTimelineFilterLink,
    evidenceTimelineCategoryCounts,
    evidenceTimelineFilter,
    setEvidenceTimelineFilter,
    setEvidenceTimelineReasonFilter,
    allEvidenceTimeline,
    evidenceTimelineSeverityCounts,
    evidenceTimelineSeverityFilter,
    setEvidenceTimelineSeverityFilter,
    activeTimelineFilters,
    setEvidenceTimelineActionFilter,
    evidenceTimelineActionFilter,
    timelineActionQuickFilters,
    timelineReasonQuickFilters,
    evidenceTimelineReasonFilter,
    filteredEvidenceTimeline,
    visibleEvidenceTimeline,
    evidenceTimelineItemRefs,
    selectedEvidenceTimelineId,
    setSelectedEvidenceTimelineId,
    selectedEvidenceTimelineItem,
    selectedEvidenceTimelineReason,
}) => {
    return (
        <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
            <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-medium text-[var(--color-text-primary)]">
                    Evidence replay timeline
                </div>
                <div className="flex items-center gap-1">
                    <button
                        className="btn btn-outlined h-6 px-2 text-[10px]"
                        onClick={() => evidenceTimelineQuery.refetch()}
                        disabled={evidenceTimelineQuery.isFetching}
                    >
                        <RefreshCcw size={10} />
                        {evidenceTimelineQuery.isFetching ? 'Syncing' : 'Sync'}
                    </button>
                    <button
                        className="btn btn-outlined h-6 px-2 text-[10px]"
                        onClick={() => handleExportEvidenceTimeline('json')}
                        disabled={filteredEvidenceTimeline.length === 0}
                    >
                        <Download size={10} />
                        Timeline JSON
                    </button>
                    <button
                        className="btn btn-outlined h-6 px-2 text-[10px]"
                        onClick={() => handleExportEvidenceTimeline('csv')}
                        disabled={filteredEvidenceTimeline.length === 0}
                    >
                        <Download size={10} />
                        Timeline CSV
                    </button>
                    <button
                        className="btn btn-outlined h-6 px-2 text-[10px]"
                        onClick={handleCopyTimelineFilterLink}
                    >
                        <Link2 size={10} />
                        Copy Link
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-1.5">
                {([
                    { key: 'all', label: `All ${evidenceTimelineCategoryCounts.all}` },
                    { key: 'alert', label: `Alert ${evidenceTimelineCategoryCounts.alert}` },
                    { key: 'export', label: `Export ${evidenceTimelineCategoryCounts.export}` },
                    { key: 'policy', label: `Policy ${evidenceTimelineCategoryCounts.policy}` },
                    { key: 'termination', label: `Terminate ${evidenceTimelineCategoryCounts.termination}` },
                ] as Array<{ key: 'all' | EvidenceTimelineCategory; label: string }>).map((item) => (
                    <button
                        key={item.key}
                        className={cn(
                            'h-6 rounded-full px-2 text-[10px] border',
                            evidenceTimelineFilter === item.key
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        )}
                        onClick={() => {
                            setEvidenceTimelineFilter(item.key);
                            if (item.key !== 'policy') {
                                setEvidenceTimelineReasonFilter(null);
                            }
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-1 mb-1.5">
                {([
                    { key: 'all', label: `Severity All ${allEvidenceTimeline.length}` },
                    { key: 'high', label: `High ${evidenceTimelineSeverityCounts.high}` },
                    { key: 'medium', label: `Medium ${evidenceTimelineSeverityCounts.medium}` },
                    { key: 'low', label: `Low ${evidenceTimelineSeverityCounts.low}` },
                ] as Array<{ key: 'all' | EvidenceTimelineSeverity; label: string }>).map((item) => (
                    <button
                        key={item.key}
                        className={cn(
                            'h-6 rounded-full px-2 text-[10px] border',
                            evidenceTimelineSeverityFilter === item.key
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        )}
                        onClick={() => setEvidenceTimelineSeverityFilter(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="mb-1.5 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">Severity distribution</div>
                <div className="flex h-2 overflow-hidden rounded-full border border-[var(--color-outline)] bg-[var(--color-surface)]">
                    {(['high', 'medium', 'low'] as EvidenceTimelineSeverity[]).map((key) => {
                        const total = Math.max(allEvidenceTimeline.length, 1);
                        const width = (evidenceTimelineSeverityCounts[key] / total) * 100;
                        const color = key === 'high'
                            ? 'var(--color-error)'
                            : key === 'medium'
                                ? 'var(--color-warning)'
                                : 'var(--color-success)';
                        return (
                            <div
                                key={`severity-bar-${key}`}
                                style={{ width: `${width}%`, backgroundColor: color }}
                            />
                        );
                    })}
                </div>
            </div>

            {activeTimelineFilters.length > 0 && (
                <div className="mb-1.5 flex flex-wrap items-center gap-1">
                    {activeTimelineFilters.map((item) => (
                        <span
                            key={`active-filter-${item}`}
                            className="inline-flex items-center rounded-full border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]"
                        >
                            {item}
                        </span>
                    ))}
                    <button
                        className="h-5 rounded-full border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 text-[10px] text-[var(--color-text-secondary)]"
                        onClick={() => {
                            setEvidenceTimelineFilter('all');
                            setEvidenceTimelineSeverityFilter('all');
                            setEvidenceTimelineActionFilter(null);
                            setEvidenceTimelineReasonFilter(null);
                        }}
                    >
                        Clear all
                    </button>
                </div>
            )}

            <div className="mb-1.5 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-medium text-[var(--color-text-primary)]">Action quick filter</span>
                    {evidenceTimelineActionFilter && (
                        <button
                            className="h-5 rounded-full border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 text-[10px] text-[var(--color-text-secondary)]"
                            onClick={() => setEvidenceTimelineActionFilter(null)}
                        >
                            Clear
                        </button>
                    )}
                </div>
                {timelineActionQuickFilters.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {timelineActionQuickFilters.map((row) => (
                            <button
                                key={`timeline-action-${row.action}`}
                                className={cn(
                                    'h-5 rounded-full border px-2 text-[10px]',
                                    evidenceTimelineActionFilter && normalizeAction(evidenceTimelineActionFilter) === normalizeAction(row.action)
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                )}
                                onClick={() => setEvidenceTimelineActionFilter(row.action)}
                            >
                                {row.action} ({row.count})
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-[var(--color-text-secondary)]">
                        No actions available yet.
                    </div>
                )}
            </div>

            <div className="mb-1.5 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-medium text-[var(--color-text-primary)]">Reason quick filter</span>
                    {evidenceTimelineReasonFilter && (
                        <button
                            className="h-5 rounded-full border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 text-[10px] text-[var(--color-text-secondary)]"
                            onClick={() => setEvidenceTimelineReasonFilter(null)}
                        >
                            Clear
                        </button>
                    )}
                </div>
                {timelineReasonQuickFilters.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {timelineReasonQuickFilters.map((row) => (
                            <button
                                key={`timeline-reason-${row.reason}`}
                                className={cn(
                                    'h-5 rounded-full border px-2 text-[10px]',
                                    evidenceTimelineReasonFilter && normalizeReason(evidenceTimelineReasonFilter) === normalizeReason(row.reason)
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                )}
                                onClick={() => {
                                    setEvidenceTimelineFilter('policy');
                                    setEvidenceTimelineSeverityFilter('all');
                                    setEvidenceTimelineActionFilter(null);
                                    setEvidenceTimelineReasonFilter(row.reason);
                                }}
                            >
                                {row.reason} ({row.count})
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-[var(--color-text-secondary)]">
                        No policy reasons available yet.
                    </div>
                )}
            </div>

            {evidenceTimelineQuery.isLoading ? (
                <div className="text-[10px] text-[var(--color-text-secondary)]">Loading replay timeline...</div>
            ) : filteredEvidenceTimeline.length === 0 ? (
                <div className="text-[10px] text-[var(--color-text-secondary)]">
                    {activeTimelineFilters.length > 0
                        ? `No timeline events for ${activeTimelineFilters.join(', ')}.`
                        : 'No timeline events for current filter.'}
                </div>
            ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-auto pr-1">
                    {visibleEvidenceTimeline.map((item) => {
                        const timelineReason = getTimelineReason(item.details);
                        return (
                            <button
                                key={item.id}
                                ref={(node) => {
                                    evidenceTimelineItemRefs.current[item.id] = node;
                                }}
                                className={cn(
                                    'w-full text-left rounded border px-2 py-1 text-[10px]',
                                    selectedEvidenceTimelineId === item.id
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                                        : 'border-[var(--color-outline)] bg-[var(--color-surface-dim)]'
                                )}
                                onClick={() => setSelectedEvidenceTimelineId(item.id)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-[var(--color-text-primary)] truncate">{item.title}</span>
                                    <span
                                        className={cn(
                                            'uppercase text-[9px] font-bold',
                                            item.severity === 'high'
                                                ? 'text-[var(--color-error)]'
                                                : item.severity === 'medium'
                                                    ? 'text-[var(--color-warning)]'
                                                    : 'text-[var(--color-success)]'
                                        )}
                                    >
                                        {item.severity}
                                    </span>
                                </div>
                                <div className="text-[var(--color-text-secondary)] truncate">{item.message}</div>
                                {timelineReason && (
                                    <div className="text-[var(--color-text-secondary)] truncate">
                                        reason: {timelineReason}
                                    </div>
                                )}
                                <div className="text-[var(--color-text-secondary)]">
                                    {new Date(item.createdAt).toLocaleTimeString()} · {item.category}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedEvidenceTimelineItem && (
                <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                    <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                        Selected event details
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] mb-1">
                        {selectedEvidenceTimelineItem.title} · {new Date(selectedEvidenceTimelineItem.createdAt).toLocaleString()}
                    </div>
                    {selectedEvidenceTimelineReason && (
                        <div className="text-[10px] text-[var(--color-text-secondary)] mb-1">
                            reason: {selectedEvidenceTimelineReason}
                        </div>
                    )}
                    <pre className="max-h-[100px] overflow-auto rounded border border-[var(--color-outline)] bg-[#0b1220] p-2 text-[10px] leading-4 text-[#dbe6ff]">
                        {JSON.stringify(selectedEvidenceTimelineItem.details || {}, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};
