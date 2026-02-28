/**
 * Interview prompt builder — 负责构建面试 AI 的系统提示、流程指令和回退文本。
 * 从 orchestrator.ts 提取，降低主编排器复杂度。
 */
import {
    buildXiaofanConversationSystemPrompt,
} from './xiaofan';
import type { XiaofanQuestionPlan } from './questionPlanner';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConversationRole = 'user' | 'assistant' | 'system';

export type ConversationMessage = {
    role: ConversationRole;
    content: string;
    timestamp: number;
};

type InterviewContext = {
    id: string;
    type: string;
    job: {
        title: string;
        department: string;
        type: string;
        descriptionJd: string;
        requirements: string[];
        companyId: string;
    };
    candidate: {
        name: string;
    };
};

// ─── System prompt ──────────────────────────────────────────────────────────

export function buildSystemPrompt(
    context: InterviewContext | null,
    questionPlan: XiaofanQuestionPlan | null,
): string {
    const candidateName = context?.candidate?.name || 'Candidate';
    const jobTitle = context?.job?.title || 'General Position';
    const jobDescription = context?.job?.descriptionJd || '';
    return buildXiaofanConversationSystemPrompt({
        candidateName,
        jobTitle,
        jobDescription,
        jobRequirements: context?.job?.requirements || [],
        interviewType: context?.type || 'ai_interview',
        questionPlan,
    });
}

// ─── User prompt with history ───────────────────────────────────────────────

export function buildPromptWithHistory(history: ConversationMessage[]): string {
    const transcript = history
        .slice(-24)
        .map((item) => `${item.role}: ${item.content}`)
        .join('\n');
    return `${transcript}\nassistant:`;
}

// ─── Turn flow directive ────────────────────────────────────────────────────

export function buildTurnFlowDirective(
    userTurnCount: number,
    minUserTurnsBeforeWrap: number,
    questionPlan: XiaofanQuestionPlan | null,
): string {
    const coreQuestions = questionPlan?.coreQuestions || [];
    const followups = questionPlan?.followups || [];
    const currentCoreIndex = coreQuestions.length > 0
        ? Math.min(coreQuestions.length - 1, Math.max(0, userTurnCount - 1))
        : -1;
    const currentCoreQuestion = currentCoreIndex >= 0 ? coreQuestions[currentCoreIndex] : '';
    const nextCoreQuestion = currentCoreIndex >= 0 && currentCoreIndex + 1 < coreQuestions.length
        ? coreQuestions[currentCoreIndex + 1]
        : '';
    const followupHint = followups.length > 0 ? followups[userTurnCount % followups.length] : '';

    return [
        '面试回合控制（必须遵守）：',
        `候选人已完成回答轮次：${userTurnCount}。`,
        userTurnCount < minUserTurnsBeforeWrap
            ? `当前不允许结束面试或给最终总结，至少完成 ${minUserTurnsBeforeWrap} 轮候选人回答后才能收束。`
            : '若信息充分可开始收束，但仍需要保持一个明确单问题推进。',
        currentCoreQuestion ? `当前主问题：${currentCoreQuestion}` : '',
        nextCoreQuestion ? `下一题候选方向：${nextCoreQuestion}` : '',
        followupHint ? `优先追问句式：${followupHint}` : '',
        '输出要求：1-3 句，先肯定候选人关键信息，再提一个单一明确问题。',
    ].filter(Boolean).join('\n');
}

// ─── Post-process assistant text ────────────────────────────────────────────

export function postProcessAssistantText(
    aiText: string,
    lastUserText: string,
    userTurnCount: number,
    minUserTurnsBeforeWrap: number,
    questionPlan: XiaofanQuestionPlan | null,
): string {
    const normalized = String(aiText || '').trim();
    if (!normalized) {
        return buildContinuationQuestion(lastUserText, userTurnCount, questionPlan);
    }

    const looksLikeWrapUp = /(到这里|今天.*面试|面试.*结束|感谢.*参与|感谢.*时间|祝你|后续通知|that's all|we('?| wi)ll be in touch|interview is over)/i.test(normalized);
    if (userTurnCount < minUserTurnsBeforeWrap && looksLikeWrapUp) {
        return buildContinuationQuestion(lastUserText, userTurnCount, questionPlan);
    }

    return normalized;
}

// ─── Continuation question ──────────────────────────────────────────────────

export function buildContinuationQuestion(
    lastUserText: string,
    userTurnCount: number,
    questionPlan: XiaofanQuestionPlan | null,
): string {
    const coreQuestions = questionPlan?.coreQuestions || [];
    const followups = questionPlan?.followups || [];
    const nextCore = coreQuestions.length > 0
        ? coreQuestions[Math.min(coreQuestions.length - 1, Math.max(0, userTurnCount))]
        : '';
    const followup = followups.length > 0 ? followups[userTurnCount % followups.length] : '';
    const baseQuestion = nextCore || followup;
    if (baseQuestion) {
        return `谢谢你的回答。${baseQuestion}`;
    }
    return generateFallbackText(lastUserText, userTurnCount);
}

// ─── Fallback text ──────────────────────────────────────────────────────────

const FALLBACK_QUESTIONS: Array<{ pattern: RegExp; question: string }> = [
    {
        pattern: /(项目|project|上线|发布|功能|需求)/i,
        question: '这个经历里你做过的最关键决策是什么？可以说说当时的判断依据和结果吗？',
    },
    {
        pattern: /(数据|指标|增长|转化|留存|A\/B|ab)/i,
        question: '你提到的数据结果很关键，能具体说一下核心指标变化和你验证有效性的过程吗？',
    },
    {
        pattern: /(团队|协作|沟通|跨部门|冲突|同事)/i,
        question: '在跨团队协作里你是怎么推动共识并保证落地节奏的？可以举一个具体场景吗？',
    },
    {
        pattern: /(难点|挑战|困难|风险|问题|bug|故障)/i,
        question: '面对这个挑战时，你最先拆解的优先级是什么，后来复盘你会调整哪一步？',
    },
    {
        pattern: /(用户|客户|体验|访谈|反馈)/i,
        question: '你是如何把用户反馈转成可执行方案的？在优先级取舍上你怎么做决定？',
    },
    {
        pattern: /(技术|架构|性能|系统|服务|接口|代码)/i,
        question: '在技术方案选择上，你如何在实现成本、稳定性和迭代速度之间做平衡？',
    },
];

const GENERIC_QUESTIONS = [
    '谢谢你的分享。你刚提到的这段经历里，哪一次决策最能体现你的判断力？',
    '如果让你复盘这段经历，你会优先优化哪一部分，为什么？',
    '在和团队协作时，你通常如何推动分歧走向共识？',
    '面对信息不完整的任务，你会如何拆解并推进到可执行状态？',
    '最后一个问题：下一阶段你最希望提升的能力是什么，你打算怎么做？',
];

export function generateFallbackText(lastUserText?: string, userTurnCount = 0): string {
    const normalizedText = String(lastUserText || '').trim();
    const leadingSentence = normalizedText
        .split(/[。！？!?]/)[0]
        .trim()
        .slice(0, 38);
    const acknowledgement = leadingSentence.length > 0
        ? `谢谢，你提到"${leadingSentence}"。`
        : '谢谢你的回答。';

    const matched = FALLBACK_QUESTIONS.find((item) => item.pattern.test(normalizedText));
    if (matched) {
        return `${acknowledgement}${matched.question}`;
    }

    const index = Math.max(0, Math.min(GENERIC_QUESTIONS.length - 1, userTurnCount - 1));
    return `${acknowledgement}${GENERIC_QUESTIONS[index]}`;
}
