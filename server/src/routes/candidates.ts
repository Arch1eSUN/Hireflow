import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function candidateRoutes(app: FastifyInstance) {
    // List Candidates
    app.get('/api/candidates', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { page = 1, pageSize = 20, search, stage, jobId } = request.query as any;

            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const where: any = {
                companyId: user.companyId,
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (stage) where.stage = stage;
            if (jobId) where.jobId = jobId;

            const [total, candidates] = await prisma.$transaction([
                prisma.candidate.count({ where }),
                prisma.candidate.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    include: { job: { select: { title: true } } }
                })
            ]);

            return success(candidates, {
                page: Number(page),
                pageSize: Number(pageSize),
                total
            });
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Get Candidate Detail
    app.get('/api/candidates/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: user.companyId },
                include: {
                    job: true,
                    interviews: { orderBy: { startTime: 'desc' } },
                    // In future: evaluations, auditLogs
                }
            });

            if (!candidate) {
                return reply.status(404).send({ error: 'Candidate not found' });
            }

            return success(candidate);
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Create Candidate
    app.post('/api/candidates', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                name: z.string().min(2),
                email: z.string().email(),
                phone: z.string().min(5),
                jobId: z.string(),
                stage: z.string().default('screening'),
                skills: z.array(z.string()).optional(),
                source: z.string().optional(),
            });

            const data = schema.parse(request.body);

            // Verify Job ownership
            const job = await prisma.job.findFirst({
                where: { id: data.jobId, companyId: user.companyId }
            });

            if (!job) {
                return reply.status(400).send({ error: 'Invalid Job ID' });
            }

            const candidate = await prisma.candidate.create({
                data: {
                    ...data,
                    companyId: user.companyId,
                    appliedDate: new Date(),
                }
            });

            // Update Job candidate count
            await prisma.job.update({
                where: { id: job.id },
                data: { candidateCount: { increment: 1 } }
            });

            return success(candidate);

        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Update Stage (legacy route)
    app.put('/api/candidates/:id/stage', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };
            const { stage } = request.body as { stage: string };

            if (!stage) return reply.status(400).send({ error: 'Stage is required' });

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: user.companyId }
            });

            if (!candidate) return reply.status(404).send({ error: 'Candidate not found' });

            const updated = await prisma.candidate.update({
                where: { id },
                data: { stage }
            });

            return success(updated);
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Update Candidate (general)
    app.put('/api/candidates/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const schema = z.object({
                name: z.string().min(2).optional(),
                email: z.string().email().optional(),
                phone: z.string().min(5).optional(),
                stage: z.string().optional(),
                score: z.number().optional(),
                skills: z.array(z.string()).optional(),
                source: z.string().optional(),
                tags: z.array(z.string()).optional(),
                verificationStatus: z.string().optional(),
            });

            const data = schema.parse(request.body);

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: user.companyId }
            });
            if (!candidate) return reply.status(404).send({ error: 'Candidate not found' });

            const updated = await prisma.candidate.update({
                where: { id },
                data,
                include: { job: { select: { title: true } } },
            });

            return success(updated);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Delete Candidate
    app.delete('/api/candidates/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const candidate = await prisma.candidate.findFirst({
                where: { id, companyId: user.companyId }
            });
            if (!candidate) return reply.status(404).send({ error: 'Candidate not found' });

            // Delete related data (cascading order: feedback/eval → interview → candidate)
            const interviewIds = await prisma.interview.findMany({
                where: { candidateId: id },
                select: { id: true },
            });
            const ids = interviewIds.map(i => i.id);
            if (ids.length > 0) {
                await prisma.interviewFeedback.deleteMany({ where: { interviewId: { in: ids } } });
                await prisma.evaluation.deleteMany({ where: { interviewId: { in: ids } } });
            }
            await prisma.interview.deleteMany({ where: { candidateId: id } });

            await prisma.candidate.delete({ where: { id } });

            // Decrement job candidate count
            await prisma.job.update({
                where: { id: candidate.jobId },
                data: { candidateCount: { decrement: 1 } }
            });

            return success({ deleted: true });
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });
}
