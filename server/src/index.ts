import 'dotenv/config';
// ================================================
// HireFlow AI — Fastify 后端 API
// 模块化架构入口
// ================================================

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { candidateRoutes } from './routes/candidates';
import { jobRoutes } from './routes/jobs';
import { interviewRoutes } from './routes/interviews';
import { authRoutes } from './routes/auth';
import { analyticsRoutes } from './routes/analytics';
import { notificationRoutes } from './routes/notifications';
import { aiRoutes } from './routes/ai';
import { screeningRoutes } from './routes/screening';
import { searchRoutes } from './routes/search';
import { teamRoutes } from './routes/team';
import { settingsRoutes } from './routes/settings';
import { integrityRoutes } from './routes/integrity';
import { websocketRoutes } from './routes/websocket';
import { apiKeyRoutes } from './routes/api-keys';
import { webhookRoutes } from './routes/webhooks';
import { evidenceRoutes } from './routes/evidence';
import { mediaRoutes } from './routes/media';
import { gdprRoutes } from './routes/gdpr';

import { success } from './utils/response';
import { env } from './config/env';
import { startCleanupTask, stopCleanupTask } from './tasks/cleanup';
import { getRedis, disconnectRedis } from './utils/redis';
import { prisma } from './utils/prisma';
import { initSentry, captureException, flushSentry } from './utils/sentry';
import { logger } from './utils/logger';

const app = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true },
        },
    },
});

function registerLenientJsonParser() {
    app.removeContentTypeParser('application/json');
    app.removeContentTypeParser('application/*+json');

    app.addContentTypeParser(
        /^application\/(?:[\w.+-]+\+)?json(?:\s*;.*)?$/i,
        { parseAs: 'string' },
        (request, body, done) => {
            const rawBody = Buffer.isBuffer(body) ? body.toString('utf8') : body;
            if (!rawBody || rawBody.trim() === '') {
                done(null, {});
                return;
            }

            try {
                done(null, JSON.parse(rawBody));
            } catch {
                done(new Error('Invalid JSON body'));
            }
        }
    );
}

async function bootstrap() {
    registerLenientJsonParser();

    // ======= 中间件 =======

    // 安全响应头（CSP, X-Frame-Options 等）
    app.addHook('onSend', async (_request, reply) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '0'); // 现代浏览器建议关闭，依赖 CSP
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
        reply.header(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' wss: https:",
                "media-src 'self' blob: https:",
                "frame-ancestors 'none'",
            ].join('; ')
        );
    });

    // ── Global error handler ────────────────────────────────────────────────
    const { AppError, extractErrorMessage } = await import('./utils/errors');
    const { ZodError } = await import('zod');

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof AppError) {
            return reply.status(error.statusCode).send({
                success: false,
                error: error.message,
                code: error.code,
            });
        }
        if (error instanceof ZodError) {
            return reply.status(400).send({
                success: false,
                error: error.flatten(),
                code: 'VALIDATION_ERROR',
            });
        }
        // 5xx → Sentry + log
        request.log.error({ err: error }, 'Unhandled error');
        captureException(error, {
            url: request.url,
            method: request.method,
        });
        return reply.status(500).send({
            success: false,
            error: env.NODE_ENV === 'production' ? 'Internal server error' : extractErrorMessage(error),
            code: 'INTERNAL_ERROR',
        });
    });

    // Helmet — 安全响应头（XSS / Clickjacking / MIME sniffing）
    await app.register(helmet, {
        contentSecurityPolicy: false, // SPA 前端需要 inline scripts
    });

    // Rate limiting — 如果 Redis 可用则使用分布式 store
    const redisClient = getRedis();
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        ...(redisClient ? {
            redis: redisClient,
        } : {}),
    });

    await app.register(cors, {
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);

            if (env.CORS_ORIGIN) {
                const allowlist = env.CORS_ORIGIN.split(',').map((s) => s.trim());
                return cb(null, allowlist.includes(origin));
            }

            const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            return cb(null, isLocal);
        },
        credentials: true,
    });

    await app.register(cookie, {
        secret: env.JWT_SECRET,
        hook: 'onRequest',
        parseOptions: {},
    });

    await app.register(websocket);

    // ======= 注册模块 =======
    app.register(authRoutes);
    app.register(candidateRoutes);
    app.register(jobRoutes);
    app.register(interviewRoutes);
    app.register(analyticsRoutes);
    app.register(notificationRoutes);
    app.register(aiRoutes);
    app.register(screeningRoutes);
    app.register(searchRoutes);
    app.register(teamRoutes);
    app.register(settingsRoutes);
    app.register(integrityRoutes);
    app.register(websocketRoutes);
    app.register(apiKeyRoutes, { prefix: '/api/api-keys' });
    app.register(webhookRoutes, { prefix: '/api/webhooks' });
    app.register(evidenceRoutes);
    app.register(mediaRoutes);
    app.register(gdprRoutes);

    // ======= 健康检查 =======
    app.get('/api/health', async () => {
        const redisClient = getRedis();
        let redisStatus = 'not_configured';
        if (redisClient) {
            try {
                await redisClient.ping();
                redisStatus = 'ok';
            } catch { redisStatus = 'error'; }
        }

        let dbStatus = 'ok';
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch { dbStatus = 'error'; }

        const allOk = dbStatus === 'ok' && redisStatus !== 'error';
        return success({
            status: allOk ? 'ok' : 'degraded',
            version: '2.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: { database: dbStatus, redis: redisStatus },
        });
    });

    // ======= Metrics 运维端点 =======
    app.get('/api/metrics', async (_request, reply) => {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        const uptime = process.uptime();
        const now = Date.now();

        // Event loop lag 简易测量
        const lagStart = Date.now();
        await new Promise((resolve) => setImmediate(resolve));
        const eventLoopLag = Date.now() - lagStart;

        // 活跃连接数（通过 Fastify 暴露）
        const requestCount = (app as any).server?.connections ?? 0;

        const metrics = {
            process: {
                uptime: Math.floor(uptime),
                pid: process.pid,
                nodeVersion: process.version,
                env: env.NODE_ENV,
            },
            memory: {
                rss: mem.rss,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                external: mem.external,
                rssMb: Math.round(mem.rss / 1024 / 1024),
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            },
            cpu: {
                userMicroseconds: cpu.user,
                systemMicroseconds: cpu.system,
            },
            eventLoop: {
                lagMs: eventLoopLag,
            },
            connections: {
                active: requestCount,
            },
            timestamp: new Date(now).toISOString(),
        };

        return success(metrics);
    });

    // ======= 启动服务器 =======
    initSentry();

    try {
        await app.listen({ port: env.PORT, host: env.HOST });
        logger.info({ host: env.HOST, port: env.PORT }, 'HireFlow API started');

        // ======= 后台任务 =======
        startCleanupTask();
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
            logger.error({ port: env.PORT }, 'Port already in use');
        } else {
            app.log.error(err);
        }
        process.exit(1);
    }

    // ======= 优雅停机 =======
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
        process.on(signal, async () => {
            logger.info({ signal }, 'Graceful shutdown initiated');
            stopCleanupTask();
            await flushSentry();
            await disconnectRedis();
            await app.close();
            process.exit(0);
        });
    });
}

void bootstrap();
