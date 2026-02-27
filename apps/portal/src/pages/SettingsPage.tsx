// HireFlow AI — 设置页 (Real API + Mutations)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bot, Shield, Bell, Save, Loader2, ChevronRight, Database, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';

type Tab = 'ai' | 'security' | 'notifications' | 'privacy';

interface SettingsFormData {
    id?: string;
    companyId?: string;
    // AI
    defaultModelId?: string;
    technicalModelId?: string;
    resumeModelId?: string;
    temperature?: number;
    maxTokens?: number;
    // Security
    antiCheatEnabled?: boolean;
    livenessDetection?: boolean;
    multiFaceDetection?: boolean;
    tabSwitchDetection?: boolean;
    aiAnswerDetection?: boolean;
    audioEnvironmentDetect?: boolean;
    dataEncryption?: boolean;
    recordingRetentionDays?: number;
    // Notifications
    emailOnInvite?: boolean;
    emailOnReminder?: boolean;
    emailOnComplete?: boolean;
    emailOnStatusChange?: boolean;
    // Privacy
    dataRetentionDays?: number;
    gdprEnabled?: boolean;
}

const SettingsPage: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('ai');

    const { data: settings, isLoading } = useQuery<SettingsFormData>({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await api.get<{ data: SettingsFormData }>('/settings');
            return res.data.data;
        },
    });

    // Local form state — initialized from server data
    const [formState, setFormState] = useState<SettingsFormData>({});
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormState(settings);
            setIsDirty(false);
        }
    }, [settings]);

    const updateField = (key: keyof SettingsFormData, value: any) => {
        setFormState((prev) => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (data: SettingsFormData) => {
            const res = await api.put('/settings', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success('设置已保存');
            setIsDirty(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || '保存失败');
        },
    });

    const handleSave = () => {
        // Send only the relevant settings fields, not the full object with id, companyId, etc.
        const { id, companyId, ...settingsData } = formState;
        saveMutation.mutate(settingsData);
    };

    const tabs = [
        { key: 'ai' as Tab, label: 'AI 配置', icon: Bot },
        { key: 'security' as Tab, label: '安全设置', icon: Shield },
        { key: 'notifications' as Tab, label: '通知偏好', icon: Bell },
        { key: 'privacy' as Tab, label: '数据隐私', icon: Database },
    ];

    if (isLoading) {
        return (
            <div className="space-y-5">
                <h1 className="text-headline-large">{t('settings.title')}</h1>
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    <div className="card animate-pulse space-y-3">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-full h-10 rounded-xl bg-gray-200" />)}
                    </div>
                    <div className="xl:col-span-3 card animate-pulse">
                        <div className="w-32 h-6 rounded bg-gray-200 mb-6" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="w-full h-12 rounded-xl bg-gray-100" />)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('settings.title')}</h1>
                {isDirty && (
                    <motion.button
                        className="btn btn-filled"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                    >
                        {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        保存更改
                    </motion.button>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                {/* Sidebar */}
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

                {/* Content */}
                <div className="xl:col-span-3 card">
                    {activeTab === 'ai' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">AI 配置</h2>
                            <div className="space-y-5">
                                <SettingRow label="默认模型 ID" desc="普通对话使用的模型">
                                    <input
                                        type="text"
                                        value={formState.defaultModelId || ''}
                                        onChange={(e) => updateField('defaultModelId', e.target.value)}
                                        placeholder="gemini-2.5-flash"
                                        className="m3-input"
                                        style={{ width: 200 }}
                                    />
                                </SettingRow>
                                <SettingRow label="技术面试模型" desc="代码评审和技术面试">
                                    <input
                                        type="text"
                                        value={formState.technicalModelId || ''}
                                        onChange={(e) => updateField('technicalModelId', e.target.value)}
                                        placeholder="gpt-4o"
                                        className="m3-input"
                                        style={{ width: 200 }}
                                    />
                                </SettingRow>
                                <SettingRow label="简历分析模型" desc="用于简历自动解析与评估">
                                    <input
                                        type="text"
                                        value={formState.resumeModelId || ''}
                                        onChange={(e) => updateField('resumeModelId', e.target.value)}
                                        placeholder="gemini-2.5-flash"
                                        className="m3-input"
                                        style={{ width: 200 }}
                                    />
                                </SettingRow>
                                <SettingRow label="Temperature" desc="模型创造力（0 精确，2 随机）">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={formState.temperature ?? 0.7}
                                            onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
                                            style={{ width: 120, accentColor: 'var(--color-primary)' }}
                                        />
                                        <span className="text-label-large w-10">{formState.temperature ?? 0.7}</span>
                                    </div>
                                </SettingRow>
                                <SettingRow label="Max Tokens" desc="最大生成长度">
                                    <input
                                        type="number"
                                        value={formState.maxTokens ?? 8192}
                                        onChange={(e) => updateField('maxTokens', parseInt(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 120 }}
                                    />
                                </SettingRow>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'security' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">安全设置</h2>
                            <div className="space-y-5">
                                <ToggleRow label="防作弊检测" desc="开启面试防作弊机制" checked={formState.antiCheatEnabled ?? true} onChange={(v) => updateField('antiCheatEnabled', v)} />
                                <ToggleRow label="活体检测" desc="验证真实人脸参与面试" checked={formState.livenessDetection ?? true} onChange={(v) => updateField('livenessDetection', v)} />
                                <ToggleRow label="多人脸检测" desc="检测镜头前是否有多人" checked={formState.multiFaceDetection ?? true} onChange={(v) => updateField('multiFaceDetection', v)} />
                                <ToggleRow label="切屏检测" desc="检测候选人是否切换到其他应用" checked={formState.tabSwitchDetection ?? true} onChange={(v) => updateField('tabSwitchDetection', v)} />
                                <ToggleRow label="AI 答案检测" desc="检测回答是否由 AI 生成" checked={formState.aiAnswerDetection ?? false} onChange={(v) => updateField('aiAnswerDetection', v)} />
                                <ToggleRow label="环境音检测" desc="检测面试环境的异常声音" checked={formState.audioEnvironmentDetect ?? false} onChange={(v) => updateField('audioEnvironmentDetect', v)} />
                                <ToggleRow label="数据加密" desc="端到端加密所有数据传输" checked={formState.dataEncryption ?? true} onChange={(v) => updateField('dataEncryption', v)} />
                                <SettingRow label="录像保留天数" desc="面试录像自动删除周期">
                                    <input
                                        type="number"
                                        value={formState.recordingRetentionDays ?? 90}
                                        onChange={(e) => updateField('recordingRetentionDays', parseInt(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 100 }}
                                    />
                                </SettingRow>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'notifications' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">通知偏好</h2>
                            <div className="space-y-5">
                                <ToggleRow label="面试邀请通知" desc="向候选人发送面试邀请邮件" checked={formState.emailOnInvite ?? true} onChange={(v) => updateField('emailOnInvite', v)} />
                                <ToggleRow label="面试提醒" desc="面试前自动发送提醒邮件" checked={formState.emailOnReminder ?? true} onChange={(v) => updateField('emailOnReminder', v)} />
                                <ToggleRow label="面试完成通知" desc="面试结束后通知相关人员" checked={formState.emailOnComplete ?? true} onChange={(v) => updateField('emailOnComplete', v)} />
                                <ToggleRow label="状态变更通知" desc="候选人状态变更时发送通知" checked={formState.emailOnStatusChange ?? false} onChange={(v) => updateField('emailOnStatusChange', v)} />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'privacy' && (
                        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-headline-medium mb-6">数据隐私</h2>
                            <div className="space-y-5">
                                <SettingRow label="数据保留天数" desc="候选人数据自动清除周期">
                                    <input
                                        type="number"
                                        value={formState.dataRetentionDays ?? 90}
                                        onChange={(e) => updateField('dataRetentionDays', parseInt(e.target.value))}
                                        className="m3-input"
                                        style={{ width: 100 }}
                                    />
                                </SettingRow>
                                <ToggleRow label="GDPR 合规" desc="启用 GDPR 数据保护合规模式" checked={formState.gdprEnabled ?? false} onChange={(v) => updateField('gdprEnabled', v)} />
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---- Helper Components ----

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
            <div>
                <p className="text-label-large">{label}</p>
                <p className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{desc}</p>
            </div>
            {children}
        </div>
    );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
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
