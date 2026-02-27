import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
    IntegrityInsight, RoomState, MonitorAlertRecord, MonitorPolicyPayload,
    MonitorPolicyHistoryItem, EvidenceExportHistoryItem, EvidenceTimelineItem,
    EvidenceChainVerification, EvidenceChainPolicyResponse, EvidenceChainPolicyHistoryItem,
    CompanyMonitorPolicyPayload
} from '@/types/monitor';

export function useMonitorState(id: string | undefined, token: string | null | undefined) {
    const isReady = !!id && !!token;

    const integrityQuery = useQuery<IntegrityInsight>({
        queryKey: ['interview-integrity', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/integrity`);
            return res.data.data;
        },
        enabled: isReady,
        refetchInterval: 10000,
    });

    const roomStateQuery = useQuery<RoomState>({
        queryKey: ['interview-monitor-state', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/monitor-state`);
            return res.data.data;
        },
        enabled: isReady,
        refetchInterval: 5000,
    });

    const monitorAlertsQuery = useQuery<MonitorAlertRecord[]>({
        queryKey: ['interview-monitor-alerts', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/monitor-alerts`, { params: { limit: 100 } });
            return res.data.data || [];
        },
        enabled: isReady,
        refetchInterval: 10000,
    });

    const monitorPolicyQuery = useQuery<MonitorPolicyPayload>({
        queryKey: ['interview-monitor-policy', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/monitor-policy`);
            return res.data.data;
        },
        enabled: isReady,
    });

    const monitorPolicyHistoryQuery = useQuery<MonitorPolicyHistoryItem[]>({
        queryKey: ['interview-monitor-policy-history', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/monitor-policy/history`, {
                params: { limit: 12 },
            });
            return res.data.data?.history || [];
        },
        enabled: isReady,
    });

    const evidenceExportHistoryQuery = useQuery<EvidenceExportHistoryItem[]>({
        queryKey: ['interview-evidence-exports', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/evidence-exports`, {
                params: { limit: 30 },
            });
            return res.data.data?.history || [];
        },
        enabled: isReady,
        refetchInterval: 15000,
    });

    const evidenceTimelineQuery = useQuery<EvidenceTimelineItem[]>({
        queryKey: ['interview-evidence-timeline', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/evidence-timeline`, {
                params: { limit: 120 },
            });
            return res.data.data?.timeline || [];
        },
        enabled: isReady,
        refetchInterval: 15000,
    });

    const evidenceChainQuery = useQuery<EvidenceChainVerification>({
        queryKey: ['interview-evidence-chain', id],
        queryFn: async () => {
            const res = await api.get(`/interviews/${id}/evidence-chain/verify`, {
                params: { limit: 500 },
            });
            return res.data.data;
        },
        enabled: isReady,
        refetchInterval: 20000,
    });

    // Company level fallback configurations
    const companyMonitorPolicyQuery = useQuery<CompanyMonitorPolicyPayload>({
        queryKey: ['company-monitor-policy-template'],
        queryFn: async () => {
            const res = await api.get('/settings/monitor-policy');
            return res.data.data;
        },
        enabled: !!token,
    });

    const evidenceChainPolicyQuery = useQuery<EvidenceChainPolicyResponse>({
        queryKey: ['company-evidence-chain-policy'],
        queryFn: async () => {
            const res = await api.get('/settings/evidence-chain-policy');
            return res.data.data;
        },
        enabled: !!token,
        refetchInterval: 30000,
    });

    const evidenceChainPolicyHistoryQuery = useQuery<EvidenceChainPolicyHistoryItem[]>({
        queryKey: ['company-evidence-chain-policy-history'],
        queryFn: async () => {
            const res = await api.get('/settings/evidence-chain-policy/history', {
                params: { limit: 12 },
            });
            return res.data.data?.history || [];
        },
        enabled: !!token,
        refetchInterval: 30000,
    });

    return {
        integrityQuery,
        roomStateQuery,
        monitorAlertsQuery,
        monitorPolicyQuery,
        monitorPolicyHistoryQuery,
        evidenceExportHistoryQuery,
        evidenceTimelineQuery,
        evidenceChainQuery,
        companyMonitorPolicyQuery,
        evidenceChainPolicyQuery,
        evidenceChainPolicyHistoryQuery,
    };
}
