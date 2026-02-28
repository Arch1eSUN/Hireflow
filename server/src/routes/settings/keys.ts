import { extractErrorMessage } from '../../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { authenticate } from '../../utils/auth';
import { success } from '../../utils/response';
import { encrypt } from '../../utils/encryption';
import { type ProviderName } from '../../services/ai/companyApiKeys';
import { getCodexOAuthCredential } from '../../services/ai/codexOAuth';
import {
    providerSchema,
    providerDefaultModels,
    apiKeyInputSchema,
    toApiKeyResponseItem,
    activateProviderKey,
    ensureProviderHasActiveKey,
    normalizeBaseUrl,
    normalizeKeyName,
    uniqueModels,
    verifyProviderKey,
} from './helpers';

export async function registerKeyRoutes(app: FastifyInstance) {
    // List configured API keys
    app.get('/api/settings/keys', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const keys = await prisma.apiKeyStore.findMany({
            where: { companyId: user.companyId },
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
            orderBy: [
                { provider: 'asc' },
                { isActive: 'desc' },
                { updatedAt: 'desc' },
            ],
        });

        return success(keys.map((item) => toApiKeyResponseItem(item)));
    });

    // Verify key without saving
    app.post('/api/settings/keys/test', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = apiKeyInputSchema.pick({
            provider: true,
            keyName: true,
            apiKey: true,
            baseUrl: true,
        });

        try {
            const { provider, keyName, apiKey, baseUrl } = schema.parse(request.body || {});
            const verification = await verifyProviderKey(provider, apiKey, baseUrl);
            if (!verification.ok) {
                return reply.status(400).send({ error: verification.message || 'Key verification failed' });
            }

            return success({
                provider,
                keyName: normalizeKeyName(keyName),
                status: 'connected',
                models: verification.models,
                baseUrl: verification.normalizedBaseUrl,
                checkedAt: new Date().toISOString(),
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Add/Update single API key
    app.post('/api/settings/keys', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        try {
            const parsedInput = apiKeyInputSchema.parse(request.body || {});
            const provider = parsedInput.provider;
            const keyName = normalizeKeyName(parsedInput.keyName);
            const allowUnverified = parsedInput.allowUnverified ?? false;
            const setActive = parsedInput.setActive !== false;
            const apiKey = parsedInput.apiKey;
            const baseUrl = parsedInput.baseUrl;
            const verification = await verifyProviderKey(provider, apiKey, baseUrl);

            if (!verification.ok && !allowUnverified) {
                return reply.status(400).send({ error: verification.message || 'Key verification failed' });
            }

            const finalBaseUrl = verification.normalizedBaseUrl || normalizeBaseUrl(baseUrl);
            const now = new Date();

            const result = await prisma.$transaction(async (tx) => {
                if (setActive) {
                    await tx.apiKeyStore.updateMany({
                        where: {
                            companyId: user.companyId,
                            provider,
                        },
                        data: {
                            isActive: false,
                        },
                    });
                }

                return tx.apiKeyStore.upsert({
                    where: {
                        companyId_provider_keyName: {
                            companyId: user.companyId,
                            provider,
                            keyName,
                        },
                    },
                    create: {
                        companyId: user.companyId,
                        provider,
                        keyName,
                        isActive: setActive,
                        encryptedKey: encrypt(apiKey),
                        baseUrl: finalBaseUrl,
                        status: verification.ok ? 'connected' : 'error',
                        cachedModels: verification.models,
                        lastTestedAt: now,
                    },
                    update: {
                        encryptedKey: encrypt(apiKey),
                        baseUrl: finalBaseUrl,
                        isActive: setActive,
                        status: verification.ok ? 'connected' : 'error',
                        cachedModels: verification.models,
                        lastTestedAt: now,
                    },
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
            });
            await ensureProviderHasActiveKey(user.companyId, provider as ProviderName);

            return success({
                ...toApiKeyResponseItem(result),
                verification: {
                    ok: verification.ok,
                    message: verification.message,
                },
            });
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.flatten() });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // Batch add/update API keys
    app.post('/api/settings/keys/batch', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = z.object({
            keys: z.array(apiKeyInputSchema).min(1).max(200),
            continueOnError: z.boolean().default(true),
            defaultAllowUnverified: z.boolean().optional(),
        });

        const parsed = schema.safeParse(request.body || {});
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const { keys, continueOnError, defaultAllowUnverified } = parsed.data;
        const touchedProviders = new Set<ProviderName>();
        const results: Array<Record<string, unknown>> = [];
        const errors: Array<Record<string, unknown>> = [];

        for (const input of keys) {
            const provider = input.provider;
            const keyName = normalizeKeyName(input.keyName);
            const allowUnverified = input.allowUnverified ?? defaultAllowUnverified ?? false;
            const setActive = input.setActive !== false;
            const now = new Date();
            try {
                const verification = await verifyProviderKey(provider, input.apiKey, input.baseUrl);
                if (!verification.ok && !allowUnverified) {
                    throw new Error(verification.message || 'Key verification failed');
                }

                const finalBaseUrl = verification.normalizedBaseUrl || normalizeBaseUrl(input.baseUrl);
                const saved = await prisma.$transaction(async (tx) => {
                    if (setActive) {
                        await tx.apiKeyStore.updateMany({
                            where: {
                                companyId: user.companyId,
                                provider,
                            },
                            data: { isActive: false },
                        });
                    }

                    return tx.apiKeyStore.upsert({
                        where: {
                            companyId_provider_keyName: {
                                companyId: user.companyId,
                                provider,
                                keyName,
                            },
                        },
                        create: {
                            companyId: user.companyId,
                            provider,
                            keyName,
                            isActive: setActive,
                            encryptedKey: encrypt(input.apiKey),
                            baseUrl: finalBaseUrl,
                            status: verification.ok ? 'connected' : 'error',
                            cachedModels: verification.models,
                            lastTestedAt: now,
                        },
                        update: {
                            encryptedKey: encrypt(input.apiKey),
                            baseUrl: finalBaseUrl,
                            isActive: setActive,
                            status: verification.ok ? 'connected' : 'error',
                            cachedModels: verification.models,
                            lastTestedAt: now,
                        },
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
                });

                touchedProviders.add(provider as ProviderName);
                results.push({
                    ...toApiKeyResponseItem(saved),
                    verification: {
                        ok: verification.ok,
                        message: verification.message,
                    },
                });
            } catch (error: unknown) {
                const detail = {
                    provider,
                    keyName,
                    message: extractErrorMessage(error) || 'Unknown error',
                };
                errors.push(detail);
                if (!continueOnError) {
                    return reply.status(400).send({
                        error: 'Batch API key import failed',
                        detail,
                        results,
                    });
                }
            }
        }

        for (const provider of touchedProviders) {
            await ensureProviderHasActiveKey(user.companyId, provider);
        }

        return success({
            total: keys.length,
            succeeded: results.length,
            failed: errors.length,
            results,
            errors,
        });
    });

    // Apply/activate an API key for a provider
    app.post('/api/settings/keys/apply', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const schema = z.object({
            provider: providerSchema,
            keyId: z.string().trim().min(8).max(64).optional(),
            keyName: z.string().trim().min(1).max(60).optional(),
        }).refine((value) => Boolean(value.keyId || value.keyName), {
            message: 'Either keyId or keyName is required',
        });
        const parsed = schema.safeParse(request.body || {});
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const { provider, keyId, keyName } = parsed.data;
        const target = keyId
            ? await prisma.apiKeyStore.findFirst({
                where: {
                    id: keyId,
                    companyId: user.companyId,
                    provider,
                },
                select: { id: true },
            })
            : await prisma.apiKeyStore.findFirst({
                where: {
                    companyId: user.companyId,
                    provider,
                    keyName: normalizeKeyName(keyName),
                },
                select: { id: true },
            });

        if (!target) {
            return reply.status(404).send({ error: 'API key not found for this provider' });
        }

        const activated = await prisma.$transaction((tx) => activateProviderKey({
            companyId: user.companyId,
            provider: provider as ProviderName,
            keyId: target.id,
        }, tx));

        return success(toApiKeyResponseItem(activated));
    });

    // Remove key by ID
    app.delete('/api/settings/keys/id/:id', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const paramsSchema = z.object({ id: z.string().trim().min(8).max(64) });
        const parsed = paramsSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const existing = await prisma.apiKeyStore.findFirst({
            where: {
                id: parsed.data.id,
                companyId: user.companyId,
            },
            select: {
                id: true,
                provider: true,
                keyName: true,
                isActive: true,
            },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'API key not found' });
        }

        await prisma.apiKeyStore.delete({
            where: { id: existing.id },
        });
        if (existing.isActive) {
            await ensureProviderHasActiveKey(user.companyId, existing.provider as ProviderName);
        }

        return success({
            deleted: true,
            id: existing.id,
            provider: existing.provider,
            keyName: existing.keyName,
        });
    });

    const deleteProviderKeys = async (params: { companyId: string; provider: ProviderName }) => {
        const deleted = await prisma.apiKeyStore.deleteMany({
            where: {
                companyId: params.companyId,
                provider: params.provider,
            },
        });
        return deleted.count;
    };

    // Remove all keys for provider (new route)
    app.delete('/api/settings/keys/provider/:provider', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const paramsSchema = z.object({ provider: providerSchema });
        const parsed = paramsSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const count = await deleteProviderKeys({
            companyId: user.companyId,
            provider: parsed.data.provider as ProviderName,
        });
        if (count === 0) {
            return reply.status(404).send({ error: 'Provider key not found' });
        }
        return success({ deleted: true, provider: parsed.data.provider, count });
    });

    // Remove all keys for provider (legacy compatible route)
    app.delete('/api/settings/keys/:provider', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const paramsSchema = z.object({ provider: providerSchema });
        const parsed = paramsSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }

        const count = await deleteProviderKeys({
            companyId: user.companyId,
            provider: parsed.data.provider as ProviderName,
        });
        if (count === 0) {
            return reply.status(404).send({ error: 'Provider key not found' });
        }
        return success({ deleted: true, provider: parsed.data.provider, count });
    });

    // Model catalog for settings UI
    app.get('/api/settings/models', async (request, reply) => {
        const user = await authenticate(request);
        if (!['owner', 'admin', 'hr_manager', 'interviewer'].includes(user.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }

        const keys = await prisma.apiKeyStore.findMany({
            where: { companyId: user.companyId },
            select: {
                provider: true,
                isActive: true,
                status: true,
                cachedModels: true,
                lastTestedAt: true,
            },
        });
        const codexOAuthCredential = await getCodexOAuthCredential(user.companyId);

        const byProvider = Object.fromEntries(
            Object.keys(providerDefaultModels).map((provider) => {
                const providerKeys = keys.filter((item) => item.provider === provider);
                const activeKey = providerKeys.find((item) => item.isActive) || providerKeys[0];
                const connectedKeys = providerKeys.filter((item) => item.status === 'connected');
                const cached = connectedKeys.flatMap((item) => (
                    Array.isArray(item.cachedModels)
                        ? (item.cachedModels as unknown[]).map((modelId) => String(modelId))
                        : []
                ));
                const connected = connectedKeys.length > 0;
                const models = connected ? uniqueModels(cached, provider) : [];
                const latestTestedAt = providerKeys
                    .map((item) => item.lastTestedAt)
                    .filter((value): value is Date => Boolean(value))
                    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
                return [provider, {
                    provider,
                    status: activeKey?.status || (connected ? 'connected' : 'disconnected'),
                    lastTestedAt: activeKey?.lastTestedAt || latestTestedAt,
                    models,
                    connected,
                }];
            })
        );

        if (codexOAuthCredential) {
            const openaiProvider = byProvider.openai as {
                provider: string;
                status: string;
                lastTestedAt: Date | null;
                models: string[];
                connected: boolean;
            };
            const mergedModels = Array.from(new Set([
                ...openaiProvider.models,
                ...codexOAuthCredential.models,
            ]));
            byProvider.openai = {
                ...openaiProvider,
                status: 'connected',
                connected: true,
                models: mergedModels,
                lastTestedAt: openaiProvider.lastTestedAt || codexOAuthCredential.lastTestedAt || codexOAuthCredential.updatedAt,
            };
        }

        const catalog = Object.values(byProvider).flatMap((item: any) => (
            item.models.map((id: string) => ({
                id,
                label: id,
                provider: item.provider,
                connected: item.connected,
            }))
        ));

        return success({
            providers: Object.values(byProvider),
            catalog,
        });
    });
}
