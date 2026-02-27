import React from 'react';
import { cn } from '@hireflow/utils';
import { MonitorPolicy, MonitorPolicyHistoryItem } from '@/types/monitor';
import { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { normalizeAuditReasonInput } from '@/utils/monitorUtils';

export interface InterviewPolicyPanelProps {
    monitorPolicy: MonitorPolicy;
    updateMonitorPolicy: (updates: Partial<MonitorPolicy>) => void;
    handleResetMonitorPolicy: () => void;
    handleApplyCompanyTemplate: () => void;
    handleSaveMonitorPolicy: () => void;
    saveMonitorPolicyMutation: UseMutationResult<any, any, any, any>;
    companyMonitorPolicyQuery: UseQueryResult<any, any>;
    monitorPolicyDirty: boolean;
    monitorPolicyQuery: UseQueryResult<any, any>;
    autoReshareCount: number;
    monitorPolicyReason: string;
    setMonitorPolicyReason: (val: string) => void;
    monitorPolicyRollbackReason: string;
    setMonitorPolicyRollbackReason: (val: string) => void;
    rollbackMonitorPolicyMutation: UseMutationResult<any, any, any, any>;
    policyHistoryItems: MonitorPolicyHistoryItem[];
    selectedPolicyHistoryId: string | null;
    setSelectedPolicyHistoryId: (id: string | null) => void;
    policyHistoryDiffCountById: Record<string, number>;
    policyDiffBaseline: 'current' | 'previous';
    setPolicyDiffBaseline: (val: 'current' | 'previous') => void;
    selectedPolicyHistoryPrevious: MonitorPolicyHistoryItem | null;
    selectedPolicyHistory: MonitorPolicyHistoryItem | null;
    policyDiffBaselineLabel: string;
    policyDiffRows: Array<{ key: string; label: string; from: string; to: string }>;
}

export const InterviewPolicyPanel: React.FC<InterviewPolicyPanelProps> = ({
    monitorPolicy, updateMonitorPolicy, handleResetMonitorPolicy, handleApplyCompanyTemplate,
    handleSaveMonitorPolicy, saveMonitorPolicyMutation, companyMonitorPolicyQuery,
    monitorPolicyDirty, monitorPolicyQuery, autoReshareCount,
    monitorPolicyReason, setMonitorPolicyReason, monitorPolicyRollbackReason,
    setMonitorPolicyRollbackReason, rollbackMonitorPolicyMutation, policyHistoryItems,
    selectedPolicyHistoryId, setSelectedPolicyHistoryId, policyHistoryDiffCountById,
    policyDiffBaseline, setPolicyDiffBaseline, selectedPolicyHistoryPrevious,
    selectedPolicyHistory, policyDiffBaselineLabel, policyDiffRows
}) => {
    return (
        <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Auto Terminate Policy</div>
                <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <input
                            type="checkbox"
                            checked={monitorPolicy.autoTerminateEnabled}
                            onChange={(event) => updateMonitorPolicy({ autoTerminateEnabled: event.target.checked })}
                        />
                        Enabled
                    </label>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={handleResetMonitorPolicy}
                        disabled={saveMonitorPolicyMutation.isPending}
                    >
                        Reset
                    </button>
                    <button
                        className="btn btn-outlined h-7 px-2 text-[10px]"
                        onClick={handleApplyCompanyTemplate}
                        disabled={saveMonitorPolicyMutation.isPending || companyMonitorPolicyQuery.isLoading}
                    >
                        Use Template
                    </button>
                    <button
                        className="btn btn-filled h-7 px-2 text-[10px]"
                        onClick={handleSaveMonitorPolicy}
                        disabled={saveMonitorPolicyMutation.isPending || !monitorPolicyDirty || monitorPolicyQuery.isLoading}
                    >
                        {saveMonitorPolicyMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-[var(--color-text-secondary)] col-span-2 flex items-center justify-between rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    Enforce fullscreen
                    <input
                        type="checkbox"
                        checked={monitorPolicy.enforceFullscreen}
                        onChange={(event) => updateMonitorPolicy({ enforceFullscreen: event.target.checked })}
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)] col-span-2 flex items-center justify-between rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    Require entire screen share
                    <input
                        type="checkbox"
                        checked={monitorPolicy.enforceEntireScreenShare}
                        onChange={(event) => updateMonitorPolicy({ enforceEntireScreenShare: event.target.checked })}
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)] col-span-2 flex items-center justify-between rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    Strict clipboard protection
                    <input
                        type="checkbox"
                        checked={monitorPolicy.strictClipboardProtection}
                        onChange={(event) => updateMonitorPolicy({ strictClipboardProtection: event.target.checked })}
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)]">
                    Max re-share attempts
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={monitorPolicy.maxAutoReshareAttempts}
                        onChange={(event) => updateMonitorPolicy({
                            maxAutoReshareAttempts: Math.min(Math.max(Number(event.target.value) || 1, 1), 10),
                        })}
                        className="m3-input mt-1 h-8 text-xs"
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)]">
                    Heartbeat terminate (sec)
                    <input
                        type="number"
                        min={10}
                        max={240}
                        value={monitorPolicy.heartbeatTerminateThresholdSec}
                        onChange={(event) => updateMonitorPolicy({
                            heartbeatTerminateThresholdSec: Math.min(Math.max(Number(event.target.value) || 10, 10), 240),
                        })}
                        className="m3-input mt-1 h-8 text-xs"
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)] col-span-2">
                    Invalid surface tolerance (count)
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={monitorPolicy.invalidSurfaceTerminateThreshold}
                        onChange={(event) => updateMonitorPolicy({
                            invalidSurfaceTerminateThreshold: Math.min(Math.max(Number(event.target.value) || 1, 1), 10),
                        })}
                        className="m3-input mt-1 h-8 text-xs"
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)] col-span-2">
                    Code sync interval (ms)
                    <input
                        type="number"
                        min={200}
                        max={4000}
                        step={50}
                        value={monitorPolicy.codeSyncIntervalMs}
                        onChange={(event) => updateMonitorPolicy({
                            codeSyncIntervalMs: Math.min(Math.max(Number(event.target.value) || 200, 200), 4000),
                        })}
                        className="m3-input mt-1 h-8 text-xs"
                    />
                </label>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                Current: {autoReshareCount} auto re-share requests issued.
            </div>
            <div className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                {monitorPolicyDirty
                    ? 'Unsaved policy changes.'
                    : monitorPolicyQuery.data?.source === 'company_default'
                        ? (monitorPolicyQuery.data.updatedAt
                            ? `Inherited company template (${new Date(monitorPolicyQuery.data.updatedAt).toLocaleString()}).`
                            : 'Inherited company template.')
                        : monitorPolicyQuery.data?.updatedAt
                            ? `Last saved ${new Date(monitorPolicyQuery.data.updatedAt).toLocaleString()}`
                            : 'Using default policy.'}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1">
                <label className="text-[10px] text-[var(--color-text-secondary)]">
                    Save reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1 h-7 text-[10px]"
                        maxLength={240}
                        placeholder="e.g. stricter fullscreen guardrail for coding tasks"
                        value={monitorPolicyReason}
                        onChange={(event) => setMonitorPolicyReason(event.target.value)}
                        disabled={saveMonitorPolicyMutation.isPending}
                    />
                </label>
                <label className="text-[10px] text-[var(--color-text-secondary)]">
                    Rollback reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1 h-7 text-[10px]"
                        maxLength={240}
                        placeholder="Used when clicking rollback"
                        value={monitorPolicyRollbackReason}
                        onChange={(event) => setMonitorPolicyRollbackReason(event.target.value)}
                        disabled={rollbackMonitorPolicyMutation.isPending}
                    />
                </label>
            </div>

            <div className="mt-2 border-t border-[var(--color-outline)] pt-2">
                <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
                        Policy Audit Trail
                    </div>
                    <span className="chip chip-neutral">{policyHistoryItems.length}</span>
                </div>
                {policyHistoryItems.length === 0 ? (
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                        No saved policy versions yet.
                    </div>
                ) : (
                    <div className="max-h-[120px] overflow-auto space-y-1 pr-1">
                        {policyHistoryItems.slice(0, 8).map((item) => (
                            <div
                                key={item.id}
                                className="rounded border px-2 py-1 flex items-center justify-between gap-2 cursor-pointer"
                                style={{
                                    borderColor: selectedPolicyHistoryId === item.id
                                        ? 'var(--color-primary)'
                                        : 'var(--color-outline)',
                                    backgroundColor: selectedPolicyHistoryId === item.id
                                        ? 'var(--color-primary-container)'
                                        : 'var(--color-surface)',
                                }}
                                onClick={() => setSelectedPolicyHistoryId(item.id)}
                            >
                                <div className="min-w-0">
                                    <div className="text-[10px] truncate">
                                        {new Date(item.updatedAt).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                                        {item.source}
                                        {item.rollbackFrom ? ` · from ${item.rollbackFrom.slice(0, 8)}` : ''}
                                        {typeof policyHistoryDiffCountById[item.id] === 'number'
                                            ? ` · ${policyHistoryDiffCountById[item.id]} fields`
                                            : ''}
                                    </div>
                                    {item.reason && (
                                        <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                                            reason: {item.reason}
                                        </div>
                                    )}
                                    {item.updatedBy && (
                                        <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                                            by {item.updatedBy}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn btn-outlined h-6 px-2 text-[10px]"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        rollbackMonitorPolicyMutation.mutate({
                                            versionId: item.id,
                                            reason: normalizeAuditReasonInput(monitorPolicyRollbackReason),
                                        });
                                    }}
                                    disabled={rollbackMonitorPolicyMutation.isPending}
                                >
                                    Rollback
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-2 rounded border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-1.5">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[10px] font-medium text-[var(--color-text-primary)]">
                            Diff baseline
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                className={cn(
                                    'h-6 rounded-full px-2 text-[10px] border',
                                    policyDiffBaseline === 'current'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                )}
                                onClick={() => setPolicyDiffBaseline('current')}
                            >
                                Current
                            </button>
                            <button
                                className={cn(
                                    'h-6 rounded-full px-2 text-[10px] border',
                                    policyDiffBaseline === 'previous'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-outline)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                )}
                                onClick={() => setPolicyDiffBaseline('previous')}
                                disabled={!selectedPolicyHistoryPrevious}
                            >
                                Previous
                            </button>
                        </div>
                    </div>

                    {selectedPolicyHistory ? (
                        <>
                            <div className="text-[10px] text-[var(--color-text-secondary)] mb-1">
                                Diff vs {policyDiffBaselineLabel}
                            </div>
                            {policyDiffRows.length === 0 ? (
                                <div className="text-[10px] text-[var(--color-text-secondary)]">
                                    No difference with selected baseline.
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-[90px] overflow-auto pr-1">
                                    {policyDiffRows.map((row) => (
                                        <div key={row.key} className="text-[10px] text-[var(--color-text-secondary)]">
                                            <span className="text-[var(--color-text-primary)]">{row.label}</span>
                                            {' · '}
                                            {row.from}
                                            {' -> '}
                                            {row.to}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-[10px] text-[var(--color-text-secondary)]">
                            Select a policy version to inspect diffs.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
