// ================================================
// HireFlow AI — Fastify 后端 API
// 模块化架构入口
// ================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { ApiResponse } from '@hireflow/types';

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
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
});

// ======= 通用响应 helpers =======
function success<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
    return { success: true, data, meta };
}

function error(code: string, message: string): ApiResponse<never> {
    return { success: false, error: { code, message } };
}

// ======= 健康检查 =======
app.get('/api/health', async () => {
    return success({
        status: 'ok',
        version: '2.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ======= Auth 模块 (占位) =======
app.post('/api/auth/login', async (request) => {
    // TODO: 实际认证逻辑
    return success({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600 * 1000,
    });
});

app.post('/api/auth/register', async (request) => {
    return success({ id: 'new-user-id', message: '注册成功' });
});

app.get('/api/auth/me', async (request) => {
    return success({
        id: 'u1',
        companyId: 'c1',
        email: 'zhangtong@hireflow.ai',
        name: '张通',
        role: 'admin',
        createdAt: '2026-01-01',
    });
});

// ======= 候选人模块 =======
app.get('/api/candidates', async (request) => {
    // TODO: 数据库查询
    return success([], { page: 1, pageSize: 20, total: 0 });
});

app.get('/api/candidates/:id', async (request) => {
    const { id } = request.params as { id: string };
    return success({ id, name: '候选人', stage: 'applied' });
});

// ======= 岗位模块 =======
app.get('/api/jobs', async () => {
    return success([], { page: 1, pageSize: 20, total: 0 });
});

app.post('/api/jobs', async (request) => {
    return success({ id: 'new-job-id', message: '岗位创建成功' });
});

// ======= 面试模块 =======
app.get('/api/interviews', async () => {
    return success([]);
});

app.post('/api/interviews', async (request) => {
    const interviewId = `iv-${Date.now()}`;
    const token = `tok-${Math.random().toString(36).slice(2, 10)}`;
    return success({
        id: interviewId,
        token,
        interviewLink: `http://localhost:3001/${token}`,
        status: 'pending',
    });
});

app.get('/api/interviews/:id', async (request) => {
    const { id } = request.params as { id: string };
    return success({ id, status: 'pending' });
});

// ======= 面试 Token 验证 (候选人端) =======
app.get('/api/interviews/token/:token', async (request) => {
    const { token } = request.params as { token: string };
    return success({
        valid: true,
        jobTitle: '高级前端工程师',
        companyName: 'HireFlow AI',
        type: 'technical',
        timeLimit: 30,
    });
});

// ======= 筛选规则 =======
app.post('/api/screening/evaluate', async (request) => {
    const body = request.body as Record<string, unknown>;
    return success({ pass: true, score: 85 });
});

// ======= AI 服务 =======
app.post('/api/ai/chat', async (request) => {
    // TODO: 接入 AI Gateway
    return success({
        text: '你好，这是一个模拟的 AI 回复。',
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 200,
    });
});

// ======= 分析数据 =======
app.get('/api/analytics/overview', async () => {
    return success({
        totalCandidates: 1245,
        activeJobs: 3,
        interviewsThisWeek: 18,
        hireRate: 0.729,
    });
});

// ======= 通知 =======
app.get('/api/notifications', async () => {
    return success([]);
});

// ======= 启动服务器 =======
try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 HireFlow API is running at http://${HOST}:${PORT}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
