import React from 'react';
import { motion } from 'framer-motion';
import {
    Settings,
    Bot,
    Shield,
    Bell,
    Save,
    Loader2,
    ChevronRight,
    Database,
    Palette,
    Puzzle,
    Plus,
    Trash2,
    PlugZap,
    Link2,
    Beaker,
    Code,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiKeysPanel } from '../components/settings/ApiKeysPanel';
import { WebhooksPanel } from '../components/settings/WebhooksPanel';
import { MonitorPolicyPanel } from '../components/settings/MonitorPolicyPanel';
import { EvidenceChainPolicyPanel } from '../components/settings/EvidenceChainPolicyPanel';
import {
    useSettingsData,
    providers,
    integrationFieldMap,
    isIntegrationType,
    buildIntegrationForm,
    formToIntegrationConfig,
    providerDefaultBaseUrl,
    detectProviderByModel,
    extractApiError,
    type Tab,
    type SettingsFormData,
    type BrandData,
    type ApiKeyRow,
    type ModelCatalogItem,
    type ModelCatalogResponse,
    type IntegrationRecord,
    type IntegrationType,
    integrationTypes,
} from '@/hooks/useSettingsData';

import { EmptyState } from '@/components/ui/EmptyState';

function normalizeAuditReasonInput(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function createIdempotencyKey(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SettingsPage: React.FC = () => {
    const ctx = useSettingsData();
    const {
        t, canManageSecrets,
        activeTab, setActiveTab,
        settingsDraft, updateSettingsField, settingsQuery,
        brandDraft, updateBrandField, brandQuery,
        handleSave, saveVisible, saveDisabled,
        apiKeys, editingProvider, setEditingProvider, handleProviderEdit,
        keyNameInput, setKeyNameInput, apiKeyInput, setApiKeyInput,
        baseUrlInput, setBaseUrlInput, setKeyAsActiveInput, setSetKeyAsActiveInput,
        testKeyMutation, connectKeyMutation, applyKeyMutation, deleteKeyMutation,
        modelOptions, modelCatalogQuery,
        integrations, integrationType, integrationForm, integrationFields,
        editingIntegrationId, setEditingIntegrationId, integrationValidationMessage,
        handleAddIntegration, handleTestIntegration, handleIntegrationTypeChange,
        handleIntegrationFieldChange, handleEditIntegration,
        addIntegrationMutation, testIntegrationMutation, removeIntegrationMutation,
        codexOAuthIntegration, codexOAuthForm, handleCodexOAuthFieldChange,
        handleTestCodexOAuth, handleSaveCodexOAuth, handleStartCodexOAuth,
        testCodexOAuthMutation, saveCodexOAuthMutation, removeCodexOAuthMutation, startCodexOAuthMutation,
    } = ctx;

    const settingsBusy = ctx.settingsBusy;
    const brandBusy = ctx.brandBusy;


    const tabs = [
        { key: 'ai' as Tab, label: t('settings.ai'), icon: Bot },
        { key: 'brand' as Tab, label: t('settings.brand'), icon: Palette },
        { key: 'security' as Tab, label: t('settings.security'), icon: Shield },
        ...(canManageSecrets ? [{ key: 'integrations' as Tab, label: t('settings.integrations'), icon: Puzzle }] : []),
        { key: 'notifications' as Tab, label: t('settings.notifications'), icon: Bell },
        { key: 'privacy' as Tab, label: t('settings.dataPrivacy'), icon: Database },
        ...(canManageSecrets ? [{ key: 'developers' as Tab, label: 'Developers', icon: Code }] : []),
    ];

    if (settingsQuery.isLoading || brandQuery.isLoading) {
        return (
            <div className="page-shell">
                <div className="page-header">
                    <h1 className="page-title">{t('settings.title')}</h1>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    <div className="card animate-pulse space-y-3">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-xl bg-gray-200" />)}
                    </div>
                    <div className="xl:col-span-3 card animate-pulse h-[460px]" />
                </div>
            </div>
        );
    }

    if (settingsQuery.isError || brandQuery.isError) {
        return (
            <ErrorState
                title={t('analytics.loadFailed')}
                message={t('error.network')}
                onRetry={() => {
                    void settingsQuery.refetch();
                    void brandQuery.refetch();
                }}
            />
        );
    }

    return (
        <div className="page-shell">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('settings.title')}</h1>
                    <p className="page-subtitle">{t('common.settings')}</p>
                </div>
                <div className="page-actions">
                    {saveVisible && (
                        <motion.button
                            className="btn btn-filled"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={handleSave}
                            disabled={saveDisabled}
                        >
                            {saveDisabled ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {t('common.save')}
                        </motion.button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="card p-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                            style={{
                                backgroundColor: activeTab === tab.key ? 'var(--color-primary-container)' : 'transparent',
                                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-on-surface)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <tab.icon size={18} />
                            <span className="text-label-large flex-1">{tab.label}</span>
                            {activeTab === tab.key && <ChevronRight size={16} />}
                        </button>
                    ))}
                </div>

                <div className="xl:col-span-3 card">
                    {activeTab === 'ai' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.ai')}</h2>

                            <div className="rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-4 mb-6">
                                <h3 className="text-title-medium mb-4">{t('settings.ai.providers')}</h3>
                                <div className="space-y-3">
                                    {providers.map((provider) => {
                                        const providerKeys = apiKeys.filter((item) => item.provider === provider);
                                        const activeRow = providerKeys.find((item) => item.isActive) || providerKeys[0];
                                        const connectedCount = providerKeys.filter((item) => item.status === 'connected').length;
                                        const isConnected = connectedCount > 0;
                                        const isEditing = editingProvider === provider;
                                        const modelInUse = [
                                            settingsDraft.defaultModelId,
                                            settingsDraft.technicalModelId,
                                            settingsDraft.resumeModelId,
                                            settingsDraft.reportModelId,
                                        ].find((item) => detectProviderByModel(item) === provider);

                                        return (
                                            <div key={provider} className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] px-4 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                        <span className="text-label-large capitalize">{provider}</span>
                                                        <span className={`text-label-small ${isConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                                                            {isConnected ? t('settings.ai.connected') : t('settings.ai.disconnected')}
                                                        </span>
                                                        <span className="text-label-small text-[var(--color-text-secondary)]">
                                                            {providerKeys.length} keys
                                                        </span>
                                                        {activeRow?.lastTestedAt && (
                                                            <span className="text-label-small text-[var(--color-text-secondary)]">
                                                                {new Date(activeRow.lastTestedAt).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {canManageSecrets ? (
                                                            <button
                                                                className="btn btn-outlined h-[30px] text-xs"
                                                                onClick={() => handleProviderEdit(provider)}
                                                            >
                                                                Add Key
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-[var(--color-text-secondary)]">
                                                                Read only
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    {t('settings.ai.currentModel')}: {modelInUse || t('settings.ai.noModel')}
                                                </div>

                                                {providerKeys.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {providerKeys.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-2 flex items-center justify-between gap-3"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                                                            {item.keyName}
                                                                        </span>
                                                                        {item.isActive && (
                                                                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-[var(--color-primary-container)] text-[var(--color-primary)]">
                                                                                active
                                                                            </span>
                                                                        )}
                                                                        <span className={`text-[10px] rounded-full px-2 py-0.5 ${item.status === 'connected' ? 'bg-green-100 text-green-700' : item.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                            {item.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 truncate">
                                                                        {item.lastTestedAt ? new Date(item.lastTestedAt).toLocaleString() : 'Never tested'}
                                                                    </div>
                                                                </div>
                                                                {canManageSecrets && (
                                                                    <div className="flex items-center gap-2">
                                                                        {!item.isActive && (
                                                                            <button
                                                                                className="btn btn-outlined h-[26px] text-[11px] px-2"
                                                                                onClick={() => applyKeyMutation.mutate({ provider, keyId: item.id })}
                                                                                disabled={applyKeyMutation.isPending || deleteKeyMutation.isPending}
                                                                            >
                                                                                Apply
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            className="btn btn-outlined h-[26px] text-[11px] px-2"
                                                                            onClick={() => handleProviderEdit(provider, item.keyName, item.baseUrl)}
                                                                        >
                                                                            Update
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-outlined h-[26px] text-[11px] px-2 text-[var(--color-error)]"
                                                                            onClick={() => deleteKeyMutation.mutate(item.id)}
                                                                            disabled={applyKeyMutation.isPending || deleteKeyMutation.isPending}
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                                        No API key configured for this provider.
                                                    </div>
                                                )}

                                                {provider === 'openai' && canManageSecrets && (
                                                    <div className="mt-3 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-3">
                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                            <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                                                Codex OAuth (代码面试模型)
                                                            </div>
                                                            <span
                                                                className={`text-[10px] rounded-full px-2 py-0.5 ${codexOAuthIntegration?.status === 'connected'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                    }`}
                                                            >
                                                                {codexOAuthIntegration?.status === 'connected' ? 'connected' : 'disconnected'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                                                            在这里接入 Codex OAuth，连接后可在模型下拉中使用 Codex 模型（如 `codex-mini-latest`）。
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {integrationFieldMap.codex_oauth.map((field) => (
                                                                <div key={`codex-${field.key}`}>
                                                                    <label className="m3-label">
                                                                        {field.label}{field.required ? ' *' : ''}
                                                                    </label>
                                                                    <input
                                                                        type={field.secret ? 'password' : 'text'}
                                                                        className="m3-input"
                                                                        value={codexOAuthForm[field.key] || ''}
                                                                        onChange={(event) => handleCodexOAuthFieldChange(field.key, event.target.value)}
                                                                        placeholder={field.placeholder}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3 flex gap-2">
                                                            <button
                                                                className="btn btn-filled"
                                                                onClick={handleStartCodexOAuth}
                                                                disabled={startCodexOAuthMutation.isPending}
                                                            >
                                                                {startCodexOAuthMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                                                                Authorize OAuth
                                                            </button>
                                                            <button
                                                                className="btn btn-outlined"
                                                                onClick={handleTestCodexOAuth}
                                                                disabled={testCodexOAuthMutation.isPending || saveCodexOAuthMutation.isPending || startCodexOAuthMutation.isPending}
                                                            >
                                                                {testCodexOAuthMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Beaker size={14} />}
                                                                Test OAuth
                                                            </button>
                                                            <button
                                                                className="btn btn-filled"
                                                                onClick={handleSaveCodexOAuth}
                                                                disabled={saveCodexOAuthMutation.isPending || startCodexOAuthMutation.isPending}
                                                            >
                                                                {saveCodexOAuthMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                                                                Save OAuth
                                                            </button>
                                                            {codexOAuthIntegration && (
                                                                <button
                                                                    className="btn btn-outlined text-[var(--color-error)]"
                                                                    onClick={() => removeCodexOAuthMutation.mutate(codexOAuthIntegration.id)}
                                                                    disabled={removeCodexOAuthMutation.isPending}
                                                                >
                                                                    Remove OAuth
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {isEditing && (
                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                                                        <input
                                                            type="text"
                                                            className="m3-input md:col-span-1"
                                                            placeholder="Key name (default)"
                                                            value={keyNameInput}
                                                            onChange={(event) => setKeyNameInput(event.target.value)}
                                                        />
                                                        <input
                                                            type="password"
                                                            className="m3-input md:col-span-1"
                                                            placeholder={t('settings.ai.apiKeyPlaceholder')}
                                                            value={apiKeyInput}
                                                            onChange={(event) => setApiKeyInput(event.target.value)}
                                                        />
                                                        <input
                                                            type="text"
                                                            className="m3-input md:col-span-1"
                                                            placeholder="Base URL (optional)"
                                                            value={baseUrlInput}
                                                            onChange={(event) => setBaseUrlInput(event.target.value)}
                                                        />
                                                        <div className="md:col-span-1 flex items-center">
                                                            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={setKeyAsActiveInput}
                                                                    onChange={(event) => setSetKeyAsActiveInput(event.target.checked)}
                                                                />
                                                                Apply after save
                                                            </label>
                                                        </div>
                                                        <div className="flex gap-2 md:col-span-4">
                                                            <button
                                                                className="btn btn-outlined flex-1"
                                                                disabled={!apiKeyInput || testKeyMutation.isPending}
                                                                onClick={() => testKeyMutation.mutate({
                                                                    provider,
                                                                    keyName: keyNameInput || 'default',
                                                                    apiKey: apiKeyInput,
                                                                    baseUrl: baseUrlInput,
                                                                })}
                                                            >
                                                                {testKeyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                                                                {t('settings.apiKeys.test')}
                                                            </button>
                                                            <button
                                                                className="btn btn-filled flex-1"
                                                                disabled={!apiKeyInput || connectKeyMutation.isPending}
                                                                onClick={() => connectKeyMutation.mutate({
                                                                    provider,
                                                                    keyName: keyNameInput || 'default',
                                                                    apiKey: apiKeyInput,
                                                                    baseUrl: baseUrlInput,
                                                                    setActive: setKeyAsActiveInput,
                                                                })}
                                                            >
                                                                {connectKeyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                                                                {t('common.save')}
                                                            </button>
                                                            <button
                                                                className="btn btn-outlined"
                                                                onClick={() => {
                                                                    setEditingProvider(null);
                                                                    setKeyNameInput('default');
                                                                    setApiKeyInput('');
                                                                    setBaseUrlInput('');
                                                                    setSetKeyAsActiveInput(true);
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <SettingRow label={t('settings.ai.defaultModel')} desc={t('settings.ai.defaultModelId.desc')}>
                                    <ModelSelect value={settingsDraft.defaultModelId} onChange={(value) => updateSettingsField('defaultModelId', value)} options={modelOptions} />
                                </SettingRow>
                                <SettingRow label={t('settings.ai.technicalModelId')} desc={t('settings.ai.technicalModel.desc')}>
                                    <ModelSelect value={settingsDraft.technicalModelId} onChange={(value) => updateSettingsField('technicalModelId', value)} options={modelOptions} />
                                </SettingRow>
                                <SettingRow label={t('settings.ai.resumeModelId')} desc={t('settings.ai.resumeModel.desc')}>
                                    <ModelSelect value={settingsDraft.resumeModelId} onChange={(value) => updateSettingsField('resumeModelId', value)} options={modelOptions} />
                                </SettingRow>
                                <SettingRow label="Report Model" desc="Model for interview report and summary generation">
                                    <ModelSelect value={settingsDraft.reportModelId} onChange={(value) => updateSettingsField('reportModelId', value)} options={modelOptions} />
                                </SettingRow>
                                <SettingRow label={t('settings.ai.temperature')} desc={t('settings.ai.temperature.desc')}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={settingsDraft.temperature ?? 0.7}
                                            onChange={(e) => updateSettingsField('temperature', Number(e.target.value))}
                                            style={{ width: 140, accentColor: 'var(--color-primary)' }}
                                        />
                                        <span className="text-label-large w-10">{settingsDraft.temperature ?? 0.7}</span>
                                    </div>
                                </SettingRow>
                                <SettingRow label={t('settings.ai.maxTokens')} desc={t('settings.ai.maxTokens.desc')}>
                                    <input
                                        type="number"
                                        value={settingsDraft.maxTokens ?? 8192}
                                        onChange={(e) => updateSettingsField('maxTokens', Number(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 140 }}
                                    />
                                </SettingRow>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'security' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.security')}</h2>
                            <div className="space-y-5">
                                <ToggleRow label={t('settings.security.antiCheat')} desc={t('settings.security.antiCheat.desc')} checked={settingsDraft.antiCheatEnabled ?? true} onChange={(v) => updateSettingsField('antiCheatEnabled', v)} />
                                <ToggleRow label={t('settings.security.liveness')} desc={t('settings.security.liveness.desc')} checked={settingsDraft.livenessDetection ?? true} onChange={(v) => updateSettingsField('livenessDetection', v)} />
                                <ToggleRow label={t('settings.security.multiFace')} desc={t('settings.security.multiFace.desc')} checked={settingsDraft.multiFaceDetection ?? true} onChange={(v) => updateSettingsField('multiFaceDetection', v)} />
                                <ToggleRow label={t('settings.security.tabSwitch')} desc={t('settings.security.tabSwitch.desc')} checked={settingsDraft.tabSwitchDetection ?? true} onChange={(v) => updateSettingsField('tabSwitchDetection', v)} />
                                <ToggleRow label={t('settings.security.aiDetect')} desc={t('settings.security.aiDetect.desc')} checked={settingsDraft.aiAnswerDetection ?? false} onChange={(v) => updateSettingsField('aiAnswerDetection', v)} />
                                <ToggleRow label={t('settings.security.audio')} desc={t('settings.security.audio.desc')} checked={settingsDraft.audioEnvironmentDetect ?? false} onChange={(v) => updateSettingsField('audioEnvironmentDetect', v)} />
                                <ToggleRow label={t('settings.security.encryption')} desc={t('settings.security.encryption.desc')} checked={settingsDraft.dataEncryption ?? true} onChange={(v) => updateSettingsField('dataEncryption', v)} />
                                <SettingRow label={t('settings.security.recordingRetention')} desc={t('settings.security.recordingRetention.desc')}>
                                    <input
                                        type="number"
                                        value={settingsDraft.recordingRetentionDays ?? 90}
                                        onChange={(e) => updateSettingsField('recordingRetentionDays', Number(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 120 }}
                                    />
                                </SettingRow>

                                <MonitorPolicyPanel />

                                <EvidenceChainPolicyPanel />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'notifications' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.notifications')}</h2>
                            <div className="space-y-5">
                                <ToggleRow label={t('settings.notifications.invite')} desc={t('settings.notifications.invite.desc')} checked={settingsDraft.emailOnInvite ?? true} onChange={(v) => updateSettingsField('emailOnInvite', v)} />
                                <ToggleRow label={t('settings.notifications.reminder')} desc={t('settings.notifications.reminder.desc')} checked={settingsDraft.emailOnReminder ?? true} onChange={(v) => updateSettingsField('emailOnReminder', v)} />
                                <ToggleRow label={t('settings.notifications.complete')} desc={t('settings.notifications.complete.desc')} checked={settingsDraft.emailOnComplete ?? true} onChange={(v) => updateSettingsField('emailOnComplete', v)} />
                                <ToggleRow label={t('settings.notifications.status')} desc={t('settings.notifications.status.desc')} checked={settingsDraft.emailOnStatusChange ?? false} onChange={(v) => updateSettingsField('emailOnStatusChange', v)} />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'privacy' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.dataPrivacy')}</h2>
                            <div className="space-y-5">
                                <SettingRow label={t('settings.privacy.retention')} desc={t('settings.privacy.retention.desc')}>
                                    <input
                                        type="number"
                                        value={settingsDraft.dataRetentionDays ?? 90}
                                        onChange={(e) => updateSettingsField('dataRetentionDays', Number(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 120 }}
                                    />
                                </SettingRow>
                                <ToggleRow label={t('settings.dataPrivacy.gdpr')} desc={t('settings.privacy.gdpr.desc')} checked={settingsDraft.gdprEnabled ?? false} onChange={(v) => updateSettingsField('gdprEnabled', v)} />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'brand' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.brand')}</h2>
                            <div className="space-y-5">
                                <SettingRow label={t('settings.brand.logo')} desc="Image URL of your company logo">
                                    <input
                                        type="text"
                                        className="m3-input"
                                        style={{ width: 320 }}
                                        value={brandDraft.logo || ''}
                                        onChange={(e) => updateBrandField('logo', e.target.value)}
                                        placeholder="https://..."
                                    />
                                </SettingRow>
                                <SettingRow label={t('auth.companyName')} desc="Display name used in dashboard and interview pages">
                                    <input
                                        type="text"
                                        className="m3-input"
                                        style={{ width: 320 }}
                                        value={brandDraft.name}
                                        onChange={(e) => updateBrandField('name', e.target.value)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.brand.color')} desc="Primary brand color in hex format">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded border border-[var(--color-outline)]" style={{ backgroundColor: brandDraft.primaryColor }} />
                                        <input
                                            type="text"
                                            className="m3-input"
                                            style={{ width: 120 }}
                                            value={brandDraft.primaryColor}
                                            onChange={(e) => updateBrandField('primaryColor', e.target.value)}
                                        />
                                    </div>
                                </SettingRow>
                                <SettingRow label={t('settings.brand.welcome')} desc="Shown to candidates before entering interview">
                                    <input
                                        type="text"
                                        className="m3-input"
                                        style={{ width: 420 }}
                                        value={brandDraft.welcomeText || ''}
                                        onChange={(e) => updateBrandField('welcomeText', e.target.value)}
                                    />
                                </SettingRow>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'integrations' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">{t('settings.integrations')}</h2>

                            <div className="rounded-2xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-4 mb-6">
                                {editingIntegrationId && (
                                    <div className="mb-3 text-xs text-[var(--color-text-secondary)]">
                                        Editing integration: <span className="font-medium text-[var(--color-text-primary)]">{integrationType}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select
                                        className="m3-input"
                                        value={integrationType}
                                        onChange={(e) => handleIntegrationTypeChange(e.target.value)}
                                    >
                                        {integrationTypes.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-outlined flex-1"
                                            onClick={handleTestIntegration}
                                            disabled={testIntegrationMutation.isPending || addIntegrationMutation.isPending}
                                        >
                                            {testIntegrationMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Beaker size={16} />}
                                            Test
                                        </button>
                                        <button className="btn btn-filled flex-1" onClick={handleAddIntegration} disabled={addIntegrationMutation.isPending}>
                                            {addIntegrationMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                            {editingIntegrationId ? 'Save Integration' : 'Add / Update Integration'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    {integrationFields.map((field) => (
                                        <div key={field.key}>
                                            <label className="m3-label">
                                                {field.label}{field.required ? ' *' : ''}
                                            </label>
                                            <input
                                                type={field.secret ? 'password' : 'text'}
                                                className="m3-input"
                                                value={integrationForm[field.key] || ''}
                                                onChange={(e) => handleIntegrationFieldChange(field.key, e.target.value)}
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {editingIntegrationId && (
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            className="btn btn-outlined h-[30px] text-xs"
                                            onClick={() => {
                                                setEditingIntegrationId(null);
                                                handleIntegrationTypeChange(integrationType);
                                            }}
                                        >
                                            Cancel Edit
                                        </button>
                                    </div>
                                )}
                                {integrationValidationMessage && (
                                    <div className="mt-3 rounded-xl border border-[var(--color-info)]/20 bg-[var(--color-info-bg)] px-3 py-2 text-xs text-[var(--color-info)]">
                                        {integrationValidationMessage}
                                    </div>
                                )}
                            </div>

                            {integrations.length === 0 ? (
                                <EmptyState title={t('common.noData')} subtitle="No integration configured yet." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {integrations.map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface-container)] p-4 cursor-pointer transition-colors hover:bg-[var(--color-surface)]"
                                            onClick={() => handleEditIntegration(item)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold capitalize">{item.type.replace(/_/g, ' ')}</div>
                                                <button
                                                    className="btn-icon w-8 h-8 text-[var(--color-error)]"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        removeIntegrationMutation.mutate(item.id);
                                                    }}
                                                    disabled={removeIntegrationMutation.isPending}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                                status: {item.status}
                                                {item.lastTestedAt ? ` · ${new Date(item.lastTestedAt).toLocaleString()}` : ''}
                                                {item.config ? ` · ${Object.keys(item.config).length} fields` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'developers' && canManageSecrets && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                            <h2 className="text-headline-medium mb-6">Developers & API</h2>
                            <ApiKeysPanel />
                            <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />
                            <WebhooksPanel />
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

function ModelSelect({
    value,
    onChange,
    options,
}: {
    value?: string;
    onChange: (value: string) => void;
    options: ModelCatalogItem[];
}) {
    const hasOptions = options.length > 0;
    return (
        <select
            className="m3-input"
            style={{ width: 260 }}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!hasOptions}
        >
            <option value="">{hasOptions ? 'Select model' : 'No available models (connect API first)'}</option>
            {options.map((item) => (
                <option key={`${item.provider}-${item.id}`} value={item.id}>
                    {item.label} ({item.provider}{item.connected ? '' : ', default'})
                </option>
            ))}
        </select>
    );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--color-outline-variant)]">
            <div>
                <p className="text-label-large">{label}</p>
                <p className="text-body-medium text-[var(--color-on-surface-variant)]">{desc}</p>
            </div>
            {children}
        </div>
    );
}

function ToggleRow({
    label,
    desc,
    checked,
    onChange,
}: {
    label: string;
    desc: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <SettingRow label={label} desc={desc}>
            <button
                onClick={() => onChange(!checked)}
                className="relative w-12 h-7 rounded-full transition-colors"
                style={{
                    backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                    border: 'none',
                    cursor: 'pointer',
                }}
            >
                <motion.div
                    layout
                    className="absolute top-1 w-5 h-5 rounded-full"
                    style={{
                        backgroundColor: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        left: checked ? 24 : 4,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
            </button>
        </SettingRow>
    );
}

export default SettingsPage;
