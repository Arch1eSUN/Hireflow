/**
 * Server-wide logger — wraps Fastify's built-in Pino instance.
 * Use this in services/utils where `request.log` is unavailable.
 */
import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true },
        },
    }),
});

/** 脱敏邮箱：a***@example.com */
export function maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex <= 1) return '***' + email.slice(atIndex);
    return email[0] + '***' + email.slice(atIndex);
}

/** 脱敏 API Key：sk-...abc */
export function maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return key.slice(0, 4) + '...' + key.slice(-3);
}
