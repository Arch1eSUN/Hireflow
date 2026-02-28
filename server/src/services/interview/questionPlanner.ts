import { logger } from '../../utils/logger';
import { generateWithCompanyFallback } from '../ai/runtimeFallback';
import type { ProviderName } from '../ai/companyApiKeys';
import type { InterviewAiRuntimeConfig } from './modelConfig';
import { parseLooseJson } from './xiaofan';

export type XiaofanQuestionPlan = {
    source: 'ai' | 'fallback';
    roleSummary: string;
    focusAreas: string[];
    coreQuestions: string[];
    followups: string[];
    model?: string;
};

type BuildQuestionPlanParams = {
    companyId: string;
    candidateName: string;
    jobTitle: string;
    jobDescription?: string | null;
    jobRequirements?: string[] | null;
    interviewType?: string | null;
    runtimeConfig: InterviewAiRuntimeConfig;
};

function sanitizeList(input: unknown, max = 6): string[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0)
        .slice(0, max);
}

function buildFallbackPlan(params: BuildQuestionPlanParams): XiaofanQuestionPlan {
    const requirements = (params.jobRequirements || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6);
    const fallbackQuestion = `请你先简要介绍最近一段与你应聘“${params.jobTitle}”最相关的工作经历。`;
    const focusAreas = requirements.length > 0
        ? requirements.map((item) => `围绕“${item}”追问实际案例`)
        : ['最近代表性项目', '岗位核心能力匹配', '协作与沟通', '问题拆解与执行'];

    return {
        source: 'fallback',
        roleSummary: `岗位：${params.jobTitle}，候选人：${params.candidateName}。`,
        focusAreas,
        coreQuestions: [
            fallbackQuestion,
            '在这个岗位最关键的一项能力上，你最有说服力的实战案例是什么？',
            '遇到跨团队协作冲突时，你通常如何推进结果达成？',
            '如果你入职后 90 天，需要优先交付什么结果，你会怎么拆解计划？',
        ],
        followups: [
            '可以具体到你的角色、动作和可量化结果吗？',
            '如果重来一次，你会保留什么、调整什么？',
            '你如何验证这个方案在真实业务中是有效的？',
        ],
    };
}

function normalizePlan(raw: unknown, fallback: XiaofanQuestionPlan, model?: string): XiaofanQuestionPlan {
    if (!raw || typeof raw !== 'object') {
        return fallback;
    }

    const data = raw as Record<string, unknown>;
    const roleSummary = String(data.roleSummary || '').trim() || fallback.roleSummary;
    const focusAreas = sanitizeList(data.focusAreas, 8);
    const coreQuestions = sanitizeList(data.coreQuestions, 8);
    const followups = sanitizeList(data.followups, 8);

    if (coreQuestions.length === 0) {
        return fallback;
    }

    return {
        source: 'ai',
        roleSummary,
        focusAreas: focusAreas.length > 0 ? focusAreas : fallback.focusAreas,
        coreQuestions,
        followups: followups.length > 0 ? followups : fallback.followups,
        model,
    };
}

export async function buildXiaofanQuestionPlan(params: BuildQuestionPlanParams): Promise<XiaofanQuestionPlan> {
    const fallback = buildFallbackPlan(params);
    const description = String(params.jobDescription || '').trim().slice(0, 1800);
    const requirements = (params.jobRequirements || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 12);

    const systemPrompt = [
        '你是招聘面试策略助手。',
        '任务：根据岗位信息生成“小梵语音面试”的问题计划。',
        '要求：只输出 JSON，不要输出 markdown，不要输出解释。',
        'JSON 结构必须包含：',
        '{',
        '  "roleSummary": string,',
        '  "focusAreas": string[],',
        '  "coreQuestions": string[],',
        '  "followups": string[]',
        '}',
        '规则：coreQuestions 提供 4-6 个，先暖场再深入；问题必须可口语化直接发问。',
    ].join('\n');

    const userPrompt = [
        `候选人：${params.candidateName}`,
        `岗位：${params.jobTitle}`,
        `面试类型：${params.interviewType || 'ai_interview'}`,
        description ? `岗位描述：${description}` : '岗位描述：无',
        requirements.length > 0 ? `岗位要求：${requirements.join('；')}` : '岗位要求：无',
    ].join('\n');

    try {
        const response = (await generateWithCompanyFallback({
            companyId: params.companyId,
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: params.runtimeConfig.model,
            temperature: params.runtimeConfig.temperature,
            maxTokens: params.runtimeConfig.maxTokens,
            provider: (params.runtimeConfig.provider || undefined) as ProviderName | undefined,
            preferredKeyId: params.runtimeConfig.apiKeyId,
            primary: {
                id: params.runtimeConfig.apiKeyId,
                keyName: params.runtimeConfig.apiKeyName,
                apiKey: params.runtimeConfig.apiKey,
                baseUrl: params.runtimeConfig.baseUrl,
            },
        })).response;
        const parsed = parseLooseJson(response.text);
        return normalizePlan(parsed, fallback, response.model);
    } catch (error) {
        logger.warn({ err: error }, '[XiaoFan] question plan generation failed, fallback plan applied');
        return fallback;
    }
}
