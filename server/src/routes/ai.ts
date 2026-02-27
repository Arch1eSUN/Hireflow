import { FastifyInstance } from 'fastify';
import { success } from '../utils/response';

export async function aiRoutes(app: FastifyInstance) {
    app.post('/api/ai/chat', async (request) => {
        // TODO: Integrate with real LLM
        return success({
            text: '你好，这是一个模拟的 AI 回复。我正在分析候选人的简历...',
            model: 'mock-model-v1',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            latencyMs: 200,
        });
    });

    app.post('/api/screening/evaluate', async (request) => {
        // Mock screening evaluation
        return success({
            pass: true,
            score: 88,
            reason: '候选人技术栈匹配度高，具备相关项目经验。'
        });
    });
}
