import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
    MonitorPolicy, MonitorPolicyHistoryItem,
    CompanyMonitorPolicyPayload,
    EvidenceChainPolicy, EvidenceChainPolicyResponse,
    EvidenceChainPolicyHistoryItem, PolicyMutationResult,
} from '@/types/monitor';
import {
    diffMonitorPolicy, diffEvidenceChainPolicy,
    normalizeAuditReasonInput, createIdempotencyKey,
} from '@/utils/monitorUtils';

export const DEFAULT_MONITOR_POLICY: MonitorPolicy = {
    autoTerminateEnabled: false,
    maxAutoReshareAttempts: 3,
    heartbeatTerminateThresholdSec: 45,
    invalidSurfaceTerminateThreshold: 2,
    enforceFullscreen: true,
    enforceEntireScreenShare: true,
    strictClipboardProtection: true,
    codeSyncIntervalMs: 300,
};

const DEFAULT_EVIDENCE_CHAIN_POLICY: EvidenceChainPolicy = {
    blockOnBrokenChain: true,
    blockOnPartialChain: false,
};

interface UseMonitorPoliciesOptions {
    interviewId: string | undefined;
    monitorPolicyQuery: any;
    monitorPolicyHistoryQuery: any;
    companyMonitorPolicyQuery: any;
    evidenceChainPolicyQuery: any;
    evidenceChainPolicyHistoryQuery: any;
}

export function useMonitorPolicies({
    interviewId,
    monitorPolicyQuery,
    monitorPolicyHistoryQuery,
    companyMonitorPolicyQuery,
    evidenceChainPolicyQuery,
    evidenceChainPolicyHistoryQuery,
}: UseMonitorPoliciesOptions) {
    const queryClient = useQueryClient();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const currentRole = useAuthStore((s) => s.user?.role);
    const canManageEvidenceChainPolicy = currentRole === 'owner' || currentRole === 'admin';

    // ── Monitor Policy State ──
    const [monitorPolicy, setMonitorPolicy] = useState<MonitorPolicy>(DEFAULT_MONITOR_POLICY);
    const [monitorPolicyDirty, setMonitorPolicyDirty] = useState(false);
    const [monitorPolicyReason, setMonitorPolicyReason] = useState('');
    const [monitorPolicyRollbackReason, setMonitorPolicyRollbackReason] = useState('');
    const [selectedPolicyHistoryId, setSelectedPolicyHistoryId] = useState<string | null>(null);
    const [policyDiffBaseline, setPolicyDiffBaseline] = useState<'current' | 'previous'>('current');
    const hasInitializedPolicyRef = useRef(false);

    // ── Evidence Chain Policy State ──
    const [evidenceChainPolicyDraft, setEvidenceChainPolicyDraft] = useState<EvidenceChainPolicy>(DEFAULT_EVIDENCE_CHAIN_POLICY);
    const [evidenceChainPolicyDirty, setEvidenceChainPolicyDirty] = useState(false);
    const [selectedEvidenceChainPolicyHistoryId, setSelectedEvidenceChainPolicyHistoryId] = useState<string | null>(null);
    const [evidenceChainPolicyReason, setEvidenceChainPolicyReason] = useState('');
    const [evidenceChainPolicyRollbackReason, setEvidenceChainPolicyRollbackReason] = useState('');
    const hasInitializedEvidenceChainPolicyRef = useRef(false);

    // ── Derived: Monitor Policy History ──
    const policyHistoryItems: MonitorPolicyHistoryItem[] = monitorPolicyHistoryQuery.data || [];
    const selectedPolicyHistory = useMemo(
        () => policyHistoryItems.find((item) => item.id === selectedPolicyHistoryId) || null,
        [policyHistoryItems, selectedPolicyHistoryId]
    );
    const selectedPolicyHistoryIndex = useMemo(
        () => policyHistoryItems.findIndex((item) => item.id === selectedPolicyHistoryId),
        [policyHistoryItems, selectedPolicyHistoryId]
    );
    const selectedPolicyHistoryPrevious = useMemo(() => {
        if (selectedPolicyHistoryIndex < 0) return null;
        return policyHistoryItems[selectedPolicyHistoryIndex + 1] || null;
    }, [policyHistoryItems, selectedPolicyHistoryIndex]);
    const policyHistoryDiffCountById = useMemo(() => {
        const diffById: Record<string, number> = {};
        policyHistoryItems.forEach((item, index) => {
            const previous = policyHistoryItems[index + 1];
            const baselinePolicy = previous?.policy || DEFAULT_MONITOR_POLICY;
            diffById[item.id] = diffMonitorPolicy(baselinePolicy, item.policy).length;
        });
        return diffById;
    }, [policyHistoryItems]);
    const policyDiffBasePolicy = useMemo(() => {
        if (policyDiffBaseline === 'previous' && selectedPolicyHistoryPrevious?.policy) {
            return selectedPolicyHistoryPrevious.policy;
        }
        return monitorPolicy;
    }, [monitorPolicy, policyDiffBaseline, selectedPolicyHistoryPrevious?.policy]);
    const policyDiffRows = useMemo(
        () => (selectedPolicyHistory ? diffMonitorPolicy(policyDiffBasePolicy, selectedPolicyHistory.policy) : []),
        [policyDiffBasePolicy, selectedPolicyHistory]
    );
    const policyDiffBaselineLabel = policyDiffBaseline === 'previous' && selectedPolicyHistoryPrevious
        ? 'Previous version'
        : 'Current active policy';

    // ── Derived: Evidence Chain Policy History ──
    const evidenceChainPolicyHistoryItems: EvidenceChainPolicyHistoryItem[] = evidenceChainPolicyHistoryQuery.data || [];
    const selectedEvidenceChainPolicyHistory = useMemo(
        () => evidenceChainPolicyHistoryItems.find((item) => item.id === selectedEvidenceChainPolicyHistoryId) || null,
        [evidenceChainPolicyHistoryItems, selectedEvidenceChainPolicyHistoryId]
    );
    const evidenceChainPolicyDiffCountById = useMemo(() => {
        const diffById: Record<string, number> = {};
        evidenceChainPolicyHistoryItems.forEach((item, index) => {
            const previous = evidenceChainPolicyHistoryItems[index + 1];
            const baselinePolicy = previous?.policy || DEFAULT_EVIDENCE_CHAIN_POLICY;
            diffById[item.id] = diffEvidenceChainPolicy(baselinePolicy, item.policy).length;
        });
        return diffById;
    }, [evidenceChainPolicyHistoryItems]);
    const evidenceChainPolicyDiffRows = useMemo(
        () => (
            selectedEvidenceChainPolicyHistory
                ? diffEvidenceChainPolicy(evidenceChainPolicyDraft, selectedEvidenceChainPolicyHistory.policy)
                : []
        ),
        [evidenceChainPolicyDraft, selectedEvidenceChainPolicyHistory]
    );

    // ── Initialize from server data ──
    useEffect(() => {
        if (!monitorPolicyQuery.data || hasInitializedPolicyRef.current) return;
        setMonitorPolicy(monitorPolicyQuery.data.policy || DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(false);
        hasInitializedPolicyRef.current = true;
    }, [monitorPolicyQuery.data]);

    useEffect(() => {
        const payload = evidenceChainPolicyQuery.data;
        if (!payload) return;
        if (hasInitializedEvidenceChainPolicyRef.current && evidenceChainPolicyDirty) return;
        setEvidenceChainPolicyDraft(payload.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
        setEvidenceChainPolicyDirty(false);
        hasInitializedEvidenceChainPolicyRef.current = true;
    }, [evidenceChainPolicyDirty, evidenceChainPolicyQuery.data]);

    useEffect(() => {
        const history = monitorPolicyHistoryQuery.data || [];
        if (history.length === 0) { setSelectedPolicyHistoryId(null); return; }
        if (selectedPolicyHistoryId && history.some((item: any) => item.id === selectedPolicyHistoryId)) return;
        setSelectedPolicyHistoryId(history[0].id);
    }, [monitorPolicyHistoryQuery.data, selectedPolicyHistoryId]);

    useEffect(() => {
        const history = evidenceChainPolicyHistoryItems;
        if (history.length === 0) { setSelectedEvidenceChainPolicyHistoryId(null); return; }
        if (selectedEvidenceChainPolicyHistoryId && history.some((item) => item.id === selectedEvidenceChainPolicyHistoryId)) return;
        setSelectedEvidenceChainPolicyHistoryId(history[0].id);
    }, [evidenceChainPolicyHistoryItems, selectedEvidenceChainPolicyHistoryId]);

    // ── Mutations ──
    const saveMonitorPolicyMutation = useMutation({
        mutationFn: async ({ nextPolicy, reason }: { nextPolicy: MonitorPolicy; reason?: string }) => {
            const res = await api.put(`/interviews/${interviewId}/monitor-policy`, {
                ...nextPolicy,
                reason,
                idempotencyKey: createIdempotencyKey('interview-monitor-policy-save'),
            });
            return res.data?.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicy(payload?.policy || DEFAULT_MONITOR_POLICY);
            setMonitorPolicyDirty(false);
            setMonitorPolicyReason('');
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', interviewId] });
            toast.success(payload?.idempotentReplay ? 'Duplicate request ignored. Existing interview policy kept.' : 'Monitor policy saved.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to save monitor policy.');
        },
    });

    const rollbackMonitorPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post(`/interviews/${interviewId}/monitor-policy/rollback`, {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('interview-monitor-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<MonitorPolicy>;
        },
        onSuccess: (payload) => {
            setMonitorPolicy(payload?.policy || DEFAULT_MONITOR_POLICY);
            setMonitorPolicyDirty(false);
            setMonitorPolicyRollbackReason('');
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', interviewId] });
            toast.success(payload?.idempotentReplay ? 'Duplicate rollback ignored. Existing interview policy kept.' : 'Monitor policy rolled back.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to roll back monitor policy.');
        },
    });

    const saveEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ nextPolicy, reason }: { nextPolicy: EvidenceChainPolicy; reason?: string }) => {
            const res = await api.put('/settings/evidence-chain-policy', {
                ...nextPolicy,
                reason,
                idempotencyKey: createIdempotencyKey('monitor-evidence-policy-save'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload?.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
            setEvidenceChainPolicyDirty(false);
            setEvidenceChainPolicyReason('');
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            toast.success(payload?.idempotentReplay ? 'Duplicate request ignored. Existing evidence chain policy kept.' : 'Evidence chain policy saved.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to save evidence chain policy.');
        },
    });

    const rollbackEvidenceChainPolicyMutation = useMutation({
        mutationFn: async ({ versionId, reason }: { versionId: string; reason?: string }) => {
            const res = await api.post('/settings/evidence-chain-policy/rollback', {
                versionId,
                reason,
                idempotencyKey: createIdempotencyKey('monitor-evidence-policy-rollback'),
            });
            return res.data.data as PolicyMutationResult<EvidenceChainPolicy>;
        },
        onSuccess: (payload) => {
            setEvidenceChainPolicyDraft(payload?.policy || DEFAULT_EVIDENCE_CHAIN_POLICY);
            setEvidenceChainPolicyDirty(false);
            setEvidenceChainPolicyRollbackReason('');
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy'] });
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            toast.success(payload?.idempotentReplay ? 'Duplicate rollback ignored. Existing evidence chain policy kept.' : 'Evidence chain policy rolled back.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to roll back evidence chain policy.');
        },
    });

    // ── Actions ──
    const updateMonitorPolicy = useCallback((patch: Partial<MonitorPolicy>) => {
        setMonitorPolicy((prev) => ({ ...prev, ...patch }));
        setMonitorPolicyDirty(true);
    }, []);

    const handleSaveMonitorPolicy = useCallback(() => {
        if (!interviewId || saveMonitorPolicyMutation.isPending) return;
        saveMonitorPolicyMutation.mutate({
            nextPolicy: monitorPolicy,
            reason: normalizeAuditReasonInput(monitorPolicyReason),
        });
    }, [interviewId, monitorPolicy, monitorPolicyReason, saveMonitorPolicyMutation]);

    const handleResetMonitorPolicy = useCallback(() => {
        setMonitorPolicy(DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(true);
    }, []);

    const handleApplyCompanyTemplate = useCallback(() => {
        const policy = companyMonitorPolicyQuery.data?.policy;
        if (!policy) {
            toast.error('Failed to load company monitor template.');
            return;
        }
        setMonitorPolicy(policy);
        setMonitorPolicyDirty(true);
        toast.success('Applied company monitor template.');
    }, [companyMonitorPolicyQuery.data?.policy]);

    const updateEvidenceChainPolicy = useCallback((patch: Partial<EvidenceChainPolicy>) => {
        setEvidenceChainPolicyDraft((prev) => ({ ...prev, ...patch }));
        setEvidenceChainPolicyDirty(true);
    }, []);

    const handleSaveEvidenceChainPolicy = useCallback(() => {
        if (!canManageEvidenceChainPolicy || saveEvidenceChainPolicyMutation.isPending) return;
        saveEvidenceChainPolicyMutation.mutate({
            nextPolicy: evidenceChainPolicyDraft,
            reason: normalizeAuditReasonInput(evidenceChainPolicyReason),
        });
    }, [canManageEvidenceChainPolicy, evidenceChainPolicyDraft, evidenceChainPolicyReason, saveEvidenceChainPolicyMutation]);

    const handleResetEvidenceChainPolicyDraft = useCallback(() => {
        setEvidenceChainPolicyDraft(
            evidenceChainPolicyQuery.data?.policy || DEFAULT_EVIDENCE_CHAIN_POLICY
        );
        setEvidenceChainPolicyDirty(false);
    }, [evidenceChainPolicyQuery.data?.policy]);

    // ── WS Message Handlers ──
    const handlePolicyWsMessage = useCallback((data: any) => {
        if (data.type === 'monitor_policy_updated' && data.policy) {
            setMonitorPolicy(data.policy as MonitorPolicy);
            setMonitorPolicyDirty(false);
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy-history', interviewId] });
            void queryClient.invalidateQueries({ queryKey: ['interview-evidence-timeline', interviewId] });
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (data.updatedBy && data.updatedBy !== currentUserId) {
                toast.info(reason ? `Monitor policy updated: ${reason}` : 'Monitor policy updated by another reviewer.');
            }
            return true;
        }

        if (data.type === 'company_monitor_policy_template_updated' && data.policy) {
            const updatedPolicy = data.policy as MonitorPolicy;
            const updatedAt = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();
            const updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : null;
            queryClient.setQueryData<CompanyMonitorPolicyPayload>(
                ['company-monitor-policy-template'],
                { policy: updatedPolicy, source: 'saved', updatedAt, updatedBy }
            );
            if (!monitorPolicyDirty && monitorPolicyQuery.data?.source === 'company_default') {
                setMonitorPolicy(updatedPolicy);
                setMonitorPolicyDirty(false);
            }
            void queryClient.invalidateQueries({ queryKey: ['company-monitor-policy-template'] });
            if (!monitorPolicyDirty) {
                void queryClient.invalidateQueries({ queryKey: ['interview-monitor-policy', interviewId] });
            }
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (updatedBy && updatedBy !== currentUserId) {
                toast.info(reason ? `Company monitor template updated: ${reason}` : 'Company monitor policy template updated.');
            }
            return true;
        }

        if (data.type === 'company_evidence_chain_policy_updated' && data.policy) {
            const updatedPolicy = data.policy as EvidenceChainPolicy;
            const updatedAt = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();
            const updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : null;
            queryClient.setQueryData<EvidenceChainPolicyResponse>(
                ['company-evidence-chain-policy'],
                { policy: updatedPolicy, source: 'saved', updatedAt, updatedBy }
            );
            if (!evidenceChainPolicyDirty) {
                setEvidenceChainPolicyDraft(updatedPolicy);
                setEvidenceChainPolicyDirty(false);
            }
            void queryClient.invalidateQueries({ queryKey: ['company-evidence-chain-policy-history'] });
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (updatedBy && updatedBy !== currentUserId) {
                toast.info(reason ? `Company evidence export policy updated: ${reason}` : 'Company evidence export policy updated.');
            }
            return true;
        }

        return false;
    }, [currentUserId, evidenceChainPolicyDirty, interviewId, monitorPolicyDirty, monitorPolicyQuery.data?.source, queryClient]);

    /** Reset all policy state (e.g. when interviewId changes) */
    const resetPolicyState = useCallback(() => {
        hasInitializedPolicyRef.current = false;
        hasInitializedEvidenceChainPolicyRef.current = false;
        setMonitorPolicy(DEFAULT_MONITOR_POLICY);
        setMonitorPolicyDirty(false);
        setMonitorPolicyReason('');
        setMonitorPolicyRollbackReason('');
        setSelectedPolicyHistoryId(null);
        setPolicyDiffBaseline('current');
        setEvidenceChainPolicyDraft(DEFAULT_EVIDENCE_CHAIN_POLICY);
        setEvidenceChainPolicyDirty(false);
        setSelectedEvidenceChainPolicyHistoryId(null);
        setEvidenceChainPolicyReason('');
        setEvidenceChainPolicyRollbackReason('');
    }, []);

    return {
        // Monitor policy
        monitorPolicy,
        monitorPolicyDirty,
        monitorPolicyReason,
        setMonitorPolicyReason,
        monitorPolicyRollbackReason,
        setMonitorPolicyRollbackReason,
        selectedPolicyHistoryId,
        setSelectedPolicyHistoryId,
        policyDiffBaseline,
        setPolicyDiffBaseline,
        policyHistoryItems,
        selectedPolicyHistory,
        selectedPolicyHistoryPrevious,
        policyHistoryDiffCountById,
        policyDiffBaselineLabel,
        policyDiffRows,
        updateMonitorPolicy,
        handleSaveMonitorPolicy,
        handleResetMonitorPolicy,
        handleApplyCompanyTemplate,
        saveMonitorPolicyMutation,
        rollbackMonitorPolicyMutation,
        // Evidence chain policy
        canManageEvidenceChainPolicy,
        evidenceChainPolicyDraft,
        evidenceChainPolicyDirty,
        evidenceChainPolicyReason,
        setEvidenceChainPolicyReason,
        evidenceChainPolicyRollbackReason,
        setEvidenceChainPolicyRollbackReason,
        selectedEvidenceChainPolicyHistoryId,
        setSelectedEvidenceChainPolicyHistoryId,
        evidenceChainPolicyHistoryItems,
        selectedEvidenceChainPolicyHistory,
        evidenceChainPolicyDiffCountById,
        evidenceChainPolicyDiffRows,
        updateEvidenceChainPolicy,
        handleSaveEvidenceChainPolicy,
        handleResetEvidenceChainPolicyDraft,
        saveEvidenceChainPolicyMutation,
        rollbackEvidenceChainPolicyMutation,
        // WS
        handlePolicyWsMessage,
        resetPolicyState,
    };
}
