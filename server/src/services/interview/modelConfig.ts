import { AIModelType } from '@hireflow/types';
import { prisma } from '../../utils/prisma';
import {
    listCompanyApiKeys,
    resolveCompanyApiKey,
    type ProviderName,
} from '../ai/companyApiKeys';
import { getCodexOAuthCredential } from '../ai/codexOAuth';
import { checkInterviewRuntimeHealth } from '../ai/runtimeReadiness';

export type InterviewAiRuntimeConfig = {
    model: AIModelType;
    temperature: number;
    maxTokens: number;
    provider?: string;
    apiKeyId?: string;
    apiKeyName?: string;
    apiKey?: string;
    baseUrl?: string;
    voiceProvider?: string;
    voiceApiKeyId?: string;
    voiceApiKeyName?: string;
    voiceApiKey?: string;
    voiceBaseUrl?: string;
};

export type InterviewStartReadiness = {
    ready: boolean;
    reason: string | null;
    runtime: InterviewAiRuntimeConfig;
};

export function detectProviderByModel(modelId: string): string {
    if (modelId.startsWith('gemini')) return 'google';
    if (modelId.startsWith('gpt')) return 'openai';
    if (modelId.startsWith('codex')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('deepseek')) return 'deepseek';
    if (modelId.startsWith('qwen')) return 'alibaba';
    return 'custom';
}

export function normalizeInterviewAiModel(modelId?: string | null): AIModelType {
    const supported = new Set(Object.values(AIModelType));
    if (modelId && supported.has(modelId as AIModelType)) {
        return modelId as AIModelType;
    }
    return AIModelType.GPT_4O;
}

const PROVIDER_DEFAULT_MODEL: Record<ProviderName, AIModelType> = {
    google: AIModelType.GEMINI_FLASH,
    openai: AIModelType.GPT_4O,
    anthropic: AIModelType.CLAUDE_SONNET,
    deepseek: AIModelType.DEEPSEEK_CHAT,
    alibaba: AIModelType.QWEN_PLUS,
    custom: AIModelType.GPT_4O,
};

export async function loadInterviewAiRuntimeConfig(companyId: string): Promise<InterviewAiRuntimeConfig> {
    const settings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: {
            defaultModelId: true,
            technicalModelId: true,
            temperature: true,
            maxTokens: true,
        },
    });

    let model = normalizeInterviewAiModel(
        settings?.technicalModelId?.trim() || settings?.defaultModelId?.trim() || AIModelType.GPT_4O
    );
    let provider = detectProviderByModel(model) as ProviderName;

    let modelKey = await resolveCompanyApiKey(companyId, provider, { requireConnected: true });
    let codexOAuthCredential = model.startsWith('codex')
        ? await getCodexOAuthCredential(companyId)
        : null;
    const genericCodexCredential = codexOAuthCredential || await getCodexOAuthCredential(companyId);

    if (!modelKey?.apiKey && !codexOAuthCredential?.accessToken) {
        const connected = await listCompanyApiKeys(companyId);
        const providerPriority: ProviderName[] = ['openai', 'google', 'anthropic', 'deepseek', 'alibaba', 'custom'];
        const fallbackProvider = providerPriority.find((candidateProvider) => (
            connected.some((item) => item.provider === candidateProvider && item.status === 'connected')
        ));

        if (fallbackProvider) {
            provider = fallbackProvider;
            model = PROVIDER_DEFAULT_MODEL[fallbackProvider];
            modelKey = await resolveCompanyApiKey(companyId, provider, { requireConnected: true });
            codexOAuthCredential = model.startsWith('codex')
                ? genericCodexCredential
                : null;
        } else if (genericCodexCredential?.accessToken) {
            provider = 'openai';
            model = AIModelType.CODEX_MINI_LATEST;
            codexOAuthCredential = genericCodexCredential;
        }
    }

    const openAiCompatibleProviders: ProviderName[] = ['openai', 'custom', 'deepseek', 'alibaba'];
    let voiceKey = openAiCompatibleProviders.includes(provider)
        ? modelKey
        : null;
    if (!voiceKey) {
        for (const candidateProvider of openAiCompatibleProviders) {
            voiceKey = await resolveCompanyApiKey(companyId, candidateProvider, { requireConnected: true });
            if (voiceKey) break;
        }
    }

    return {
        model,
        temperature: settings?.temperature ?? 0.7,
        maxTokens: settings?.maxTokens ?? 2048,
        provider,
        apiKeyId: modelKey?.id,
        apiKeyName: modelKey?.keyName || (codexOAuthCredential ? 'codex_oauth' : undefined),
        apiKey: modelKey?.apiKey || codexOAuthCredential?.accessToken,
        baseUrl: modelKey?.baseUrl || codexOAuthCredential?.baseUrl || undefined,
        voiceProvider: voiceKey?.provider,
        voiceApiKeyId: voiceKey?.id,
        voiceApiKeyName: voiceKey?.keyName,
        voiceApiKey: voiceKey?.apiKey,
        voiceBaseUrl: voiceKey?.baseUrl || undefined,
    };
}

export async function resolveInterviewStartReadiness(companyId: string): Promise<InterviewStartReadiness> {
    const runtime = await loadInterviewAiRuntimeConfig(companyId);
    const hasModelCredential = Boolean(String(runtime.apiKey || '').trim());
    if (!hasModelCredential) {
        return {
            ready: false,
            reason: 'AI interview is not configured. Please connect at least one AI API key in Settings > AI.',
            runtime,
        };
    }

    const health = await checkInterviewRuntimeHealth(companyId, runtime);
    if (!health.ready) {
        return {
            ready: false,
            reason: health.reason || 'Connected AI key is temporarily unavailable.',
            runtime,
        };
    }

    return {
        ready: true,
        reason: null,
        runtime,
    };
}
