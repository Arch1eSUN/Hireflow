import { AIModelType } from '@hireflow/types';
import { logger } from '../../utils/logger';

type OpenAIRawMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

type OpenAIRawChatResponse = {
    id?: string;
    model?: string;
    choices?: Array<{
        index?: number;
        message?: {
            role?: string;
            content?: string | Array<{ type?: string; text?: string }> | null;
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    error?: {
        message?: string;
        type?: string;
        code?: string;
    };
};

type OpenAIRawImageResponse = {
    created?: number;
    data?: Array<{
        url?: string;
        b64_json?: string;
    }>;
    error?: {
        message?: string;
        type?: string;
        code?: string;
    };
};

type OpenAIRawBaseOptions = {
    apiKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
};

type OpenAIRawPromptOptions = OpenAIRawBaseOptions & {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
};

type OpenAIRawImageOptions = OpenAIRawBaseOptions & {
    model?: string;
    size?: string;
    responseFormat?: 'url' | 'b64_json';
};

/**
 * OpenAI raw API integration service.
 * Keeps the direct /chat/completions and /images/generations access pattern
 * for easier provider migration and endpoint swapping.
 */
export class OpenAIRawService {
    private static instance: OpenAIRawService;
    private readonly defaultBaseUrl: string;
    private readonly defaultApiKey: string;
    private readonly defaultModel: string;

    private constructor() {
        this.defaultBaseUrl = process.env.XIAOFAN_OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
        this.defaultApiKey = process.env.OPENAI_API_KEY || '';
        this.defaultModel = process.env.XIAOFAN_OPENAI_MODEL?.trim() || AIModelType.GPT_4O;

        if (!this.defaultApiKey) {
            logger.warn('[OpenAIRawService] OPENAI_API_KEY not set. Raw OpenAI mode will fail.');
        }
    }

    public static getInstance(): OpenAIRawService {
        if (!OpenAIRawService.instance) {
            OpenAIRawService.instance = new OpenAIRawService();
        }
        return OpenAIRawService.instance;
    }

    public async sendPrompt(
        systemPrompt: string,
        userPrompt: string,
        options: OpenAIRawPromptOptions = {}
    ): Promise<OpenAIRawChatResponse> {
        const messages: OpenAIRawMessage[] = [];
        if (systemPrompt.trim()) {
            messages.push({
                role: 'system',
                content: systemPrompt,
            });
        }
        messages.push({
            role: 'user',
            content: userPrompt,
        });

        const payload = {
            model: options.model || this.defaultModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: options.stream ?? false,
        };

        return await this.requestJson<OpenAIRawChatResponse>({
            path: '/chat/completions',
            payload,
            options,
            type: 'ChatCompletion',
        });
    }

    public async generateImage(
        prompt: string,
        n = 1,
        options: OpenAIRawImageOptions = {}
    ): Promise<OpenAIRawImageResponse> {
        const payload = {
            model: options.model || 'gpt-image-1',
            prompt: prompt.slice(0, 1000),
            n,
            size: options.size || '1536x1024',
            response_format: options.responseFormat || 'url',
        };

        return await this.requestJson<OpenAIRawImageResponse>({
            path: '/images/generations',
            payload,
            options,
            type: 'ImageGeneration',
        });
    }

    public extractText(response: OpenAIRawChatResponse): string {
        const content = response.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map((item) => (typeof item?.text === 'string' ? item.text : ''))
                .filter((item) => item.length > 0)
                .join('\n');
        }
        return '';
    }

    private async requestJson<T>(params: {
        path: string;
        payload: Record<string, unknown>;
        options: OpenAIRawBaseOptions;
        type: 'ChatCompletion' | 'ImageGeneration';
    }): Promise<T> {
        const apiKey = params.options.apiKey || this.defaultApiKey;
        const baseUrl = (params.options.baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
        const timeoutMs = params.options.timeoutMs ?? 300_000;

        if (!apiKey) {
            throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY or pass apiKey in options.');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetch(`${baseUrl}${params.path}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(params.payload),
                signal: controller.signal,
            });

            const text = await response.text();
            let jsonBody: unknown = null;
            if (text.trim()) {
                try {
                    jsonBody = JSON.parse(text);
                } catch {
                    jsonBody = null;
                }
            }

            if (!response.ok) {
                const errorPayload = jsonBody || { error: text || `HTTP ${response.status}` };
                throw new Error(`OpenAI ${params.type} API Error: ${JSON.stringify(errorPayload)}`);
            }

            if (!jsonBody || typeof jsonBody !== 'object') {
                throw new Error(`OpenAI ${params.type} API Error: Empty or invalid JSON response`);
            }

            return jsonBody as T;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`OpenAI ${params.type} API timeout after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
