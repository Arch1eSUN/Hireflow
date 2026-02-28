import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { evaluateRule, calculateMatchScore, RULE_TEMPLATES } from '../services/screening/engine';
import type { RuleNode } from '@hireflow/types';
import { AIModelType } from '@hireflow/types';
import { listCompanyApiKeys, type ProviderName } from '../services/ai/companyApiKeys';
import { getCodexOAuthCredential } from '../services/ai/codexOAuth';
import { generateWithCompanyFallback } from '../services/ai/runtimeFallback';

function detectProvider(model: string): string {
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('codex')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('deepseek')) return 'deepseek';
    if (model.startsWith('qwen')) return 'alibaba';
    return 'custom';
}

function parseRuleJson(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const withoutFence = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    try {
        return JSON.parse(withoutFence);
    } catch {
        const first = withoutFence.indexOf('{');
        const last = withoutFence.lastIndexOf('}');
        if (first >= 0 && last > first) {
            try {
                return JSON.parse(withoutFence.slice(first, last + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

const providerPriority: ProviderName[] = ['openai', 'google', 'anthropic', 'deepseek', 'alibaba', 'custom'];
const providerDefaultModel: Record<ProviderName, string> = {
    google: AIModelType.GEMINI_FLASH,
    openai: AIModelType.GPT_4O,
    anthropic: AIModelType.CLAUDE_SONNET,
    deepseek: AIModelType.DEEPSEEK_CHAT,
    alibaba: AIModelType.QWEN_PLUS,
    custom: AIModelType.GPT_4O,
};

async function resolveScreeningRuntimeConfig(companyId: string): Promise<{
    model: string;
    temperature: number;
    maxTokens: number;
    provider: ProviderName;
}> {
    const settings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: {
            defaultModelId: true,
            resumeModelId: true,
            technicalModelId: true,
            temperature: true,
            maxTokens: true,
        },
    });

    const codexOAuth = await getCodexOAuthCredential(companyId);
    const connectedKeys = await listCompanyApiKeys(companyId);
    const connectedByProvider = providerPriority.filter((provider) => (
        connectedKeys.some((item) => item.provider === provider && item.status === 'connected')
    ));

    let model = (
        settings?.resumeModelId?.trim()
        || settings?.defaultModelId?.trim()
        || settings?.technicalModelId?.trim()
        || ''
    );

    if (!model) {
        if (codexOAuth?.models?.length) {
            model = codexOAuth.models[0];
        } else if (connectedByProvider.length > 0) {
            const firstProvider = connectedByProvider[0];
            model = providerDefaultModel[firstProvider];
        }
    }

    if (!model) {
        throw new Error('No available model. Please connect API key or Codex OAuth in Settings > AI.');
    }

    const provider = detectProvider(model) as ProviderName;
    return {
        model,
        temperature: settings?.temperature ?? 0.4,
        maxTokens: Math.min(settings?.maxTokens ?? 2048, 4096),
        provider,
    };
}

export async function screeningRoutes(app: FastifyInstance) {
    // Schema
    const RuleSchema = z.object({
        name: z.string(),
        description: z.string().optional(),
        jobId: z.string().optional(),
        conditions: z.any() // JSON
    });

    // CRUD
    app.post('/api/screening/rules', async (req, reply) => {
        const body = RuleSchema.parse(req.body);
        const user = await authenticate(req);
        const { companyId } = user;

        const rule = await prisma.screeningRule.create({
            data: {
                companyId,
                name: body.name,
                description: body.description,
                jobId: body.jobId,
                conditions: body.conditions,
                isTemplate: false
            }
        });
        return { success: true, data: rule };
    });

    app.get('/api/screening/rules', async (req, reply) => {
        const user = await authenticate(req);
        const { companyId } = user;
        const { jobId } = req.query as { jobId?: string };

        const rules = await prisma.screeningRule.findMany({
            where: { companyId, jobId: jobId || undefined },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: rules };
    });

    app.put('/api/screening/rules/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = RuleSchema.parse(req.body);
        const user = await authenticate(req);
        const { companyId } = user;

        const existing = await prisma.screeningRule.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
            return reply.status(404).send({ error: 'Rule not found' });
        }

        const rule = await prisma.screeningRule.update({
            where: { id },
            data: {
                name: body.name,
                description: body.description,
                jobId: body.jobId,
                conditions: body.conditions
            }
        });
        return { success: true, data: rule };
    });

    app.delete('/api/screening/rules/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const user = await authenticate(req);
        const { companyId } = user;

        const existing = await prisma.screeningRule.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
            return reply.status(404).send({ error: 'Rule not found' });
        }

        await prisma.screeningRule.delete({ where: { id } });
        return { success: true };
    });

    // Evaluation
    app.post('/api/screening/evaluate', async (req, reply) => {
        const user = await authenticate(req);
        const body = z.object({
            ruleId: z.string(),
            candidateData: z.record(z.any())
        }).parse(req.body);

        const rule = await prisma.screeningRule.findUnique({ where: { id: body.ruleId } });
        if (!rule || rule.companyId !== user.companyId) {
            return reply.status(404).send({ error: 'Rule not found' });
        }

        const conditions = rule.conditions as unknown as RuleNode;
        const pass = evaluateRule(body.candidateData, conditions);
        const score = calculateMatchScore(body.candidateData, conditions);

        return { success: true, data: { pass, score } };
    });

    app.post('/api/screening/batch-evaluate', async (req, reply) => {
        const user = await authenticate(req);
        const body = z.object({
            ruleId: z.string(),
            candidateIds: z.array(z.string())
        }).parse(req.body);

        const rule = await prisma.screeningRule.findUnique({ where: { id: body.ruleId } });
        if (!rule || rule.companyId !== user.companyId) {
            return reply.status(404).send({ error: 'Rule not found' });
        }
        const conditions = rule.conditions as unknown as RuleNode;

        const candidates = await prisma.candidate.findMany({
            where: {
                id: { in: body.candidateIds },
                companyId: user.companyId,
            }
        });

        const results = candidates.map(c => {
            // In reality, we should fetch parsed resume content.
            // Assuming candidate fields (skills, experience_years) are populated or we use flatten structure.
            // For now, simple check against candidate fields.
            const data = { ...c };
            return {
                candidateId: c.id,
                pass: evaluateRule(data, conditions),
                score: calculateMatchScore(data, conditions)
            };
        });

        return { success: true, data: results };
    });

    // AI Suggest
    app.post('/api/screening/ai-suggest', async (req, reply) => {
        const user = await authenticate(req);
        const { jobDescription } = z.object({ jobDescription: z.string() }).parse(req.body);

        const prompt = `
        Given this Job Description:
        "${jobDescription.substring(0, 1000)}..."
        
        Generate a screening rule JSON structure conforming to RuleNode interface.
        Example: { type: 'group', operator: 'AND', children: [{ type: 'condition', field: 'skills', operator: 'CONTAINS', value: 'React' }] }
        
        Return ONLY valid JSON.
        `;

        let runtimeConfig: Awaited<ReturnType<typeof resolveScreeningRuntimeConfig>>;
        try {
            runtimeConfig = await resolveScreeningRuntimeConfig(user.companyId);
        } catch (error: unknown) {
            return reply.status(400).send({
                error: extractErrorMessage(error) || 'No available AI model for screening suggestion',
            });
        }

        let response;
        try {
            const generated = await generateWithCompanyFallback({
                companyId: user.companyId,
                prompt,
                model: runtimeConfig.model,
                temperature: runtimeConfig.temperature,
                maxTokens: runtimeConfig.maxTokens,
                provider: runtimeConfig.provider,
            });
            response = generated.response;
        } catch (error: unknown) {
            return reply.status(502).send({
                error: extractErrorMessage(error) || 'AI generation request failed',
            });
        }

        const parsed = parseRuleJson(response.text || '');
        if (!parsed || typeof parsed !== 'object') {
            return reply.status(500).send({ error: 'AI generation failed to produce valid JSON' });
        }

        return {
            success: true,
            data: parsed,
            meta: {
                model: runtimeConfig.model,
                provider: runtimeConfig.provider,
            },
        };
    });

    // Templates
    app.get('/api/screening/templates', async (req, reply) => {
        await authenticate(req);
        return { success: true, data: RULE_TEMPLATES };
    });
}
