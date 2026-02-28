import React, { useEffect, useMemo, useState } from 'react';
import {
    Search, Plus, Save, Play, FileCode, Wand2, Trash2, RefreshCw, Sparkles, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { cn } from '@hireflow/utils/src/index';
import { toast } from 'sonner';
import { useScreeningRules, type ScreeningRule } from '@/hooks/useScreeningRules';

const DEFAULT_RULE_DSL = {
    id: 'root',
    type: 'group',
    operator: 'AND',
    children: [
        {
            id: 'c1',
            type: 'condition',
            field: 'skills',
            operator: 'CONTAINS',
            value: 'React',
        },
    ],
};

const DEFAULT_CANDIDATE = {
    skills: ['React', 'TypeScript'],
    experience_years: 4,
    education: { degree: 'Bachelor' },
};

const buildNewDraftId = () => `new-${Date.now()}`;

const ScreeningPage: React.FC = () => {
    const { t } = useI18n();
    const {
        rules,
        templates,
        loading,
        saveRule,
        deleteRule,
        generateRule,
        evaluateRule,
        fetchRules,
    } = useScreeningRules();

    const [search, setSearch] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('New Rule');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftConditionsText, setDraftConditionsText] = useState(JSON.stringify(DEFAULT_RULE_DSL, null, 2));
    const [jobDescription, setJobDescription] = useState('');
    const [candidateDataText, setCandidateDataText] = useState(JSON.stringify(DEFAULT_CANDIDATE, null, 2));
    const [testResult, setTestResult] = useState<{ pass: boolean; score: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);

    const filteredRules = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return rules;
        return rules.filter((rule) => {
            return (
                rule.name.toLowerCase().includes(keyword) ||
                rule.description?.toLowerCase().includes(keyword)
            );
        });
    }, [rules, search]);

    const parsedConditions = useMemo(() => {
        try {
            return { valid: true, data: JSON.parse(draftConditionsText), error: '' };
        } catch (error: any) {
            return { valid: false, data: null, error: error?.message || 'Invalid JSON' };
        }
    }, [draftConditionsText]);

    const parsedCandidateData = useMemo(() => {
        try {
            return { valid: true, data: JSON.parse(candidateDataText), error: '' };
        } catch (error: any) {
            return { valid: false, data: null, error: error?.message || 'Invalid JSON' };
        }
    }, [candidateDataText]);

    const loadRuleDraft = (rule: ScreeningRule) => {
        setSelectedRuleId(rule.id);
        setDraftName(rule.name || 'Untitled Rule');
        setDraftDescription(rule.description || '');
        setDraftConditionsText(JSON.stringify(rule.conditions || DEFAULT_RULE_DSL, null, 2));
        setTestResult(null);
    };

    const createNewDraft = () => {
        setSelectedRuleId(buildNewDraftId());
        setDraftName('New Rule');
        setDraftDescription('');
        setDraftConditionsText(JSON.stringify(DEFAULT_RULE_DSL, null, 2));
        setTestResult(null);
    };

    const applyTemplate = (template: { name: string; description: string; rule: any }) => {
        setSelectedRuleId(buildNewDraftId());
        setDraftName(`${template.name} (Copy)`);
        setDraftDescription(template.description || '');
        setDraftConditionsText(JSON.stringify(template.rule || DEFAULT_RULE_DSL, null, 2));
        setTestResult(null);
    };

    useEffect(() => {
        if (!selectedRuleId && rules.length > 0) {
            loadRuleDraft(rules[0]);
        }
    }, [rules, selectedRuleId]);

    const handleSave = async () => {
        if (!draftName.trim()) {
            toast.error('Rule name is required.');
            return;
        }
        if (!parsedConditions.valid) {
            toast.error(`Conditions JSON invalid: ${parsedConditions.error}`);
            return;
        }

        setIsSaving(true);
        try {
            const saved = await saveRule({
                id: selectedRuleId || undefined,
                name: draftName.trim(),
                description: draftDescription.trim() || undefined,
                conditions: parsedConditions.data,
            });
            if (saved?.id) {
                setSelectedRuleId(saved.id);
            }
            toast.success('Screening rule saved.');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to save rule.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedRuleId) return;

        if (selectedRuleId.startsWith('new-')) {
            createNewDraft();
            return;
        }

        setIsSaving(true);
        try {
            await deleteRule(selectedRuleId);
            toast.success('Rule deleted.');
            setSelectedRuleId(null);
        } catch {
            toast.error('Failed to delete rule.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSuggest = async () => {
        if (!jobDescription.trim()) {
            toast.error('Please paste a job description first.');
            return;
        }
        setIsSuggesting(true);
        try {
            const suggested = await generateRule(jobDescription);
            if (!suggested) {
                toast.error('AI suggestion failed.');
                return;
            }
            setDraftConditionsText(JSON.stringify(suggested, null, 2));
            toast.success('AI generated screening rule JSON.');
        } finally {
            setIsSuggesting(false);
        }
    };

    const ensureSavedRule = async (): Promise<string | null> => {
        if (selectedRuleId && !selectedRuleId.startsWith('new-')) return selectedRuleId;
        if (!parsedConditions.valid || !draftName.trim()) return null;

        const saved = await saveRule({
            id: selectedRuleId || undefined,
            name: draftName.trim(),
            description: draftDescription.trim() || undefined,
            conditions: parsedConditions.data,
        });
        if (!saved?.id) return null;
        setSelectedRuleId(saved.id);
        return saved.id;
    };

    const handleRunTest = async () => {
        if (!parsedCandidateData.valid) {
            toast.error(`Candidate JSON invalid: ${parsedCandidateData.error}`);
            return;
        }

        setIsTesting(true);
        try {
            const ruleId = await ensureSavedRule();
            if (!ruleId) {
                toast.error('Please save a valid rule before testing.');
                return;
            }
            const result = await evaluateRule(ruleId, parsedCandidateData.data);
            setTestResult(result);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to run test.');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-outline)] mb-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-[20px] font-normal text-[var(--color-text-primary)]">{t('screening.title')}</h1>
                    <span className="text-[var(--color-text-secondary)]">/</span>
                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">Rule Studio</span>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-outlined" onClick={createNewDraft}>
                        <Plus size={16} /> New Rule
                    </button>
                    <button className="btn btn-outlined" onClick={() => fetchRules()}>
                        <RefreshCw size={16} /> Sync
                    </button>
                    <button className="btn btn-filled" onClick={handleSave} disabled={isSaving}>
                        <Save size={16} /> {isSaving ? 'Saving...' : t('common.save')}
                    </button>
                    <button
                        className="btn btn-filled bg-[var(--color-success)] hover:bg-[var(--color-success)] opacity-90 hover:opacity-100 text-white shadow-none"
                        onClick={handleRunTest}
                        disabled={isTesting}
                    >
                        <Play size={16} /> {isTesting ? 'Testing...' : t('screening.testWithSample')}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex min-h-0 border border-[var(--color-outline)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-surface)]">
                <div className="w-[320px] border-r border-[var(--color-outline)] flex flex-col bg-[var(--color-surface-dim)]">
                    <div className="p-3 border-b border-[var(--color-outline)]">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 text-[var(--color-text-secondary)]" size={14} />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="w-full h-9 pl-8 pr-3 text-sm bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-sm)] focus:border-[var(--color-primary)] outline-none"
                                placeholder={t('common.search')}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        <div>
                            <div className="text-[11px] font-bold text-[var(--color-text-secondary)] px-2 py-1 uppercase tracking-wider">
                                Company Rules
                            </div>
                            {loading ? (
                                <div className="text-xs text-[var(--color-text-secondary)] px-2 py-2">Loading rules...</div>
                            ) : filteredRules.length === 0 ? (
                                <div className="text-xs text-[var(--color-text-secondary)] px-2 py-2">No rules found.</div>
                            ) : (
                                filteredRules.map((rule) => (
                                    <button
                                        key={rule.id}
                                        onClick={() => loadRuleDraft(rule)}
                                        className={cn(
                                            'w-full text-left p-2 rounded-[var(--radius-sm)] text-sm flex flex-col gap-1 transition-colors',
                                            selectedRuleId === rule.id
                                                ? 'bg-[var(--color-primary-container)] text-[var(--color-primary)] ring-1 ring-[#1A73E8] ring-opacity-20'
                                                : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                                        )}
                                    >
                                        <span className="font-medium">{rule.name}</span>
                                        <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                            {rule.description || 'No description'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>

                        <div>
                            <div className="text-[11px] font-bold text-[var(--color-text-secondary)] px-2 py-1 uppercase tracking-wider">
                                {t('screening.templates')}
                            </div>
                            {templates.map((template) => (
                                <button
                                    key={template.name}
                                    onClick={() => applyTemplate(template)}
                                    className="w-full text-left p-2 rounded-[var(--radius-sm)] text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
                                >
                                    <div className="font-medium text-[var(--color-text-primary)]">{template.name}</div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">{template.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)]">
                    <div className="p-4 border-b border-[var(--color-outline)] bg-[var(--color-surface)] flex justify-between items-center">
                        <h2 className="text-[14px] font-medium flex items-center gap-2">
                            <FileCode size={16} className="text-[var(--color-text-secondary)]" />
                            Rule Configuration
                        </h2>
                        <button
                            className="btn btn-outlined h-[32px] text-xs"
                            onClick={handleDelete}
                            disabled={isSaving || !selectedRuleId}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 bg-[var(--color-surface-dim)] space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Rule Name</div>
                                <input
                                    value={draftName}
                                    onChange={(event) => setDraftName(event.target.value)}
                                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-sm)] focus:border-[var(--color-primary)] outline-none"
                                    placeholder="e.g. Senior Frontend Screening"
                                />
                            </div>
                            <div>
                                <div className="text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Description</div>
                                <input
                                    value={draftDescription}
                                    onChange={(event) => setDraftDescription(event.target.value)}
                                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-sm)] focus:border-[var(--color-primary)] outline-none"
                                    placeholder="What this rule is used for"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Rule JSON (DSL)</div>
                            <textarea
                                value={draftConditionsText}
                                onChange={(event) => setDraftConditionsText(event.target.value)}
                                className="w-full min-h-[280px] px-3 py-2 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-sm)] focus:border-[var(--color-primary)] outline-none leading-relaxed"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                <div className="w-[380px] border-l border-[var(--color-outline)] flex flex-col bg-[var(--color-surface)]">
                    <div className="p-4 border-b border-[var(--color-outline)]">
                        <h2 className="text-[14px] font-medium flex items-center gap-2">
                            <Sparkles size={16} className="text-[var(--color-text-secondary)]" />
                            Preview & Validation
                        </h2>
                    </div>

                    <div className="flex-1 p-4 bg-[var(--color-surface-dim)] overflow-y-auto space-y-4">
                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded">
                            <div className="flex items-center gap-2 mb-2">
                                {parsedConditions.valid ? (
                                    <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                                ) : (
                                    <AlertTriangle size={14} className="text-[var(--color-error)]" />
                                )}
                                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                    {parsedConditions.valid ? 'Valid JSON' : 'Invalid JSON'}
                                </span>
                            </div>
                            {!parsedConditions.valid && (
                                <div className="text-xs text-[var(--color-error)]">{parsedConditions.error}</div>
                            )}
                            {parsedConditions.valid && (
                                <div className="text-xs text-[var(--color-text-secondary)]">
                                    Rule JSON is parsable and ready to save.
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded">
                            <div className="text-[12px] font-medium mb-2">AI Suggest from Job Description</div>
                            <textarea
                                value={jobDescription}
                                onChange={(event) => setJobDescription(event.target.value)}
                                className="w-full min-h-[96px] px-2 py-2 text-xs bg-[var(--color-surface-dim)] border border-[var(--color-outline)] rounded outline-none focus:border-[var(--color-primary)]"
                                placeholder="Paste job description here..."
                            />
                            <button className="btn btn-outlined h-[32px] text-xs mt-2" onClick={handleSuggest} disabled={isSuggesting}>
                                <Wand2 size={14} /> {isSuggesting ? 'Generating...' : 'Generate Rule'}
                            </button>
                        </div>

                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded">
                            <div className="text-[12px] font-medium mb-2">Candidate Test JSON</div>
                            <textarea
                                value={candidateDataText}
                                onChange={(event) => setCandidateDataText(event.target.value)}
                                className="w-full min-h-[120px] px-2 py-2 text-xs font-mono bg-[var(--color-surface-dim)] border border-[var(--color-outline)] rounded outline-none focus:border-[var(--color-primary)]"
                                spellCheck={false}
                            />
                            {testResult && (
                                <div className={cn(
                                    'mt-2 p-2 rounded text-xs border',
                                    testResult.pass
                                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)] border-opacity-30'
                                        : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)] border-opacity-30'
                                )}>
                                    Result: {testResult.pass ? 'PASS' : 'FAIL'} · Score {testResult.score}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScreeningPage;

