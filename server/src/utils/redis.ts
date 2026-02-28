import { logger } from "./logger";
import Redis from 'ioredis';
import { env } from '../config/env';

let redis: Redis | null = null;

/**
 * Returns a singleton ioredis client.
 * Gracefully degrades — if REDIS_URL is not set, returns null.
 */
export function getRedis(): Redis | null {
    if (!env.REDIS_URL) return null;
    if (redis) return redis;

    redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 5) return null; // stop retrying
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    redis.on('error', (err) => {
        logger.error({ err }, '[Redis] Connection error');
    });

    redis.on('connect', () => {
        logger.info('[Redis] Connected successfully');
    });

    return redis;
}

/**
 * Disconnect Redis cleanly on shutdown.
 */
export async function disconnectRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}

// ── Caching helpers ──

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a cached JSON value. Returns null on miss or if Redis is unavailable.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
    const client = getRedis();
    if (!client) return null;
    try {
        const raw = await client.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/**
 * Set a cached JSON value with TTL.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
        // silently fail — caching is non-critical
    }
}

/**
 * Delete a cached value.
 */
export async function cacheDel(key: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
        await client.del(key);
    } catch {
        // silently fail
    }
}

/**
 * Invalidate all keys matching a pattern (e.g. `company:abc:*`).
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(...keys);
        }
    } catch {
        // silently fail
    }
}
