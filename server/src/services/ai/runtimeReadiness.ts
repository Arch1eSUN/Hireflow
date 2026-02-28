import type { InterviewAiRuntimeConfig } from '../interview/modelConfig';

type RuntimeHealthResult = {
    ready: boolean;
    reason: string | null;
    checkedAt: string;
    source: 'probe' | 'cache';
};

type CachedHealth = {
    value: RuntimeHealthResult;
    expiresAt: number;
};

const healthCache = new Map<string, CachedHealth>();
const inflightChecks = new Map<string, Promise<RuntimeHealthResult>>();

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = Number.parseInt(process.env[name] || '', 10);
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
}

const SUCCESS_CACHE_MS = readIntEnv('XIAOFAN_KEY_HEALTH_CACHE_MS', 30000, 5000, 5 * 60_000);
const FAILURE_CACHE_MS = readIntEnv('XIAOFAN_KEY_HEALTH_FAILURE_CACHE_MS', 10000, 3000, 60_000);
const PROBE_TIMEOUT_MS = readIntEnv('XIAOFAN_KEY_HEALTH_TIMEOUT_MS', 7000, 2000, 20_000);

function normalizeProvider(config: InterviewAiRuntimeConfig): string {
    const explicit = String(config.provider || '').trim().toLowerCase();
    if (explicit) return explicit;
    const model = String(config.model || '').trim().toLowerCase();
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('deepseek')) return 'deepseek';
    if (model.startsWith('qwen')) return 'alibaba';
    if (model.startsWith('codex')) return 'openai';
    if (model.startsWith('gpt')) return 'openai';
    return 'custom';
}

function resolveProbeBaseUrl(provider: string, baseUrl?: string): string {
    if (baseUrl && baseUrl.trim()) return baseUrl.trim().replace(/\/$/, '');
    if (provider === 'openai' || provider === 'custom') return 'https://api.openai.com/v1';
    if (provider === 'deepseek') return 'https://api.deepseek.com/v1';
    if (provider === 'alibaba') return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    return '';
}

function getCacheKey(companyId: string, config: InterviewAiRuntimeConfig): string {
    const provider = normalizeProvider(config);
    const credentialRef = String(
        config.apiKeyId
        || config.apiKeyName
        || `${String(config.apiKey || '').slice(0, 12)}:${String(config.apiKey || '').length}`
    );
    const baseUrl = String(config.baseUrl || '');
    return [companyId, provider, credentialRef, baseUrl].join('::');
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = PROBE_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function probeRuntimeCredential(config: InterviewAiRuntimeConfig): Promise<{ ok: boolean; reason: string | null }> {
    const apiKey = String(config.apiKey || '').trim();
    if (!apiKey) {
        return {
            ok: false,
            reason: 'AI interview is not configured. Please connect at least one AI API key in Settings > AI.',
        };
    }

    const provider = normalizeProvider(config);

    try {
        if (provider === 'google') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
            const response = await fetchWithTimeout(url, { method: 'GET' });
            if (!response.ok) {
                return {
                    ok: false,
                    reason: `Connected Google key is unavailable now (${response.status}).`,
                };
            }
            return { ok: true, reason: null };
        }

        if (provider === 'anthropic') {
            const response = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
            if (!response.ok) {
                return {
                    ok: false,
                    reason: `Connected Anthropic key is unavailable now (${response.status}).`,
                };
            }
            return { ok: true, reason: null };
        }

        const baseUrl = resolveProbeBaseUrl(provider, config.baseUrl);
        if (!baseUrl) {
            return {
                ok: false,
                reason: 'Connected AI provider is missing base URL.',
            };
        }

        const response = await fetchWithTimeout(`${baseUrl}/models`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            return {
                ok: false,
                reason: `Connected ${provider} key is unavailable now (${response.status}).`,
            };
        }

        return { ok: true, reason: null };
    } catch (error: unknown) {
        return {
            ok: false,
            reason: (error instanceof Error && error.name === 'AbortError')
                ? 'AI key health check timed out.'
                : 'AI key health check failed. Please retry.',
        };
    }
}

export async function checkInterviewRuntimeHealth(
    companyId: string,
    config: InterviewAiRuntimeConfig
): Promise<RuntimeHealthResult> {
    const cacheKey = getCacheKey(companyId, config);
    const now = Date.now();
    const cached = healthCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return {
            ...cached.value,
            source: 'cache',
        };
    }

    const existingInflight = inflightChecks.get(cacheKey);
    if (existingInflight) {
        return existingInflight;
    }

    const pending = (async (): Promise<RuntimeHealthResult> => {
        const probe = await probeRuntimeCredential(config);
        const value: RuntimeHealthResult = {
            ready: probe.ok,
            reason: probe.reason,
            checkedAt: new Date().toISOString(),
            source: 'probe',
        };
        healthCache.set(cacheKey, {
            value,
            expiresAt: now + (probe.ok ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS),
        });
        return value;
    })();

    inflightChecks.set(cacheKey, pending);
    try {
        return await pending;
    } finally {
        inflightChecks.delete(cacheKey);
    }
}

