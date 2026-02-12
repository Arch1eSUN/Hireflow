// ================================================
// HireFlow AI - Resume Screening Rule Engine
// Supports complex DSL with AND/OR/NOT logic
// ================================================

import { RuleNode } from '@/types';

/**
 * Evaluates a candidate data object against a rule tree.
 * Supports nested groups with AND/OR/NOT logic and various comparison operators.
 */
export const evaluateRule = (candidate: Record<string, unknown>, rule: RuleNode): boolean => {
    if (rule.type === 'group') {
        if (!rule.children || rule.children.length === 0) return true;

        switch (rule.operator) {
            case 'AND':
                return rule.children.every((child) => evaluateRule(candidate, child));
            case 'OR':
                return rule.children.some((child) => evaluateRule(candidate, child));
            case 'NOT':
                return !evaluateRule(candidate, rule.children[0]);
            default:
                return false;
        }
    }

    if (rule.type === 'condition') {
        const candidateValue = getNestedValue(candidate, rule.field || '');
        const ruleValue = rule.value;

        switch (rule.operator) {
            case 'EQUALS':
                return candidateValue == ruleValue;
            case 'NOT_EQUALS':
                return candidateValue != ruleValue;
            case 'GTE':
                return Number(candidateValue) >= Number(ruleValue);
            case 'LTE':
                return Number(candidateValue) <= Number(ruleValue);
            case 'GT':
                return Number(candidateValue) > Number(ruleValue);
            case 'LT':
                return Number(candidateValue) < Number(ruleValue);
            case 'CONTAINS':
                if (Array.isArray(candidateValue)) {
                    return candidateValue.includes(ruleValue);
                }
                return String(candidateValue).toLowerCase().includes(String(ruleValue).toLowerCase());
            case 'NOT_CONTAINS':
                if (Array.isArray(candidateValue)) {
                    return !candidateValue.includes(ruleValue);
                }
                return !String(candidateValue).toLowerCase().includes(String(ruleValue).toLowerCase());
            case 'IN':
                if (Array.isArray(ruleValue)) {
                    return (ruleValue as unknown[]).includes(candidateValue);
                }
                return false;
            case 'BETWEEN':
                if (Array.isArray(ruleValue) && (ruleValue as unknown[]).length === 2) {
                    const num = Number(candidateValue);
                    return num >= Number((ruleValue as unknown[])[0]) && num <= Number((ruleValue as unknown[])[1]);
                }
                return false;
            case 'REGEX':
                try {
                    return new RegExp(String(ruleValue), 'i').test(String(candidateValue));
                } catch {
                    return false;
                }
            default:
                return false;
        }
    }

    return false;
};

/**
 * Access nested object properties via dot path
 * e.g., "experience.years" => obj.experience.years
 */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce<unknown>((prev, curr) => {
        if (prev && typeof prev === 'object' && curr in (prev as Record<string, unknown>)) {
            return (prev as Record<string, unknown>)[curr];
        }
        return null;
    }, obj);
};

/**
 * Serialize a rule tree to a human-readable string
 */
export const ruleToString = (rule: RuleNode, depth = 0): string => {
    const indent = '  '.repeat(depth);

    if (rule.type === 'condition') {
        return `${indent}${rule.field} ${rule.operator} ${JSON.stringify(rule.value)}`;
    }

    if (rule.type === 'group' && rule.children) {
        const childrenStr = rule.children.map((c) => ruleToString(c, depth + 1)).join(`\n${indent}${rule.operator}\n`);
        return `${indent}(\n${childrenStr}\n${indent})`;
    }

    return '';
};

/**
 * Calculate how many conditions a candidate passes
 * Returns a score from 0-100
 */
export const calculateMatchScore = (candidate: Record<string, unknown>, rule: RuleNode): number => {
    const conditions = flattenConditions(rule);
    if (conditions.length === 0) return 100;

    const passed = conditions.filter((c) => evaluateRule(candidate, c)).length;
    return Math.round((passed / conditions.length) * 100);
};

/**
 * Extract all leaf conditions from a rule tree
 */
const flattenConditions = (rule: RuleNode): RuleNode[] => {
    if (rule.type === 'condition') return [rule];
    if (rule.type === 'group' && rule.children) {
        return rule.children.flatMap((c) => flattenConditions(c));
    }
    return [];
};

// ================================================
// Default Rule Templates
// ================================================

export const DEFAULT_ENGINEER_RULE: RuleNode = {
    id: 'root',
    type: 'group',
    operator: 'AND',
    label: 'Senior Engineer Screening',
    children: [
        {
            id: 'c1',
            type: 'condition',
            field: 'experience_years',
            operator: 'GTE',
            value: 3,
            label: 'Minimum 3 years experience',
        },
        {
            id: 'c2',
            type: 'condition',
            field: 'skills',
            operator: 'CONTAINS',
            value: 'React',
            label: 'Must know React',
        },
        {
            id: 'c3',
            type: 'condition',
            field: 'education_level',
            operator: 'GTE',
            value: 'bachelor',
            label: 'Bachelor degree or above',
        },
    ],
};

export const RULE_TEMPLATES: { name: string; description: string; rule: RuleNode }[] = [
    {
        name: 'Senior Engineer',
        description: '3+ years, React/TypeScript, Bachelor+',
        rule: DEFAULT_ENGINEER_RULE,
    },
    {
        name: 'Product Manager',
        description: '5+ years, MBA preferred, growth experience',
        rule: {
            id: 'pm-root',
            type: 'group',
            operator: 'AND',
            children: [
                { id: 'pm1', type: 'condition', field: 'experience_years', operator: 'GTE', value: 5 },
                { id: 'pm2', type: 'condition', field: 'skills', operator: 'CONTAINS', value: 'Product Management' },
            ],
        },
    },
    {
        name: 'Data Scientist',
        description: 'Python + ML + 2yr+',
        rule: {
            id: 'ds-root',
            type: 'group',
            operator: 'AND',
            children: [
                { id: 'ds1', type: 'condition', field: 'experience_years', operator: 'GTE', value: 2 },
                { id: 'ds2', type: 'condition', field: 'skills', operator: 'CONTAINS', value: 'Python' },
                { id: 'ds3', type: 'condition', field: 'skills', operator: 'CONTAINS', value: 'Machine Learning' },
            ],
        },
    },
];
