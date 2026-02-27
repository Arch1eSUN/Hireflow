import 'dotenv/config';
// ================================================
// HireFlow AI — Fastify 后端 API
// 模块化架构入口
// ================================================

import Fastify from 'fastify';
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

import { success } from './utils/response';
import { env } from './config/env';
import { startCleanupTask, stopCleanupTask } from './tasks/cleanup';

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
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
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

    // ======= 健康检查 =======
    app.get('/api/health', async () => {
        return success({
            status: 'ok',
            version: '2.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    // ======= 启动服务器 =======
    try {
        await app.listen({ port: env.PORT, host: env.HOST });
        console.log(`HireFlow API is running at http://${env.HOST}:${env.PORT}`);

        // ======= 后台任务 =======
        startCleanupTask();
    } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${env.PORT} is already in use.`);
            console.error(`Identify process: lsof -i :${env.PORT}`);
            console.error(`Kill process: kill -9 $(lsof -t -i :${env.PORT})`);
        } else {
            app.log.error(err);
        }
        process.exit(1);
    }

    // ======= 优雅停机 =======
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
        process.on(signal, async () => {
            console.log(`\nReceived ${signal}, shutting down gracefully...`);
            stopCleanupTask();
            await app.close();
            process.exit(0);
        });
    });
}

void bootstrap();
