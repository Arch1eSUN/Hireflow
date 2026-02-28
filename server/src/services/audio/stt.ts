import { env } from '../../config/env';
import { logger } from '../../utils/logger';

type STTProvider = 'openai' | 'google';

type STTRequestOptions = {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    language?: string;
    provider?: STTProvider;
    prompt?: string;
    temperature?: number;
    mimeType?: string;
};

export class STTService {
    private static instance: STTService;
    private readonly defaultApiKey: string;
    private readonly defaultBaseUrl: string;
    private readonly defaultModel: string;
    private readonly defaultLanguage: string;
    private readonly defaultProvider: STTProvider;
    private readonly defaultMimeType: string;

    private constructor() {
        this.defaultApiKey = env.OPENAI_API_KEY || '';
        this.defaultBaseUrl = (env.XIAOFAN_STT_BASE_URL || env.XIAOFAN_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
        this.defaultModel = env.XIAOFAN_STT_MODEL || 'gpt-4o-mini-transcribe';
        this.defaultLanguage = env.XIAOFAN_STT_LANGUAGE || 'zh';
        this.defaultProvider = env.XIAOFAN_STT_PROVIDER || 'openai';
        this.defaultMimeType = env.XIAOFAN_STT_MIME_TYPE || 'audio/webm;codecs=opus';

        if (!this.defaultApiKey) {
            logger.warn('OPENAI_API_KEY not set. Runtime provider keys will be used when available.');
        }
    }

    public static getInstance(): STTService {
        if (!STTService.instance) {
            STTService.instance = new STTService();
        }
        return STTService.instance;
    }

    public async transcribe(audioBuffer: Buffer, options: STTRequestOptions = {}): Promise<string> {
        const provider: STTProvider = options.provider || this.defaultProvider;
        if (provider === 'google') {
            return this.transcribeWithGoogle(audioBuffer, options);
        }
        return this.transcribeWithOpenAI(audioBuffer, options);
    }

    private async transcribeWithOpenAI(audioBuffer: Buffer, options: STTRequestOptions): Promise<string> {
        const apiKey = options.apiKey || this.defaultApiKey;
        if (!apiKey) {
            throw new Error('STT Service: API key missing. Configure API key in Settings > AI providers.');
        }

        const baseUrl = (options.baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
        const model = options.model || this.defaultModel;
        const language = options.language || this.defaultLanguage;
        const mimeType = options.mimeType || this.defaultMimeType;
        const prompt = (options.prompt || '').trim();
        const temperature = typeof options.temperature === 'number' ? options.temperature : 0;

        const transcribeWithModel = async (
            modelName: string
        ): Promise<{ text: string; status: number; errorText?: string }> => {
            const blob = new Blob([audioBuffer as unknown as BlobPart], { type: mimeType });
            const formData = new FormData();
            formData.append('file', blob, 'audio.webm');
            formData.append('model', modelName);
            if (language.trim()) {
                formData.append('language', language.trim());
            }
            if (prompt.length > 0) {
                formData.append('prompt', prompt.slice(0, 800));
            }
            formData.append('temperature', String(temperature));

            const response = await fetch(`${baseUrl}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { text: '', status: response.status, errorText };
            }

            const data = await response.json();
            return {
                text: typeof data?.text === 'string' ? data.text.trim() : '',
                status: response.status,
            };
        };

        const configuredFallbackModel = (env.XIAOFAN_STT_FALLBACK_MODEL || '').trim();
        const modelCandidates = Array.from(new Set([
            model,
            configuredFallbackModel,
            'gpt-4o-mini-transcribe',
            'whisper-1',
        ].filter((item) => item.length > 0)));

        let lastError: { modelName: string; status: number; errorText?: string } | null = null;
        for (const candidateModel of modelCandidates) {
            const result = await transcribeWithModel(candidateModel);
            if (!result.errorText) {
                return result.text;
            }

            lastError = {
                modelName: candidateModel,
                status: result.status,
                errorText: result.errorText,
            };

            const shouldTryNextModel = result.status === 400
                || result.status === 404
                || result.status === 422
                || result.status === 501;
            if (!shouldTryNextModel) {
                break;
            }
        }

        if (lastError) {
            throw new Error(
                `STT(OpenAI) Error [${lastError.modelName}]: ${lastError.status} ${lastError.errorText || ''}`.trim()
            );
        }
        throw new Error('STT(OpenAI) Error: unknown transcribe failure');
    }

    private async transcribeWithGoogle(audioBuffer: Buffer, options: STTRequestOptions): Promise<string> {
        const apiKey = options.apiKey || env.GEMINI_API_KEY || this.defaultApiKey;
        if (!apiKey) {
            throw new Error('STT Service: Google API key missing.');
        }

        const model = options.model || env.XIAOFAN_STT_GOOGLE_MODEL || 'gemini-2.5-flash';
        const language = options.language || this.defaultLanguage;
        const mimeType = options.mimeType || this.defaultMimeType;
        const prompt = (options.prompt || '').trim() || `请将以下音频转写为${language === 'zh' ? '简体中文' : language}，只输出转写文本。`;

        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey });

        const response = await client.models.generateContent({
            model,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType,
                                data: audioBuffer.toString('base64'),
                            },
                        },
                    ],
                },
            ],
            config: {
                temperature: 0,
            },
        });

        return String(response.text || '')
            .replace(/^```[\w-]*\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
    }
}
