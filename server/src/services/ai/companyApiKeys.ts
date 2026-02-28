import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/encryption';
import { logger } from '../../utils/logger';

export type ProviderName =
    | 'google'
    | 'openai'
    | 'anthropic'
    | 'deepseek'
    | 'alibaba'
    | 'custom';

export type CompanyApiKeyRecord = {
    id: string;
    provider: string;
    keyName: string;
    isActive: boolean;
    status: string;
    baseUrl: string | null;
    apiKey: string;
    lastTestedAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
};

type ResolveKeyOptions = {
    requireConnected?: boolean;
};

function toDecryptedRecord(row: {
    id: string;
    provider: string;
    keyName: string;
    isActive: boolean;
    status: string;
    baseUrl: string | null;
    encryptedKey: string;
    lastTestedAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
}): CompanyApiKeyRecord | null {
    try {
        const apiKey = decrypt(row.encryptedKey);
        if (!apiKey) return null;
        return {
            id: row.id,
            provider: row.provider,
            keyName: row.keyName,
            isActive: row.isActive,
            status: row.status,
            baseUrl: row.baseUrl,
            apiKey,
            lastTestedAt: row.lastTestedAt,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
        };
    } catch (error) {
        logger.error({ err: error, keyId: row.id, provider: row.provider, keyName: row.keyName }, '[CompanyApiKeys] Failed to decrypt provider key');
        return null;
    }
}

export async function listCompanyApiKeys(
    companyId: string,
    provider?: ProviderName
): Promise<CompanyApiKeyRecord[]> {
    const rows = await prisma.apiKeyStore.findMany({
        where: {
            companyId,
            ...(provider ? { provider } : {}),
        },
        select: {
            id: true,
            provider: true,
            keyName: true,
            isActive: true,
            status: true,
            baseUrl: true,
            encryptedKey: true,
            lastTestedAt: true,
            updatedAt: true,
            createdAt: true,
        },
        orderBy: [
            { provider: 'asc' },
            { isActive: 'desc' },
            { updatedAt: 'desc' },
        ],
    });

    const decrypted = rows
        .map((row) => toDecryptedRecord(row))
        .filter((row): row is CompanyApiKeyRecord => row !== null);
    return decrypted;
}

export async function resolveCompanyApiKey(
    companyId: string,
    provider: ProviderName,
    options: ResolveKeyOptions = {}
): Promise<CompanyApiKeyRecord | null> {
    const where: {
        companyId: string;
        provider: string;
        status?: string;
    } = {
        companyId,
        provider,
    };
    if (options.requireConnected) {
        where.status = 'connected';
    }

    const rows = await prisma.apiKeyStore.findMany({
        where,
        select: {
            id: true,
            provider: true,
            keyName: true,
            isActive: true,
            status: true,
            baseUrl: true,
            encryptedKey: true,
            lastTestedAt: true,
            updatedAt: true,
            createdAt: true,
        },
        orderBy: [
            { isActive: 'desc' },
            { lastTestedAt: 'desc' },
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
        ],
        take: 8,
    });

    for (const row of rows) {
        const decrypted = toDecryptedRecord(row);
        if (decrypted) return decrypted;
    }
    return null;
}
