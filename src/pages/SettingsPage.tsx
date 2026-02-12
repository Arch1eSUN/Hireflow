// ================================================
// HireFlow AI - Settings Page
// AI Model configuration, team management, system settings
// ================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, Cpu, Key, Shield, Globe, Bell, Database,
    Users, Palette, Clock, Zap, ChevronRight, Check,
    ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { AIModelType } from '@/types';

const MODELS = [
    { id: AIModelType.GEMINI_PRO, name: 'Gemini 2.5 Pro', provider: 'Google', desc: 'Most capable, best for complex interviews', cost: '$$$' },
    { id: AIModelType.GEMINI_FLASH, name: 'Gemini 2.5 Flash', provider: 'Google', desc: 'Fast and efficient, good for screening', cost: '$' },
    { id: AIModelType.GPT_4O, name: 'GPT-4o', provider: 'OpenAI', desc: 'Strong reasoning, multimodal support', cost: '$$$' },
    { id: AIModelType.GPT_4O_MINI, name: 'GPT-4o Mini', provider: 'OpenAI', desc: 'Cost-effective, fast responses', cost: '$' },
    { id: AIModelType.CLAUDE_SONNET, name: 'Claude Sonnet 4', provider: 'Anthropic', desc: 'Excellent analysis and writing', cost: '$$' },
    { id: AIModelType.CLAUDE_OPUS, name: 'Claude Opus 4', provider: 'Anthropic', desc: 'Most powerful Claude model', cost: '$$$$' },
    { id: AIModelType.LOCAL, name: 'Local Model', provider: 'Self-hosted', desc: 'Privacy-first, runs on your infrastructure', cost: 'Free' },
    { id: AIModelType.MOCK, name: 'Demo Mode', provider: 'HireFlow', desc: 'Simulated responses for testing', cost: 'Free' },
];

const SettingsPage: React.FC = () => {
    const { isDark, toggleTheme, theme } = useTheme();
    const [activeTab, setActiveTab] = useState('ai');
    const [selectedModel, setSelectedModel] = useState<string>(AIModelType.GEMINI_FLASH);
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(2048);

    const tabs = [
        { id: 'ai', label: 'AI Models', icon: Cpu },
        { id: 'api', label: 'API Keys', icon: Key },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'data', label: 'Data & Privacy', icon: Database },
        { id: 'integrations', label: 'Integrations', icon: Globe },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="p-8 max-w-[1200px] mx-auto"
        >
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className={cn('mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Configure AI models, security policies, and platform preferences
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Tabs */}
                <div className={cn('lg:w-56 shrink-0 space-y-1 rounded-2xl p-3', isDark ? 'bg-[#1C1B20]' : 'bg-white shadow-sm border border-slate-100')}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                                activeTab === tab.id
                                    ? isDark ? 'bg-primary-600/15 text-primary-300' : 'bg-primary-50 text-primary-700'
                                    : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1">
                    {/* AI Models Tab */}
                    {activeTab === 'ai' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">Default AI Model</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Choose the primary model for AI interviews and screening
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => setSelectedModel(model.id)}
                                            className={cn(
                                                'p-4 rounded-xl text-left transition-all border',
                                                selectedModel === model.id
                                                    ? isDark
                                                        ? 'bg-primary-600/10 border-primary-500/40 ring-1 ring-primary-500/20'
                                                        : 'bg-primary-50 border-primary-200 ring-1 ring-primary-500/20'
                                                    : isDark
                                                        ? 'bg-white/5 border-white/5 hover:bg-white/10'
                                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-sm">{model.name}</span>
                                                {selectedModel === model.id && (
                                                    <Check className="w-4 h-4 text-primary-500" />
                                                )}
                                            </div>
                                            <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>{model.provider}</p>
                                            <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>{model.desc}</p>
                                            <div className={cn(
                                                'mt-2 text-xs font-semibold px-2 py-0.5 rounded-full w-fit',
                                                model.cost === 'Free' ? 'bg-green-50 text-green-700' :
                                                    model.cost === '$' ? 'bg-blue-50 text-blue-700' :
                                                        model.cost === '$$' ? 'bg-orange-50 text-orange-700' :
                                                            'bg-red-50 text-red-700'
                                            )}>
                                                {model.cost}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Model Parameters */}
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">Model Parameters</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Fine-tune AI behavior for your interviews
                                </p>

                                <div className="space-y-6">
                                    {/* Temperature */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium">Temperature</label>
                                            <span className={cn('text-sm font-mono px-2 py-1 rounded-lg', isDark ? 'bg-white/5' : 'bg-slate-100')}>
                                                {temperature}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={temperature}
                                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                            className="w-full accent-primary-600"
                                        />
                                        <div className="flex justify-between mt-1">
                                            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>Precise (0.0)</span>
                                            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>Creative (1.0)</span>
                                        </div>
                                    </div>

                                    {/* Max Tokens */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium">Max Tokens</label>
                                            <span className={cn('text-sm font-mono px-2 py-1 rounded-lg', isDark ? 'bg-white/5' : 'bg-slate-100')}>
                                                {maxTokens}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="256"
                                            max="8192"
                                            step="256"
                                            value={maxTokens}
                                            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                            className="w-full accent-primary-600"
                                        />
                                        <div className="flex justify-between mt-1">
                                            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>Short (256)</span>
                                            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>Long (8192)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-6">
                                    <button className="m3-btn-filled">
                                        Save Configuration
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* API Keys Tab */}
                    {activeTab === 'api' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">API Key Management</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Configure API keys for AI providers. Keys are encrypted at rest.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { name: 'Google Gemini', env: 'GEMINI_API_KEY', configured: true },
                                        { name: 'OpenAI', env: 'OPENAI_API_KEY', configured: false },
                                        { name: 'Anthropic Claude', env: 'ANTHROPIC_API_KEY', configured: false },
                                        { name: 'Local Model URL', env: 'LOCAL_MODEL_URL', configured: false },
                                    ].map((api) => (
                                        <div
                                            key={api.env}
                                            className={cn(
                                                'flex items-center justify-between p-4 rounded-xl border',
                                                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                                            )}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{api.name}</p>
                                                <p className={cn('text-xs font-mono', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                    {api.env}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {api.configured ? (
                                                    <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> Configured
                                                    </span>
                                                ) : (
                                                    <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                                        Not Set
                                                    </span>
                                                )}
                                                <button className="m3-btn-outlined text-xs py-1.5 px-3">
                                                    {api.configured ? 'Update' : 'Set Key'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">Appearance</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Customize the look and feel
                                </p>

                                <div className="flex gap-4">
                                    {[
                                        { mode: 'light' as const, label: 'Light', icon: '☀️' },
                                        { mode: 'dark' as const, label: 'Dark', icon: '🌙' },
                                    ].map((option) => (
                                        <button
                                            key={option.mode}
                                            onClick={() => { if (theme !== option.mode) toggleTheme(); }}
                                            className={cn(
                                                'flex-1 p-6 rounded-2xl text-center transition-all border',
                                                theme === option.mode
                                                    ? isDark ? 'bg-primary-600/10 border-primary-500/40 ring-1 ring-primary-500/20' : 'bg-primary-50 border-primary-200'
                                                    : isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            )}
                                        >
                                            <span className="text-3xl mb-2 block">{option.icon}</span>
                                            <p className="font-semibold">{option.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">Security & Compliance</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Configure data protection and anti-cheat policies
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { label: 'AES-256 Video Encryption', desc: 'All interview recordings are encrypted', enabled: true },
                                        { label: 'Anti-Cheat Monitoring', desc: 'Face detection, tab switching, multi-person detection', enabled: true },
                                        { label: 'Liveness Detection', desc: 'Random instruction verification (blink, head turn)', enabled: true },
                                        { label: 'AI Answer Detection', desc: 'Detect if candidate uses AI to formulate answers', enabled: false },
                                        { label: 'GDPR Compliance Mode', desc: 'Additional consent flows and data handling', enabled: true },
                                        { label: 'Auto Data Retention', desc: 'Automatically purge data after 90 days', enabled: false },
                                    ].map((setting) => (
                                        <div
                                            key={setting.label}
                                            className={cn(
                                                'flex items-center justify-between p-4 rounded-xl border',
                                                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                                            )}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{setting.label}</p>
                                                <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{setting.desc}</p>
                                            </div>
                                            <div className={cn(
                                                'w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors',
                                                setting.enabled ? 'bg-primary-600' : isDark ? 'bg-white/10' : 'bg-slate-300'
                                            )}>
                                                <div className={cn(
                                                    'w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                                                    setting.enabled ? 'translate-x-5' : 'translate-x-0'
                                                )} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Integrations Tab */}
                    {activeTab === 'integrations' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className={cn('rounded-2xl p-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                                <h2 className="font-semibold text-lg mb-1">Integrations</h2>
                                <p className={cn('text-sm mb-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                    Connect with your existing tools and workflows
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { name: 'Google Calendar', desc: 'Sync interview schedules', connected: true, icon: '📅' },
                                        { name: 'Outlook Calendar', desc: 'Microsoft 365 integration', connected: false, icon: '📆' },
                                        { name: 'Greenhouse', desc: 'ATS synchronization', connected: false, icon: '🌿' },
                                        { name: 'Lever', desc: 'Candidate pipeline sync', connected: false, icon: '⚡' },
                                        { name: 'WeCom / DingTalk', desc: 'Push notifications to team', connected: true, icon: '💬' },
                                        { name: 'Feishu / Lark', desc: 'Team collaboration', connected: false, icon: '🐦' },
                                        { name: 'Webhook', desc: 'Custom event notifications', connected: true, icon: '🔗' },
                                        { name: 'REST API', desc: 'Full programmatic access', connected: true, icon: '🔌' },
                                    ].map((integration) => (
                                        <div
                                            key={integration.name}
                                            className={cn(
                                                'p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer',
                                                isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            )}
                                        >
                                            <span className="text-2xl">{integration.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{integration.name}</p>
                                                <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{integration.desc}</p>
                                            </div>
                                            {integration.connected ? (
                                                <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Connected
                                                </span>
                                            ) : (
                                                <button className="m3-btn-outlined text-xs py-1 px-3">Connect</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Default for other tabs */}
                    {!['ai', 'api', 'appearance', 'security', 'integrations'].includes(activeTab) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn('rounded-2xl p-12 text-center', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}
                        >
                            <Settings className={cn('w-12 h-12 mx-auto mb-4', isDark ? 'text-slate-600' : 'text-slate-300')} />
                            <h2 className="font-semibold text-lg mb-2">
                                {tabs.find((t) => t.id === activeTab)?.label || 'Settings'}
                            </h2>
                            <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                This section is being developed. Configuration options coming soon.
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default SettingsPage;
