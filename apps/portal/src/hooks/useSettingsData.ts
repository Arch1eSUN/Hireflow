import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ── 公共类型 ──

export type Tab = 'ai' | 'security' | 'notifications' | 'privacy' | 'brand' | 'integrations' | 'developers';

export interface SettingsFormData {
    id?: string;
    companyId?: string;
    defaultModelId?: string;
    technicalModelId?: string;
    resumeModelId?: string;
    reportModelId?: string;
    temperature?: number;
    maxTokens?: number;
    antiCheatEnabled?: boolean;
    livenessDetection?: boolean;
    multiFaceDetection?: boolean;
    tabSwitchDetection?: boolean;
    aiAnswerDetection?: boolean;
    audioEnvironmentDetect?: boolean;
    dataEncryption?: boolean;
    recordingRetentionDays?: number;
    emailOnInvite?: boolean;
    emailOnReminder?: boolean;
    emailOnComplete?: boolean;
    emailOnStatusChange?: boolean;
    dataRetentionDays?: number;
    gdprEnabled?: boolean;
}

export interface BrandData {
    name: string;
    logo: string | null;
    primaryColor: string;
    welcomeText: string | null;
}

export interface ApiKeyRow {
    id: string;
    provider: string;
    keyName: string;
    isActive: boolean;
    status: 'connected' | 'disconnected' | 'error';
    lastTestedAt?: string | null;
    baseUrl?: string | null;
    cachedModels?: unknown;
    modelCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ModelCatalogItem {
    id: string;
    label: string;
    provider: string;
    connected: boolean;
}

export interface ModelCatalogProvider {
    provider: string;
    status: string;
    lastTestedAt?: string | null;
    models: string[];
    connected: boolean;
}

export interface ModelCatalogResponse {
    providers: ModelCatalogProvider[];
    catalog: ModelCatalogItem[];
}

export interface IntegrationRecord {
    id: string;
    type: string;
    status: string;
    config: Record<string, unknown>;
    lastTestedAt?: string | null;
}

interface CodexOAuthStartPayload {
    authorizeUrl: string;
    state: string;
    redirectUri: string;
    expiresInSec: number;
}

export const providers = ['google', 'openai', 'anthropic', 'deepseek', 'alibaba', 'custom'] as const;
export const integrationTypes = [
    'google_calendar', 'outlook', 'slack', 'greenhouse', 'lever', 'codex_oauth', 'generic_oauth',
] as const;
export type IntegrationType = typeof integrationTypes[number];
type IntegrationFieldDef = { key: string; label: string; placeholder: string; required?: boolean; secret?: boolean };

export const integrationFieldMap: Record<IntegrationType, IntegrationFieldDef[]> = {
    slack: [
        { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', required: true, secret: true },
        { key: 'channel', label: 'Channel', placeholder: '#hiring-alerts' },
        { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-***', secret: true },
    ],
    google_calendar: [
        { key: 'clientId', label: 'Client ID', placeholder: 'Google OAuth Client ID', required: true },
        { key: 'clientSecret', label: 'Client Secret', placeholder: 'Google OAuth Client Secret', required: true, secret: true },
        { key: 'calendarId', label: 'Calendar ID', placeholder: 'primary or your_calendar_id@group.calendar.google.com' },
    ],
    outlook: [
        { key: 'tenantId', label: 'Tenant ID', placeholder: 'Azure tenant id' },
        { key: 'clientId', label: 'Client ID', placeholder: 'Azure app client id', required: true },
        { key: 'clientSecret', label: 'Client Secret', placeholder: 'Azure app client secret', required: true, secret: true },
    ],
    greenhouse: [
        { key: 'apiKey', label: 'API Key', placeholder: 'Greenhouse Harvest API key', required: true, secret: true },
        { key: 'endpoint', label: 'Endpoint', placeholder: 'https://harvest.greenhouse.io/v1' },
    ],
    lever: [
        { key: 'apiKey', label: 'API Key', placeholder: 'Lever API key', required: true, secret: true },
        { key: 'endpoint', label: 'Endpoint', placeholder: 'https://api.lever.co/v1' },
    ],
    codex_oauth: [
        { key: 'accessToken', label: 'Access Token', placeholder: 'Optional: existing OAuth access token', secret: true },
        { key: 'baseUrl', label: 'API Base URL', placeholder: 'https://api.openai.com/v1 (optional)' },
        { key: 'models', label: 'Codex Models', placeholder: 'codex-mini-latest' },
        { key: 'clientId', label: 'Client ID', placeholder: 'Codex OAuth client id' },
        { key: 'clientSecret', label: 'Client Secret', placeholder: 'Codex OAuth client secret', secret: true },
        { key: 'authorizeUrl', label: 'Authorize URL', placeholder: 'https://auth.example.com/oauth/authorize' },
        { key: 'tokenUrl', label: 'Token URL', placeholder: 'https://auth.example.com/oauth/token' },
        { key: 'redirectUri', label: 'Redirect URI', placeholder: 'https://your-domain.com/oauth/callback' },
        { key: 'scopes', label: 'Scopes', placeholder: 'read write interview:code' },
    ],
    generic_oauth: [
        { key: 'accessToken', label: 'Access Token', placeholder: 'Optional: existing OAuth access token', secret: true },
        { key: 'clientId', label: 'Client ID', placeholder: 'OAuth client id' },
        { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth client secret', secret: true },
        { key: 'authorizeUrl', label: 'Authorize URL', placeholder: 'https://provider.com/oauth/authorize' },
        { key: 'tokenUrl', label: 'Token URL', placeholder: 'https://provider.com/oauth/token' },
        { key: 'redirectUri', label: 'Redirect URI', placeholder: 'https://your-domain.com/oauth/callback' },
        { key: 'baseUrl', label: 'API Base URL', placeholder: 'https://api.provider.com' },
        { key: 'scopes', label: 'Scopes', placeholder: 'scopeA scopeB' },
    ],
};

export function isIntegrationType(value: string): value is IntegrationType {
    return (integrationTypes as readonly string[]).includes(value);
}

export function buildIntegrationForm(type: IntegrationType, config?: Record<string, unknown>) {
    const fields = integrationFieldMap[type];
    const next: Record<string, string> = {};
    for (const field of fields) {
        const value = config?.[field.key];
        next[field.key] = typeof value === 'string' ? value : '';
    }
    return next;
}

export function formToIntegrationConfig(form: Record<string, string>) {
    const config: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
        const trimmed = value?.trim();
        if (trimmed) config[key] = trimmed;
    }
    return config;
}

export const providerDefaultBaseUrl: Record<string, string> = {
    google: '', openai: 'https://api.openai.com/v1', anthropic: '',
    deepseek: 'https://api.deepseek.com/v1', alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1', custom: '',
};

export function detectProviderByModel(modelId?: string): string | null {
    if (!modelId) return null;
    const lower = modelId.toLowerCase();
    if (lower.includes('gemini') || lower.includes('palm')) return 'google';
    if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('chatgpt')) return 'openai';
    if (lower.includes('claude')) return 'anthropic';
    if (lower.includes('deepseek')) return 'deepseek';
    if (lower.includes('qwen') || lower.includes('tongyi')) return 'alibaba';
    return null;
}

export function extractApiError(error: any, fallback: string): string {
    if (error?.response?.data) {
        const body = error.response.data;
        if (typeof body === 'string') return body;
        if (typeof body.error === 'string') return body.error;
        if (typeof body.message === 'string') return body.message;
        if (body.error && typeof body.error === 'object') {
            if (Array.isArray(body.error.formErrors) && body.error.formErrors.length > 0) return body.error.formErrors.join(', ');
            if (body.error.fieldErrors) {
                const fields = Object.entries(body.error.fieldErrors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
                if (fields.length > 0) return fields.join('; ');
            }
        }
    }
    if (error?.message) return error.message;
    return fallback;
}

/**
 * 设置页数据 + 逻辑层 Hook。
 * 封装所有 queries、mutations、handlers，保持 SettingsPage 为纯 UI。
 */
export function useSettingsData() {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const currentRole = useAuthStore((state) => state.user?.role);
    const canManageSecrets = currentRole === 'owner' || currentRole === 'admin';

    // ── Local state ──
    const [activeTab, setActiveTab] = useState<Tab>('ai');
    const [settingsDraft, setSettingsDraft] = useState<SettingsFormData>({});
    const [brandDraft, setBrandDraft] = useState<BrandData>({ name: '', logo: null, primaryColor: '#1A73E8', welcomeText: '' });
    const [isSettingsDirty, setIsSettingsDirty] = useState(false);
    const [isBrandDirty, setIsBrandDirty] = useState(false);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [keyNameInput, setKeyNameInput] = useState('default');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [baseUrlInput, setBaseUrlInput] = useState('');
    const [setKeyAsActiveInput, setSetKeyAsActiveInput] = useState(true);
    const [integrationType, setIntegrationType] = useState<IntegrationType>('google_calendar');
    const [integrationForm, setIntegrationForm] = useState<Record<string, string>>(() => buildIntegrationForm('google_calendar'));
    const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
    const [integrationValidationMessage, setIntegrationValidationMessage] = useState<string | null>(null);
    const [codexOAuthForm, setCodexOAuthForm] = useState<Record<string, string>>(() => buildIntegrationForm('codex_oauth'));
    const codexOAuthPopupRef = useRef<Window | null>(null);

    // ── Queries ──
    const settingsQuery = useQuery<SettingsFormData>({
        queryKey: ['settings'],
        queryFn: async () => { const res = await api.get<{ data: SettingsFormData }>('/settings'); return res.data.data; },
    });

    const apiKeysQuery = useQuery<ApiKeyRow[]>({
        queryKey: ['api-keys'],
        queryFn: async () => { if (!canManageSecrets) return []; const res = await api.get<{ data: ApiKeyRow[] }>('/settings/keys'); return res.data.data || []; },
        enabled: canManageSecrets,
    });

    const modelCatalogQuery = useQuery<ModelCatalogResponse>({
        queryKey: ['settings-models'],
        queryFn: async () => { const res = await api.get<{ data: ModelCatalogResponse }>('/settings/models'); return res.data.data; },
    });

    const brandQuery = useQuery<BrandData>({
        queryKey: ['brand'],
        queryFn: async () => { const res = await api.get<{ data: BrandData }>('/settings/brand'); return res.data.data; },
    });

    const integrationsQuery = useQuery<IntegrationRecord[]>({
        queryKey: ['integrations'],
        queryFn: async () => { if (!canManageSecrets) return []; const res = await api.get<{ data: IntegrationRecord[] }>('/settings/integrations'); return res.data.data || []; },
        enabled: canManageSecrets,
    });

    // ── Sync effects ──
    useEffect(() => { if (settingsQuery.data) { setSettingsDraft(settingsQuery.data); setIsSettingsDirty(false); } }, [settingsQuery.data]);
    useEffect(() => {
        if (brandQuery.data) {
            setBrandDraft({ name: brandQuery.data.name || '', logo: brandQuery.data.logo || null, primaryColor: brandQuery.data.primaryColor || '#1A73E8', welcomeText: brandQuery.data.welcomeText || '' });
            setIsBrandDirty(false);
        }
    }, [brandQuery.data]);

    // ── Mutations ──
    const saveSettingsMutation = useMutation({
        mutationFn: async (payload: Partial<SettingsFormData>) => { const res = await api.put('/settings', payload); return res.data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success(t('settings.toast.saved')); setIsSettingsDirty(false); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.saveFailed'))); },
    });

    const saveBrandMutation = useMutation({
        mutationFn: async (payload: Partial<BrandData>) => { const res = await api.put('/settings/brand', payload); return res.data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['brand'] }); toast.success(t('settings.toast.saved')); setIsBrandDirty(false); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.saveFailed'))); },
    });

    const testKeyMutation = useMutation({
        mutationFn: async ({ provider, keyName, apiKey, baseUrl }: { provider: string; keyName: string; apiKey: string; baseUrl?: string }) => {
            const res = await api.post('/settings/keys/test', { provider, keyName, apiKey, baseUrl: baseUrl || undefined }); return res.data.data;
        },
        onSuccess: () => { toast.success(t('settings.toast.connected')); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.connectFailed'))); },
    });

    const connectKeyMutation = useMutation({
        mutationFn: async ({ provider, keyName, apiKey, baseUrl, setActive }: { provider: string; keyName: string; apiKey: string; baseUrl?: string; setActive?: boolean }) => {
            const res = await api.post('/settings/keys', { provider, keyName, apiKey, baseUrl: baseUrl || undefined, setActive }); return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['api-keys'] }); queryClient.invalidateQueries({ queryKey: ['settings-models'] });
            toast.success(t('settings.toast.connected'));
            setEditingProvider(null); setKeyNameInput('default'); setApiKeyInput(''); setBaseUrlInput(''); setSetKeyAsActiveInput(true);
        },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.connectFailed'))); },
    });

    const applyKeyMutation = useMutation({
        mutationFn: async ({ provider, keyId }: { provider: string; keyId: string }) => { await api.post('/settings/keys/apply', { provider, keyId }); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); queryClient.invalidateQueries({ queryKey: ['settings-models'] }); toast.success('API key applied'); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const deleteKeyMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/settings/keys/id/${id}`); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); queryClient.invalidateQueries({ queryKey: ['settings-models'] }); toast.success('API key removed'); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const addIntegrationMutation = useMutation({
        mutationFn: async ({ type, config }: { type: IntegrationType; config: Record<string, unknown> }) => { const res = await api.post('/settings/integrations', { type, config }); return res.data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); toast.success(t('settings.toast.saved')); setEditingIntegrationId(null); setIntegrationForm(buildIntegrationForm(integrationType)); setIntegrationValidationMessage(null); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const testIntegrationMutation = useMutation({
        mutationFn: async ({ type, config }: { type: IntegrationType; config: Record<string, unknown> }) => { const res = await api.post('/settings/integrations/test', { type, config }); return res.data.data as { message?: string; warnings?: string[] }; },
        onSuccess: (payload) => { const warnings = payload?.warnings || []; setIntegrationValidationMessage(warnings.length > 0 ? warnings.join(' · ') : (payload?.message || 'Integration verified')); toast.success(payload?.message || 'Integration verified'); },
        onError: (err: any) => { setIntegrationValidationMessage(null); toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const removeIntegrationMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/settings/integrations/${id}`); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); toast.success(t('settings.toast.disconnected')); setIntegrationValidationMessage(null); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const saveCodexOAuthMutation = useMutation({
        mutationFn: async (config: Record<string, unknown>) => { const res = await api.post('/settings/integrations', { type: 'codex_oauth', config }); return res.data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); queryClient.invalidateQueries({ queryKey: ['settings-models'] }); toast.success('Codex OAuth saved'); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const testCodexOAuthMutation = useMutation({
        mutationFn: async (config: Record<string, unknown>) => { const res = await api.post('/settings/integrations/test', { type: 'codex_oauth', config }); return res.data.data as { message?: string; warnings?: string[] }; },
        onSuccess: (payload) => { const warnings = payload?.warnings || []; if (warnings.length > 0) toast.warning(warnings.join(' · ')); else toast.success(payload?.message || 'Codex OAuth verified'); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const removeCodexOAuthMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/settings/integrations/${id}`); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); queryClient.invalidateQueries({ queryKey: ['settings-models'] }); toast.success('Codex OAuth removed'); setCodexOAuthForm(buildIntegrationForm('codex_oauth')); },
        onError: (err: any) => { toast.error(extractApiError(err, t('settings.toast.actionFailed'))); },
    });

    const startCodexOAuthMutation = useMutation({
        mutationFn: async ({ config }: { config: Record<string, unknown> }) => { const res = await api.post<{ data: CodexOAuthStartPayload }>('/settings/integrations/codex-oauth/start', { config }); return res.data.data; },
        onSuccess: (payload) => { const popup = codexOAuthPopupRef.current; if (!popup || popup.closed) { toast.error('OAuth popup was blocked. Please allow popups and retry.'); return; } popup.location.href = payload.authorizeUrl; toast.info('Redirected to Codex OAuth authorization page.'); },
        onError: (err: any) => { codexOAuthPopupRef.current?.close(); codexOAuthPopupRef.current = null; toast.error(extractApiError(err, 'Failed to start Codex OAuth')); },
    });

    // ── Derived ──
    const apiKeys = apiKeysQuery.data || [];
    const integrations = integrationsQuery.data || [];
    const codexOAuthIntegration = useMemo(() => integrations.find((item) => item.type === 'codex_oauth') || null, [integrations]);
    const modelOptions = useMemo(() => modelCatalogQuery.data?.catalog || [], [modelCatalogQuery.data]);
    const settingsBusy = saveSettingsMutation.isPending;
    const brandBusy = saveBrandMutation.isPending;
    const integrationFields = integrationFieldMap[integrationType];

    const saveVisible = (activeTab === 'ai' || activeTab === 'security' || activeTab === 'notifications' || activeTab === 'privacy')
        ? isSettingsDirty : activeTab === 'brand' ? isBrandDirty : false;
    const saveDisabled = (activeTab === 'brand' && brandBusy) || ((activeTab !== 'brand') && settingsBusy);

    // ── Codex OAuth sync ──
    useEffect(() => { setCodexOAuthForm(buildIntegrationForm('codex_oauth', codexOAuthIntegration?.config || {})); }, [codexOAuthIntegration?.id]);
    useEffect(() => {
        const handleOAuthMessage = (event: MessageEvent<any>) => {
            if (event.origin !== window.location.origin) return;
            if (!event.data || event.data.type !== 'codex_oauth_complete') return;
            codexOAuthPopupRef.current?.close(); codexOAuthPopupRef.current = null;
            if (event.data.success) { void queryClient.invalidateQueries({ queryKey: ['integrations'] }); void queryClient.invalidateQueries({ queryKey: ['settings-models'] }); toast.success('Codex OAuth connected'); }
            else { toast.error(String(event.data.error || 'Codex OAuth failed')); }
        };
        window.addEventListener('message', handleOAuthMessage);
        return () => { window.removeEventListener('message', handleOAuthMessage); };
    }, [queryClient]);

    // ── Handlers ──
    const updateSettingsField = useCallback((key: keyof SettingsFormData, value: any) => { setSettingsDraft((prev) => ({ ...prev, [key]: value })); setIsSettingsDirty(true); }, []);
    const updateBrandField = useCallback((key: keyof BrandData, value: any) => { setBrandDraft((prev) => ({ ...prev, [key]: value })); setIsBrandDirty(true); }, []);

    const handleSave = useCallback(() => {
        if (activeTab === 'brand') { saveBrandMutation.mutate({ name: brandDraft.name.trim(), logo: brandDraft.logo || '', primaryColor: brandDraft.primaryColor, welcomeText: brandDraft.welcomeText || '' }); return; }
        const { id, companyId, ...payload } = settingsDraft; saveSettingsMutation.mutate(payload);
    }, [activeTab, brandDraft, saveBrandMutation, saveSettingsMutation, settingsDraft]);

    const handleProviderEdit = useCallback((provider: string, keyName = 'default', baseUrl?: string | null) => {
        setEditingProvider(provider); setKeyNameInput(keyName); setApiKeyInput(''); setBaseUrlInput(baseUrl || providerDefaultBaseUrl[provider] || ''); setSetKeyAsActiveInput(true);
    }, []);

    const handleAddIntegration = useCallback(() => { addIntegrationMutation.mutate({ type: integrationType, config: formToIntegrationConfig(integrationForm) }); }, [addIntegrationMutation, integrationType, integrationForm]);
    const handleTestIntegration = useCallback(() => { testIntegrationMutation.mutate({ type: integrationType, config: formToIntegrationConfig(integrationForm) }); }, [testIntegrationMutation, integrationType, integrationForm]);
    const handleIntegrationTypeChange = useCallback((value: string) => { if (!isIntegrationType(value)) return; setIntegrationType(value); setEditingIntegrationId(null); setIntegrationValidationMessage(null); setIntegrationForm(buildIntegrationForm(value)); }, []);
    const handleIntegrationFieldChange = useCallback((key: string, value: string) => { setIntegrationForm((prev) => ({ ...prev, [key]: value })); setIntegrationValidationMessage(null); }, []);
    const handleCodexOAuthFieldChange = useCallback((key: string, value: string) => { setCodexOAuthForm((prev) => ({ ...prev, [key]: value })); }, []);
    const handleTestCodexOAuth = useCallback(() => { testCodexOAuthMutation.mutate(formToIntegrationConfig(codexOAuthForm)); }, [testCodexOAuthMutation, codexOAuthForm]);
    const handleSaveCodexOAuth = useCallback(() => { saveCodexOAuthMutation.mutate(formToIntegrationConfig(codexOAuthForm)); }, [saveCodexOAuthMutation, codexOAuthForm]);
    const handleStartCodexOAuth = useCallback(() => {
        const popup = window.open('about:blank', 'hireflow_codex_oauth', 'width=560,height=760,noopener=false,noreferrer=false');
        if (!popup) { toast.error('Unable to open OAuth popup. Please allow popups and retry.'); return; }
        popup.document.title = 'Codex OAuth'; popup.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 16px;">Redirecting to Codex OAuth...</p>';
        codexOAuthPopupRef.current = popup; startCodexOAuthMutation.mutate({ config: formToIntegrationConfig(codexOAuthForm) });
    }, [startCodexOAuthMutation, codexOAuthForm]);

    const handleEditIntegration = useCallback((item: IntegrationRecord) => {
        const nextType = isIntegrationType(item.type) ? item.type : 'slack';
        setEditingIntegrationId(item.id); setIntegrationType(nextType); setIntegrationValidationMessage(null); setIntegrationForm(buildIntegrationForm(nextType, item.config || {}));
    }, []);

    return {
        t, canManageSecrets,
        // Tab
        activeTab, setActiveTab,
        // Settings
        settingsDraft, updateSettingsField, settingsQuery, isSettingsDirty,
        // Brand
        brandDraft, updateBrandField, brandQuery, isBrandDirty,
        // Save
        handleSave, saveVisible, saveDisabled, settingsBusy, brandBusy,
        // API Keys
        apiKeys, apiKeysQuery, editingProvider, setEditingProvider, handleProviderEdit,
        keyNameInput, setKeyNameInput, apiKeyInput, setApiKeyInput,
        baseUrlInput, setBaseUrlInput, setKeyAsActiveInput, setSetKeyAsActiveInput,
        testKeyMutation, connectKeyMutation, applyKeyMutation, deleteKeyMutation,
        // Models
        modelOptions, modelCatalogQuery,
        // Integrations
        integrations, integrationsQuery, integrationType, integrationForm, integrationFields,
        editingIntegrationId, setEditingIntegrationId, integrationValidationMessage,
        handleAddIntegration, handleTestIntegration, handleIntegrationTypeChange,
        handleIntegrationFieldChange, handleEditIntegration,
        addIntegrationMutation, testIntegrationMutation, removeIntegrationMutation,
        // Codex OAuth
        codexOAuthIntegration, codexOAuthForm, handleCodexOAuthFieldChange,
        handleTestCodexOAuth, handleSaveCodexOAuth, handleStartCodexOAuth,
        testCodexOAuthMutation, saveCodexOAuthMutation, removeCodexOAuthMutation, startCodexOAuthMutation,
    };
}
