import { prisma } from '../../utils/prisma';
import { decryptIntegrationConfigSecrets } from '../integrations/configCrypto';

type CodexOAuthConfig = Record<string, unknown>;

export type CodexOAuthCredential = {
    integrationId: string;
    accessToken: string;
    baseUrl?: string;
    models: string[];
    updatedAt: Date;
    lastTestedAt: Date | null;
};

function readString(config: CodexOAuthConfig, key: string): string | undefined {
    const value = config[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function parseModels(config: CodexOAuthConfig): string[] {
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

export async function getCodexOAuthCredential(companyId: string): Promise<CodexOAuthCredential | null> {
    const integration = await prisma.integration.findFirst({
        where: {
            companyId,
            type: 'codex_oauth',
            status: 'connected',
        },
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            config: true,
            updatedAt: true,
            lastTestedAt: true,
        },
    });
    if (!integration || !integration.config || typeof integration.config !== 'object') {
        return null;
    }

    const config = decryptIntegrationConfigSecrets(integration.config) as CodexOAuthConfig;
    const accessToken = readString(config, 'accessToken') || readString(config, 'token');
    if (!accessToken) return null;

    const models = parseModels(config);
    const normalizedModels = models.length > 0 ? models : ['codex-mini-latest'];
    const baseUrl = readString(config, 'baseUrl') || readString(config, 'endpoint');

    return {
        integrationId: integration.id,
        accessToken,
        baseUrl,
        models: normalizedModels,
        updatedAt: integration.updatedAt,
        lastTestedAt: integration.lastTestedAt,
    };
}
