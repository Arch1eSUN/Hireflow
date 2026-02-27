import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function jobRoutes(app: FastifyInstance) {
    // List Jobs
    app.get('/api/jobs', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { page = 1, pageSize = 20, status, department, search } = request.query as any;

            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const where: any = {
                companyId: user.companyId,
            };

            if (status) where.status = status;
            if (department) where.department = department;
            if (search) {
                where.title = { contains: search, mode: 'insensitive' };
            }

            const [total, jobs] = await prisma.$transaction([
                prisma.job.count({ where }),
                prisma.job.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                })
            ]);

            // Recalculate candidate counts (optional, if trusted)
            // Or rely on job.candidateCount field which we aggregate via triggers/app logic

            return success(jobs, {
                page: Number(page),
                pageSize: Number(pageSize),
                total
            });
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Job Detail
    app.get('/api/jobs/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const job = await prisma.job.findFirst({
                where: { id, companyId: user.companyId },
                include: {
                    candidates: {
                        select: { id: true, stage: true }, // Lightweight for stats
                    }
                }
            });

            if (!job) return reply.status(404).send({ error: 'Job not found' });

            // Calculate pipeline stats
            const pipelineStats = job.candidates.reduce((acc: any, c) => {
                acc[c.stage] = (acc[c.stage] || 0) + 1;
                return acc;
            }, {});

            return success({ ...job, pipelineStats });
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Create Job
    app.post('/api/jobs', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                title: z.string().min(2),
                department: z.string().min(2),
                location: z.string().min(2),
                type: z.string(),
                descriptionJd: z.string(),
                requirements: z.array(z.string()),
                salaryRange: z.object({
                    min: z.number(),
                    max: z.number(),
                    currency: z.string(),
                }),
                pipeline: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                })).optional(),
            });

            const data = schema.parse(request.body);

            const job = await prisma.job.create({
                data: {
                    ...data,
                    status: 'active',
                    companyId: user.companyId,
                    candidateCount: 0,
                    pipeline: data.pipeline || [] // Add default pipeline
                }
            });

            return success(job);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Update Job
    app.put('/api/jobs/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const schema = z.object({
                title: z.string().min(2).optional(),
                department: z.string().optional(),
                location: z.string().optional(),
                type: z.string().optional(),
                descriptionJd: z.string().optional(),
                requirements: z.array(z.string()).optional(),
                status: z.string().optional(),
                salaryRange: z.object({
                    min: z.number(),
                    max: z.number(),
                    currency: z.string(),
                }).optional(),
                pipeline: z.any().optional(),
            });

            const data = schema.parse(request.body);

            const job = await prisma.job.findFirst({
                where: { id, companyId: user.companyId }
            });
            if (!job) return reply.status(404).send({ error: 'Job not found' });

            const updated = await prisma.job.update({
                where: { id },
                data,
            });

            return success(updated);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Delete Job
    app.delete('/api/jobs/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const job = await prisma.job.findFirst({
                where: { id, companyId: user.companyId }
            });
            if (!job) return reply.status(404).send({ error: 'Job not found' });

            // Delete related data first (cascade: feedback/eval → interview → candidate → job)
            const interviewIds = await prisma.interview.findMany({
                where: { jobId: id },
                select: { id: true },
            });
            const ivIds = interviewIds.map(i => i.id);
            if (ivIds.length > 0) {
                await prisma.interviewFeedback.deleteMany({ where: { interviewId: { in: ivIds } } });
                await prisma.evaluation.deleteMany({ where: { interviewId: { in: ivIds } } });
            }
            await prisma.interview.deleteMany({ where: { jobId: id } });
            await prisma.candidate.deleteMany({ where: { jobId: id } });
            await prisma.job.delete({ where: { id } });

            return success({ deleted: true });
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });
}
