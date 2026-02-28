import type { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { AIModelType } from '@hireflow/types';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import type { ProviderName } from '../ai/companyApiKeys';
import { generateWithCompanyFallback } from '../ai/runtimeFallback';
import { OpenAIRawService } from '../ai/openaiRawService';
import { loadInterviewAiRuntimeConfig, type InterviewAiRuntimeConfig } from './modelConfig';
import {
    XIAOFAN_BRAND_NAME,
    XIAOFAN_RESULT_ACTION,
    XIAOFAN_SESSION_ACTION,
    buildXiaofanExtractionSystemPrompt,
    buildXiaofanExtractionUserPrompt,
    createDefaultXiaofanResult,
    createXiaofanSessionId,
    normalizeXiaofanResult,
    parseLooseJson,
    xiaofanResultSaveSchema,
} from './xiaofan';

const xiaofanResultSaveRequestSchema = z.object({
    sessionId: z.string().trim().min(12).max(96).optional(),
    personal_info: z.record(z.unknown()).optional(),
    summary: z.string().trim().min(2).max(4000).optional(),
    recommendation: z.enum(['strong_hire', 'hire', 'maybe', 'no_hire']).optional(),
    model: z.string().trim().min(2).max(120).optional(),
    forceRegenerate: z.boolean().optional(),
});

type XiaofanResultSaveRequest = z.infer<typeof xiaofanResultSaveRequestSchema>;
type XiaofanApiMode = 'gateway' | 'raw_openai';

export type PublicInterviewContext = {
    id: string;
    token: string;
    status: string;
    startTime: Date;
    endTime: Date | null;
    candidate: { name: string };
    job: { title: string; descriptionJd: string; companyId: string };
};

export type XiaofanResultEnvelope = {
    sessionId: string;
    summary: string;
    recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
    model?: string;
    personalInfo: Record<string, unknown>;
    savedAt: string;
};

function isOpenAICompatibleModel(modelId: string): boolean {
    return modelId.startsWith('gpt')
        || modelId.startsWith('codex')
        || modelId.startsWith('deepseek')
        || modelId.startsWith('qwen');
}

export class XiaofanResultService {
    private static instance: XiaofanResultService;
    private readonly openAIRaw = OpenAIRawService.getInstance();

    private constructor() { }

    public static getInstance(): XiaofanResultService {
        if (!XiaofanResultService.instance) {
            XiaofanResultService.instance = new XiaofanResultService();
        }
        return XiaofanResultService.instance;
    }

    public parseResultSaveRequest(payload: unknown): XiaofanResultSaveRequest {
        return xiaofanResultSaveRequestSchema.parse(payload || {});
    }

    public async findInterviewByToken(token: string): Promise<PublicInterviewContext | null> {
        const interview = await prisma.interview.findUnique({
            where: { token },
            include: {
                candidate: {
                    select: { name: true },
                },
                job: {
                    select: {
                        title: true,
                        descriptionJd: true,
                        companyId: true,
                    },
                },
            },
        });

        if (!interview) return null;
        return {
            id: interview.id,
            token: interview.token,
            status: interview.status,
            startTime: interview.startTime,
            endTime: interview.endTime,
            candidate: {
                name: interview.candidate.name || 'Candidate',
            },
            job: {
                title: interview.job.title,
                descriptionJd: interview.job.descriptionJd || '',
                companyId: interview.job.companyId,
            },
        };
    }

    public async ensureSessionId(companyId: string, interviewId: string): Promise<string> {
        const existing = await this.getLatestSessionId(companyId, interviewId);
        if (existing) return existing;

        const sessionId = createXiaofanSessionId();
        await prisma.auditLog.create({
            data: {
                companyId,
                action: XIAOFAN_SESSION_ACTION,
                targetType: 'interview',
                targetId: interviewId,
                metadata: {
                    sessionId,
                    source: 'xiaofan',
                    brand: XIAOFAN_BRAND_NAME,
                    timestamp: new Date().toISOString(),
                } satisfies Prisma.InputJsonObject,
            },
        });

        return sessionId;
    }

    public async getLatestResult(companyId: string, interviewId: string): Promise<XiaofanResultEnvelope | null> {
        const latest = await prisma.auditLog.findFirst({
            where: {
                companyId,
                action: XIAOFAN_RESULT_ACTION,
                targetType: 'interview',
                targetId: interviewId,
            },
            orderBy: { createdAt: 'desc' },
            select: {
                metadata: true,
                createdAt: true,
            },
        });

        const envelope = this.toResultEnvelope(latest?.metadata);
        if (!envelope) return null;
        if (!envelope.savedAt && latest) {
            envelope.savedAt = latest.createdAt.toISOString();
        }
        return envelope;
    }

    public async saveResult(params: {
        interview: PublicInterviewContext;
        payload: unknown;
    }): Promise<XiaofanResultEnvelope> {
        const parsed = this.parseResultSaveRequest(params.payload);
        const sessionId = parsed.sessionId || await this.ensureSessionId(
            params.interview.job.companyId,
            params.interview.id
        );

        if (!parsed.forceRegenerate) {
            const existing = await this.getLatestResult(params.interview.job.companyId, params.interview.id);
            if (existing) {
                return existing;
            }
        }

        const resultPayload = await this.generateResult({
            interview: params.interview,
            sessionId,
        });

        return await this.persistResult({
            companyId: params.interview.job.companyId,
            interviewId: params.interview.id,
            result: resultPayload,
        });
    }

    public async ensureResult(interview: PublicInterviewContext): Promise<XiaofanResultEnvelope> {
        const sessionId = await this.ensureSessionId(interview.job.companyId, interview.id);
        const existing = await this.getLatestResult(interview.job.companyId, interview.id);
        if (existing) return existing;

        const generated = await this.generateResult({
            interview,
            sessionId,
        });
        return await this.persistResult({
            companyId: interview.job.companyId,
            interviewId: interview.id,
            result: generated,
        });
    }

    private async generateResult(params: {
        interview: PublicInterviewContext;
        sessionId: string;
    }): Promise<z.infer<typeof xiaofanResultSaveSchema>> {
        const messages = await prisma.interviewMessage.findMany({
            where: { interviewId: params.interview.id },
            orderBy: { createdAt: 'asc' },
            select: {
                role: true,
                content: true,
            },
        });

        const transcript = messages
            .filter((item) => item.role === 'assistant' || item.role === 'user')
            .map((item) => `${item.role}: ${item.content}`)
            .join('\n')
            .slice(0, 16000);

        if (!transcript.trim()) {
            return createDefaultXiaofanResult(params.sessionId);
        }

        const runtimeConfig = await loadInterviewAiRuntimeConfig(params.interview.job.companyId);
        try {
            const extractionText = await this.generateResultText({
                interview: params.interview,
                transcript,
                runtimeConfig,
            });

            const normalized = normalizeXiaofanResult(parseLooseJson(extractionText), {
                sessionId: params.sessionId,
                model: runtimeConfig.model,
                summaryFallback: extractionText.slice(0, 600),
            });

            if (normalized) return normalized;
            return createDefaultXiaofanResult(params.sessionId, runtimeConfig.model);
        } catch (error) {
            logger.error({ err: error }, 'Failed to generate Xiaofan interview result');
            return createDefaultXiaofanResult(params.sessionId, runtimeConfig.model);
        }
    }

    private async generateResultText(params: {
        interview: PublicInterviewContext;
        transcript: string;
        runtimeConfig: InterviewAiRuntimeConfig;
    }): Promise<string> {
        const systemPrompt = buildXiaofanExtractionSystemPrompt({
            candidateName: params.interview.candidate.name,
            jobTitle: params.interview.job.title,
        });
        const userPrompt = buildXiaofanExtractionUserPrompt({
            transcript: params.transcript,
        });

        if (this.getApiMode() === 'raw_openai') {
            const runtimeUsesOpenAIModel = isOpenAICompatibleModel(params.runtimeConfig.model);
            const rawResponse = await this.openAIRaw.sendPrompt(systemPrompt, userPrompt, {
                model: process.env.XIAOFAN_OPENAI_MODEL?.trim()
                    || (runtimeUsesOpenAIModel ? params.runtimeConfig.model : AIModelType.GPT_4O),
                temperature: params.runtimeConfig.temperature,
                maxTokens: params.runtimeConfig.maxTokens,
                apiKey: runtimeUsesOpenAIModel ? params.runtimeConfig.apiKey : undefined,
                baseUrl: runtimeUsesOpenAIModel
                    ? (params.runtimeConfig.baseUrl || process.env.XIAOFAN_OPENAI_BASE_URL)
                    : process.env.XIAOFAN_OPENAI_BASE_URL,
            });
            const text = this.openAIRaw.extractText(rawResponse).trim();
            if (!text) {
                throw new Error('Raw OpenAI response missing message content');
            }
            return text;
        }

        const aiResponse = (await generateWithCompanyFallback({
            companyId: params.interview.job.companyId,
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: params.runtimeConfig.model,
            temperature: params.runtimeConfig.temperature,
            maxTokens: params.runtimeConfig.maxTokens,
            provider: (params.runtimeConfig.provider || undefined) as ProviderName | undefined,
            preferredKeyId: params.runtimeConfig.apiKeyId,
            primary: {
                id: params.runtimeConfig.apiKeyId,
                keyName: params.runtimeConfig.apiKeyName,
                apiKey: params.runtimeConfig.apiKey,
                baseUrl: params.runtimeConfig.baseUrl,
            },
        })).response;
        return aiResponse.text.trim();
    }

    private getApiMode(): XiaofanApiMode {
        const raw = (process.env.XIAOFAN_API_MODE || '').trim().toLowerCase();
        return raw === 'raw_openai' ? 'raw_openai' : 'gateway';
    }

    private async persistResult(params: {
        companyId: string;
        interviewId: string;
        result: z.infer<typeof xiaofanResultSaveSchema>;
    }): Promise<XiaofanResultEnvelope> {
        const savedAt = new Date().toISOString();
        const metadata: Prisma.InputJsonObject = {
            sessionId: params.result.sessionId,
            summary: params.result.summary,
            recommendation: params.result.recommendation,
            personal_info: this.toPrismaJsonObject(params.result.personal_info as unknown as Record<string, unknown>),
            model: params.result.model || null,
            source: 'xiaofan',
            brand: XIAOFAN_BRAND_NAME,
            savedAt,
        };

        await prisma.auditLog.create({
            data: {
                companyId: params.companyId,
                action: XIAOFAN_RESULT_ACTION,
                targetType: 'interview',
                targetId: params.interviewId,
                metadata,
            },
        });

        const updateData: Prisma.InterviewUpdateInput = {
            feedback: params.result.summary,
        };
        if (params.result.model) {
            updateData.aiModel = params.result.model;
        }

        await prisma.interview.update({
            where: { id: params.interviewId },
            data: updateData,
        });

        return {
            sessionId: params.result.sessionId,
            summary: params.result.summary,
            recommendation: params.result.recommendation,
            model: params.result.model,
            personalInfo: params.result.personal_info as unknown as Record<string, unknown>,
            savedAt,
        };
    }

    private async getLatestSessionId(companyId: string, interviewId: string): Promise<string | null> {
        const latest = await prisma.auditLog.findFirst({
            where: {
                companyId,
                action: XIAOFAN_SESSION_ACTION,
                targetType: 'interview',
                targetId: interviewId,
            },
            orderBy: { createdAt: 'desc' },
            select: {
                metadata: true,
            },
        });
        return this.getSessionIdFromMetadata(latest?.metadata);
    }

    private getMetadataRecord(metadata: unknown): Record<string, unknown> {
        if (!metadata || typeof metadata !== 'object') return {};
        return metadata as Record<string, unknown>;
    }

    private getSessionIdFromMetadata(metadata: unknown): string | null {
        const record = this.getMetadataRecord(metadata);
        const value = record.sessionId;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private toResultEnvelope(metadata: unknown): XiaofanResultEnvelope | null {
        const record = this.getMetadataRecord(metadata);
        const sessionId = this.getSessionIdFromMetadata(record);
        const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
        const recommendationRaw = typeof record.recommendation === 'string' ? record.recommendation : 'maybe';
        const recommendation = (
            recommendationRaw === 'strong_hire'
            || recommendationRaw === 'hire'
            || recommendationRaw === 'maybe'
            || recommendationRaw === 'no_hire'
        ) ? recommendationRaw : 'maybe';

        if (!sessionId || !summary) return null;

        return {
            sessionId,
            summary,
            recommendation,
            model: typeof record.model === 'string' ? record.model : undefined,
            personalInfo: this.getMetadataRecord(record.personal_info),
            savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
        };
    }

    private toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | null {
        if (value === null) return null;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.toPrismaJsonValue(item));
        }
        if (typeof value === 'object') {
            const normalized: Record<string, Prisma.InputJsonValue | null> = {};
            for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
                normalized[key] = this.toPrismaJsonValue(item);
            }
            return normalized;
        }
        return value === undefined ? null : String(value);
    }

    private toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
        const normalized: Record<string, Prisma.InputJsonValue | null> = {};
        for (const [key, item] of Object.entries(value)) {
            normalized[key] = this.toPrismaJsonValue(item);
        }
        return normalized as Prisma.InputJsonObject;
    }
}
