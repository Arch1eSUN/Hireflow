import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@hireflow/i18n/react';

/* ---------- types ---------- */

interface EvidenceChainPolicy {
    blockOnBrokenChain: boolean;
    blockOnPartialChain: boolean;
}

interface EvidenceChainPolicyResponse {
    policy: EvidenceChainPolicy;
    source: 'saved' | 'default';
    updatedAt: string | null;
    updatedBy: string | null;
}

interface EvidenceChainPolicyHistoryItem {
    id: string;
    policy: EvidenceChainPolicy;
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

const DEFAULT_EVIDENCE_CHAIN_POLICY: EvidenceChainPolicy = {
    blockOnBrokenChain: true,
    blockOnPartialChain: false,
};

const evidenceChainPolicyFieldLabels: Record<keyof EvidenceChainPolicy, string> = {
    blockOnBrokenChain: 'Block export on broken chain',
    blockOnPartialChain: 'Block export on partial chain',
};

/* ---------- helpers ---------- */

function formatEvidenceChainPolicyValue(value: boolean): string {
    return value ? 'Enabled' : 'Disabled';
}

function diffEvidenceChainPolicy(base: EvidenceChainPolicy, target: EvidenceChainPolicy) {
    const rows: { key: string; label: string; from: string; to: string }[] = [];
    for (const key of Object.keys(evidenceChainPolicyFieldLabels) as Array<keyof EvidenceChainPolicy>) {
        const baseVal = base[key];
        const targetVal = target[key];
        if (baseVal !== targetVal) {
            rows.push({
                key,
                label: evidenceChainPolicyFieldLabels[key],
                from: formatEvidenceChainPolicyValue(baseVal),
                to: formatEvidenceChainPolicyValue(targetVal),
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

export const EvidenceChainPolicyPanel: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const currentRole = useAuthStore((state) => state.user?.role);
    const canManageMonitorPolicy = currentRole === 'owner' || currentRole === 'admin';

    /* --- state --- */
    const [evidenceChainPolicyDraft, setEvidenceChainPolicyDraft] = useState<EvidenceChainPolicy>(DEFAULT_EVIDENCE_CHAIN_POLICY);
    const [isEvidenceChainPolicyDirty, setIsEvidenceChainPolicyDirty] = useState(false);
    const [selectedEvidenceChainHistoryId, setSelectedEvidenceChainHistoryId] = useState<string | null>(null);
    const [evidenceChainPolicyReason, setEvidenceChainPolicyReason] = useState('');
    const [evidenceChainPolicyRollbackReason, setEvidenceChainPolicyRollbackReason] = useState('');

    /* --- queries --- */
    const evidenceChainPolicyQuery = useQuery<EvidenceChainPolicyResponse>({
        queryKey: ['settings-evidence-chain-policy'],
        queryFn: async () => {
            const res = await api.get<{ data: EvidenceChainPolicyResponse }>('/settings/evidence-chain-policy');
            return res.data.data;
        },
    });

    const evidenceChainPolicyHistoryQuery = useQuery<EvidenceChainPolicyHistoryItem[]>({
        queryKey: ['settings-evidence-chain-policy-history'],
        queryFn: async () => {
            const res = await api.get<{ data: { history: EvidenceChainPolicyHistoryItem[] } }>(
                '/settings/evidence-chain-policy/history',
                { params: { limit: 12 } }
            );
            return res.data.data?.history || [];
        },
    });

    /* --- effects --- */
    useEffect(() => {
        const payload = evidenceChainPolicyQuery.data;
        if (!payload || isEvidenceChainPolicyDirty) return;
        setEvidenceChainPolicyDraft(payload.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
        setIsEvidenceChainPolicyDirty(false);
    }, [evidenceChainPolicyQuery.data, isEvidenceChainPolicyDirty]);

    useEffect(() => {
        const history = evidenceChainPolicyHistoryQuery.data || [];
        if (history.length === 0) {
            setSelectedEvidenceChainHistoryId(null);
            return;
        }
        if (selectedEvidenceChainHistoryId && history.some((item) => item.id === selectedEvidenceChainHistoryId)) {
            return;
        }
        setSelectedEvidenceChainHistoryId(history[0].id);
    }, [evidenceChainPolicyHistoryQuery.data, selectedEvidenceChainHistoryId]);

    /* --- mutations --- */
    const saveEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ policy, reason }: { policy: EvidenceChainPolicy; reason?: string }) => {
            const res = await api.put('/settings/evidence-chain-policy', {
                ...policy,
                reason,
                idempotencyKey: createIdempotencyKey('settings-evidence-policy-save'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
            void queryClient.invalidateQueries({ queryKey: ['settings-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['settings-evidence-chain-policy-history'] });
            setIsEvidenceChainPolicyDirty(false);
            setEvidenceChainPolicyReason('');
            if (payload.idempotentReplay) {
                toast.info('Duplicate request ignored. Existing evidence chain policy kept.');
            } else {
                toast.success('Evidence chain export policy saved.');
            }
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    const rollbackEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post('/settings/evidence-chain-policy/rollback', {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('settings-evidence-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
            setIsEvidenceChainPolicyDirty(false);
            void queryClient.invalidateQueries({ queryKey: ['settings-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['settings-evidence-chain-policy-history'] });
            setEvidenceChainPolicyRollbackReason('');
            if (payload.idempotentReplay) {
                toast.info('Duplicate rollback ignored. Existing evidence chain policy kept.');
            } else {
                toast.success('Evidence chain export policy rolled back.');
            }
        },
        onError: (err: any) => {
            toast.error(extractApiError(err, t('settings.toast.actionFailed')));
        },
    });

    /* --- handlers --- */
    const updateEvidenceChainPolicyField = (patch: Partial<EvidenceChainPolicy>) => {
        setEvidenceChainPolicyDraft((prev) => ({ ...prev, ...patch }));
        setIsEvidenceChainPolicyDirty(true);
    };

    const handleSaveEvidenceChainPolicy = () => {
        if (!canManageMonitorPolicy || saveEvidenceChainPolicyMutation.isPending) return;
        saveEvidenceChainPolicyMutation.mutate({
            policy: evidenceChainPolicyDraft,
            reason: normalizeAuditReasonInput(evidenceChainPolicyReason),
        });
    };

    /* --- derived --- */
    const selectedEvidenceChainHistory = useMemo(
        () => (evidenceChainPolicyHistoryQuery.data || []).find((item) => item.id === selectedEvidenceChainHistoryId) || null,
        [evidenceChainPolicyHistoryQuery.data, selectedEvidenceChainHistoryId]
    );
    const evidenceChainDiffRows = useMemo(
        () => (
            selectedEvidenceChainHistory
                ? diffEvidenceChainPolicy(evidenceChainPolicyDraft, selectedEvidenceChainHistory.policy)
                : []
        ),
        [evidenceChainPolicyDraft, selectedEvidenceChainHistory]
    );

    /* --- render --- */
    return (
        <div className="rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-title-medium flex items-center gap-2">
                        <Link2 size={16} />
                        Evidence Chain Export Policy
                    </div>
                    <div className="text-body-small text-[var(--color-text-secondary)]">
                        Control whether evidence exports are blocked when hash-chain integrity is broken or partial.
                    </div>
                </div>
                <button
                    className="btn btn-filled h-8 px-3 text-xs"
                    onClick={handleSaveEvidenceChainPolicy}
                    disabled={!canManageMonitorPolicy || saveEvidenceChainPolicyMutation.isPending || !isEvidenceChainPolicyDirty}
                >
                    {saveEvidenceChainPolicyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Save Policy
                </button>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Block export on broken chain
                    <input
                        type="checkbox"
                        checked={evidenceChainPolicyDraft.blockOnBrokenChain}
                        onChange={(e) => updateEvidenceChainPolicyField({ blockOnBrokenChain: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)] flex items-center justify-between rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                    Block export on partial chain
                    <input
                        type="checkbox"
                        checked={evidenceChainPolicyDraft.blockOnPartialChain}
                        onChange={(e) => updateEvidenceChainPolicyField({ blockOnPartialChain: e.target.checked })}
                        disabled={!canManageMonitorPolicy}
                    />
                </label>
            </div>

            <div className="mt-3 text-label-small text-[var(--color-text-secondary)]">
                {isEvidenceChainPolicyDirty
                    ? 'Evidence chain policy has unsaved changes.'
                    : evidenceChainPolicyQuery.data?.updatedAt
                        ? `Last saved ${new Date(evidenceChainPolicyQuery.data.updatedAt).toLocaleString()}`
                        : 'Using default policy (block broken chain only).'}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Save reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1"
                        maxLength={240}
                        placeholder="e.g. allow partial chain for pilot customer"
                        value={evidenceChainPolicyReason}
                        onChange={(event) => setEvidenceChainPolicyReason(event.target.value)}
                        disabled={!canManageMonitorPolicy || saveEvidenceChainPolicyMutation.isPending}
                    />
                </label>
                <label className="text-label-small text-[var(--color-text-secondary)]">
                    Rollback reason (optional)
                    <input
                        type="text"
                        className="m3-input mt-1"
                        maxLength={240}
                        placeholder="Used when clicking rollback below"
                        value={evidenceChainPolicyRollbackReason}
                        onChange={(event) => setEvidenceChainPolicyRollbackReason(event.target.value)}
                        disabled={!canManageMonitorPolicy || rollbackEvidenceChainPolicyMutation.isPending}
                    />
                </label>
            </div>

            <div className="mt-4 border-t border-[var(--color-outline)] pt-3">
                <div className="text-label-small text-[var(--color-text-secondary)] mb-2">
                    Policy History
                </div>
                <div className="space-y-2 max-h-[180px] overflow-auto pr-1">
                    {(evidenceChainPolicyHistoryQuery.data || []).length === 0 ? (
                        <div className="text-xs text-[var(--color-text-secondary)]">No saved policy versions yet.</div>
                    ) : (
                        (evidenceChainPolicyHistoryQuery.data || []).map((item) => (
                            <div
                                key={item.id}
                                className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2 cursor-pointer"
                                style={{
                                    borderColor: selectedEvidenceChainHistoryId === item.id
                                        ? 'var(--color-primary)'
                                        : 'var(--color-outline)',
                                    backgroundColor: selectedEvidenceChainHistoryId === item.id
                                        ? 'var(--color-primary-container)'
                                        : 'var(--color-surface)',
                                }}
                                onClick={() => setSelectedEvidenceChainHistoryId(item.id)}
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
                                        rollbackEvidenceChainPolicyMutation.mutate({
                                            versionId: item.id,
                                            reason: normalizeAuditReasonInput(evidenceChainPolicyRollbackReason),
                                        });
                                    }}
                                    disabled={!canManageMonitorPolicy || rollbackEvidenceChainPolicyMutation.isPending}
                                >
                                    Rollback
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {selectedEvidenceChainHistory && (
                    <div className="mt-3 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2">
                        <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
                            Diff vs current draft
                        </div>
                        {evidenceChainDiffRows.length === 0 ? (
                            <div className="text-[11px] text-[var(--color-text-secondary)]">
                                No difference with current draft.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[120px] overflow-auto pr-1">
                                {evidenceChainDiffRows.map((row) => (
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
