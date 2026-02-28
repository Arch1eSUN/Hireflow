/**
 * Settings route helpers — shared types, schemas, and utility functions.
 *
 * Every route sub-module (`core`, `policy`, `keys`, `integrations`) imports
 * from this file rather than duplicating definitions.
 */
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import {
    decryptIntegrationConfigSecrets,
    encryptIntegrationConfigSecrets,
} from '../../services/integrations/configCrypto';
import { env } from '../../config/env';
import { extractErrorMessage } from '../../utils/errors';
import { type ProviderName } from '../../services/ai/companyApiKeys';
import {
    evidenceChainPolicySchema,
} from '../../services/evidence/policy';

// ─── Provider schemas & defaults ────────────────────────────────────────────

export const providerSchema = z.enum(['google', 'openai', 'anthropic', 'deepseek', 'alibaba', 'custom']);

export const providerDefaultModels: Record<string, string[]> = {
    google: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    alibaba: ['qwen-plus', 'qwen-max'],
    custom: [],
};

export const providerDefaultBaseUrl: Record<string, string | null> = {
    google: null,
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com/v1',
    alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    custom: null,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type VerifyResult = {
    ok: boolean;
    message?: string;
    models: string[];
    normalizedBaseUrl?: string;
};

export type IntegrationConfig = Record<string, unknown>;

export type IntegrationType = z.infer<typeof integrationTypeSchema>;

export type IntegrationValidationResult = {
    ok: boolean;
    missingFields: string[];
    warnings: string[];
    message: string;
};

export type CodexOauthPendingPayload = {
    companyId: string;
    userId: string;
    config: IntegrationConfig;
    createdAt: number;
    expiresAt: number;
};

export type CodexOauthPendingState = CodexOauthPendingPayload & {
    persistedLogId?: string;
};

export type PersistedCodexPendingState = {
    logId: string;
    payload: CodexOauthPendingPayload;
};

export type ApiKeyInput = z.infer<typeof apiKeyInputSchema>;

// ─── Schemas ────────────────────────────────────────────────────────────────

export const integrationTypeSchema = z.enum([
    'google_calendar',
    'outlook',
    'slack',
    'greenhouse',
    'lever',
    'codex_oauth',
    'generic_oauth',
]);

export const monitorPolicyApplySchema = z.object({
    mode: z.enum(['missing_only', 'overwrite']).default('missing_only'),
    statuses: z.array(z.enum(['upcoming', 'active', 'completed', 'cancelled'])).default(['upcoming', 'active']),
    limit: z.coerce.number().int().min(1).max(1000).default(200),
    dryRun: z.boolean().default(false),
});

export const evidenceChainPolicyMutationSchema = evidenceChainPolicySchema.extend({
    reason: z.string().trim().min(2).max(240).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const evidenceChainPolicyHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const evidenceChainPolicyRollbackSchema = z.object({
    versionId: z.string().min(8),
    reason: z.string().trim().min(2).max(240).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const apiKeyInputSchema = z.object({
    provider: providerSchema,
    keyName: z.string().trim().min(1).max(60).optional(),
    apiKey: z.string().trim().min(10),
    baseUrl: z.string().trim().url().optional(),
    allowUnverified: z.boolean().optional(),
    setActive: z.boolean().optional(),
});

export const codexOauthStartSchema = z.object({
    config: z.record(z.unknown()).default({}),
});

export const codexOauthCallbackSchema = z.object({
    state: z.string().trim().min(8).max(240),
    code: z.string().trim().min(2).max(2000).optional(),
    error: z.string().trim().max(120).optional(),
    errorDescription: z.string().trim().max(500).optional(),
});

// ─── Constants ──────────────────────────────────────────────────────────────

export const MASKED_SECRET = '********';
export const SENSITIVE_CONFIG_KEY = /(key|token|secret|password|signature|credential|webhook)/i;
export const CODEX_OAUTH_PENDING_ACTION = 'integration.codex_oauth.pending_state';
export const CODEX_OAUTH_PENDING_TARGET_TYPE = 'oauth_state';
export const CODEX_OAUTH_PENDING_TTL_MS = 15 * 60 * 1000;

export const codexOauthPendingStore = new Map<string, CodexOauthPendingState>();

// ─── API Key helpers ────────────────────────────────────────────────────────

export function normalizeKeyName(rawName?: string): string {
    const trimmed = (rawName || '').trim();
    return trimmed.length > 0 ? trimmed : 'default';
}

export function toApiKeyResponseItem(item: {
    id: string;
    provider: string;
    keyName: string;
    isActive: boolean;
    status: string;
    lastTestedAt: Date | null;
    baseUrl: string | null;
    cachedModels: unknown;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        ...item,
        modelCount: Array.isArray(item.cachedModels) ? item.cachedModels.length : 0,
    };
}

export async function activateProviderKey(params: {
    companyId: string;
    provider: ProviderName;
    keyId: string;
}, tx: Prisma.TransactionClient = prisma) {
    await tx.apiKeyStore.updateMany({
        where: {
            companyId: params.companyId,
            provider: params.provider,
        },
        data: {
            isActive: false,
        },
    });

    return tx.apiKeyStore.update({
        where: { id: params.keyId },
        data: { isActive: true },
        select: {
            id: true,
            provider: true,
            keyName: true,
            isActive: true,
            status: true,
            lastTestedAt: true,
            baseUrl: true,
            cachedModels: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

export async function ensureProviderHasActiveKey(companyId: string, provider: ProviderName) {
    const existingActive = await prisma.apiKeyStore.findFirst({
        where: {
            companyId,
            provider,
            isActive: true,
        },
        select: { id: true },
    });
    if (existingActive) return;

    const fallback = await prisma.apiKeyStore.findFirst({
        where: {
            companyId,
            provider,
        },
        orderBy: [
            { status: 'asc' },
            { lastTestedAt: 'desc' },
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
        ],
        select: { id: true },
    });
    if (!fallback) return;

    await prisma.apiKeyStore.update({
        where: { id: fallback.id },
        data: { isActive: true },
    });
}

export function normalizeBaseUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    return url.trim().replace(/\/$/, '');
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 9000): Promise<Response> {
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

export function uniqueModels(models: string[], provider: string): string[] {
    const seed = providerDefaultModels[provider] || [];
    return Array.from(new Set([...models.filter(Boolean), ...seed]));
}

// ─── Integration config helpers ─────────────────────────────────────────────

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function redactIntegrationConfig(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => redactIntegrationConfig(item));
    }

    if (!isRecord(value)) {
        return value;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(value)) {
        if (typeof rawValue === 'string' && rawValue.length > 0 && SENSITIVE_CONFIG_KEY.test(key)) {
            redacted[key] = MASKED_SECRET;
            continue;
        }
        redacted[key] = redactIntegrationConfig(rawValue);
    }
    return redacted;
}

export function mergeMaskedSecrets(nextValue: unknown, previousValue: unknown): unknown {
    if (typeof nextValue === 'string' && nextValue === MASKED_SECRET && typeof previousValue === 'string') {
        return previousValue;
    }

    if (Array.isArray(nextValue)) {
        const prevArray = Array.isArray(previousValue) ? previousValue : [];
        return nextValue.map((item, index) => mergeMaskedSecrets(item, prevArray[index]));
    }

    if (!isRecord(nextValue)) {
        return nextValue;
    }

    const prevObject = isRecord(previousValue) ? previousValue : {};
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(nextValue)) {
        merged[key] = mergeMaskedSecrets(value, prevObject[key]);
    }
    return merged;
}

export function readStringField(config: IntegrationConfig, key: string): string | undefined {
    const value = decryptIntegrationConfigSecrets(config[key]);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function parseModelsFromConfig(config: IntegrationConfig): string[] {
    const raw = config.models;
    if (Array.isArray(raw)) {
        return raw
            .map((item) => String(item || '').trim())
            .filter((item) => item.length > 0);
    }
    if (typeof raw === 'string') {
        return raw
            .split(/[\s,;\n]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    return [];
}

// ─── Codex OAuth pending state ──────────────────────────────────────────────

export function cleanupExpiredCodexOauthStates(now = Date.now()) {
    for (const [state, item] of codexOauthPendingStore.entries()) {
        if (item.expiresAt <= now) {
            codexOauthPendingStore.delete(state);
        }
    }
}

export async function persistCodexOauthPendingState(state: string, payload: CodexOauthPendingPayload): Promise<string> {
    const encryptedConfig = encryptIntegrationConfigSecrets(payload.config) as Prisma.InputJsonValue;
    const created = await prisma.auditLog.create({
        data: {
            companyId: payload.companyId,
            userId: payload.userId,
            action: CODEX_OAUTH_PENDING_ACTION,
            targetType: CODEX_OAUTH_PENDING_TARGET_TYPE,
            targetId: state,
            metadata: {
                state,
                userId: payload.userId,
                createdAt: new Date(payload.createdAt).toISOString(),
                expiresAt: new Date(payload.expiresAt).toISOString(),
                consumed: false,
                config: encryptedConfig,
            } satisfies Prisma.InputJsonObject,
        },
        select: { id: true },
    });
    return created.id;
}

export async function loadCodexOauthPendingState(
    companyId: string,
    state: string
): Promise<PersistedCodexPendingState | null> {
    const log = await prisma.auditLog.findFirst({
        where: {
            companyId,
            action: CODEX_OAUTH_PENDING_ACTION,
            targetType: CODEX_OAUTH_PENDING_TARGET_TYPE,
            targetId: state,
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            userId: true,
            metadata: true,
        },
    });

    if (!log) return null;
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    if (metadata.consumed === true) return null;

    const expiresAtRaw = typeof metadata.expiresAt === 'string' ? metadata.expiresAt : '';
    const expiresAtMs = expiresAtRaw ? new Date(expiresAtRaw).getTime() : NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        return null;
    }

    const userId = String(metadata.userId || log.userId || '').trim();
    if (!userId) return null;

    const createdAtRaw = typeof metadata.createdAt === 'string' ? metadata.createdAt : '';
    const createdAtMs = createdAtRaw ? new Date(createdAtRaw).getTime() : Date.now();
    const encryptedConfig = (metadata.config || {}) as IntegrationConfig;
    const config = decryptIntegrationConfigSecrets(encryptedConfig) as IntegrationConfig;

    return {
        logId: log.id,
        payload: {
            companyId,
            userId,
            config,
            createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
            expiresAt: expiresAtMs,
        },
    };
}

export async function markCodexOauthPendingStateConsumed(logId: string): Promise<void> {
    const existing = await prisma.auditLog.findUnique({
        where: { id: logId },
        select: { metadata: true },
    });
    if (!existing) return;

    const metadata = (existing.metadata || {}) as Record<string, unknown>;
    await prisma.auditLog.update({
        where: { id: logId },
        data: {
            metadata: {
                ...metadata,
                consumed: true,
                consumedAt: new Date().toISOString(),
            } satisfies Prisma.InputJsonObject,
        },
    });
}

export async function consumeCodexOauthPendingState(
    state: string,
    companyId: string,
    pendingLogId?: string | null
): Promise<void> {
    codexOauthPendingStore.delete(state);
    let logId = typeof pendingLogId === 'string' ? pendingLogId.trim() : '';
    if (!logId) {
        const persisted = await loadCodexOauthPendingState(companyId, state);
        logId = persisted?.logId || '';
    }
    if (!logId) return;
    await markCodexOauthPendingStateConsumed(logId);
}

// ─── Portal / OAuth helpers ─────────────────────────────────────────────────

export function resolvePortalOrigin(request: any): string {
    const requestOrigin = typeof request?.headers?.origin === 'string' ? request.headers.origin.trim() : '';
    if (requestOrigin && /^https?:\/\/[^\s/]+$/i.test(requestOrigin)) {
        return requestOrigin;
    }

    return env.APP_URL;
}

export function toUrlEncodedBody(fields: Record<string, string | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed) continue;
        params.set(key, trimmed);
    }
    return params;
}

export function extractIntegrationErrorMessage(body: string): string {
    if (!body) return 'Unknown OAuth provider error';
    try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const candidate = parsed.error_description || parsed.error || parsed.message;
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    } catch {
        // no-op
    }
    return body.slice(0, 320);
}

// ─── Integration validation & probing ───────────────────────────────────────

export function validateIntegrationConfig(type: IntegrationType, config: IntegrationConfig): IntegrationValidationResult {
    const missingFields: string[] = [];
    const warnings: string[] = [];

    if (type === 'slack') {
        const webhookUrl = readStringField(config, 'webhookUrl');
        const botToken = readStringField(config, 'botToken') || readStringField(config, 'token');
        if (!webhookUrl && !botToken) {
            missingFields.push('webhookUrl or botToken');
        }
        if (webhookUrl && !/^https:\/\//i.test(webhookUrl)) {
            warnings.push('webhookUrl should start with https://');
        }
        if (!readStringField(config, 'channel')) {
            warnings.push('channel is not set; notifications will use provider defaults.');
        }
    } else if (type === 'google_calendar') {
        const hasClientPair = Boolean(readStringField(config, 'clientId') && readStringField(config, 'clientSecret'));
        const hasAccessToken = Boolean(readStringField(config, 'accessToken'));
        if (!hasClientPair && !hasAccessToken) {
            missingFields.push('clientId + clientSecret or accessToken');
        }
        if (!readStringField(config, 'calendarId')) {
            warnings.push('calendarId is not set; default calendar will be used.');
        }
    } else if (type === 'outlook') {
        const hasClientPair = Boolean(readStringField(config, 'clientId') && readStringField(config, 'clientSecret'));
        const hasAccessToken = Boolean(readStringField(config, 'accessToken'));
        if (!hasClientPair && !hasAccessToken) {
            missingFields.push('clientId + clientSecret or accessToken');
        }
        if (!readStringField(config, 'tenantId')) {
            warnings.push('tenantId is not set; multi-tenant defaults may apply.');
        }
    } else if (type === 'greenhouse') {
        if (!readStringField(config, 'apiKey')) {
            missingFields.push('apiKey');
        }
        const endpoint = readStringField(config, 'endpoint');
        if (endpoint && !/^https:\/\//i.test(endpoint)) {
            warnings.push('endpoint should start with https://');
        }
    } else if (type === 'lever') {
        if (!readStringField(config, 'apiKey') && !readStringField(config, 'accessToken')) {
            missingFields.push('apiKey or accessToken');
        }
        const endpoint = readStringField(config, 'endpoint');
        if (endpoint && !/^https:\/\//i.test(endpoint)) {
            warnings.push('endpoint should start with https://');
        }
    } else if (type === 'codex_oauth') {
        const hasAccessToken = Boolean(readStringField(config, 'accessToken'));
        const hasOAuthClient = Boolean(
            readStringField(config, 'clientId')
            && readStringField(config, 'clientSecret')
            && readStringField(config, 'authorizeUrl')
            && readStringField(config, 'tokenUrl')
        );
        if (!hasAccessToken && !hasOAuthClient) {
            missingFields.push('accessToken or clientId + clientSecret + authorizeUrl + tokenUrl');
        }
        const authorizeUrl = readStringField(config, 'authorizeUrl');
        const tokenUrl = readStringField(config, 'tokenUrl');
        if (authorizeUrl && !/^https:\/\//i.test(authorizeUrl)) {
            warnings.push('authorizeUrl should start with https://');
        }
        if (tokenUrl && !/^https:\/\//i.test(tokenUrl)) {
            warnings.push('tokenUrl should start with https://');
        }
        if (!readStringField(config, 'redirectUri')) {
            warnings.push('redirectUri is not set; OAuth callback may fail in production.');
        }
    } else if (type === 'generic_oauth') {
        const hasAccessToken = Boolean(readStringField(config, 'accessToken'));
        const hasOAuthClient = Boolean(
            readStringField(config, 'clientId')
            && readStringField(config, 'clientSecret')
            && readStringField(config, 'authorizeUrl')
            && readStringField(config, 'tokenUrl')
        );
        if (!hasAccessToken && !hasOAuthClient) {
            missingFields.push('accessToken or clientId + clientSecret + authorizeUrl + tokenUrl');
        }
        const authorizeUrl = readStringField(config, 'authorizeUrl');
        const tokenUrl = readStringField(config, 'tokenUrl');
        if (!authorizeUrl && !hasAccessToken) {
            missingFields.push('authorizeUrl');
        }
        if (!tokenUrl && !hasAccessToken) {
            missingFields.push('tokenUrl');
        }
        if (authorizeUrl && !/^https:\/\//i.test(authorizeUrl)) {
            warnings.push('authorizeUrl should start with https://');
        }
        if (tokenUrl && !/^https:\/\//i.test(tokenUrl)) {
            warnings.push('tokenUrl should start with https://');
        }
    }

    if (missingFields.length > 0) {
        return {
            ok: false,
            missingFields,
            warnings,
            message: `Missing required integration fields: ${missingFields.join(', ')}`,
        };
    }

    return {
        ok: true,
        missingFields: [],
        warnings,
        message: warnings.length > 0
            ? `Validated with warnings: ${warnings.join(' | ')}`
            : 'Integration config validated.',
    };
}

export function getPrimaryProbeUrl(type: IntegrationType, config: IntegrationConfig): string | null {
    const candidatesByType: Record<IntegrationType, string[]> = {
        slack: ['webhookUrl'],
        google_calendar: ['endpoint'],
        outlook: ['endpoint'],
        greenhouse: ['endpoint'],
        lever: ['endpoint'],
        codex_oauth: ['tokenUrl', 'authorizeUrl'],
        generic_oauth: ['tokenUrl', 'authorizeUrl', 'baseUrl', 'endpoint'],
    };

    for (const key of candidatesByType[type]) {
        const value = readStringField(config, key);
        if (value) return value;
    }
    return null;
}

export async function probeIntegrationUrl(url: string): Promise<{ ok: boolean; message?: string; statusCode?: number }> {
    try {
        const parsedUrl = new URL(url);
        const probeTarget = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const response = await fetchWithTimeout(probeTarget, { method: 'GET' }, 7000);
        return {
            ok: true,
            statusCode: response.status,
        };
    } catch (error: unknown) {
        return {
            ok: false,
            message: (error instanceof Error && error.name === 'AbortError')
                ? 'Probe timeout while checking integration endpoint'
                : `Unable to reach integration endpoint: ${extractErrorMessage(error)}`,
        };
    }
}

export function toIntegrationResponse(item: {
    id: string;
    type: string;
    status: string;
    config: unknown;
    lastTestedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        ...item,
        config: redactIntegrationConfig(item.config),
    };
}

// ─── API key verification ───────────────────────────────────────────────────

export async function verifyProviderKey(
    provider: z.infer<typeof providerSchema>,
    apiKey: string,
    baseUrl?: string
): Promise<VerifyResult> {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    try {
        if (provider === 'google') {
            const res = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
            );
            if (!res.ok) {
                const body = await res.text();
                return { ok: false, message: `Google verify failed: ${body || res.statusText}`, models: [] };
            }
            const payload = await res.json() as { models?: Array<{ name?: string }> };
            const models = (payload.models || [])
                .map((item) => item.name?.replace('models/', '') || '')
                .filter(Boolean);
            return { ok: true, models: uniqueModels(models, provider) };
        }

        if (provider === 'anthropic') {
            const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
            if (!res.ok) {
                const body = await res.text();
                return { ok: false, message: `Anthropic verify failed: ${body || res.statusText}`, models: [] };
            }
            const payload = await res.json() as { data?: Array<{ id?: string }> };
            const models = (payload.data || []).map((item) => item.id || '').filter(Boolean);
            return { ok: true, models: uniqueModels(models, provider) };
        }

        const finalBaseUrl = normalizedBaseUrl || providerDefaultBaseUrl[provider];
        if (!finalBaseUrl) {
            return {
                ok: false,
                message: 'Custom provider requires baseUrl',
                models: [],
            };
        }

        const res = await fetchWithTimeout(`${finalBaseUrl}/models`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        if (!res.ok) {
            const body = await res.text();
            return {
                ok: false,
                message: `${provider} verify failed: ${body || res.statusText}`,
                models: [],
                normalizedBaseUrl: finalBaseUrl,
            };
        }

        const payload = await res.json() as { data?: Array<{ id?: string }> };
        const models = (payload.data || []).map((item) => item.id || '').filter(Boolean);
        return {
            ok: true,
            models: uniqueModels(models, provider),
            normalizedBaseUrl: finalBaseUrl,
        };
    } catch (error: unknown) {
        return {
            ok: false,
            message: (error instanceof Error && error.name === 'AbortError') ? 'Verification timeout' : `Verification error: ${extractErrorMessage(error)}`,
            models: [],
            normalizedBaseUrl,
        };
    }
}
