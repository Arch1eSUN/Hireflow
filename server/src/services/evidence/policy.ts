import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const evidenceChainPolicySchema = z.object({
    blockOnBrokenChain: z.boolean().default(true),
    blockOnPartialChain: z.boolean().default(false),
});

export type EvidenceChainPolicy = z.infer<typeof evidenceChainPolicySchema>;
export type EvidenceChainPolicySource = 'saved' | 'default';

export const DEFAULT_EVIDENCE_CHAIN_POLICY: EvidenceChainPolicy = {
    blockOnBrokenChain: true,
    blockOnPartialChain: false,
};

export function normalizeEvidenceChainPolicy(rawPolicy: unknown): EvidenceChainPolicy {
    const parsed = evidenceChainPolicySchema.safeParse(rawPolicy);
    if (!parsed.success) return DEFAULT_EVIDENCE_CHAIN_POLICY;
    return parsed.data;
}

export function toEvidenceChainPolicyPayload(policy: EvidenceChainPolicy): Prisma.InputJsonObject {
    return {
        blockOnBrokenChain: policy.blockOnBrokenChain,
        blockOnPartialChain: policy.blockOnPartialChain,
    };
}

export async function getLatestCompanyEvidenceChainPolicy(
    prisma: PrismaClient,
    companyId: string
): Promise<{
    policy: EvidenceChainPolicy;
    source: EvidenceChainPolicySource;
    updatedAt: string | null;
    updatedBy: string | null;
}> {
    const latest = await prisma.auditLog.findFirst({
        where: {
            companyId,
            action: 'evidence.chain.policy.updated',
            targetType: 'company',
            targetId: companyId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
            metadata: true,
            createdAt: true,
            userId: true,
        },
    });

    return {
        policy: normalizeEvidenceChainPolicy((latest?.metadata as any)?.policy),
        source: latest ? 'saved' : 'default',
        updatedAt: latest?.createdAt?.toISOString() || null,
        updatedBy: latest?.userId || null,
    };
}

export function toEvidenceChainPolicyHistoryItem(log: {
    id: string;
    createdAt: Date;
    metadata: unknown;
    userId: string | null;
}) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const source = typeof metadata.source === 'string' ? metadata.source : 'saved';
    const reasonRaw = typeof metadata.reason === 'string' ? metadata.reason.trim() : '';
    const reason = reasonRaw.length > 0
        ? reasonRaw
        : source === 'rollback'
            ? 'manual rollback'
            : 'manual update';
    return {
        id: log.id,
        policy: normalizeEvidenceChainPolicy(metadata.policy),
        source,
        rollbackFrom: typeof metadata.rollbackFrom === 'string' ? metadata.rollbackFrom : null,
        reason,
        updatedAt: log.createdAt.toISOString(),
        updatedBy: log.userId,
    };
}
