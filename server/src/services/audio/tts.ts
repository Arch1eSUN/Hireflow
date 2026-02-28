import { env } from '../../config/env';
import { logger } from '../../utils/logger';

type TTSSpeechOptions = {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    voice?: string;
    responseFormat?: string;
    speed?: number;
};

export class TTSService {
    private static instance: TTSService;
    private readonly defaultApiKey: string;
    private readonly defaultBaseUrl: string;
    private readonly defaultModel: string;
    private readonly defaultVoice: string;
    private readonly defaultResponseFormat: string;
    private readonly defaultSpeed: number;

    private constructor() {
        this.defaultApiKey = env.OPENAI_API_KEY || '';
        this.defaultBaseUrl = (env.XIAOFAN_TTS_BASE_URL || env.XIAOFAN_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
        this.defaultModel = env.XIAOFAN_TTS_MODEL || 'tts-1-hd';
        this.defaultVoice = env.XIAOFAN_TTS_VOICE || 'nova';
        this.defaultResponseFormat = env.XIAOFAN_TTS_FORMAT || 'mp3';
        const speedRaw = env.XIAOFAN_TTS_SPEED ?? 0.94;
        this.defaultSpeed = Number.isFinite(speedRaw)
            ? Math.min(2, Math.max(0.5, speedRaw))
            : 0.94;
        if (!this.defaultApiKey) {
            logger.warn('OPENAI_API_KEY not set. Provide runtime key from company settings for voice TTS.');
        }
    }

    public static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    // Returns a ReadableStream or similar to pipe to WebSocket
    public async streamSpeech(
        text: string,
        onChunk: (chunk: Buffer) => void,
        options: TTSSpeechOptions = {}
    ): Promise<void> {
        const apiKey = options.apiKey || this.defaultApiKey;
        if (!apiKey) {
            throw new Error('TTS Service: API key missing. Configure API key in Settings > AI providers.');
        }
        const baseUrl = (options.baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
        const model = options.model || this.defaultModel;
        const voice = options.voice || this.defaultVoice;
        const responseFormat = options.responseFormat || this.defaultResponseFormat;
        const speedRaw = typeof options.speed === 'number' ? options.speed : this.defaultSpeed;
        const speed = Number.isFinite(speedRaw)
            ? Math.min(2, Math.max(0.5, speedRaw))
            : this.defaultSpeed;

        // Simple TTS API call (blocking for now, then chunked send)
        // OpenAI TTS 'tts-1' model is fast
        try {
            const response = await fetch(`${baseUrl}/audio/speech`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    input: text,
                    voice,
                    response_format: responseFormat,
                    speed,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`TTS API Error: ${response.status} ${errorText}`);
            }

            const audioBuffer = Buffer.from(await response.arrayBuffer());
            if (audioBuffer.length === 0) {
                throw new Error('TTS response body is empty');
            }

            // Current web client decodes one complete audio payload at a time.
            // Send a full audio buffer per utterance to avoid partial-frame decode failures.
            onChunk(audioBuffer);

        } catch (error) {
            logger.error({ err: error }, 'Speech generation failed');
            throw error;
        }
    }
}
