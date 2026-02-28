import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success } from '../utils/response';

type SearchResultType = 'candidate' | 'job' | 'interview';

type SearchResult = {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: string;
    url: string;
};

export async function searchRoutes(app: FastifyInstance) {
    app.get('/api/search', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const querySchema = z.object({
                q: z.string().trim().min(1).max(80),
                limit: z.coerce.number().int().min(1).max(10).default(5),
            });
            const parsed = querySchema.safeParse(request.query || {});
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten() });
            }

            const keyword = parsed.data.q;
            const limit = parsed.data.limit;

            const [candidates, jobs, interviews] = await Promise.all([
                prisma.candidate.findMany({
                    where: {
                        companyId: user.companyId,
                        OR: [
                            { name: { contains: keyword, mode: 'insensitive' } },
                            { email: { contains: keyword, mode: 'insensitive' } },
                            { skills: { hasSome: [keyword] } },
                        ],
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                }),
                prisma.job.findMany({
                    where: {
                        companyId: user.companyId,
                        OR: [
                            { title: { contains: keyword, mode: 'insensitive' } },
                            { department: { contains: keyword, mode: 'insensitive' } },
                            { descriptionJd: { contains: keyword, mode: 'insensitive' } },
                        ],
                    },
                    select: {
                        id: true,
                        title: true,
                        department: true,
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                }),
                prisma.interview.findMany({
                    where: {
                        job: { companyId: user.companyId },
                        OR: [
                            { candidate: { name: { contains: keyword, mode: 'insensitive' } } },
                            { job: { title: { contains: keyword, mode: 'insensitive' } } },
                            { type: { contains: keyword, mode: 'insensitive' } },
                        ],
                    },
                    select: {
                        id: true,
                        status: true,
                        type: true,
                        candidate: { select: { name: true } },
                        job: { select: { title: true } },
                    },
                    orderBy: { startTime: 'desc' },
                    take: limit,
                }),
            ]);

            const results: SearchResult[] = [
                ...candidates.map((item) => ({
                    id: item.id,
                    type: 'candidate' as const,
                    title: item.name,
                    subtitle: item.email,
                    url: `/candidates/${item.id}`,
                })),
                ...jobs.map((item) => ({
                    id: item.id,
                    type: 'job' as const,
                    title: item.title,
                    subtitle: item.department,
                    url: '/jobs',
                })),
                ...interviews.map((item) => ({
                    id: item.id,
                    type: 'interview' as const,
                    title: `${item.candidate.name} · ${item.job.title}`,
                    subtitle: `${item.type} · ${item.status}`,
                    url: item.status === 'active' ? `/interviews/${item.id}/monitor` : '/interviews',
                })),
            ];

            return success({
                keyword,
                results: results.slice(0, limit * 3),
            });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
