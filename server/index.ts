// ================================================
// HireFlow AI - Backend Server (Fastify + TypeScript)
// RESTful API with Zod validation
// ================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const server = Fastify({ logger: true });

// ======= CORS =======
server.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

// ======= Unified Response Helper =======
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
}

function success<T>(data: T): ApiResponse<T> {
    return { success: true, data };
}

function error(code: string, message: string): ApiResponse<never> {
    return { success: false, error: { code, message } };
}

// ======= Zod Schemas =======
const CreateInterviewLinkSchema = z.object({
    candidateId: z.string().uuid(),
    jobId: z.string().uuid(),
    stage: z.enum(['interview_1', 'interview_2', 'hr_interview']),
    expiresInHours: z.number().min(1).max(168).default(48),
    aiModel: z.string().optional(),
});

const ValidateInterviewLinkSchema = z.object({
    linkId: z.string().uuid(),
});

const ScreeningRuleSchema = z.object({
    jobId: z.string().uuid(),
    name: z.string().min(1).max(100),
    ruleDsl: z.any(), // Complex JSON DSL
    minScore: z.number().min(0).max(100).default(70),
});

// ======= In-Memory Store (Replace with PostgreSQL in production) =======
interface InterviewLink {
    id: string;
    candidateId: string;
    jobId: string;
    stage: string;
    token: string;
    url: string;
    expiresAt: Date;
    aiModel: string;
    status: 'pending' | 'used' | 'expired';
    createdAt: Date;
}

const interviewLinks: Map<string, InterviewLink> = new Map();
const aiUsageLogs: Array<{
    id: string;
    model: string;
    tokens: number;
    latencyMs: number;
    cost: number;
    timestamp: Date;
}> = [];

// ======= Routes =======

// Health check
server.get('/api/health', async () => {
    return success({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ======= Interview Link API =======

// Generate interview link
server.post('/api/interviews/link', async (request, reply) => {
    try {
        const body = CreateInterviewLinkSchema.parse(request.body);
        const linkId = uuidv4();
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);

        const link: InterviewLink = {
            id: linkId,
            candidateId: body.candidateId,
            jobId: body.jobId,
            stage: body.stage,
            token,
            url: `https://hireflow.ai/interview/${token}`,
            expiresAt,
            aiModel: body.aiModel || 'gemini-2.5-flash',
            status: 'pending',
            createdAt: new Date(),
        };

        interviewLinks.set(token, link);

        return success({
            id: linkId,
            url: link.url,
            token,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            reply.code(400);
            return error('VALIDATION_ERROR', err.errors.map(e => e.message).join(', '));
        }
        reply.code(500);
        return error('INTERNAL_ERROR', 'Failed to generate interview link');
    }
});

// Validate interview link
server.get('/api/interviews/link/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = interviewLinks.get(token);

    if (!link) {
        reply.code(404);
        return error('LINK_NOT_FOUND', 'Interview link not found or invalid');
    }

    if (new Date() > link.expiresAt) {
        link.status = 'expired';
        reply.code(410);
        return error('LINK_EXPIRED', 'This interview link has expired');
    }

    if (link.status === 'used') {
        reply.code(409);
        return error('LINK_USED', 'This interview link has already been used');
    }

    return success({
        id: link.id,
        stage: link.stage,
        aiModel: link.aiModel,
        expiresAt: link.expiresAt.toISOString(),
        status: link.status,
    });
});

// ======= AI Usage API =======

// Log AI usage
server.post('/api/ai/usage', async (request) => {
    const body = request.body as {
        model: string;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number;
        cost: number;
    };

    const log = {
        id: uuidv4(),
        model: body.model,
        tokens: (body.promptTokens || 0) + (body.completionTokens || 0),
        latencyMs: body.latencyMs || 0,
        cost: body.cost || 0,
        timestamp: new Date(),
    };
    aiUsageLogs.push(log);

    return success(log);
});

// Get AI usage stats
server.get('/api/ai/usage', async () => {
    const totalCalls = aiUsageLogs.length;
    const totalTokens = aiUsageLogs.reduce((sum, l) => sum + l.tokens, 0);
    const totalCost = aiUsageLogs.reduce((sum, l) => sum + l.cost, 0);
    const avgLatency = totalCalls > 0
        ? aiUsageLogs.reduce((sum, l) => sum + l.latencyMs, 0) / totalCalls
        : 0;

    return success({
        totalCalls,
        totalTokens,
        totalCost: Math.round(totalCost * 10000) / 10000,
        avgLatency: Math.round(avgLatency),
        recentLogs: aiUsageLogs.slice(-20),
    });
});

// ======= Screening Rules API =======

server.post('/api/screening/evaluate', async (request) => {
    const { candidate, rules } = request.body as {
        candidate: Record<string, unknown>;
        rules: { type: string; operator: string; field?: string; value?: unknown; children?: unknown[] };
    };

    // Simple evaluation engine (matching frontend logic)
    const evaluate = (candidateData: Record<string, unknown>, rule: any): boolean => {
        if (rule.type === 'group') {
            if (!rule.children || rule.children.length === 0) return true;
            if (rule.operator === 'AND') return rule.children.every((c: any) => evaluate(candidateData, c));
            if (rule.operator === 'OR') return rule.children.some((c: any) => evaluate(candidateData, c));
            return false;
        }
        if (rule.type === 'condition') {
            const val = candidateData[rule.field];
            switch (rule.operator) {
                case 'EQUALS': return val == rule.value;
                case 'GTE': return Number(val) >= Number(rule.value);
                case 'LTE': return Number(val) <= Number(rule.value);
                case 'CONTAINS':
                    if (Array.isArray(val)) return val.includes(rule.value);
                    return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
                default: return false;
            }
        }
        return false;
    };

    const result = evaluate(candidate, rules);

    return success({ pass: result, candidate });
});

// ======= WebRTC Signaling Placeholder =======
// In production, this would use WebSocket. Here we provide the REST endpoints.

server.get('/api/webrtc/ice-servers', async () => {
    return success({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    });
});

// ======= Start Server =======
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
    console.log(`🚀 HireFlow API Server running at ${address}`);
    console.log(`📊 Health: ${address}/api/health`);
});
