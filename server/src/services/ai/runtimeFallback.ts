import { extractErrorMessage } from '../../utils/errors';
import { AIGateway } from './gateway';
import { listCompanyApiKeys, type CompanyApiKeyRecord, type ProviderName } from './companyApiKeys';
import { getCodexOAuthCredential } from './codexOAuth';
import { AIModelType, type AIResponse } from '@hireflow/types';

type RuntimePrimaryCredential = {
    id?: string;
    keyName?: string;
    apiKey?: string;
    baseUrl?: string;
};

type RuntimeFallbackCandidate = {
    source: 'api_key' | 'codex_oauth' | 'runtime_primary' | 'env';
    id: string;
    keyName: string;
    apiKey?: string;
    baseUrl?: string;
};

type GenerateWithFallbackParams = {
    companyId: string;
    prompt: string;
    systemInstruction?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    provider?: ProviderName;
    preferredKeyId?: string;
    primary?: RuntimePrimaryCredential;
    allowEnvFallback?: boolean;
    allowProviderKeyFallback?: boolean;
};

type GenerateWithFallbackResult = {
    response: AIResponse;
    provider: ProviderName;
    used: {
        source: RuntimeFallbackCandidate['source'];
        id?: string;
        keyName?: string;
        baseUrl?: string;
    };
};

const PROVIDER_DEFAULT_ORDER: ProviderName[] = ['openai', 'google', 'anthropic', 'deepseek', 'alibaba', 'custom'];
const PROVIDER_DEFAULT_MODEL: Record<ProviderName, AIModelType> = {
    google: AIModelType.GEMINI_FLASH,
    openai: AIModelType.GPT_4O,
    anthropic: AIModelType.CLAUDE_SONNET,
    deepseek: AIModelType.DEEPSEEK_CHAT,
    alibaba: AIModelType.QWEN_PLUS,
    custom: AIModelType.GPT_4O,
};

function detectProviderByModel(modelId: string): ProviderName {
    if (modelId.startsWith('gemini')) return 'google';
    if (modelId.startsWith('gpt')) return 'openai';
    if (modelId.startsWith('codex')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('deepseek')) return 'deepseek';
    if (modelId.startsWith('qwen')) return 'alibaba';
    return 'custom';
}

function keySort(a: CompanyApiKeyRecord, b: CompanyApiKeyRecord): number {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const aLast = a.lastTestedAt?.getTime() || 0;
    const bLast = b.lastTestedAt?.getTime() || 0;
    if (aLast !== bLast) return bLast - aLast;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function mapKeyCandidate(row: CompanyApiKeyRecord): RuntimeFallbackCandidate {
    return {
        source: 'api_key',
        id: row.id,
        keyName: row.keyName,
        apiKey: row.apiKey,
        baseUrl: row.baseUrl || undefined,
    };
}

function uniqueCandidates(candidates: RuntimeFallbackCandidate[]): RuntimeFallbackCandidate[] {
    const seen = new Set<string>();
    const next: RuntimeFallbackCandidate[] = [];
    for (const candidate of candidates) {
        const fingerprint = [
            candidate.source,
            candidate.id || '',
            candidate.keyName || '',
            candidate.baseUrl || '',
            candidate.apiKey || '',
        ].join('::');
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        next.push(candidate);
    }
    return next;
}

function hasEnvCredential(provider: ProviderName): boolean {
    if (provider === 'google') {
        return Boolean((process.env.GEMINI_API_KEY || '').trim());
    }
    if (provider === 'anthropic') {
        return Boolean((process.env.ANTHROPIC_API_KEY || '').trim());
    }
    return Boolean((process.env.OPENAI_API_KEY || '').trim());
}

async function resolveProviderCandidates(params: {
    companyId: string;
    provider: ProviderName;
    model: string;
    preferredKeyId?: string;
    primary?: RuntimePrimaryCredential;
    allowProviderKeyFallback: boolean;
}): Promise<RuntimeFallbackCandidate[]> {
    const candidates: RuntimeFallbackCandidate[] = [];

    if (params.primary?.apiKey) {
        candidates.push({
            source: 'runtime_primary',
            id: params.primary.id || `runtime:${params.provider}`,
            keyName: params.primary.keyName || 'runtime_primary',
            apiKey: params.primary.apiKey,
            baseUrl: params.primary.baseUrl,
        });
    }

    const providerKeys = await listCompanyApiKeys(params.companyId, params.provider);
    const connectedKeys = providerKeys
        .filter((item) => item.status === 'connected')
        .sort(keySort);

    if (params.preferredKeyId) {
        const preferred = connectedKeys.find((item) => item.id === params.preferredKeyId);
        if (preferred) {
            candidates.push(mapKeyCandidate(preferred));
        }
    }

    if (params.allowProviderKeyFallback) {
        for (const row of connectedKeys) {
            candidates.push(mapKeyCandidate(row));
        }
    }

    if (params.provider === 'openai') {
        const codexOAuth = await getCodexOAuthCredential(params.companyId);
        if (codexOAuth?.accessToken) {
            candidates.push({
                source: 'codex_oauth',
                id: codexOAuth.integrationId,
                keyName: 'codex_oauth',
                apiKey: codexOAuth.accessToken,
                baseUrl: codexOAuth.baseUrl || undefined,
            });
        }
    }

    return uniqueCandidates(candidates);
}

export async function generateWithCompanyFallback(
    params: GenerateWithFallbackParams
): Promise<GenerateWithFallbackResult> {
    const provider = params.provider || detectProviderByModel(params.model);
    const allowProviderKeyFallback = params.allowProviderKeyFallback !== false;
    const allowEnvFallback = params.allowEnvFallback !== false;
    const orderedProviders = [provider, ...PROVIDER_DEFAULT_ORDER.filter((item) => item !== provider)];
    const ai = AIGateway.getInstance();
    const errors: string[] = [];

    for (const candidateProvider of orderedProviders) {
        const candidates = await resolveProviderCandidates({
            companyId: params.companyId,
            provider: candidateProvider,
            model: params.model,
            preferredKeyId: candidateProvider === provider ? params.preferredKeyId : undefined,
            primary: candidateProvider === provider ? params.primary : undefined,
            allowProviderKeyFallback,
        });

        if (allowEnvFallback) {
            if (hasEnvCredential(candidateProvider)) {
                candidates.push({
                    source: 'env',
                    id: `env:${candidateProvider}`,
                    keyName: 'env_default',
                });
            }
        }

        for (const candidate of uniqueCandidates(candidates)) {
            try {
                const modelForAttempt = candidateProvider === provider
                    ? params.model
                    : PROVIDER_DEFAULT_MODEL[candidateProvider];
                const response = await ai.generate(
                    params.prompt,
                    params.systemInstruction,
                    {
                        model: modelForAttempt as AIModelType,
                        temperature: params.temperature,
                        maxTokens: params.maxTokens,
                        apiKey: candidate.apiKey,
                        baseUrl: candidate.baseUrl,
                    }
                );
                return {
                    response,
                    provider: candidateProvider,
                    used: {
                        source: candidate.source,
                        id: candidate.id,
                        keyName: candidate.keyName,
                        baseUrl: candidate.baseUrl,
                    },
                };
            } catch (error: unknown) {
                errors.push(`${candidateProvider}/${candidate.keyName}: ${extractErrorMessage(error) || 'unknown error'}`);
            }
        }
    }

    const detail = errors.slice(0, 6).join(' | ');
    throw new Error(detail || 'No available AI key or provider');
}
