// HireFlow AI — 系统设置页
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Key, Shield, Bell, Puzzle, Paintbrush, Database, Monitor, Save } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import { useTheme } from '@/contexts/ThemeContext';

const SECTIONS = [
    { id: 'ai', icon: Bot, key: 'settings.ai' },
    { id: 'apiKeys', icon: Key, key: 'settings.apiKeys' },
    { id: 'security', icon: Shield, key: 'settings.security' },
    { id: 'notifications', icon: Bell, key: 'settings.notifications' },
    { id: 'integrations', icon: Puzzle, key: 'settings.integrations' },
    { id: 'brand', icon: Paintbrush, key: 'settings.brand' },
    { id: 'dataPrivacy', icon: Database, key: 'settings.dataPrivacy' },
    { id: 'appearance', icon: Monitor, key: 'settings.appearance' },
];

const SettingsPage: React.FC = () => {
    const { t, locale, setLocale } = useI18n();
    const { theme, setTheme } = useTheme();
    const [activeSection, setActiveSection] = useState('ai');

    return (
        <div className="space-y-5">
            <h1 className="text-headline-large">{t('settings.title')}</h1>

            <div className="flex gap-6">
                {/* 左侧导航 */}
                <nav className="w-48 shrink-0 space-y-1">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`nav-item w-full ${activeSection === s.id ? 'active' : ''}`}
                        >
                            <s.icon size={18} />
                            <span className="text-sm">{t(s.key)}</span>
                        </button>
                    ))}
                </nav>

                {/* 右侧内容 */}
                <div className="flex-1">
                    {activeSection === 'ai' && (
                        <motion.div className="card space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-headline-medium">{t('settings.ai')}</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-label-large block mb-2">{t('settings.ai.defaultModel')}</label>
                                    <select
                                        className="input-compact"
                                        style={{ width: 300, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                                        defaultValue="gemini-2.5-flash"
                                    >
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="claude-sonnet">Claude Sonnet 4</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-label-large block mb-2">{t('settings.ai.temperature')}</label>
                                    <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-64" />
                                    <span className="ml-3 text-body-medium">0.7</span>
                                </div>
                                <div>
                                    <label className="text-label-large block mb-2">{t('settings.ai.maxTokens')}</label>
                                    <input
                                        type="number"
                                        defaultValue={8192}
                                        className="input-compact"
                                        style={{ width: 200, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeSection === 'appearance' && (
                        <motion.div className="card space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-headline-medium">{t('settings.appearance')}</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-label-large block mb-2">{t('settings.appearance.theme')}</label>
                                    <div className="flex gap-2">
                                        {(['light', 'dark', 'system'] as const).map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => setTheme(opt)}
                                                className={`btn ${theme === opt ? 'btn-filled' : 'btn-outlined'}`}
                                            >
                                                {t(`settings.appearance.theme.${opt}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-label-large block mb-2">{t('settings.appearance.language')}</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setLocale('zh-CN')}
                                            className={`btn ${locale === 'zh-CN' ? 'btn-filled' : 'btn-outlined'}`}
                                        >
                                            简体中文
                                        </button>
                                        <button
                                            onClick={() => setLocale('en-US')}
                                            className={`btn ${locale === 'en-US' ? 'btn-filled' : 'btn-outlined'}`}
                                        >
                                            English
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeSection === 'security' && (
                        <motion.div className="card space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-headline-medium">{t('settings.security')}</h2>
                            {[
                                { key: 'settings.security.antiCheat', default: true },
                                { key: 'settings.security.liveness', default: true },
                                { key: 'settings.security.multiFace', default: true },
                                { key: 'settings.security.tabSwitch', default: true },
                                { key: 'settings.security.aiDetect', default: false },
                                { key: 'settings.security.encryption', default: true },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--color-surface-variant)' }}>
                                    <span className="text-body-large">{t(item.key)}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                    </label>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {!['ai', 'appearance', 'security'].includes(activeSection) && (
                        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-headline-medium mb-4">{t(`settings.${activeSection}`)}</h2>
                            <p className="text-body-large" style={{ color: 'var(--color-on-surface-variant)' }}>
                                功能开发中，敬请期待...
                            </p>
                        </motion.div>
                    )}

                    <div className="mt-4">
                        <button className="btn btn-filled">
                            <Save size={16} />
                            {t('settings.saveConfig')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
