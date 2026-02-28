/**
 * Sentry 初始化与工具函数
 *
 * 使用方式：
 *   1. 在 .env 中设置 SENTRY_DSN
 *   2. 服务启动时自动初始化（如果有 DSN）
 *   3. 全局 error handler 自动上报
 */
import * as Sentry from '@sentry/node';
import { env } from '../config/env';
import { logger } from './logger';

let initialized = false;

/**
 * 初始化 Sentry SDK
 * 仅当 SENTRY_DSN 配置时生效；开发环境自动降低采样率。
 */
export function initSentry(): void {
    const dsn = env.SENTRY_DSN;
    if (!dsn) {
        logger.info('Sentry DSN not configured, error reporting disabled');
        return;
    }

    Sentry.init({
        dsn,
        environment: env.NODE_ENV || 'development',
        release: env.SENTRY_RELEASE || undefined,

        // 采样率：生产 100%，开发 10%
        tracesSampleRate: env.NODE_ENV === 'production' ? 1.0 : 0.1,

        // 不上报 4xx 类业务错误
        beforeSend(event, hint) {
            const error = hint?.originalException;
            if (error && typeof error === 'object' && 'statusCode' in error) {
                const statusCode = (error as { statusCode: number }).statusCode;
                if (statusCode >= 400 && statusCode < 500) {
                    return null; // 丢弃 4xx
                }
            }
            return event;
        },
    });

    initialized = true;
    logger.info({ environment: env.NODE_ENV }, 'Sentry initialized');
}

/**
 * 捕获异常上报到 Sentry
 * 附加 context（userId / companyId / interviewId 等）
 */
export function captureException(
    error: unknown,
    context?: Record<string, string | number | boolean | undefined>,
): void {
    if (!initialized) return;

    if (context) {
        Sentry.withScope((scope) => {
            for (const [key, value] of Object.entries(context)) {
                if (value !== undefined) {
                    scope.setExtra(key, value);
                }
            }
            // 如果有 userId，设置为 Sentry user
            if (context.userId) {
                scope.setUser({ id: String(context.userId) });
            }
            Sentry.captureException(error);
        });
    } else {
        Sentry.captureException(error);
    }
}

/**
 * 手动上报消息
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!initialized) return;
    Sentry.captureMessage(message, level);
}

/**
 * 优雅关闭 — 确保所有事件在进程退出前发送
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
    if (!initialized) return;
    await Sentry.flush(timeoutMs);
}
