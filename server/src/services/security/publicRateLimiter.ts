type QuotaBucket = {
    windowStart: number;
    used: number;
};

export type PublicQuotaRule = {
    id: string;
    max: number;
    windowMs: number;
};

export type PublicQuotaResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSec: number;
};

const buckets = new Map<string, QuotaBucket>();
let operationCount = 0;

export function readIntEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = Number.parseInt(process.env[name] || '', 10);
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
}

export function extractClientIp(request: {
    ip?: string;
    headers?: Record<string, unknown>;
}): string {
    const forwarded = request?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    const realIp = request?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
        return realIp.trim();
    }
    const ip = String(request?.ip || '').trim();
    return ip || 'unknown';
}

export function buildPublicIdentity(params: {
    request: { ip?: string; headers?: Record<string, unknown> };
    token?: string;
    suffix?: string;
}): string {
    const ip = extractClientIp(params.request);
    const token = String(params.token || '').trim() || 'anonymous';
    const suffix = String(params.suffix || '').trim();
    return suffix ? `${ip}::${token}::${suffix}` : `${ip}::${token}`;
}

function cleanupExpiredBuckets(now: number): void {
    if (operationCount % 512 !== 0) return;
    for (const [key, bucket] of buckets.entries()) {
        // Keep inactive buckets for at most 2 windows.
        if (now - bucket.windowStart > 120_000) {
            buckets.delete(key);
        }
    }
}

export function consumePublicQuota(params: {
    identity: string;
    rule: PublicQuotaRule;
    cost?: number;
}): PublicQuotaResult {
    const now = Date.now();
    const cost = Math.max(1, Math.floor(params.cost || 1));
    const key = `${params.rule.id}::${params.identity}`;
    const existing = buckets.get(key);

    operationCount += 1;
    cleanupExpiredBuckets(now);

    if (!existing || now - existing.windowStart >= params.rule.windowMs) {
        const used = cost;
        const allowed = used <= params.rule.max;
        buckets.set(key, {
            windowStart: now,
            used,
        });
        return {
            allowed,
            remaining: allowed ? Math.max(0, params.rule.max - used) : 0,
            retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil(params.rule.windowMs / 1000)),
        };
    }

    const nextUsed = existing.used + cost;
    const allowed = nextUsed <= params.rule.max;
    existing.used = nextUsed;
    buckets.set(key, existing);

    const elapsed = now - existing.windowStart;
    const retryAfterSec = Math.max(1, Math.ceil((params.rule.windowMs - elapsed) / 1000));
    return {
        allowed,
        remaining: allowed ? Math.max(0, params.rule.max - nextUsed) : 0,
        retryAfterSec: allowed ? 0 : retryAfterSec,
    };
}

