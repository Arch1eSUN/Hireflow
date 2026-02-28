import React from 'react';
import { cn } from '@hireflow/utils';
import { Database, RefreshCcw, Link2, Download, Files, FileText } from 'lucide-react';
import { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import {
    EvidenceExportHistoryItem,
    EvidenceChainPolicyHistoryItem,
    EvidenceChainPolicy,
    EvidenceChainVerification,
    EvidenceExportMode
} from '@/types/monitor';
import { normalizeAuditReasonInput, normalizeReason } from '@/utils/monitorUtils';
import { InterviewTimelinePanel, InterviewTimelinePanelProps } from '@/components/monitor/InterviewTimelinePanel';

export interface InterviewEvidenceCenterProps extends InterviewTimelinePanelProps {
    evidenceExportHistoryQuery: UseQueryResult<any, any>;
    evidenceChainStatusClass: string;
    evidenceChainStatusLabel: string;
    highRiskIntegrityCount: number | string;
    highSeverityMonitorAlertCount: number | string;
    codeChangeTimeline: any[];
    autoTerminateAlertCount: number | string;

    evidenceChainQuery: UseQueryResult<any, any>;
    evidenceChain: any;
    evidenceChainPolicy: any;
    exportBlockedReason: string | null;

    evidenceChainPolicyQuery: UseQueryResult<any, any>;
    evidenceChainPolicyDraft: EvidenceChainPolicy;
    updateEvidenceChainPolicy: (patch: Partial<EvidenceChainPolicy>) => void;
    canManageEvidenceChainPolicy: boolean;
    evidenceChainPolicyDirty: boolean;
    handleResetEvidenceChainPolicyDraft: () => void;
    handleSaveEvidenceChainPolicy: () => void;
    saveEvidenceChainPolicyMutation: UseMutationResult<any, any, any>;
    evidenceChainPolicyReason: string;
    setEvidenceChainPolicyReason: (val: string) => void;
    evidenceChainPolicyRollbackReason: string;
    setEvidenceChainPolicyRollbackReason: (val: string) => void;
    rollbackEvidenceChainPolicyMutation: UseMutationResult<any, any, any>;

    evidenceChainPolicyHistoryQuery: UseQueryResult<any, any>;
    evidenceChainPolicyHistoryItems: EvidenceChainPolicyHistoryItem[];
    selectedEvidenceChainPolicyHistoryId: string | null;
    setSelectedEvidenceChainPolicyHistoryId: (id: string | null) => void;
    evidenceChainPolicyDiffCountById: Record<string, number>;
    selectedEvidenceChainPolicyHistory: EvidenceChainPolicyHistoryItem | null;
    evidenceChainPolicyDiffRows: any[];

    handleExportEvidence: (mode: EvidenceExportMode | 'all') => void;
    handleDownloadPDF: () => void;
    logEvidenceExportMutation: UseMutationResult<any, any, any>;
    isEvidenceExportBlocked: boolean;
    lastEvidenceExportAt: string | null;
    lastEvidenceExportMode: string | null;
    mergedTimeline: any[];
    codeChangeSummary: any;
    policyReasonSummary: any;

    allEvidenceExports: EvidenceExportHistoryItem[];
    visibleEvidenceExports: EvidenceExportHistoryItem[];
    evidenceExportItemRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
    selectedEvidenceExportId: string | null;
    setSelectedEvidenceExportId: (id: string | null) => void;
    selectedEvidenceExportItem: EvidenceExportHistoryItem | null;
    selectedEvidenceExportTopReasons: any[];
}

export const InterviewEvidenceCenter: React.FC<InterviewEvidenceCenterProps> = (props) => {
    return (
        <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Database size={12} />
                    Evidence Center
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="chip chip-neutral">{props.evidenceExportHistoryQuery.data?.length || 0} logs</span>
                    <span className={`chip ${props.evidenceChainStatusClass}`}>{props.evidenceChainStatusLabel}</span>
                    <span className="chip chip-primary">Audit Ready</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] text-[var(--color-text-secondary)]">High risk events</div>
                    <div className="text-sm font-semibold text-[var(--color-error)]">{props.highRiskIntegrityCount}</div>
                </div>
                <div className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] text-[var(--color-text-secondary)]">High severity alerts</div>
                    <div className="text-sm font-semibold text-[var(--color-warning)]">{props.highSeverityMonitorAlertCount}</div>
                </div>
                <div className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] text-[var(--color-text-secondary)]">Code diff events</div>
                    <div className="text-sm font-semibold text-[var(--color-primary)]">{props.codeChangeTimeline.length}</div>
                </div>
                <div className="rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] text-[var(--color-text-secondary)]">Auto terminations</div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">{props.autoTerminateAlertCount}</div>
                </div>
            </div>

            <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <Link2 size={11} />
                        Evidence hash chain
                    </div>
                    <button
                        className="btn btn-outlined h-6 px-2 text-[10px]"
                        onClick={() => props.evidenceChainQuery.refetch()}
                        disabled={props.evidenceChainQuery.isFetching}
                    >
                        <RefreshCcw size={10} />
                        {props.evidenceChainQuery.isFetching ? 'Verifying' : 'Verify'}
                    </button>
                </div>
                {props.evidenceChainQuery.isLoading ? (
                    <div className="mt-1 text-[10px] text-[var(--color-text-secondary)]">Verifying chain integrity...</div>
                ) : (
                    <div className="mt-1 space-y-0.5 text-[10px] text-[var(--color-text-secondary)]">
                        <div>
                            Status: <span className="text-[var(--color-text-primary)]">{props.evidenceChainStatusLabel}</span> · linked {props.evidenceChain?.linkedEvents || 0}/{props.evidenceChain?.checkedEvents || 0}
                        </div>
                        {props.evidenceChainPolicy && (
                            <div>
                                Policy: block broken {props.evidenceChainPolicy.blockOnBrokenChain ? 'ON' : 'OFF'} · block partial {props.evidenceChainPolicy.blockOnPartialChain ? 'ON' : 'OFF'}
                            </div>
                        )}
                        {props.evidenceChain?.latestHash && (
                            <div className="truncate">
                                Latest hash: <span className="font-mono text-[var(--color-text-primary)]">{props.evidenceChain.latestHash}</span>
                            </div>
                        )}
                        {props.evidenceChain?.brokenAt && (
                            <div className="text-[var(--color-error)] truncate">
                                Broken: {props.evidenceChain.brokenAt.reason} ({props.evidenceChain.brokenAt.action})
                            </div>
                        )}
                        {!props.evidenceChain?.brokenAt && (props.evidenceChain?.unlinkedAfterChainStart || 0) > 0 && (
                            <div className="text-[var(--color-warning)]">
                                Warning: {props.evidenceChain?.unlinkedAfterChainStart} event(s) missing chain linkage.
                            </div>
                        )}
                        {props.exportBlockedReason && (
                            <div className="text-[var(--color-error)]">
                                {props.exportBlockedReason}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-medium text-[var(--color-text-primary)]">
                            Export guardrail policy
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={cn(
                                'chip',
                                props.evidenceChainPolicyQuery.data?.source === 'saved' ? 'chip-success' : 'chip-neutral'
                            )}>
                                {props.evidenceChainPolicyQuery.data?.source === 'saved' ? 'Saved policy' : 'Default policy'}
                            </span>
                            <button
                                className="btn btn-outlined h-6 px-2 text-[10px]"
                                onClick={() => props.evidenceChainPolicyQuery.refetch()}
                                disabled={props.evidenceChainPolicyQuery.isFetching}
                            >
                                <RefreshCcw size={10} />
                                {props.evidenceChainPolicyQuery.isFetching ? 'Syncing' : 'Sync'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                        {props.evidenceChainPolicyQuery.data?.updatedAt
                            ? `Last saved ${new Date(props.evidenceChainPolicyQuery.data.updatedAt).toLocaleString()}`
                            : 'Using default policy (block broken chain only).'}
                    </div>

                    <div className="mt-1.5 grid grid-cols-1 gap-1">
                        <label className="text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                            Block export on broken chain
                            <input
                                type="checkbox"
                                checked={props.evidenceChainPolicyDraft.blockOnBrokenChain}
                                onChange={(event) => props.updateEvidenceChainPolicy({ blockOnBrokenChain: event.target.checked })}
                                disabled={!props.canManageEvidenceChainPolicy}
                            />
                        </label>
                        <label className="text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                            Block export on partial chain
                            <input
                                type="checkbox"
                                checked={props.evidenceChainPolicyDraft.blockOnPartialChain}
                                onChange={(event) => props.updateEvidenceChainPolicy({ blockOnPartialChain: event.target.checked })}
                                disabled={!props.canManageEvidenceChainPolicy}
                            />
                        </label>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--color-text-secondary)]">
                        <span>
                            {props.evidenceChainPolicyDirty ? 'Unsaved policy changes.' : 'Policy synced.'}
                        </span>
                        {props.canManageEvidenceChainPolicy ? (
                            <div className="flex items-center gap-1">
                                <button
                                    className="btn btn-outlined h-6 px-2 text-[10px]"
                                    onClick={props.handleResetEvidenceChainPolicyDraft}
                                    disabled={props.saveEvidenceChainPolicyMutation.isPending}
                                >
                                    Reset
                                </button>
                                <button
                                    className="btn btn-filled h-6 px-2 text-[10px]"
                                    onClick={props.handleSaveEvidenceChainPolicy}
                                    disabled={props.saveEvidenceChainPolicyMutation.isPending || !props.evidenceChainPolicyDirty}
                                >
                                    {props.saveEvidenceChainPolicyMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        ) : (
                            <span>Read-only</span>
                        )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1">
                        <label className="text-[10px] text-[var(--color-text-secondary)]">
                            Save reason (optional)
                            <input
                                type="text"
                                className="m3-input mt-1 h-7 text-[10px]"
                                maxLength={240}
                                placeholder="e.g. relax partial-chain block for pilot customers"
                                value={props.evidenceChainPolicyReason}
                                onChange={(event) => props.setEvidenceChainPolicyReason(event.target.value)}
                                disabled={!props.canManageEvidenceChainPolicy || props.saveEvidenceChainPolicyMutation.isPending}
                            />
                        </label>
                        <label className="text-[10px] text-[var(--color-text-secondary)]">
                            Rollback reason (optional)
                            <input
                                type="text"
                                className="m3-input mt-1 h-7 text-[10px]"
                                maxLength={240}
                                placeholder="Used when clicking rollback"
                                value={props.evidenceChainPolicyRollbackReason}
                                onChange={(event) => props.setEvidenceChainPolicyRollbackReason(event.target.value)}
                                disabled={!props.canManageEvidenceChainPolicy || props.rollbackEvidenceChainPolicyMutation.isPending}
                            />
                        </label>
                    </div>

                    <div className="mt-2 border-t border-[var(--color-outline)] pt-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
                                Policy history
                            </div>
                            <span className="chip chip-neutral">{props.evidenceChainPolicyHistoryItems.length}</span>
                        </div>
                        {props.evidenceChainPolicyHistoryQuery.isLoading ? (
                            <div className="text-[10px] text-[var(--color-text-secondary)]">
                                Loading policy history...
                            </div>
                        ) : props.evidenceChainPolicyHistoryItems.length === 0 ? (
                            <div className="text-[10px] text-[var(--color-text-secondary)]">
                                No saved policy versions yet.
                            </div>
                        ) : (
                            <div className="max-h-[120px] overflow-auto space-y-1 pr-1">
                                {props.evidenceChainPolicyHistoryItems.slice(0, 8).map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded border px-2 py-1 flex items-center justify-between gap-2 cursor-pointer"
                                        style={{
                                            borderColor: props.selectedEvidenceChainPolicyHistoryId === item.id
                                                ? 'var(--color-primary)'
                                                : 'var(--color-outline)',
                                            backgroundColor: props.selectedEvidenceChainPolicyHistoryId === item.id
                                                ? 'var(--color-primary-container)'
                                                : 'var(--color-surface)',
                                        }}
                                        onClick={() => props.setSelectedEvidenceChainPolicyHistoryId(item.id)}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-[10px] truncate">
                                                {new Date(item.updatedAt).toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                                                {item.source}
                                                {item.rollbackFrom ? ` · from ${item.rollbackFrom.slice(0, 8)}` : ''}
                                                {typeof props.evidenceChainPolicyDiffCountById[item.id] === 'number'
                                                    ? ` · ${props.evidenceChainPolicyDiffCountById[item.id]} fields`
                                                    : ''}
                                            </div>
                                            {item.reason && (
                                                <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                                                    reason: {item.reason}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className="btn btn-outlined h-6 px-2 text-[10px]"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.rollbackEvidenceChainPolicyMutation.mutate({
                                                    versionId: item.id,
                                                    reason: normalizeAuditReasonInput(props.evidenceChainPolicyRollbackReason),
                                                });
                                            }}
                                            disabled={!props.canManageEvidenceChainPolicy || props.rollbackEvidenceChainPolicyMutation.isPending}
                                        >
                                            Rollback
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                        <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                            Selected version diff vs current draft
                        </div>
                        {props.selectedEvidenceChainPolicyHistory ? (
                            props.evidenceChainPolicyDiffRows.length === 0 ? (
                                <div className="text-[10px] text-[var(--color-text-secondary)]">
                                    No difference with current draft.
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-[80px] overflow-auto pr-1">
                                    {props.evidenceChainPolicyDiffRows.map((row) => (
                                        <div key={row.key} className="text-[10px] text-[var(--color-text-secondary)]">
                                            <span className="text-[var(--color-text-primary)]">{row.label}</span>
                                            {' · '}
                                            {row.from}
                                            {' -> '}
                                            {row.to}
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="text-[10px] text-[var(--color-text-secondary)]">
                                Select a policy version to inspect diffs.
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        className="btn btn-filled h-7 px-2 text-[10px] bg-[var(--color-primary)] text-white"
                        onClick={props.handleDownloadPDF}
                    >
                        <FileText size={12} /> Download PDF
                    </button>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={() => props.handleExportEvidence('all')}
                        disabled={props.logEvidenceExportMutation.isPending || props.isEvidenceExportBlocked}
                    >
                        <Files size={12} /> Export All
                    </button>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={() => props.handleExportEvidence('bundle')}
                        disabled={props.logEvidenceExportMutation.isPending || props.isEvidenceExportBlocked}
                    >
                        <Download size={12} /> Bundle
                    </button>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={() => props.handleExportEvidence('json')}
                        disabled={props.logEvidenceExportMutation.isPending || props.isEvidenceExportBlocked}
                    >
                        <FileText size={12} /> JSON
                    </button>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={() => props.handleExportEvidence('csv')}
                        disabled={props.logEvidenceExportMutation.isPending || props.isEvidenceExportBlocked}
                    >
                        <Download size={12} /> CSV
                    </button>
                </div>

                <div className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
                    {props.lastEvidenceExportAt
                        ? `Last export ${new Date(props.lastEvidenceExportAt).toLocaleString()}${props.lastEvidenceExportMode ? ` (${props.lastEvidenceExportMode.toUpperCase()})` : ''}.`
                        : 'No evidence package exported in this session yet.'}
                </div>

                <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                        Export manifest preview
                    </div>
                    <div className="space-y-1 text-[10px] text-[var(--color-text-secondary)]">
                        <div>JSON: monitor state, transcript, integrity, policy, alerts, code snapshot, replay timeline.</div>
                        <div>CSV: integrity timeline ({props.mergedTimeline.length}), code deltas ({props.codeChangeTimeline.length}), replay timeline ({props.allEvidenceTimeline.length}).</div>
                        <div>
                            Code summary: +{props.codeChangeSummary.added} / -{props.codeChangeSummary.removed} / ~{props.codeChangeSummary.changed} lines.
                        </div>
                        <div>
                            Policy reasons: {props.policyReasonSummary.events} events / {props.policyReasonSummary.unique} unique.
                        </div>
                        <div>
                            {props.policyReasonSummary.topReasons[0]
                                ? `Top reason: ${props.policyReasonSummary.topReasons[0].reason} (${props.policyReasonSummary.topReasons[0].count})`
                                : 'Top reason: none'}
                        </div>
                    </div>
                </div>

                <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                        Persisted export audit
                    </div>
                    {props.evidenceExportHistoryQuery.isLoading ? (
                        <div className="text-[10px] text-[var(--color-text-secondary)]">Loading export audit...</div>
                    ) : props.allEvidenceExports.length === 0 ? (
                        <div className="text-[10px] text-[var(--color-text-secondary)]">No persisted export logs yet.</div>
                    ) : (
                        <div className="space-y-1.5 max-h-[120px] overflow-auto pr-1">
                            {props.visibleEvidenceExports.map((item) => (
                                <button
                                    key={item.id}
                                    ref={(node) => {
                                        props.evidenceExportItemRefs.current[item.id] = node;
                                    }}
                                    className={cn(
                                        'w-full text-left rounded border px-2 py-1 text-[10px]',
                                        props.selectedEvidenceExportId === item.id
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                                            : 'border-[var(--color-outline)] bg-[var(--color-surface-dim)]'
                                    )}
                                    onClick={() => props.setSelectedEvidenceExportId(item.id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-[var(--color-text-primary)]">{item.mode.toUpperCase()}</span>
                                        <span className="text-[var(--color-text-secondary)]">
                                            {new Date(item.exportedAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="text-[var(--color-text-secondary)] truncate">
                                        files {item.files.length}
                                        {typeof item.summary?.highRiskIntegrityCount === 'number'
                                            ? ` · high risk ${item.summary.highRiskIntegrityCount}`
                                            : ''}
                                        {typeof item.summary?.codeDiffEvents === 'number'
                                            ? ` · diffs ${item.summary.codeDiffEvents}`
                                            : ''}
                                        {typeof item.summary?.policyReasonEvents === 'number'
                                            ? ` · reasons ${item.summary.policyReasonEvents}/${item.summary.policyReasonUnique || 0}`
                                            : ''}
                                        {item.summary?.policyTopReasons?.[0]?.reason
                                            ? ` · top ${item.summary.policyTopReasons[0].reason}(${item.summary.policyTopReasons[0].count})`
                                            : ''}
                                        {item.summary?.chainStatus
                                            ? ` · chain ${item.summary.chainStatus}`
                                            : ''}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {props.selectedEvidenceExportItem && (
                        <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface-dim)] px-2 py-1.5">
                            <div className="text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                                Selected export details
                            </div>
                            <div className="text-[10px] text-[var(--color-text-secondary)] mb-1">
                                {props.selectedEvidenceExportItem.mode.toUpperCase()} · {new Date(props.selectedEvidenceExportItem.exportedAt).toLocaleString()} · files {props.selectedEvidenceExportItem.files.length}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-secondary)] mb-1">
                                Policy reasons: {props.selectedEvidenceExportItem.summary?.policyReasonEvents || 0} events / {props.selectedEvidenceExportItem.summary?.policyReasonUnique || 0} unique
                            </div>
                            {props.selectedEvidenceExportTopReasons.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {props.selectedEvidenceExportTopReasons.slice(0, 5).map((row) => (
                                        <button
                                            key={`${row.reason}-${row.count}`}
                                            className={cn(
                                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]',
                                                props.evidenceTimelineReasonFilter && normalizeReason(props.evidenceTimelineReasonFilter) === normalizeReason(row.reason)
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                                    : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                            )}
                                            onClick={() => {
                                                props.setEvidenceTimelineFilter('policy');
                                                props.setEvidenceTimelineSeverityFilter('all');
                                                props.setEvidenceTimelineActionFilter(null);
                                                props.setEvidenceTimelineReasonFilter(row.reason);
                                            }}
                                            title="Filter replay timeline by this reason"
                                        >
                                            {row.reason} ({row.count})
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[10px] text-[var(--color-text-secondary)]">
                                    No policy reason breakdown in this export.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <InterviewTimelinePanel {...props} />
            </div>
        </div>
    );
};
