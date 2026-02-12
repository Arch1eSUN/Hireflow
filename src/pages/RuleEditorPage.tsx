// ================================================
// HireFlow AI - Screening Rule Editor Page
// Visual rule builder with drag-and-drop style
// ================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Save, Play, Copy, Wand2, ChevronDown,
    FileText, CheckCircle, XCircle, Layers,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, generateId } from '@/lib/utils';
import { evaluateRule, calculateMatchScore, DEFAULT_ENGINEER_RULE, RULE_TEMPLATES } from '@/services/rules/ruleEngine';
import type { RuleNode, RuleOperator } from '@/types';

// Available fields for rules
const RULE_FIELDS = [
    { value: 'experience_years', label: 'Years of Experience' },
    { value: 'education_level', label: 'Education Level' },
    { value: 'skills', label: 'Skills' },
    { value: 'gpa', label: 'GPA' },
    { value: 'salary_expectation', label: 'Salary Expectation' },
    { value: 'location', label: 'Location' },
    { value: 'job_changes', label: 'Job Changes (2yr)' },
    { value: 'languages', label: 'Languages' },
];

const OPERATORS: { value: RuleOperator; label: string; symbol: string }[] = [
    { value: 'EQUALS', label: 'Equals', symbol: '=' },
    { value: 'NOT_EQUALS', label: 'Not Equals', symbol: '≠' },
    { value: 'GTE', label: 'Greater or Equal', symbol: '≥' },
    { value: 'LTE', label: 'Less or Equal', symbol: '≤' },
    { value: 'GT', label: 'Greater Than', symbol: '>' },
    { value: 'LT', label: 'Less Than', symbol: '<' },
    { value: 'CONTAINS', label: 'Contains', symbol: '∋' },
    { value: 'NOT_CONTAINS', label: 'Not Contains', symbol: '∌' },
    { value: 'REGEX', label: 'Regex Match', symbol: '~' },
];

const RuleEditorPage: React.FC = () => {
    const { isDark } = useTheme();
    const [rule, setRule] = useState<RuleNode>(DEFAULT_ENGINEER_RULE);
    const [testResult, setTestResult] = useState<{ pass: boolean; score: number } | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [ruleName, setRuleName] = useState('Senior Engineer Screening');

    // Mock candidate for testing
    const mockCandidate = {
        name: 'Test Candidate',
        experience_years: 4,
        education_level: 'bachelor',
        skills: ['React', 'TypeScript', 'Node.js', 'Python'],
        gpa: 3.5,
        salary_expectation: 150000,
        location: 'Shanghai',
        job_changes: 1,
        languages: ['English', 'Chinese'],
    };

    const handleTest = () => {
        const pass = evaluateRule(mockCandidate, rule);
        const score = calculateMatchScore(mockCandidate, rule);
        setTestResult({ pass, score });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-5xl mx-auto p-8"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Screening Rules</h1>
                    <p className={cn('mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        Define automated criteria for resume filtering
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                            isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        Templates
                    </button>
                    <button
                        onClick={handleTest}
                        className="m3-btn-tonal"
                    >
                        <Play className="w-4 h-4" /> Test Rule
                    </button>
                    <button className="m3-btn-filled">
                        <Save className="w-4 h-4" /> Save
                    </button>
                </div>
            </div>

            {/* Templates Dropdown */}
            <AnimatePresence>
                {showTemplates && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn('rounded-2xl p-5 mb-6 overflow-hidden', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}
                    >
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-primary-500" />
                            Rule Templates
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {RULE_TEMPLATES.map((template) => (
                                <button
                                    key={template.name}
                                    onClick={() => {
                                        setRule(template.rule);
                                        setRuleName(template.name);
                                        setShowTemplates(false);
                                        setTestResult(null);
                                    }}
                                    className={cn(
                                        'p-4 rounded-xl text-left transition-all border',
                                        isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-primary-50 hover:border-primary-200'
                                    )}
                                >
                                    <p className="font-semibold text-sm">{template.name}</p>
                                    <p className={cn('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                                        {template.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Rule Name */}
            <div className={cn('rounded-2xl p-6 mb-6', isDark ? 'bg-[#1C1B20] border border-white/5' : 'bg-white shadow-sm border border-slate-100')}>
                <div className="flex items-center gap-3 mb-5">
                    <FileText className={cn('w-5 h-5', isDark ? 'text-primary-400' : 'text-primary-600')} />
                    <input
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        className={cn('text-lg font-semibold bg-transparent border-none outline-none flex-1', isDark ? 'text-white' : 'text-slate-900')}
                        placeholder="Rule Name"
                    />
                </div>

                {/* Rule Builder */}
                <RuleGroupNode
                    node={rule}
                    onChange={setRule}
                    isDark={isDark}
                    depth={0}
                />
            </div>

            {/* Test Result */}
            <AnimatePresence>
                {testResult !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                            'p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
                            testResult.pass
                                ? isDark ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
                                : isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {testResult.pass ? (
                                <CheckCircle className="w-6 h-6 text-green-500" />
                            ) : (
                                <XCircle className="w-6 h-6 text-red-500" />
                            )}
                            <div>
                                <p className="font-semibold">
                                    Test against: <span className="font-bold">{mockCandidate.name}</span>
                                </p>
                                <p className="text-sm opacity-80">
                                    Exp: {mockCandidate.experience_years}yr • Skills: {mockCandidate.skills.join(', ')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold">{testResult.score}%</p>
                                <p className="text-xs opacity-70">Match Score</p>
                            </div>
                            <span className="font-bold text-sm uppercase px-3 py-1.5 rounded-full bg-current/10">
                                {testResult.pass ? '✅ PASS' : '❌ FAIL'}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ================================================
// Recursive Rule Node Component
// ================================================

interface RuleGroupNodeProps {
    node: RuleNode;
    onChange: (node: RuleNode) => void;
    onDelete?: () => void;
    isDark: boolean;
    depth: number;
}

const RuleGroupNode: React.FC<RuleGroupNodeProps> = ({ node, onChange, onDelete, isDark, depth }) => {
    if (node.type === 'condition') {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isDark ? 'bg-[#211F26] border-white/5' : 'bg-white border-slate-200 shadow-sm'
                )}
            >
                <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg shrink-0',
                    isDark ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-50 text-primary-600'
                )}>
                    IF
                </span>

                {/* Field Selector */}
                <select
                    value={node.field || ''}
                    onChange={(e) => onChange({ ...node, field: e.target.value })}
                    className={cn(
                        'rounded-lg px-3 py-2 text-sm border-none w-44',
                        isDark ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-700'
                    )}
                >
                    <option value="">Select field...</option>
                    {RULE_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>

                {/* Operator Selector */}
                <select
                    value={node.operator || 'EQUALS'}
                    onChange={(e) => onChange({ ...node, operator: e.target.value as RuleOperator })}
                    className={cn(
                        'rounded-lg px-3 py-2 text-sm font-mono border-none w-32',
                        isDark ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-600'
                    )}
                >
                    {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                            {op.symbol} {op.label}
                        </option>
                    ))}
                </select>

                {/* Value Input */}
                <input
                    value={String(node.value ?? '')}
                    onChange={(e) => {
                        const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                        onChange({ ...node, value: val });
                    }}
                    className={cn(
                        'rounded-lg px-3 py-2 text-sm border-none flex-1 min-w-[100px]',
                        isDark ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-700'
                    )}
                    placeholder="Value"
                />

                {onDelete && (
                    <button
                        onClick={onDelete}
                        className={cn(
                            'p-2 rounded-lg transition-colors shrink-0',
                            isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </motion.div>
        );
    }

    // Group Logic
    const borderColors = [
        isDark ? 'border-primary-500/30' : 'border-primary-200',
        isDark ? 'border-blue-500/30' : 'border-blue-200',
        isDark ? 'border-green-500/30' : 'border-green-200',
    ];

    return (
        <motion.div
            layout
            className={cn('pl-4 border-l-2 space-y-3', borderColors[depth % borderColors.length])}
        >
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    value={node.operator || 'AND'}
                    onChange={(e) => onChange({ ...node, operator: e.target.value as RuleOperator })}
                    className={cn(
                        'rounded-xl px-3 py-2 font-bold text-sm border',
                        isDark
                            ? 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                            : 'bg-primary-50 text-primary-700 border-primary-100'
                    )}
                >
                    <option value="AND">AND — All must match</option>
                    <option value="OR">OR — Any must match</option>
                    <option value="NOT">NOT — Must not match</option>
                </select>

                <button
                    onClick={() => {
                        const newChild: RuleNode = {
                            id: generateId(),
                            type: 'condition',
                            field: '',
                            operator: 'GTE',
                            value: '',
                        };
                        onChange({ ...node, children: [...(node.children || []), newChild] });
                    }}
                    className={cn(
                        'text-xs flex items-center gap-1 font-medium px-3 py-2 rounded-xl transition-colors',
                        isDark ? 'text-slate-400 hover:text-primary-300 hover:bg-white/5' : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'
                    )}
                >
                    <Plus className="w-3 h-3" /> Add Condition
                </button>

                <button
                    onClick={() => {
                        const newGroup: RuleNode = {
                            id: generateId(),
                            type: 'group',
                            operator: 'AND',
                            children: [],
                        };
                        onChange({ ...node, children: [...(node.children || []), newGroup] });
                    }}
                    className={cn(
                        'text-xs flex items-center gap-1 font-medium px-3 py-2 rounded-xl transition-colors',
                        isDark ? 'text-slate-400 hover:text-blue-300 hover:bg-white/5' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                    )}
                >
                    <Copy className="w-3 h-3" /> Add Group
                </button>

                {onDelete && (
                    <button
                        onClick={onDelete}
                        className={cn(
                            'p-2 rounded-lg transition-colors ml-auto',
                            isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {node.children?.map((child, idx) => (
                    <RuleGroupNode
                        key={child.id}
                        node={child}
                        onChange={(updatedChild) => {
                            const newChildren = [...(node.children || [])];
                            newChildren[idx] = updatedChild;
                            onChange({ ...node, children: newChildren });
                        }}
                        onDelete={() => {
                            const newChildren = (node.children || []).filter((_, i) => i !== idx);
                            onChange({ ...node, children: newChildren });
                        }}
                        isDark={isDark}
                        depth={depth + 1}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default RuleEditorPage;
