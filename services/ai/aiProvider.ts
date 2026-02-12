import { GoogleGenAI } from "@google/genai";
import { AIModelType, AIProviderConfig, AIResponse } from '../../types';

// Abstract Base Class for Provider Pattern
abstract class LLMProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse>;
}

// Google Gemini Implementation
class GeminiProvider extends LLMProvider {
  private client: GoogleGenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    // In a real app, API Key comes from env, but we handle the process.env check internally safely
    const apiKey = process.env.API_KEY || 'demo-key';
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    const startTime = performance.now();
    try {
      const modelId = this.config.model === AIModelType.GEMINI_PRO 
        ? 'gemini-3-pro-preview' 
        : 'gemini-2.5-flash-latest';

      const response = await this.client.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        }
      });

      const endTime = performance.now();
      
      return {
        text: response.text || "",
        latencyMs: Math.round(endTime - startTime),
        usage: {
            promptTokens: 0, // Not always available in basic response without usage metadata enabled
            completionTokens: 0,
            totalTokens: 0
        }
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}

// Mock Provider for UI Development/Fallback
class MockProvider extends LLMProvider {
  async generateContent(prompt: string): Promise<AIResponse> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate latency
    return {
      text: `[Mock AI Response] Analysis of: "${prompt.substring(0, 20)}..." suggests high compatibility.`,
      latencyMs: 1000,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    };
  }
}

// Factory to switch providers
export class AIGateway {
  private static instance: AIGateway;
  private currentProvider: LLMProvider;

  private constructor() {
    // Default to Gemini or Mock if no key
    const useMock = !process.env.API_KEY;
    this.currentProvider = useMock 
      ? new MockProvider({ model: AIModelType.MOCK })
      : new GeminiProvider({ model: AIModelType.GEMINI_FLASH });
  }

  public static getInstance(): AIGateway {
    if (!AIGateway.instance) {
      AIGateway.instance = new AIGateway();
    }
    return AIGateway.instance;
  }

  public setProvider(model: AIModelType, config: Partial<AIProviderConfig> = {}) {
    const fullConfig = { model, ...config };
    
    if (model.startsWith('gemini')) {
      this.currentProvider = new GeminiProvider(fullConfig);
    } else if (model === AIModelType.MOCK) {
        this.currentProvider = new MockProvider(fullConfig);
    } else {
      // Fallback or OpenAI implementation would go here
      console.warn(`Model ${model} not implemented, falling back to Mock.`);
      this.currentProvider = new MockProvider(fullConfig);
    }
  }

  public async generate(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    try {
      return await this.currentProvider.generateContent(prompt, systemInstruction);
    } catch (error) {
      console.error("Primary provider failed, attempting fallback...");
      // Simple fallback mechanism
      const fallback = new MockProvider({ model: AIModelType.MOCK });
      return await fallback.generateContent(prompt);
    }
  }
}
