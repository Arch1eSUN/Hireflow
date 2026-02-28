import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AIModelType } from '@hireflow/types';
import { prisma } from '../../utils/prisma';
import { generateWithCompanyFallback } from '../ai/runtimeFallback';
import { OpenAIRawService } from '../ai/openaiRawService';
import type { ProviderName } from '../ai/companyApiKeys';
import { STTService } from '../audio/stt';
import { TTSService } from '../audio/tts';
import { SocketManager } from '../socket/manager';
import { loadInterviewAiRuntimeConfig, type InterviewAiRuntimeConfig } from './modelConfig';
import { buildXiaofanQuestionPlan, type XiaofanQuestionPlan } from './questionPlanner';
import {
    buildXiaofanConversationSystemPrompt,
    buildXiaofanOpeningMessage,
} from './xiaofan';
import {
    type ConversationMessage,
    type ConversationRole,
    buildSystemPrompt as buildSystemPromptFn,
    buildPromptWithHistory as buildPromptWithHistoryFn,
    buildTurnFlowDirective as buildTurnFlowDirectiveFn,
    postProcessAssistantText as postProcessAssistantTextFn,
    buildContinuationQuestion as buildContinuationQuestionFn,
    generateFallbackText,
} from './promptBuilder';

type InterviewTurnState = 'listening' | 'thinking' | 'speaking';

type InterviewContext = {
    id: string;
    type: string;
    job: {
        title: string;
        department: string;
        type: string;
        descriptionJd: string;
        requirements: string[];
        companyId: string;
    };
    candidate: {
        name: string;
    };
};

type CandidateVoiceMode = {
    stt: 'server' | 'browser';
    tts: 'server' | 'browser';
};

/** 读取可选的面试运行时微调参数（不在 env.ts 中强校验） */
function readNumberEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = Number.parseFloat(process.env[name] || '');
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
}

function isOpenAICompatibleModel(modelId: string): boolean {
    return modelId.startsWith('gpt')
        || modelId.startsWith('codex')
        || modelId.startsWith('deepseek')
        || modelId.startsWith('qwen');
}

export class InterviewOrchestrator {
    private conversationHistory: ConversationMessage[] = [];
    private audioBuffer: Buffer[] = [];
    private readonly interviewId: string;
    private readonly socketManager = SocketManager.getInstance();
    private readonly stt = STTService.getInstance();
    private readonly tts = TTSService.getInstance();
    private readonly openAIRaw = OpenAIRawService.getInstance();

    private context: InterviewContext | null = null;
    private aiRuntimeConfig: InterviewAiRuntimeConfig = {
        model: AIModelType.GPT_4O,
        temperature: 0.7,
        maxTokens: 2048,
    };
    private questionPlan: XiaofanQuestionPlan | null = null;
    private questionPlanPromise: Promise<void> | null = null;
    private greetingDelivered = false;
    private readonly initPromise: Promise<void>;
    private disposed = false;
    private turnState: InterviewTurnState = 'listening';
    private turnProcessing = false;
    private lastInputGateNoticeAt = 0;
    private pendingVadStopTimer: NodeJS.Timeout | null = null;
    private pendingPassiveTurnTimer: NodeJS.Timeout | null = null;
    private pendingSttRecoveryTimer: NodeJS.Timeout | null = null;
    private audioMimeType: string | undefined = undefined;
    private readonly vadStopDebounceMs = Math.round(readNumberEnv('XIAOFAN_VAD_STOP_DEBOUNCE_MS', 900, 200, 2800));
    private readonly minTurnAudioBytes = Math.round(readNumberEnv('XIAOFAN_MIN_TURN_AUDIO_BYTES', 2600, 512, 64000));
    private readonly minTurnAudioChunks = Math.round(readNumberEnv('XIAOFAN_MIN_TURN_AUDIO_CHUNKS', 3, 1, 20));
    private readonly passiveTurnIdleMs = Math.round(readNumberEnv('XIAOFAN_PASSIVE_TURN_IDLE_MS', 1700, 600, 5000));
    private readonly minUserTurnsBeforeWrap = Math.round(readNumberEnv('XIAOFAN_MIN_USER_TURNS_BEFORE_WRAP', 5, 2, 18));
    private readonly sttFailureFallbackThreshold = Math.round(readNumberEnv('XIAOFAN_STT_FAILURE_FALLBACK_THRESHOLD', 2, 1, 8));
    private readonly sttEmptyFallbackThreshold = Math.round(readNumberEnv('XIAOFAN_STT_EMPTY_FALLBACK_THRESHOLD', 3, 1, 10));
    private readonly sttFallbackHoldMs = Math.round(readNumberEnv('XIAOFAN_STT_FALLBACK_HOLD_MS', 180000, 30000, 900000));
    private readonly speechCaptureHintCooldownMs = Math.round(readNumberEnv('XIAOFAN_SPEECH_CAPTURE_HINT_COOLDOWN_MS', 2200, 600, 8000));
    private lastSpeechCaptureHintAt = 0;
    private currentTurnChunkCount = 0;
    private lastAudioChunkAt = 0;
    private sttConsecutiveFailures = 0;
    private sttConsecutiveEmpty = 0;
    private serverSttFallbackUntil = 0;

    private static sessions: Map<string, InterviewOrchestrator> = new Map();

    private constructor(interviewId: string) {
        this.interviewId = interviewId;
        this.initPromise = this.init();
    }

    public static getSession(interviewId: string): InterviewOrchestrator {
        if (!this.sessions.has(interviewId)) {
            this.sessions.set(interviewId, new InterviewOrchestrator(interviewId));
        }
        return this.sessions.get(interviewId)!;
    }

    public static releaseSession(interviewId: string): void {
        const session = this.sessions.get(interviewId);
        if (!session) return;
        session.dispose();
        this.sessions.delete(interviewId);
    }

    public async beginInterviewGreeting(force = false): Promise<void> {
        await this.ensureReady();
        if (this.greetingDelivered && !force) return;
        if (this.turnProcessing) return;

        this.turnProcessing = true;
        this.setTurnState('thinking');
        try {
            if (!this.questionPlan && this.questionPlanPromise) {
                await this.withTimeout(this.questionPlanPromise, 2200, 'Question plan warmup timeout').catch(() => undefined);
            }
            const greeting = buildXiaofanOpeningMessage(
                this.context?.candidate?.name,
                this.questionPlan?.coreQuestions?.[0]
            );
            this.greetingDelivered = true;
            await this.emitAssistantMessage(greeting);
        } catch (error) {
            logger.error({ err: error }, 'Failed to emit XiaoFan opening message');
            this.setTurnState('listening');
        } finally {
            this.turnProcessing = false;
        }
    }

    public handleAudio(base64Chunk: string, mimeType?: string): void {
        if (!this.canAcceptCandidateInput()) {
            this.resetAudioTurnBuffer();
            this.notifyInputGate();
            return;
        }

        try {
            const chunk = Buffer.from(base64Chunk, 'base64');
            if (chunk.length === 0) return;
            this.audioBuffer.push(chunk);
            this.currentTurnChunkCount += 1;
            this.lastAudioChunkAt = Date.now();
            if (typeof mimeType === 'string' && mimeType.trim().length > 0) {
                this.audioMimeType = mimeType.trim();
            }
            this.schedulePassiveTurnProcess();
        } catch (error) {
            logger.error({ err: error }, 'Error decoding audio chunk');
        }
    }

    public async handleVad(status: 'speaking_start' | 'speaking_stop'): Promise<void> {
        if (!this.canAcceptCandidateInput()) {
            if (status === 'speaking_start') {
                this.resetAudioTurnBuffer();
            }
            this.notifyInputGate();
            return;
        }

        if (status === 'speaking_start') {
            this.clearPendingVadStop();
            this.clearPendingPassiveTurn();
            this.resetAudioTurnBuffer();
            return;
        }
        if (status === 'speaking_stop') {
            this.scheduleProcessTurn();
        }
    }

    public async handleUserText(rawText: string): Promise<void> {
        if (this.disposed) return;
        await this.ensureReady();
        if (!this.canAcceptCandidateInput()) {
            this.notifyInputGate();
            return;
        }
        await this.processUserTranscript(rawText);
    }

    public getTurnState(): InterviewTurnState {
        return this.turnState;
    }

    public async getCandidateVoiceMode(): Promise<CandidateVoiceMode> {
        await this.ensureReady();
        return {
            stt: this.canUseServerStt() ? 'server' : 'browser',
            tts: this.canUseServerTts() ? 'server' : 'browser',
        };
    }

    private async ensureReady(): Promise<void> {
        if (this.disposed) return;
        await this.initPromise;
    }

    private async init(): Promise<void> {
        try {
            const interview = await prisma.interview.findUnique({
                where: { id: this.interviewId },
                include: {
                    job: {
                        select: {
                            title: true,
                            department: true,
                            type: true,
                            descriptionJd: true,
                            requirements: true,
                            companyId: true,
                        },
                    },
                    candidate: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

            if (!interview) return;

            this.context = {
                id: interview.id,
                type: interview.type,
                job: {
                    title: interview.job.title,
                    department: interview.job.department || '',
                    type: interview.job.type || 'full-time',
                    descriptionJd: interview.job.descriptionJd || '',
                    requirements: interview.job.requirements || [],
                    companyId: interview.job.companyId,
                },
                candidate: {
                    name: interview.candidate.name || 'Candidate',
                },
            };

            this.aiRuntimeConfig = await loadInterviewAiRuntimeConfig(interview.job.companyId);
            this.questionPlanPromise = this.prepareQuestionPlan();
            try {
                await prisma.interview.update({
                    where: { id: this.interviewId },
                    data: {
                        aiModel: this.aiRuntimeConfig.model,
                    },
                });
            } catch (error) {
                logger.error({ err: error, interviewId: this.interviewId }, 'Failed to persist interview AI model');
            }

            const existingMessages = await prisma.interviewMessage.findMany({
                where: { interviewId: this.interviewId },
                orderBy: { createdAt: 'asc' },
                take: 40,
                select: {
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });

            this.conversationHistory = existingMessages
                .map((item) => {
                    const role = item.role === 'assistant' || item.role === 'system' ? item.role : 'user';
                    return {
                        role,
                        content: item.content,
                        timestamp: item.createdAt.getTime(),
                    } as ConversationMessage;
                });

            this.greetingDelivered = existingMessages.some((item) => item.role === 'assistant');
        } catch (error) {
            logger.error({ err: error, interviewId: this.interviewId }, 'Failed to init interview orchestrator');
        }
    }

    private async processTurn(): Promise<void> {
        if (this.disposed) return;
        this.clearPendingVadStop();
        this.clearPendingPassiveTurn();
        await this.ensureReady();
        if (!this.canAcceptCandidateInput()) {
            this.resetAudioTurnBuffer();
            return;
        }
        if (!this.canUseServerStt()) {
            this.resetAudioTurnBuffer();
            return;
        }
        if (this.audioBuffer.length === 0) return;

        const chunkCount = this.currentTurnChunkCount;
        const mimeType = this.audioMimeType;
        const fullAudio = Buffer.concat(this.audioBuffer);
        this.resetAudioTurnBuffer();
        if (fullAudio.length < this.minTurnAudioBytes && chunkCount < this.minTurnAudioChunks) {
            this.registerEmptyTurn('too_short');
            return;
        }

        let transcript = '';
        try {
            const sttProvider = this.resolveSttProvider();
            transcript = await this.stt.transcribe(fullAudio, {
                provider: sttProvider,
                apiKey: this.resolveSttApiKey(),
                baseUrl: this.resolveSttBaseUrl(),
                model: this.resolveSttModel(sttProvider),
                language: env.XIAOFAN_STT_LANGUAGE || 'zh',
                prompt: this.buildSttPrompt(),
                mimeType,
            });
        } catch (error) {
            logger.error({ err: error }, 'STT failed');
            this.registerSttFailure('stt_failed');
            return;
        }

        if (!transcript.trim()) {
            this.registerEmptyTurn('empty_transcript');
            return;
        }
        this.resetSttHealthState();
        await this.processUserTranscript(transcript.trim());
    }

    private async processUserTranscript(rawText: string): Promise<void> {
        const transcript = rawText.trim();
        if (!transcript) return;
        if (this.turnProcessing || this.turnState !== 'listening') {
            this.notifyInputGate();
            return;
        }

        this.turnProcessing = true;
        this.setTurnState('thinking');
        try {
            await this.emitUserMessage(transcript);

            let aiText = '';
            try {
                aiText = await this.withTimeout(this.generateAssistantText(), 12000, 'LLM generation timeout');
            } catch (error) {
                logger.error({ err: error }, 'LLM generation failed');
                try {
                    aiText = this.generateAssistantFallbackText(transcript);
                } catch (fallbackError) {
                    logger.error({ err: fallbackError }, 'LLM fallback generation failed');
                    this.socketManager.sendToCandidate(this.interviewId, {
                        type: 'ai_text',
                        text: '小梵面试官正在恢复连接，请稍候继续。',
                    });
                    return;
                }
            }

            if (!aiText) {
                aiText = '感谢你的回答。接下来请再具体讲讲你在这个经历里最有挑战的一次决策。';
            }
            aiText = this.postProcessAssistantText(aiText, transcript);

            await this.emitAssistantMessage(aiText);
        } finally {
            this.turnProcessing = false;
            if (!this.disposed) this.setTurnState('listening');
        }
    }

    private buildSystemPrompt(): string {
        return buildSystemPromptFn(this.context, this.questionPlan);
    }

    private buildPromptWithHistory(): string {
        return buildPromptWithHistoryFn(this.conversationHistory);
    }

    private getUserTurnCount(): number {
        return this.conversationHistory.filter((item) => item.role === 'user').length;
    }

    private buildTurnFlowDirective(): string {
        return buildTurnFlowDirectiveFn(
            this.getUserTurnCount(),
            this.minUserTurnsBeforeWrap,
            this.questionPlan,
        );
    }

    private postProcessAssistantText(aiText: string, lastUserText: string): string {
        return postProcessAssistantTextFn(
            aiText,
            lastUserText,
            this.getUserTurnCount(),
            this.minUserTurnsBeforeWrap,
            this.questionPlan,
        );
    }

    private generateAssistantFallbackText(lastUserText?: string): string {
        return generateFallbackText(lastUserText, this.getUserTurnCount());
    }

    private async generateAssistantText(): Promise<string> {
        const systemPrompt = this.buildSystemPrompt();
        const flowDirective = this.buildTurnFlowDirective();
        const userPrompt = [flowDirective, this.buildPromptWithHistory()].filter(Boolean).join('\n\n');
        const apiMode = (env.XIAOFAN_API_MODE || '').trim().toLowerCase();

        if (apiMode === 'raw_openai') {
            const runtimeUsesOpenAIModel = isOpenAICompatibleModel(this.aiRuntimeConfig.model);
            const rawResponse = await this.openAIRaw.sendPrompt(systemPrompt, userPrompt, {
                model: env.XIAOFAN_OPENAI_MODEL?.trim()
                    || (runtimeUsesOpenAIModel ? this.aiRuntimeConfig.model : AIModelType.GPT_4O),
                temperature: this.aiRuntimeConfig.temperature,
                maxTokens: this.aiRuntimeConfig.maxTokens,
                apiKey: runtimeUsesOpenAIModel ? this.aiRuntimeConfig.apiKey : undefined,
                baseUrl: runtimeUsesOpenAIModel
                    ? (this.aiRuntimeConfig.baseUrl || env.XIAOFAN_OPENAI_BASE_URL)
                    : env.XIAOFAN_OPENAI_BASE_URL,
            });
            return this.openAIRaw.extractText(rawResponse).trim();
        }

        const companyId = this.context?.job.companyId;
        if (!companyId) {
            throw new Error('Interview context not initialized');
        }

        const response = (await generateWithCompanyFallback({
            companyId,
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: this.aiRuntimeConfig.model,
            temperature: this.aiRuntimeConfig.temperature,
            maxTokens: this.aiRuntimeConfig.maxTokens,
            provider: (this.aiRuntimeConfig.provider || undefined) as ProviderName | undefined,
            preferredKeyId: this.aiRuntimeConfig.apiKeyId,
            primary: {
                id: this.aiRuntimeConfig.apiKeyId,
                keyName: this.aiRuntimeConfig.apiKeyName,
                apiKey: this.aiRuntimeConfig.apiKey,
                baseUrl: this.aiRuntimeConfig.baseUrl,
            },
        })).response;
        return response.text.trim();
    }


    private async prepareQuestionPlan(): Promise<void> {
        if (!this.context) return;
        try {
            this.questionPlan = await this.withTimeout(
                buildXiaofanQuestionPlan({
                    companyId: this.context.job.companyId,
                    candidateName: this.context.candidate.name,
                    jobTitle: this.context.job.title,
                    jobDescription: this.context.job.descriptionJd,
                    jobRequirements: this.context.job.requirements,
                    interviewType: this.context.type,
                    runtimeConfig: this.aiRuntimeConfig,
                }),
                9000,
                'Question plan generation timeout'
            );
        } catch (error) {
            logger.warn({ err: error }, 'Failed to prepare question plan before interview');
            this.questionPlan = null;
        }
    }

    private resolveSttProvider(): 'openai' | 'google' {
        const candidate = (this.aiRuntimeConfig.provider || '').trim().toLowerCase();
        const voiceProvider = (this.aiRuntimeConfig.voiceProvider || '').trim().toLowerCase();
        if (voiceProvider === 'google' || candidate === 'google' || this.aiRuntimeConfig.model.startsWith('gemini')) {
            return 'google';
        }
        return 'openai';
    }

    private resolveSttApiKey(): string | undefined {
        const sttProvider = this.resolveSttProvider();
        if (sttProvider === 'google') {
            return this.aiRuntimeConfig.apiKey;
        }
        return this.aiRuntimeConfig.voiceApiKey || this.aiRuntimeConfig.apiKey;
    }

    private resolveSttBaseUrl(): string | undefined {
        const sttProvider = this.resolveSttProvider();
        if (sttProvider === 'google') return undefined;
        return this.aiRuntimeConfig.voiceBaseUrl
            || this.aiRuntimeConfig.baseUrl
            || env.XIAOFAN_OPENAI_BASE_URL
            || undefined;
    }

    private resolveSttModel(sttProvider: 'openai' | 'google'): string | undefined {
        if (sttProvider === 'google') {
            return env.XIAOFAN_STT_GOOGLE_MODEL
                || env.XIAOFAN_GEMINI_STT_MODEL
                || AIModelType.GEMINI_FLASH;
        }
        return env.XIAOFAN_STT_MODEL || undefined;
    }

    private canUseServerStt(): boolean {
        if (Date.now() < this.serverSttFallbackUntil) {
            return false;
        }
        return Boolean(this.resolveSttApiKey());
    }

    private canUseServerTts(): boolean {
        const provider = (this.aiRuntimeConfig.voiceProvider || this.aiRuntimeConfig.provider || '').trim().toLowerCase();
        const hasVoiceKey = Boolean(this.aiRuntimeConfig.voiceApiKey || this.aiRuntimeConfig.apiKey);
        return hasVoiceKey && ['openai', 'deepseek', 'alibaba', 'custom'].includes(provider);
    }

    private buildSttPrompt(): string {
        const title = this.context?.job?.title || '岗位';
        const requirements = (this.context?.job?.requirements || []).slice(0, 8).join('，');
        return [
            `这是中文面试语音，请直接转写为简体中文，保留术语与数字。`,
            `面试岗位：${title}。`,
            requirements ? `岗位关键词：${requirements}。` : '',
            '不要总结，不要润色，不要补全未说出的内容。',
        ].join('\n');
    }

    private async withTimeout<T>(task: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
        let timer: NodeJS.Timeout | null = null;
        try {
            return await Promise.race([
                task,
                new Promise<T>((_, reject) => {
                    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private async emitUserMessage(content: string): Promise<void> {
        if (this.disposed) return;
        const message: ConversationMessage = {
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        this.conversationHistory.push(message);

        this.socketManager.broadcast(this.interviewId, {
            type: 'transcript',
            text: content,
            role: 'user',
            final: true,
        });

        await this.persistMessage('user', content);
    }

    private async emitAssistantMessage(content: string): Promise<void> {
        if (this.disposed) return;
        this.setTurnState('speaking');
        const message: ConversationMessage = {
            role: 'assistant',
            content,
            timestamp: Date.now(),
        };
        this.conversationHistory.push(message);

        this.socketManager.broadcast(this.interviewId, {
            type: 'ai_text',
            text: content,
        });

        await this.persistMessage('assistant', content);

        let streamedAudio = false;
        if (this.canUseServerTts()) {
            try {
                await this.tts.streamSpeech(
                    content,
                    (chunk: Buffer) => {
                        this.socketManager.sendToCandidate(this.interviewId, {
                            type: 'audio_playback',
                            data: chunk.toString('base64'),
                        });
                    },
                    {
                        apiKey: this.aiRuntimeConfig.voiceApiKey || this.aiRuntimeConfig.apiKey,
                        baseUrl: this.aiRuntimeConfig.voiceBaseUrl || this.aiRuntimeConfig.baseUrl || env.XIAOFAN_OPENAI_BASE_URL,
                    }
                );
                streamedAudio = true;
            } catch (error) {
                logger.error({ err: error }, 'TTS failed');
            }
        }

        if (!streamedAudio) {
            await this.delay(this.estimateSpeechDurationMs(content));
        }

        this.socketManager.sendToCandidate(this.interviewId, {
            type: 'assistant_audio_done',
        });
        this.setTurnState('listening');
    }

    private async persistMessage(role: ConversationRole, content: string): Promise<void> {
        if (this.disposed) return;
        try {
            await prisma.interviewMessage.create({
                data: {
                    interviewId: this.interviewId,
                    role,
                    content,
                },
            });
        } catch (error) {
            logger.error({ err: error, interviewId: this.interviewId }, 'Failed to persist interview message');
        }
    }

    private dispose() {
        this.disposed = true;
        this.clearPendingVadStop();
        this.clearPendingPassiveTurn();
        this.clearPendingSttRecovery();
        this.resetAudioTurnBuffer();
        this.conversationHistory = [];
        this.context = null;
        this.questionPlan = null;
        this.questionPlanPromise = null;
        this.turnState = 'listening';
        this.turnProcessing = false;
        this.resetSttHealthState();
        this.serverSttFallbackUntil = 0;
    }

    private canAcceptCandidateInput(): boolean {
        return !this.disposed
            && this.greetingDelivered
            && !this.turnProcessing
            && this.turnState === 'listening';
    }

    private setTurnState(nextState: InterviewTurnState): void {
        if (this.disposed) return;
        if (this.turnState === nextState) return;
        this.turnState = nextState;
        this.socketManager.broadcast(this.interviewId, {
            type: 'interview_turn_state',
            state: nextState,
        });
    }

    private notifyInputGate(): void {
        if (this.disposed) return;
        const now = Date.now();
        if (now - this.lastInputGateNoticeAt < 1200) return;
        this.lastInputGateNoticeAt = now;
        this.socketManager.sendToCandidate(this.interviewId, {
            type: 'input_gate',
            reason: this.turnState,
        });
    }

    private notifySpeechCaptureHint(
        text: string,
        reason: 'too_short' | 'stt_failed' | 'empty_transcript',
        force = false
    ): void {
        if (this.disposed) return;
        const now = Date.now();
        if (!force && now - this.lastSpeechCaptureHintAt < this.speechCaptureHintCooldownMs) {
            return;
        }
        this.lastSpeechCaptureHintAt = now;
        this.socketManager.sendToCandidate(this.interviewId, {
            type: 'speech_capture_hint',
            text,
            reason,
        });
    }

    private registerSttFailure(reason: 'stt_failed'): void {
        this.sttConsecutiveFailures += 1;
        this.notifySpeechCaptureHint('语音识别暂时不稳定，请再回答一次。', reason);
        if (this.sttConsecutiveFailures >= this.sttFailureFallbackThreshold) {
            this.fallbackToBrowserStt(reason);
        }
    }

    private registerEmptyTurn(reason: 'too_short' | 'empty_transcript'): void {
        this.sttConsecutiveEmpty += 1;
        const hintText = reason === 'too_short'
            ? '我没有完整听到你的回答，请再靠近麦克风重复一次。'
            : '我没有听清这段回答，请再说一遍。';
        this.notifySpeechCaptureHint(hintText, reason);
        if (this.sttConsecutiveEmpty >= this.sttEmptyFallbackThreshold) {
            this.fallbackToBrowserStt(reason);
        }
    }

    private fallbackToBrowserStt(reason: 'too_short' | 'stt_failed' | 'empty_transcript'): void {
        const now = Date.now();
        if (this.serverSttFallbackUntil > now) {
            return;
        }
        this.serverSttFallbackUntil = now + this.sttFallbackHoldMs;
        this.resetSttHealthState();
        this.socketManager.sendToCandidate(this.interviewId, {
            type: 'voice_mode',
            stt: 'browser',
            tts: this.canUseServerTts() ? 'server' : 'browser',
            fallbackReason: reason,
            fallbackUntil: this.serverSttFallbackUntil,
        });
        this.notifySpeechCaptureHint('已切换到浏览器语音识别模式，请在小梵说完后继续回答。', reason, true);
        this.scheduleSttRecovery();
    }

    private scheduleSttRecovery(): void {
        this.clearPendingSttRecovery();
        const waitMs = Math.max(500, this.serverSttFallbackUntil - Date.now());
        this.pendingSttRecoveryTimer = setTimeout(() => {
            this.pendingSttRecoveryTimer = null;
            if (this.disposed) return;
            if (!this.canUseServerStt()) return;
            this.socketManager.sendToCandidate(this.interviewId, {
                type: 'voice_mode',
                stt: 'server',
                tts: this.canUseServerTts() ? 'server' : 'browser',
                recovered: true,
            });
            this.notifySpeechCaptureHint('语音识别已恢复高精度模式。', 'stt_failed', true);
        }, waitMs);
    }

    private resetSttHealthState(): void {
        this.sttConsecutiveFailures = 0;
        this.sttConsecutiveEmpty = 0;
    }

    private clearPendingVadStop(): void {
        if (!this.pendingVadStopTimer) return;
        clearTimeout(this.pendingVadStopTimer);
        this.pendingVadStopTimer = null;
    }

    private clearPendingPassiveTurn(): void {
        if (!this.pendingPassiveTurnTimer) return;
        clearTimeout(this.pendingPassiveTurnTimer);
        this.pendingPassiveTurnTimer = null;
    }

    private clearPendingSttRecovery(): void {
        if (!this.pendingSttRecoveryTimer) return;
        clearTimeout(this.pendingSttRecoveryTimer);
        this.pendingSttRecoveryTimer = null;
    }

    private resetAudioTurnBuffer(): void {
        this.audioBuffer = [];
        this.audioMimeType = undefined;
        this.currentTurnChunkCount = 0;
        this.lastAudioChunkAt = 0;
    }

    private scheduleProcessTurn(): void {
        this.clearPendingVadStop();
        this.clearPendingPassiveTurn();
        this.pendingVadStopTimer = setTimeout(() => {
            this.pendingVadStopTimer = null;
            void this.processTurn().catch((error) => {
                logger.error({ err: error }, 'Deferred turn processing failed');
            });
        }, this.vadStopDebounceMs);
    }

    private schedulePassiveTurnProcess(): void {
        this.clearPendingPassiveTurn();
        if (!this.canAcceptCandidateInput()) return;
        this.pendingPassiveTurnTimer = setTimeout(() => {
            this.pendingPassiveTurnTimer = null;
            if (this.disposed) return;
            if (!this.canAcceptCandidateInput()) {
                this.resetAudioTurnBuffer();
                return;
            }
            if (this.audioBuffer.length === 0) return;
            const idleFor = Date.now() - this.lastAudioChunkAt;
            if (idleFor < this.passiveTurnIdleMs - 40) {
                this.schedulePassiveTurnProcess();
                return;
            }
            void this.processTurn().catch((error) => {
                logger.error({ err: error }, 'Passive turn processing failed');
            });
        }, this.passiveTurnIdleMs);
    }

    private estimateSpeechDurationMs(text: string): number {
        const plainLength = text.replace(/\s+/g, '').length;
        const charsPerSecondRaw = Number.parseFloat(process.env.XIAOFAN_SPEECH_CHARS_PER_SEC || '4.2');
        const charsPerSecond = Number.isFinite(charsPerSecondRaw) && charsPerSecondRaw > 0
            ? charsPerSecondRaw
            : 4.2;
        const durationSeconds = Math.max(1.2, Math.min(20, plainLength / charsPerSecond));
        return Math.round(durationSeconds * 1000);
    }

    private async delay(ms: number): Promise<void> {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, Math.max(0, ms));
        });
    }
}
