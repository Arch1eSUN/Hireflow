// ================================================
// HireFlow AI - Unified AI Gateway Service
// Provider Pattern with fallback mechanism
// ================================================

import { AIModelType, AIProviderConfig, AIResponse, AIGatewayLog } from '@/types';

/**
 * Abstract base class for all LLM providers.
 * Each provider (OpenAI, Gemini, Claude, etc.) implements this interface.
 */
abstract class LLMProvider {
    protected config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse>;
    abstract get modelName(): string;
}

/**
 * Google Gemini Provider Implementation
 * Supports: gemini-2.5-pro, gemini-2.5-flash
 */
class GeminiProvider extends LLMProvider {
    get modelName() {
        return this.config.model;
    }

    async generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const startTime = performance.now();
        const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        try {
            const { GoogleGenAI } = await import('@google/genai');
            const client = new GoogleGenAI({ apiKey });

            const response = await client.models.generateContent({
                model: this.config.model,
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: this.config.temperature ?? 0.7,
                    maxOutputTokens: this.config.maxTokens ?? 2048,
                },
            });

            const latencyMs = Math.round(performance.now() - startTime);

            return {
                text: response.text || '',
                latencyMs,
                model: this.config.model,
                usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                },
                costEstimate: 0,
            };
        } catch (error) {
            console.error('[GeminiProvider] API Error:', error);
            throw error;
        }
    }
}

/**
 * OpenAI Provider Implementation
 * Supports: gpt-4o, gpt-4o-mini
 * Uses the standard OpenAI REST API
 */
class OpenAIProvider extends LLMProvider {
    get modelName() {
        return this.config.model;
    }

    async generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const startTime = performance.now();
        const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY || '';
        const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const messages: Array<{ role: string; content: string }> = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages,
                    temperature: this.config.temperature ?? 0.7,
                    max_tokens: this.config.maxTokens ?? 2048,
                }),
            });

            const data = await response.json();
            const latencyMs = Math.round(performance.now() - startTime);

            if (!response.ok) {
                throw new Error(data.error?.message || 'OpenAI API error');
            }

            return {
                text: data.choices?.[0]?.message?.content || '',
                latencyMs,
                model: this.config.model,
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                },
                costEstimate: this.estimateCost(data.usage),
            };
        } catch (error) {
            console.error('[OpenAIProvider] API Error:', error);
            throw error;
        }
    }

    private estimateCost(usage: { prompt_tokens?: number; completion_tokens?: number }): number {
        const rates: Record<string, { input: number; output: number }> = {
            'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
            'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
        };
        const rate = rates[this.config.model] || rates['gpt-4o-mini'];
        return (usage?.prompt_tokens || 0) * rate.input + (usage?.completion_tokens || 0) * rate.output;
    }
}

/**
 * Anthropic Claude Provider Implementation
 * Supports: claude-sonnet-4, claude-opus-4
 */
class ClaudeProvider extends LLMProvider {
    get modelName() {
        return this.config.model;
    }

    async generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const startTime = performance.now();
        const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY || '';

        if (!apiKey) {
            throw new Error('Anthropic API key not configured');
        }

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: this.config.maxTokens ?? 2048,
                    system: systemInstruction,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });

            const data = await response.json();
            const latencyMs = Math.round(performance.now() - startTime);

            if (!response.ok) {
                throw new Error(data.error?.message || 'Anthropic API error');
            }

            return {
                text: data.content?.[0]?.text || '',
                latencyMs,
                model: this.config.model,
                usage: {
                    promptTokens: data.usage?.input_tokens || 0,
                    completionTokens: data.usage?.output_tokens || 0,
                    totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                },
                costEstimate: 0,
            };
        } catch (error) {
            console.error('[ClaudeProvider] API Error:', error);
            throw error;
        }
    }
}

/**
 * Local/Private Model Provider
 * Connects to any OpenAI-compatible API (vLLM, Ollama, etc.)
 */
class LocalProvider extends LLMProvider {
    get modelName() {
        return 'local-model';
    }

    async generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const startTime = performance.now();
        const baseUrl = this.config.baseUrl || 'http://localhost:11434/v1';

        try {
            const messages: Array<{ role: string; content: string }> = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.model,
                    messages,
                    temperature: this.config.temperature ?? 0.7,
                    max_tokens: this.config.maxTokens ?? 2048,
                }),
            });

            const data = await response.json();
            const latencyMs = Math.round(performance.now() - startTime);

            return {
                text: data.choices?.[0]?.message?.content || '',
                latencyMs,
                model: 'local-model',
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                },
            };
        } catch (error) {
            console.error('[LocalProvider] API Error:', error);
            throw error;
        }
    }
}

/**
 * Mock Provider for UI Development & Fallback
 * Returns realistic simulated responses
 */
class MockProvider extends LLMProvider {
    get modelName() {
        return 'mock-model';
    }

    async generateContent(prompt: string): Promise<AIResponse> {
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

        const responses = [
            "Based on the candidate's experience with distributed systems and cloud architecture, I would rate their technical depth at 85/100. Their explanation of microservices patterns was particularly strong.",
            "The candidate demonstrated excellent problem-solving skills. They approached the algorithm challenge methodically, identifying edge cases before coding. Communication was clear throughout.",
            "I noticed some inconsistencies in the candidate's timeline — they mentioned 3 years at Company A, but the resume shows 2 years. I recommend clarifying this in the next round.",
            "The candidate's React expertise is above average. They correctly identified performance optimization opportunities and mentioned using React.memo and useMemo in appropriate contexts.",
            "Communication skills are strong. The candidate articulated complex technical concepts clearly and asked thoughtful clarifying questions before diving into solutions.",
        ];

        return {
            text: responses[Math.floor(Math.random() * responses.length)],
            latencyMs: Math.round(800 + Math.random() * 700),
            model: 'mock-model',
            usage: { promptTokens: 150, completionTokens: 80, totalTokens: 230 },
            costEstimate: 0,
        };
    }
}

// ================================================
// AI Gateway — Singleton with logging & fallback
// ================================================

export class AIGateway {
    private static instance: AIGateway;
    private currentProvider: LLMProvider;
    private fallbackProvider: LLMProvider;
    private logs: AIGatewayLog[] = [];
    private config: AIProviderConfig;

    private constructor() {
        // Default configuration — try Gemini, fallback to Mock
        this.config = {
            model: AIModelType.GEMINI_FLASH,
            temperature: 0.7,
            maxTokens: 2048,
        };

        const hasGeminiKey = !!process.env.GEMINI_API_KEY;
        this.currentProvider = hasGeminiKey
            ? new GeminiProvider(this.config)
            : new MockProvider({ model: AIModelType.MOCK });

        this.fallbackProvider = new MockProvider({ model: AIModelType.MOCK });
    }

    public static getInstance(): AIGateway {
        if (!AIGateway.instance) {
            AIGateway.instance = new AIGateway();
        }
        return AIGateway.instance;
    }

    /**
     * Switch the active AI provider
     */
    public setProvider(model: AIModelType, config: Partial<AIProviderConfig> = {}): void {
        const fullConfig: AIProviderConfig = { ...this.config, model, ...config };
        this.config = fullConfig;

        if (model.startsWith('gemini')) {
            this.currentProvider = new GeminiProvider(fullConfig);
        } else if (model.startsWith('gpt')) {
            this.currentProvider = new OpenAIProvider(fullConfig);
        } else if (model.startsWith('claude')) {
            this.currentProvider = new ClaudeProvider(fullConfig);
        } else if (model === AIModelType.LOCAL) {
            this.currentProvider = new LocalProvider(fullConfig);
        } else {
            this.currentProvider = new MockProvider(fullConfig);
        }
    }

    /**
     * Generate AI content with automatic fallback
     * All calls are logged for cost tracking and monitoring
     */
    public async generate(prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const logEntry: Partial<AIGatewayLog> = {
            id: crypto.randomUUID(),
            model: this.currentProvider.modelName,
            timestamp: Date.now(),
        };

        try {
            const response = await this.currentProvider.generateContent(prompt, systemInstruction);

            // Log successful call
            this.addLog({
                ...logEntry,
                promptTokens: response.usage?.promptTokens || 0,
                completionTokens: response.usage?.completionTokens || 0,
                latencyMs: response.latencyMs,
                costEstimate: response.costEstimate || 0,
                status: 'success',
            } as AIGatewayLog);

            return response;
        } catch (error) {
            console.error('[AIGateway] Primary provider failed, attempting fallback...', error);

            // Log failed attempt
            this.addLog({
                ...logEntry,
                promptTokens: 0,
                completionTokens: 0,
                latencyMs: 0,
                costEstimate: 0,
                status: 'error',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            } as AIGatewayLog);

            // Try fallback
            try {
                const fallbackResponse = await this.fallbackProvider.generateContent(prompt, systemInstruction);

                this.addLog({
                    id: crypto.randomUUID(),
                    model: this.fallbackProvider.modelName,
                    promptTokens: fallbackResponse.usage?.promptTokens || 0,
                    completionTokens: fallbackResponse.usage?.completionTokens || 0,
                    latencyMs: fallbackResponse.latencyMs,
                    costEstimate: 0,
                    timestamp: Date.now(),
                    status: 'fallback',
                });

                return fallbackResponse;
            } catch (fallbackError) {
                throw new Error('All AI providers failed');
            }
        }
    }

    /**
     * Get usage logs for monitoring dashboard
     */
    public getLogs(): AIGatewayLog[] {
        return [...this.logs];
    }

    /**
     * Get aggregated usage statistics
     */
    public getUsageStats() {
        const totalCalls = this.logs.length;
        const totalTokens = this.logs.reduce((sum, l) => sum + l.promptTokens + l.completionTokens, 0);
        const totalCost = this.logs.reduce((sum, l) => sum + l.costEstimate, 0);
        const avgLatency = totalCalls > 0
            ? this.logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalCalls
            : 0;
        const errorRate = totalCalls > 0
            ? this.logs.filter((l) => l.status === 'error').length / totalCalls
            : 0;

        return { totalCalls, totalTokens, totalCost, avgLatency, errorRate };
    }

    private addLog(log: AIGatewayLog): void {
        this.logs.push(log);
        // Keep last 1000 logs in memory
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
    }

    public getCurrentModel(): string {
        return this.currentProvider.modelName;
    }
}
