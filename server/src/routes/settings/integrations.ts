import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';
import {
    decryptIntegrationConfigSecrets,
    encryptIntegrationConfigSecrets,
} from '../../services/integrations/configCrypto';
import {
    type IntegrationConfig,
    type CodexOauthPendingState,
    integrationTypeSchema,
    codexOauthStartSchema,
    codexOauthCallbackSchema,
    CODEX_OAUTH_PENDING_TTL_MS,
    codexOauthPendingStore,
    readStringField,
    mergeMaskedSecrets,
    validateIntegrationConfig,
    getPrimaryProbeUrl,
    probeIntegrationUrl,
    toIntegrationResponse,
    resolvePortalOrigin,
    toUrlEncodedBody,
    extractIntegrationErrorMessage,
    parseModelsFromConfig,
    cleanupExpiredCodexOauthStates,
    persistCodexOauthPendingState,
    loadCodexOauthPendingState,
    consumeCodexOauthPendingState,
} from './helpers';

export async function registerIntegrationRoutes(app: FastifyInstance) {
    // Codex OAuth start
    app.post('/api/settings/integrations/codex-oauth/start', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const parsed = codexOauthStartSchema.safeParse(request.body || {});
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const config = parsed.data.config as IntegrationConfig;
        const existing = await prisma.integration.findFirst({
            where: {
                companyId: user.companyId,
                type: 'codex_oauth',
            },
            orderBy: { updatedAt: 'desc' },
        });
        const existingConfig = decryptIntegrationConfigSecrets((existing?.config || {}) as IntegrationConfig) as IntegrationConfig;
        const mergedConfig = mergeMaskedSecrets(config, existingConfig) as IntegrationConfig;

        const clientId = readStringField(mergedConfig, 'clientId');
        const clientSecret = readStringField(mergedConfig, 'clientSecret');
        const authorizeUrlRaw = readStringField(mergedConfig, 'authorizeUrl');
        const tokenUrlRaw = readStringField(mergedConfig, 'tokenUrl');

        const missingFields: string[] = [];
        if (!clientId) missingFields.push('clientId');
        if (!clientSecret) missingFields.push('clientSecret');
        if (!authorizeUrlRaw) missingFields.push('authorizeUrl');
        if (!tokenUrlRaw) missingFields.push('tokenUrl');
        if (missingFields.length > 0) {
            return reply.status(400).send({
                error: `Missing required Codex OAuth fields: ${missingFields.join(', ')}`,
                missingFields,
            });
        }

        let authorizeUrl: URL;
        try {
            authorizeUrl = new URL(authorizeUrlRaw!);
        } catch {
            return reply.status(400).send({ error: 'authorizeUrl is not a valid URL' });
        }

        const redirectUri = readStringField(mergedConfig, 'redirectUri')
            || `${resolvePortalOrigin(request)}/settings/codex-oauth/callback`;

        const scopeRaw = readStringField(mergedConfig, 'scopes');
        const scopes = scopeRaw
            ? scopeRaw
                .split(/[,\s]+/)
                .map((item) => item.trim())
                .filter(Boolean)
                .join(' ')
            : 'openid profile email';

        const state = randomUUID().replace(/-/g, '');
        cleanupExpiredCodexOauthStates();
        const pendingPayload: CodexOauthPendingState = {
            companyId: user.companyId,
            userId: user.userId,
            config: {
                ...mergedConfig,
                redirectUri,
            },
            createdAt: Date.now(),
            expiresAt: Date.now() + CODEX_OAUTH_PENDING_TTL_MS,
        };
        codexOauthPendingStore.set(state, pendingPayload);
        try {
            const pendingLogId = await persistCodexOauthPendingState(state, pendingPayload);
            codexOauthPendingStore.set(state, {
                ...pendingPayload,
                persistedLogId: pendingLogId,
            });
        } catch (error) {
            request.log.warn({ err: error, state }, 'Failed to persist Codex OAuth pending state');
        }

        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('client_id', clientId!);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('state', state);
        if (scopes) {
            authorizeUrl.searchParams.set('scope', scopes);
        }

        return success({
            authorizeUrl: authorizeUrl.toString(),
            state,
            redirectUri,
            expiresInSec: Math.floor(CODEX_OAUTH_PENDING_TTL_MS / 1000),
        });
    });

    // Codex OAuth callback
    app.post('/api/settings/integrations/codex-oauth/callback', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const parsed = codexOauthCallbackSchema.safeParse(request.body || {});
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        cleanupExpiredCodexOauthStates();
        let pending = codexOauthPendingStore.get(parsed.data.state) || null;
        let pendingLogId: string | null = pending?.persistedLogId || null;
        if (!pending || !pendingLogId) {
            const persisted = await loadCodexOauthPendingState(user.companyId, parsed.data.state);
            if (persisted) {
                if (!pending) {
                    pending = {
                        ...persisted.payload,
                        persistedLogId: persisted.logId,
                    };
                    codexOauthPendingStore.set(parsed.data.state, pending);
                }
                pendingLogId = pendingLogId || persisted.logId;
            }
        }
        if (!pending) {
            return reply.status(400).send({ error: 'OAuth state expired. Please restart authorization.' });
        }
        if (pending.companyId !== user.companyId || pending.userId !== user.userId) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(403).send({ error: 'OAuth state does not match current user.' });
        }

        if (parsed.data.error) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            const detail = parsed.data.errorDescription || parsed.data.error;
            return reply.status(400).send({ error: `Codex OAuth authorization failed: ${detail}` });
        }

        const code = (parsed.data.code || '').trim();
        if (!code) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({ error: 'OAuth callback is missing code.' });
        }

        const config = pending.config;
        const tokenUrl = readStringField(config, 'tokenUrl');
        const clientId = readStringField(config, 'clientId');
        const clientSecret = readStringField(config, 'clientSecret');
        const redirectUri = readStringField(config, 'redirectUri')
            || `${resolvePortalOrigin(request)}/settings/codex-oauth/callback`;

        if (!tokenUrl || !clientId || !clientSecret) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({ error: 'Codex OAuth config incomplete. Please restart authorization.' });
        }

        let tokenResponse: Response;
        try {
            const tokenBody = toUrlEncodedBody({
                grant_type: 'authorization_code',
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            });
            tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: tokenBody,
            });
        } catch (error: unknown) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(502).send({
                error: extractErrorMessage(error) || 'Failed to reach OAuth token endpoint',
            });
        }

        const tokenRawText = await tokenResponse.text();
        if (!tokenResponse.ok) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({
                error: `Codex OAuth token exchange failed: ${extractIntegrationErrorMessage(tokenRawText)}`,
            });
        }

        let tokenPayload: Record<string, unknown> = {};
        try {
            tokenPayload = JSON.parse(tokenRawText);
        } catch {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({
                error: 'Codex OAuth token exchange returned non-JSON response',
            });
        }

        const accessToken = typeof tokenPayload.access_token === 'string'
            ? tokenPayload.access_token.trim()
            : typeof tokenPayload.accessToken === 'string'
                ? tokenPayload.accessToken.trim()
                : '';
        if (!accessToken) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({
                error: 'Codex OAuth token exchange succeeded but access token is missing',
            });
        }

        const now = new Date();
        const expiresIn = Number(tokenPayload.expires_in);
        const expiresAtIso = Number.isFinite(expiresIn) && expiresIn > 0
            ? new Date(now.getTime() + expiresIn * 1000).toISOString()
            : undefined;

        const configuredModels = parseModelsFromConfig(config);
        const finalMergedConfig = {
            ...config,
            accessToken,
            tokenType: typeof tokenPayload.token_type === 'string' ? tokenPayload.token_type : undefined,
            refreshToken: typeof tokenPayload.refresh_token === 'string' ? tokenPayload.refresh_token : undefined,
            scope: typeof tokenPayload.scope === 'string' ? tokenPayload.scope : undefined,
            expiresAt: expiresAtIso,
            redirectUri,
            models: configuredModels.length > 0 ? configuredModels : ['codex-mini-latest'],
        } satisfies IntegrationConfig;

        const validation = validateIntegrationConfig('codex_oauth', finalMergedConfig);
        if (!validation.ok) {
            await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);
            return reply.status(400).send({
                error: validation.message,
                missingFields: validation.missingFields,
                warnings: validation.warnings,
            });
        }
        const encryptedConfig = encryptIntegrationConfigSecrets(finalMergedConfig) as Prisma.InputJsonValue;

        const existingIntegration = await prisma.integration.findFirst({
            where: {
                companyId: user.companyId,
                type: 'codex_oauth',
            },
            orderBy: { createdAt: 'desc' },
        });

        const integration = existingIntegration
            ? await prisma.integration.update({
                where: { id: existingIntegration.id },
                data: {
                    config: encryptedConfig,
                    status: 'connected',
                    lastTestedAt: now,
                },
            })
            : await prisma.integration.create({
                data: {
                    companyId: user.companyId,
                    type: 'codex_oauth',
                    config: encryptedConfig,
                    status: 'connected',
                    lastTestedAt: now,
                },
            });

        await consumeCodexOauthPendingState(parsed.data.state, user.companyId, pendingLogId).catch(() => undefined);

        return success({
            ...toIntegrationResponse(integration),
            validation: {
                warnings: validation.warnings,
            },
        });
    });

    // List integrations
    app.get('/api/settings/integrations', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const integrations = await prisma.integration.findMany({
            where: { companyId: user.companyId },
            orderBy: { updatedAt: 'desc' },
        });
        return success(integrations.map((item) => toIntegrationResponse(item)));
    });

    // Create/update integration
    app.post('/api/settings/integrations', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = z.object({
            type: integrationTypeSchema,
            config: z.record(z.any()).optional(),
        });

        try {
            const { type, config } = schema.parse(request.body || {});
            const existing = await prisma.integration.findFirst({
                where: {
                    companyId: user.companyId,
                    type,
                },
                orderBy: { createdAt: 'desc' },
            });

            const now = new Date();
            const incomingConfig: IntegrationConfig = (config || {}) as IntegrationConfig;
            const existingConfig = decryptIntegrationConfigSecrets((existing?.config || {}) as IntegrationConfig) as IntegrationConfig;
            const mergedConfig = mergeMaskedSecrets(incomingConfig, existingConfig) as IntegrationConfig;
            const validation = validateIntegrationConfig(type, mergedConfig);
            if (!validation.ok) {
                return reply.status(400).send({
                    error: validation.message,
                    missingFields: validation.missingFields,
                });
            }
            const encryptedConfig = encryptIntegrationConfigSecrets(mergedConfig) as Prisma.InputJsonValue;

            const integration = existing
                ? await prisma.integration.update({
                    where: { id: existing.id },
                    data: {
                        config: encryptedConfig,
                        status: 'connected',
                        lastTestedAt: now,
                    },
                })
                : await prisma.integration.create({
                    data: {
                        companyId: user.companyId,
                        type,
                        config: encryptedConfig,
                        status: 'connected',
                        lastTestedAt: now,
                    },
                });

            return success({
                ...toIntegrationResponse(integration),
                validation: {
                    warnings: validation.warnings,
                },
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(400).send({ error: extractErrorMessage(err) });
        }
    });

    // Test integration config
    app.post('/api/settings/integrations/test', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = z.object({
            type: integrationTypeSchema,
            config: z.record(z.any()).optional(),
        });

        try {
            const { type, config } = schema.parse(request.body || {});
            const normalizedConfig = (config || {}) as IntegrationConfig;
            const validation = validateIntegrationConfig(type, normalizedConfig);

            if (!validation.ok) {
                return reply.status(400).send({
                    error: validation.message,
                    missingFields: validation.missingFields,
                    warnings: validation.warnings,
                });
            }

            const probeUrl = getPrimaryProbeUrl(type, normalizedConfig);
            let probe: { ok: boolean; message?: string; statusCode?: number } | null = null;
            if (probeUrl) {
                probe = await probeIntegrationUrl(probeUrl);
                if (!probe.ok) {
                    return reply.status(400).send({
                        error: probe.message || 'Integration endpoint probe failed',
                        warnings: validation.warnings,
                    });
                }
            }

            return success({
                ok: true,
                type,
                checkedAt: new Date().toISOString(),
                message: validation.message,
                warnings: validation.warnings,
                probe,
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(400).send({ error: extractErrorMessage(err) });
        }
    });

    // Delete integration
    app.delete('/api/settings/integrations/:id', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const { id } = request.params as { id: string };
        const result = await prisma.integration.deleteMany({
            where: { id, companyId: user.companyId },
        });
        if (result.count === 0) {
            return reply.status(404).send({ error: 'Integration not found' });
        }
        return success({ deleted: true });
    });
}
