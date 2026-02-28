import type { AuditLog, Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

export const CHAINED_EVIDENCE_ACTIONS = [
    'integrity.event',
    'monitor.alert',
    'monitor.evidence_export',
    'interview.terminated',
] as const;

type ChainedEvidenceAction = (typeof CHAINED_EVIDENCE_ACTIONS)[number];

type JsonObject = Record<string, unknown>;

export type EvidenceChainStatus = 'valid' | 'broken' | 'partial' | 'not_initialized';

export interface EvidenceChainEntry {
    version: 'v1';
    algorithm: 'sha256';
    scope: 'interview';
    seq: number;
    prevHash: string | null;
    payloadHash: string;
    eventHash: string;
}

export interface EvidenceChainBrokenAt {
    id: string;
    action: string;
    createdAt: string;
    reason: string;
}

export interface EvidenceChainVerificationSummary {
    status: EvidenceChainStatus;
    checkedEvents: number;
    linkedEvents: number;
    legacyUnlinkedEvents: number;
    unlinkedAfterChainStart: number;
    latestHash: string | null;
    firstHash: string | null;
    latestSeq: number;
    brokenAt: EvidenceChainBrokenAt | null;
}

function hashString(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function toJsonSafeValue(value: unknown): Prisma.InputJsonValue | null {
    if (value === null) return null;
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => toJsonSafeValue(item));
    }
    if (typeof value === 'object') {
        const normalized: Record<string, Prisma.InputJsonValue | null> = {};
        for (const [key, item] of Object.entries(value as JsonObject)) {
            normalized[key] = toJsonSafeValue(item);
        }
        return normalized;
    }
    return String(value);
}

function toJsonObject(value: JsonObject): Prisma.InputJsonObject {
    const normalized: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
        normalized[key] = toJsonSafeValue(item);
    }
    return normalized as Prisma.InputJsonObject;
}

function asRecord(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as JsonObject;
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const objectValue = value as JsonObject;
    const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));
    const body = keys
        .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
        .join(',');
    return `{${body}}`;
}

function stripChainField(metadata: JsonObject): JsonObject {
    if (!('chain' in metadata)) return { ...metadata };
    const copy = { ...metadata };
    delete copy.chain;
    return copy;
}

function extractChainEntry(metadata: unknown): EvidenceChainEntry | null {
    const record = asRecord(metadata);
    const chain = asRecord(record.chain);
    const seq = typeof chain.seq === 'number' ? chain.seq : null;
    const prevHash = typeof chain.prevHash === 'string' ? chain.prevHash : null;
    const payloadHash = typeof chain.payloadHash === 'string' ? chain.payloadHash : null;
    const eventHash = typeof chain.eventHash === 'string' ? chain.eventHash : null;

    if (!seq || seq < 1 || !payloadHash || !eventHash) {
        return null;
    }

    return {
        version: 'v1',
        algorithm: 'sha256',
        scope: 'interview',
        seq,
        prevHash,
        payloadHash,
        eventHash,
    };
}

function buildPayloadHash(input: {
    companyId: string;
    interviewId: string;
    userId: string | null;
    action: string;
    metadata: JsonObject;
}): string {
    const payload = {
        companyId: input.companyId,
        interviewId: input.interviewId,
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
    };

    return hashString(stableStringify(payload));
}

function buildEventHash(payloadHash: string, prevHash: string | null, seq: number): string {
    return hashString(`v1|sha256|${payloadHash}|${prevHash || ''}|${seq}`);
}

async function getLatestChainState(
    prisma: PrismaClient,
    companyId: string,
    interviewId: string
): Promise<{ seq: number; eventHash: string | null }> {
    const recentLogs = await prisma.auditLog.findMany({
        where: {
            companyId,
            targetType: 'interview',
            targetId: interviewId,
            action: { in: CHAINED_EVIDENCE_ACTIONS as unknown as string[] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
        select: {
            metadata: true,
        },
    });

    for (const log of recentLogs) {
        const chain = extractChainEntry(log.metadata);
        if (chain) {
            return {
                seq: chain.seq,
                eventHash: chain.eventHash,
            };
        }
    }

    return {
        seq: 0,
        eventHash: null,
    };
}

export async function createChainedInterviewAuditLog(input: {
    prisma: PrismaClient;
    companyId: string;
    interviewId: string;
    userId?: string | null;
    action: ChainedEvidenceAction;
    metadata?: JsonObject;
}) {
    const { prisma, companyId, interviewId, userId, action } = input;
    const rawMetadata = asRecord(input.metadata || {});
    const normalizedMetadata = stripChainField(rawMetadata);
    const latest = await getLatestChainState(prisma, companyId, interviewId);
    const seq = latest.seq + 1;
    const payloadHash = buildPayloadHash({
        companyId,
        interviewId,
        userId: userId || null,
        action,
        metadata: normalizedMetadata,
    });
    const eventHash = buildEventHash(payloadHash, latest.eventHash, seq);

    const chain: EvidenceChainEntry = {
        version: 'v1',
        algorithm: 'sha256',
        scope: 'interview',
        seq,
        prevHash: latest.eventHash,
        payloadHash,
        eventHash,
    };

    return prisma.auditLog.create({
        data: {
            companyId,
            userId: userId || null,
            action,
            targetType: 'interview',
            targetId: interviewId,
            metadata: toJsonObject({
                ...normalizedMetadata,
                chain,
            }),
        },
    });
}

export async function verifyInterviewEvidenceChainWithDb(input: {
    prisma: PrismaClient;
    companyId: string;
    interviewId: string;
    limit?: number;
}) {
    const { prisma, companyId, interviewId } = input;
    const limit = Math.min(Math.max(input.limit || 500, 20), 5000);
    const logsDesc = await prisma.auditLog.findMany({
        where: {
            companyId,
            targetType: 'interview',
            targetId: interviewId,
            action: { in: CHAINED_EVIDENCE_ACTIONS as unknown as string[] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
            id: true,
            companyId: true,
            targetId: true,
            userId: true,
            action: true,
            createdAt: true,
            metadata: true,
        },
    });

    const logsAscending = [...logsDesc].reverse();
    const verification = verifyInterviewEvidenceChain(logsAscending);
    return {
        ...verification,
        totalFetched: logsAscending.length,
        limit,
    };
}

export function verifyInterviewEvidenceChain(
    logsAscending: Array<Pick<AuditLog, 'id' | 'companyId' | 'targetId' | 'userId' | 'action' | 'createdAt' | 'metadata'>>
): EvidenceChainVerificationSummary {
    if (!logsAscending.length) {
        return {
            status: 'not_initialized',
            checkedEvents: 0,
            linkedEvents: 0,
            legacyUnlinkedEvents: 0,
            unlinkedAfterChainStart: 0,
            latestHash: null,
            firstHash: null,
            latestSeq: 0,
            brokenAt: null,
        };
    }

    let linkedEvents = 0;
    let legacyUnlinkedEvents = 0;
    let unlinkedAfterChainStart = 0;
    let latestHash: string | null = null;
    let firstHash: string | null = null;
    let latestSeq = 0;
    let previousHash: string | null = null;
    let previousSeq = 0;
    let seenChain = false;
    let brokenAt: EvidenceChainBrokenAt | null = null;

    for (const log of logsAscending) {
        const metadata = asRecord(log.metadata);
        const chain = extractChainEntry(metadata);
        if (!chain) {
            if (seenChain) {
                unlinkedAfterChainStart += 1;
            } else {
                legacyUnlinkedEvents += 1;
            }
            continue;
        }

        seenChain = true;
        linkedEvents += 1;

        const metadataWithoutChain = stripChainField(metadata);
        const expectedPayloadHash = buildPayloadHash({
            companyId: log.companyId,
            interviewId: log.targetId || '',
            userId: log.userId,
            action: log.action,
            metadata: metadataWithoutChain,
        });
        const expectedEventHash = buildEventHash(expectedPayloadHash, previousHash, previousSeq + 1);

        const seqValid = chain.seq === previousSeq + 1;
        const prevHashValid = chain.prevHash === previousHash;
        const payloadValid = chain.payloadHash === expectedPayloadHash;
        const eventHashValid = chain.eventHash === expectedEventHash;

        if (!seqValid || !prevHashValid || !payloadValid || !eventHashValid) {
            const reasons: string[] = [];
            if (!seqValid) reasons.push('sequence mismatch');
            if (!prevHashValid) reasons.push('prevHash mismatch');
            if (!payloadValid) reasons.push('payload hash mismatch');
            if (!eventHashValid) reasons.push('event hash mismatch');
            brokenAt = {
                id: log.id,
                action: log.action,
                createdAt: log.createdAt.toISOString(),
                reason: reasons.join(', '),
            };
            break;
        }

        previousSeq = chain.seq;
        previousHash = chain.eventHash;
        latestSeq = chain.seq;
        latestHash = chain.eventHash;
        if (!firstHash) firstHash = chain.eventHash;
    }

    const status: EvidenceChainStatus = linkedEvents === 0
        ? 'not_initialized'
        : brokenAt
            ? 'broken'
            : unlinkedAfterChainStart > 0
                ? 'partial'
                : 'valid';

    return {
        status,
        checkedEvents: logsAscending.length,
        linkedEvents,
        legacyUnlinkedEvents,
        unlinkedAfterChainStart,
        latestHash,
        firstHash,
        latestSeq,
        brokenAt,
    };
}
