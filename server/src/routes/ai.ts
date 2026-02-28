import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../utils/auth';
import { success } from '../utils/response';
import { AIModelType } from '@hireflow/types';
import type { ProviderName } from '../services/ai/companyApiKeys';
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

export async function aiRoutes(app: FastifyInstance) {
    // General Chat Endpoint
    app.post('/api/ai/chat', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                prompt: z.string(),
                systemInstruction: z.string().optional(),
                modelId: z.string().optional(),
                keyId: z.string().trim().min(8).max(64).optional(),
            });
            const { prompt, systemInstruction, modelId, keyId } = schema.parse(request.body);

            // Determine model and provider
            const model = modelId || AIModelType.GEMINI_FLASH;
            const providerName = detectProvider(model);

            const generated = await generateWithCompanyFallback({
                companyId: user.companyId,
                prompt,
                systemInstruction,
                model,
                provider: providerName as ProviderName,
                preferredKeyId: keyId,
            });
            const response = generated.response;

            return success(response);
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });

    // AI-driven screening endpoint (kept separate from rule-engine evaluation route)
    app.post('/api/ai/screening/evaluate', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                resumeText: z.string(),
                jobDescription: z.string(),
                criteria: z.array(z.string()).optional(),
                modelId: z.string().optional(),
                keyId: z.string().trim().min(8).max(64).optional(),
            });
            const { resumeText, jobDescription, criteria, modelId, keyId } = schema.parse(request.body);

            // Construct Prompt
            const systemPrompt = `You are an expert HR recruiter. Evaluate the candidate's resume against the job description.
            Return a JSON object with:
            - pass: boolean (true if candidate meets >70% requirements)
            - score: number (0-100)
            - reason: string (summary of fit)
            - analysis: string (detailed breakdown)
            
            Do not include markdown formatting (like \`\`\`json). Just the raw JSON string.`;

            const userPrompt = `
            JOB DESCRIPTION:
            ${jobDescription}

            CANDIDATE RESUME:
            ${resumeText.substring(0, 8000)} // Truncate to avoid token limits if naive

            CRITERIA:
            ${criteria?.join('\n') || 'General Fit'}
            `;

            const model = modelId || AIModelType.GEMINI_FLASH;
            const providerName = detectProvider(model);

            const generated = await generateWithCompanyFallback({
                companyId: user.companyId,
                prompt: userPrompt,
                systemInstruction: systemPrompt,
                model,
                provider: providerName as ProviderName,
                preferredKeyId: keyId,
            });
            const response = generated.response;

            // Parse JSON response
            let jsonResponse;
            try {
                // simple cleanup if model returns markdown block
                const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                jsonResponse = JSON.parse(cleanText);
            } catch (e) {
                // Fallback if JSON parsing fails
                jsonResponse = {
                    pass: false,
                    score: 0,
                    reason: 'Failed to parse AI response',
                    raw: response.text
                };
            }

            return success({
                ...jsonResponse,
                meta: {
                    model: response.model,
                    tokens: response.usage,
                    latency: response.latencyMs
                }
            });

        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
