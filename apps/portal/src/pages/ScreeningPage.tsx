// HireFlow AI — 简历筛选规则页
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Wand2, Save, Play, ChevronDown } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

const ScreeningPage: React.FC = () => {
    const { t } = useI18n();

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('screening.title')}</h1>
                <div className="flex gap-2">
                    <button className="btn btn-outlined">
                        <Wand2 size={16} />
                        {t('screening.aiSuggest')}
                    </button>
                    <button className="btn btn-tonal">
                        <Save size={16} />
                        {t('screening.saveTemplate')}
                    </button>
                    <button className="btn btn-filled">
                        <Play size={16} />
                        {t('screening.batchEvaluate')}
                    </button>
                </div>
            </div>

            {/* 规则构建器 */}
            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-title-medium mb-4">规则构建器</h3>
                <div className="space-y-3">
                    {/* 示例规则 */}
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
                        <span className="chip chip-primary">AND</span>
                        <div className="flex items-center gap-2 flex-1">
                            <select
                                className="input-compact"
                                style={{ width: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            >
                                <option>工作经验（年）</option>
                                <option>学历</option>
                                <option>技能</option>
                            </select>
                            <select
                                className="input-compact"
                                style={{ width: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            >
                                <option>≥ 大于等于</option>
                                <option>= 等于</option>
                                <option>包含</option>
                            </select>
                            <input
                                className="input-compact"
                                defaultValue="5"
                                style={{ width: 80, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
                        <span className="chip chip-primary">AND</span>
                        <div className="flex items-center gap-2 flex-1">
                            <select
                                className="input-compact"
                                style={{ width: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            >
                                <option>技能</option>
                            </select>
                            <select
                                className="input-compact"
                                style={{ width: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            >
                                <option>包含</option>
                            </select>
                            <input
                                className="input-compact"
                                defaultValue="React, TypeScript"
                                style={{ width: 200, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                            />
                        </div>
                    </div>
                    <button className="btn btn-text">
                        <Plus size={16} />
                        {t('screening.addCondition')}
                    </button>
                </div>
            </motion.div>

            {/* 预设模板 */}
            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <h3 className="text-title-medium mb-3">{t('screening.templates')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {['高级前端工程师（严格）', '产品经理（标准）', '远程优先'].map((name) => (
                        <div key={name} className="p-3 rounded-lg cursor-pointer" style={{
                            backgroundColor: 'var(--color-surface-dim)',
                            border: '1px solid var(--color-outline)',
                            transition: 'all var(--duration-micro)',
                        }}>
                            <p className="text-label-large">{name}</p>
                            <p className="text-label-small mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>3 条规则 · 点击应用</p>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default ScreeningPage;
