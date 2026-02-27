import 'dotenv/config';
// ================================================
// HireFlow AI — Fastify 后端 API
// 模块化架构入口
// ================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket'; // Import websocket plugin
import { candidateRoutes } from './routes/candidates';
import { jobRoutes } from './routes/jobs';
import { interviewRoutes } from './routes/interviews';
import { authRoutes } from './routes/auth';
import { analyticsRoutes } from './routes/analytics';
import { notificationRoutes } from './routes/notifications';
import { aiRoutes } from './routes/ai';
import { teamRoutes } from './routes/team';
import { settingsRoutes } from './routes/settings';
import { websocketRoutes } from './routes/websocket'; // Import route

import { success } from './utils/response';

const PORT = parseInt(process.env.PORT || '4000');
const HOST = process.env.HOST || '0.0.0.0';

const app = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true },
        },
    },
});

// ======= 中间件 =======
await app.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005'],
    credentials: true,
});

await app.register(cookie, {
    secret: process.env.JWT_SECRET || 'dev-secret-cookie',
    hook: 'onRequest',
    parseOptions: {}
});

await app.register(websocket); // Register websocket plugin

// ======= 注册模块 =======
app.register(authRoutes);
app.register(candidateRoutes);
app.register(jobRoutes);
app.register(interviewRoutes);
app.register(analyticsRoutes);
app.register(notificationRoutes);
app.register(aiRoutes);
app.register(teamRoutes);
app.register(settingsRoutes);
app.register(websocketRoutes); // Register websocket route

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
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 HireFlow API is running at http://${HOST}:${PORT}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
