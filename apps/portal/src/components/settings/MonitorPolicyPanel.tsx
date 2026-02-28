import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@hireflow/i18n/react';

/* ---------- types ---------- */

interface MonitorPolicy {
    autoTerminateEnabled: boolean;
    maxAutoReshareAttempts: number;
    heartbeatTerminateThresholdSec: number;
    invalidSurfaceTerminateThreshold: number;
    enforceFullscreen: boolean;
    enforceEntireScreenShare: boolean;
    strictClipboardProtection: boolean;
    codeSyncIntervalMs: number;
}

interface MonitorPolicyResponse {
    policy: MonitorPolicy;
    source: 'saved' | 'default';
    updatedAt: string | null;
    updatedBy: string | null;
}

interface MonitorPolicyApplyResponse {
    dryRun?: boolean;
    mode: 'missing_only' | 'overwrite';
    statuses: Array<'upcoming' | 'active' | 'completed' | 'cancelled'>;
    totalCandidates: number;
    applied: number;
    skipped: number;
    policy: MonitorPolicy;
    affectedInterviewIds?: string[];
}

interface MonitorPolicyHistoryItem {
    id: string;
    policy: MonitorPolicy;
    source: string;
    rollbackFrom?: string | null;
    reason?: string | null;
    updatedAt: string;
    updatedBy: string | null;
}

interface PolicyMutationResult<TPolicy> {
    policy: TPolicy;
    reason?: string | null;
    savedAt?: string;
    idempotentReplay?: boolean;
}

/* ---------- constants ---------- */

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

/* ---------- helpers ---------- */

function formatMonitorPolicyValue(key: keyof MonitorPolicy, value: MonitorPolicy[keyof MonitorPolicy]): string {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
    if (key === 'codeSyncIntervalMs') return `${value} ms`;
    if (key === 'heartbeatTerminateThresholdSec') return `${value} sec`;
    return String(value);
}

function diffMonitorPolicy(base: MonitorPolicy, target: MonitorPolicy) {
    const rows: { key: string; label: string; from: string; to: string }[] = [];
    for (const key of Object.keys(monitorPolicyFieldLabels) as Array<keyof MonitorPolicy>) {
        const baseVal = base[key];
        const targetVal = target[key];
        if (baseVal !== targetVal) {
            rows.push({
                key,
                label: monitorPolicyFieldLabels[key],
                from: formatMonitorPolicyValue(key, baseVal),
                to: formatMonitorPolicyValue(key, targetVal),
            });
        }
    }
    return rows;
}

function extractApiError(error: any, fallback: string): string {
    if (typeof error === 'string') return error;
    const data = error?.response?.data;
    if (data?.error) {
        if (typeof data.error === 'string') return data.error;
        if (typeof data.error === 'object' && data.error.formErrors?.length) return data.error.formErrors[0];
    }
    if (error?.message) return error.message;
    return fallback;
}

function normalizeAuditReasonInput(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length >= 2 ? trimmed : undefined;
}

function createIdempotencyKey(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- component ---------- */

export const MonitorPolicyPanel: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const currentRole = useAuthStore((state) => state.user?.role);
    const canManageMonitorPolicy = currentRole === 'owner' || currentRole === 'admin';

    /* --- state --- */
    const [monitorPolicyDraft, setMonitorPolicyDraft] = useState<MonitorPolicy>(DEFAULT_MONITOR_POLICY);
    const [isMonitorPolicyDirty, setIsMonitorPolicyDirty] = useState(false);
    const [applyPolicyOverwrite, setApplyPolicyOverwrite] = useState(false);
    const [applyPolicyLimit, setApplyPolicyLimit] = useState(300);
    const [applyPolicyStatuses, setApplyPolicyStatuses] = useState<Array<'upcoming' | 'active' | 'completed' | 'cancelled'>>(['upcoming', 'active']);
    const [lastApplyResult, setLastApplyResult] = useState<MonitorPolicyApplyResponse | null>(null);
    const [lastPreviewResult, setLastPreviewResult] = useState<MonitorPolicyApplyResponse | null>(null);
    const [selectedTemplateHistoryId, setSelectedTemplateHistoryId] = useState<string | null>(null);
    const [monitorPolicyReason, setMonitorPolicyReason] = useState('');
    const [monitorPolicyRollbackReason, setMonitorPolicyRollbackReason] = useState('');
    const monitorPolicyInitializedRef = useRef(false);

    /* --- queries --- */
    const monitorPolicyQuery = useQuery<MonitorPolicyResponse>({
        queryKey: ['settings-monitor-policy'],
        queryFn: async () => {
            const res = await api.get<{ data: MonitorPolicyResponse }>('/settings/monitor-policy');
            return res.data.data;
        },
    });

    const monitorPolicyHistoryQuery = useQuery<MonitorPolicyHistoryItem[]>({
        queryKey: ['settings-monitor-policy-history'],
        queryFn: async () => {
            const res = await api.get<{ data: { history: MonitorPolicyHistoryItem[] } }>('/settings/monitor-policy/history', {
                params: { limit: 12 },
            });
            return res.data.data?.history || [];
        },
    });

    /* --- effects --- */
    useEffect(() => {
        const payload = monitorPolicyQuery.data;
        if (!payload || (monitorPolicyInitializedRef.current && isMonitorPolicyDirty)) return;
        setMonitorPolicyDraft(payload.policy || DEFAULT_MONITOR_POLICY);
        setIsMonitorPolicyDirty(false);
        monitorPolicyInitializedRef.current = true;
    }, [isMonitorPolicyDirty, monitorPolicyQuery.data]);

    useEffect(() => {
        const history = monitorPolicyHistoryQuery.data || [];
        if (history.length === 0) {
            setSelectedTemplateHistoryId(null);
            return;
        }
        if (selectedTemplateHistoryId && history.some((item) => item.id === selectedTemplateHistoryId)) {
            return;
        }
        setSelectedTemplateHistoryId(history[0].id);
    }, [monitorPolicyHistoryQuery.data, selectedTemplateHistoryId]);

    /* --- mutations --- */
    const saveMonitorPolicyMutation = useMutation({
        mutationFn: async ({ policy, reason }: { policy: MonitorPolicy; reason?: string }) => {
            const res = await api.put('/settings/monitor-policy', {
                ...policy,
                reason,
                idempotencyKey: createIdempotencyKey('settings-monitor-policy-save'),
            });
            return res.data.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicyDraft(payload.policy || DEFAULT_MONITOR_POLICY);
            void queryClient.invalidateQueries({ queryKey: ['settings-monitor-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['settings-monitor-policy-history'] });
            setIsMonitorPolicyDirty(false);
            setMonitorPolicyReason('');
            if (payload.idempotentReplay) {
                toast.info('Duplicate request ignored. Existing monitor policy template kept.');
            } else {
                toast.success('Monitor policy template saved.');
            }
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    const rollbackMonitorPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post('/settings/monitor-policy/rollback', {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('settings-monitor-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicyDraft(payload.policy || DEFAULT_MONITOR_POLICY);
            setIsMonitorPolicyDirty(false);
            void queryClient.invalidateQueries({ queryKey: ['settings-monitor-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['settings-monitor-policy-history'] });
            setMonitorPolicyRollbackReason('');
            if (payload.idempotentReplay) {
                toast.info('Duplicate rollback ignored. Existing monitor policy template kept.');
            } else {
                toast.success('Monitor policy template rolled back.');
            }
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    const applyMonitorPolicyMutation = useMutation({
        mutationFn: async () => {
            if (applyPolicyStatuses.length === 0) {
                throw new Error('Please select at least one interview status.');
            }
            const res = await api.post<{ data: MonitorPolicyApplyResponse }>('/settings/monitor-policy/apply', {
                mode: applyPolicyOverwrite ? 'overwrite' : 'missing_only',
                statuses: applyPolicyStatuses,
                limit: Math.min(Math.max(applyPolicyLimit || 1, 1), 1000),
                dryRun: false,
            });
            return res.data.data;
        },
        onSuccess: (payload) => {
            const { applied, skipped, totalCandidates } = payload;
            setLastApplyResult(payload);
            toast.success(`Applied template to ${applied}/${totalCandidates} interviews${skipped ? `, skipped ${skipped}` : ''}.`);
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    const previewMonitorPolicyMutation = useMutation({
        mutationFn: async () => {
            if (applyPolicyStatuses.length === 0) {
                throw new Error('Please select at least one interview status.');
            }
            const res = await api.post<{ data: MonitorPolicyApplyResponse }>('/settings/monitor-policy/apply', {
                mode: applyPolicyOverwrite ? 'overwrite' : 'missing_only',
                statuses: applyPolicyStatuses,
                limit: Math.min(Math.max(applyPolicyLimit || 1, 1), 1000),
                dryRun: true,
            });
            return res.data.data;
        },
        onSuccess: (payload) => {
            setLastPreviewResult(payload);
            toast.success(`Preview ready: ${payload.applied}/${payload.totalCandidates} interviews would be updated.`);
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    /* --- handlers --- */
    const updateMonitorPolicyField = (patch: Partial<MonitorPolicy>) => {
        setMonitorPolicyDraft((prev) => ({ ...prev, ...patch }));
        setIsMonitorPolicyDirty(true);
    };

    const handleSaveMonitorPolicy = () => {
        if (!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending) return;
        saveMonitorPolicyMutation.mutate({
            policy: monitorPolicyDraft,
            reason: normalizeAuditReasonInput(monitorPolicyReason),
        });
    };

    const handleResetMonitorPolicy = () => {
        setMonitorPolicyDraft(DEFAULT_MONITOR_POLICY);
        setIsMonitorPolicyDirty(true);
    };

    const toggleApplyStatus = (status: 'upcoming' | 'active' | 'completed' | 'cancelled') => {
        setApplyPolicyStatuses((prev) => (
            prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
        ));
    };

    /* --- derived --- */
    const selectedTemplateHistory = useMemo(
        () => (monitorPolicyHistoryQuery.data || []).find((item) => item.id === selectedTemplateHistoryId) || null,
        [monitorPolicyHistoryQuery.data, selectedTemplateHistoryId]
    );
    const templateDiffRows = useMemo(
        () => (selectedTemplateHistory ? diffMonitorPolicy(monitorPolicyDraft, selectedTemplateHistory.policy) : []),
        [monitorPolicyDraft, selectedTemplateHistory]
    );

    /* --- render --- */
    return (
        <div className="rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-title-medium">Monitor Guardrail Template</div>
                    <div className="text-body-small text-[var(--color-text-secondary)]">
                        Default policy applied to newly created interviews and used by monitor auto-termination logic.
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="btn btn-outlined h-8 px-3 text-xs"
                        onClick={handleResetMonitorPolicy}
                        disabled={!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending}
                    >
                        Reset
                    </button>
                    <button
                        className="btn btn-outlined h-8 px-3 text-xs"
                        onClick={() => previewMonitorPolicyMutation.mutate()}
                        disabled={!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending || applyPolicyStatuses.length === 0}
                    >
                        {previewMonitorPolicyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        Preview Apply
                    </button>
                    <button
                        className="btn btn-outlined h-8 px-3 text-xs"
                        onClick={() => applyMonitorPolicyMutation.mutate()}
                        disabled={!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending || applyPolicyStatuses.length === 0}
                    >
                        {applyMonitorPolicyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        Apply to Interviews
                    </button>
                    <button
                        className="btn btn-filled h-8 px-3 text-xs"
                        onClick={handleSaveMonitorPolicy}
                        disabled={!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending || !isMonitorPolicyDirty}
                    >
                        {saveMonitorPolicyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        Save Template
                    </button>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2 text-label-small text-[var(--color-text-secondary)]">
                <span>Overwrite existing interview policies</span>
                <input
                    type="checkbox"
                    checked={applyPolicyOverwrite}
                    onChange={(e) => setApplyPolicyOverwrite(e.target.checked)}
                    disabled={!canManageMonitorPolicy || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending}
                />
            </div>

            <div className="mt-3 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-3">
                <div className="text-label-small text-[var(--color-text-secondary)] mb-2">
                    Apply Scope
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(['upcoming', 'active', 'completed', 'cancelled'] as const).map((status) => (
                        <label
                            key={status}
                            className="text-xs flex items-center justify-between rounded-lg border border-[var(--color-outline)] px-2 py-1.5"
                        >
                            <span className="capitalize">{status}</span>
                            <input
                                type="checkbox"
                                checked={applyPolicyStatuses.includes(status)}
                                onChange={() => toggleApplyStatus(status)}
                                disabled={!canManageMonitorPolicy || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending}
                            />
                        </label>
                    ))}
                </div>

                <div className="mt-3">
                    <label className="text-label-small text-[var(--color-text-secondary)]">
                        Max interviews per batch
                        <input
                            type="number"
                            className="m3-input mt-1"
                            min={1}
                            max={1000}
                            value={applyPolicyLimit}
                            onChange={(e) => setApplyPolicyLimit(Math.min(Math.max(Number(e.target.value) || 1, 1), 1000))}
                            disabled={!canManageMonitorPolicy || applyMonitorPolicyMutation.isPending || previewMonitorPolicyMutation.isPending}
                        />
                    </label>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Auto terminate enabled
                    <input
                        type="checkbox"
                        checked={monitorPolicyDraft.autoTerminateEnabled}
                        onChange={(e) => updateMonitorPolicyField({ autoTerminateEnabled: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Enforce fullscreen lock
                    <input
                        type="checkbox"
                        checked={monitorPolicyDraft.enforceFullscreen}
                        onChange={(e) => updateMonitorPolicyField({ enforceFullscreen: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Require entire screen share
                    <input
                        type="checkbox"
                        checked={monitorPolicyDraft.enforceEntireScreenShare}
                        onChange={(e) => updateMonitorPolicyField({ enforceEntireScreenShare: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Strict clipboard protection
                    <input
                        type="checkbox"
                        checked={monitorPolicyDraft.strictClipboardProtection}
                        onChange={(e) => updateMonitorPolicyField({ strictClipboardProtection: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Max auto re-share attempts
                    <input
                        type="number"
                        className="m3-input mt-1"
                        min={1}
                        max={10}
                        value={monitorPolicyDraft.maxAutoReshareAttempts}
                        onChange={(e) => updateMonitorPolicyField({
                            maxAutoReshareAttempts: Math.min(Math.max(Number(e.target.value) || 1, 1), 10),
                        })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Heartbeat terminate threshold (sec)
                    <input
                        type="number"
                        className="m3-input mt-1"
                        min={10}
                        max={240}
                        value={monitorPolicyDraft.heartbeatTerminateThresholdSec}
                        onChange={(e) => updateMonitorPolicyField({
                            heartbeatTerminateThresholdSec: Math.min(Math.max(Number(e.target.value) || 10, 10), 240),
                        })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Invalid surface tolerance (count)
                    <input
                        type="number"
                        className="m3-input mt-1"
                        min={1}
                        max={10}
                        value={monitorPolicyDraft.invalidSurfaceTerminateThreshold}
                        onChange={(e) => updateMonitorPolicyField({
                            invalidSurfaceTerminateThreshold: Math.min(Math.max(Number(e.target.value) || 1, 1), 10),
                        })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Code sync interval (ms)
                    <input
                        type="number"
                        className="m3-input mt-1"
                        min={200}
                        max={4000}
                        step={50}
                        value={monitorPolicyDraft.codeSyncIntervalMs}
                        onChange={(e) => updateMonitorPolicyField({
                            codeSyncIntervalMs: Math.min(Math.max(Number(e.target.value) || 200, 200), 4000),
                        })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
            </div>

            <div className="mt-3 text-label-small text-[var(--color-text-secondary)]">
                {isMonitorPolicyDirty
                    ? 'Template has unsaved changes.'
                    : monitorPolicyQuery.data?.updatedAt
                        ? `Last saved ${new Date(monitorPolicyQuery.data.updatedAt).toLocaleString()}`
                        : 'Using system default template.'}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Save reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1"
                        maxLength={240}
                        placeholder="e.g. tighten anti-cheat policy for coding round"
                        value={monitorPolicyReason}
                        onChange={(event) => setMonitorPolicyReason(event.target.value)}
                        disabled={!canManageMonitorPolicy || saveMonitorPolicyMutation.isPending}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Rollback reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1"
                        maxLength={240}
                        placeholder="Used when clicking rollback below"
                        value={monitorPolicyRollbackReason}
                        onChange={(event) => setMonitorPolicyRollbackReason(event.target.value)}
                        disabled={!canManageMonitorPolicy || rollbackMonitorPolicyMutation.isPending}
                    />
                </label>
            </div>

            {lastPreviewResult && (
                <div className="mt-3 rounded-xl border border-[var(--color-info)]/20 bg-[var(--color-info-bg)] px-3 py-2 text-xs text-[var(--color-info)]">
                    Preview: {lastPreviewResult.applied}/{lastPreviewResult.totalCandidates} interviews would be updated
                    {lastPreviewResult.skipped ? `, ${lastPreviewResult.skipped} skipped` : ''}
                    {' · '}
                    statuses: {lastPreviewResult.statuses.join(', ')}
                </div>
            )}

            {lastApplyResult && (
                <div className="mt-3 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    Last apply: {lastApplyResult.applied}/{lastApplyResult.totalCandidates} applied
                    {lastApplyResult.skipped ? `, ${lastApplyResult.skipped} skipped` : ''}
                    {' · '}
                    statuses: {lastApplyResult.statuses.join(', ')}
                </div>
            )}

            <div className="mt-4 border-t border-[var(--color-outline)] pt-3">
                <div className="text-label-small text-[var(--color-text-secondary)] mb-2">
                    Template History
                </div>
                <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                    {(monitorPolicyHistoryQuery.data || []).length === 0 ? (
                        <div className="text-xs text-[var(--color-text-secondary)]">No saved template versions yet.</div>
                    ) : (
                        (monitorPolicyHistoryQuery.data || []).map((item) => (
                            <div
                                key={item.id}
                                className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2 cursor-pointer"
                                style={{
                                    borderColor: selectedTemplateHistoryId === item.id
                                        ? 'var(--color-primary)'
                                        : 'var(--color-outline)',
                                    backgroundColor: selectedTemplateHistoryId === item.id
                                        ? 'var(--color-primary-container)'
                                        : 'var(--color-surface)',
                                }}
                                onClick={() => setSelectedTemplateHistoryId(item.id)}
                            >
                                <div className="min-w-0">
                                    <div className="text-xs text-[var(--color-text-primary)] truncate">
                                        {new Date(item.updatedAt).toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                        source: {item.source}
                                        {item.rollbackFrom ? ` · from ${item.rollbackFrom.slice(0, 8)}` : ''}
                                    </div>
                                    {item.reason && (
                                        <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                            reason: {item.reason}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn btn-outlined h-[28px] px-2 text-[11px]"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        rollbackMonitorPolicyMutation.mutate({
                                            versionId: item.id,
                                            reason: normalizeAuditReasonInput(monitorPolicyRollbackReason),
                                        });
                                    }}
                                    disabled={!canManageMonitorPolicy || rollbackMonitorPolicyMutation.isPending}
                                >
                                    Rollback
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {selectedTemplateHistory && (
                    <div className="mt-3 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                        <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
                            Diff vs current draft
                        </div>
                        {templateDiffRows.length === 0 ? (
                            <div className="text-[11px] text-[var(--color-text-secondary)]">
                                No difference with current draft.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[120px] overflow-auto pr-1">
                                {templateDiffRows.map((row) => (
                                    <div key={row.key} className="text-[11px] text-[var(--color-text-secondary)]">
                                        <span className="text-[var(--color-text-primary)]">{row.label}</span>
                                        {' · '}
                                        {row.from}
                                        {' -> '}
                                        {row.to}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
