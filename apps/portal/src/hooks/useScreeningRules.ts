import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

export interface ScreeningRule {
    id: string;
    name: string;
    description?: string;
    jobId?: string;
    conditions: any; // RuleNode
    isTemplate: boolean;
}

export interface ScreeningTemplate {
    name: string;
    description: string;
    rule: any;
}

export interface ScreeningEvaluationResult {
    pass: boolean;
    score: number;
}

const unwrap = <T,>(response: any): T => {
    return (response?.data?.data ?? response?.data) as T;
};

export function useScreeningRules(jobId?: string) {
    const [rules, setRules] = useState<ScreeningRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<ScreeningTemplate[]>([]);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch company rules
            const rulesRes = await api.get('/screening/rules', { params: { jobId } });
            setRules(unwrap<ScreeningRule[]>(rulesRes) || []);

            // Fetch templates
            const templatesRes = await api.get('/screening/templates');
            setTemplates(unwrap<ScreeningTemplate[]>(templatesRes) || []);
        } catch (e) {
            console.error('Failed to fetch screening rules', e);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    const saveRule = async (rule: Partial<ScreeningRule>) => {
        try {
            const payload = {
                name: rule.name,
                description: rule.description,
                jobId: rule.jobId,
                conditions: rule.conditions,
            };
            if (rule.id && !rule.id.startsWith('temp-') && !rule.id.startsWith('new-')) {
                const res = await api.put(`/screening/rules/${rule.id}`, payload);
                return unwrap<ScreeningRule>(res);
            } else {
                const res = await api.post('/screening/rules', payload);
                return unwrap<ScreeningRule>(res);
            }
        } catch (e) {
            console.error('Failed to save rule', e);
            throw e;
        } finally {
            fetchRules();
        }
    };

    const deleteRule = async (id: string) => {
        try {
            await api.delete(`/screening/rules/${id}`);
            fetchRules();
        } catch (e) {
            console.error('Failed to delete rule', e);
        }
    };

    // AI Suggestion
    const generateRule = async (jobDescription: string) => {
        try {
            const res = await api.post('/screening/ai-suggest', { jobDescription });
            return unwrap<any>(res);
        } catch (e) {
            console.error('AI generation failed', e);
            return null;
        }
    };

    const evaluateRule = async (ruleId: string, candidateData: Record<string, unknown>) => {
        const res = await api.post('/screening/evaluate', { ruleId, candidateData });
        return unwrap<ScreeningEvaluationResult>(res);
    };

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    return { rules, templates, loading, saveRule, deleteRule, generateRule, evaluateRule, fetchRules };
}
