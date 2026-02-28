import { extractErrorMessage } from '../utils/errors';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success } from '../utils/response';

export async function jobRoutes(app: FastifyInstance) {
    const jobStatusSchema = z.enum(['draft', 'active', 'paused', 'closed']);
    const salaryRangeSchema = z.object({
        min: z.number(),
        max: z.number(),
        currency: z.string().default('CNY'),
    });

    function normalizeSalaryRange(input: {
        salaryRange?: { min: number; max: number; currency: string };
        salaryMin?: number;
        salaryMax?: number;
    }): { min: number; max: number; currency: string } {
        if (input.salaryRange) {
            return input.salaryRange;
        }

        const hasMin = typeof input.salaryMin === 'number' && Number.isFinite(input.salaryMin);
        const hasMax = typeof input.salaryMax === 'number' && Number.isFinite(input.salaryMax);
        if (hasMin || hasMax) {
            return {
                min: hasMin ? Number(input.salaryMin) : 0,
                max: hasMax ? Number(input.salaryMax) : 0,
                currency: 'CNY',
            };
        }

        return { min: 0, max: 0, currency: 'CNY' };
    }

    // List Jobs
    app.get('/api/jobs', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { page = 1, pageSize = 20, status, department, search } = request.query as any;

            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const where: Record<string, unknown> = {
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
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
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
            const pipelineStats = job.candidates.reduce((acc: Record<string, number>, c) => {
                acc[c.stage] = (acc[c.stage] || 0) + 1;
                return acc;
            }, {});

            return success({ ...job, pipelineStats });
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
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
                type: z.string().optional(),
                status: jobStatusSchema.optional(),
                descriptionJd: z.string().optional(),
                description: z.string().optional(),
                requirements: z.array(z.string()).optional(),
                salaryRange: salaryRangeSchema.optional(),
                salaryMin: z.number().optional(),
                salaryMax: z.number().optional(),
                pipeline: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                })).optional(),
            });

            const data = schema.parse(request.body);
            const salaryRange = normalizeSalaryRange({
                salaryRange: data.salaryRange,
                salaryMin: data.salaryMin,
                salaryMax: data.salaryMax,
            });
            const descriptionJd = (data.descriptionJd ?? data.description ?? '').trim();

            const job = await prisma.job.create({
                data: {
                    title: data.title,
                    department: data.department,
                    location: data.location,
                    type: data.type || 'full-time',
                    descriptionJd,
                    requirements: data.requirements || [],
                    status: data.status || 'active',
                    salaryRange,
                    companyId: user.companyId,
                    candidateCount: 0,
                    pipeline: data.pipeline || [] // Add default pipeline
                }
            });

            return success(job);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
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
                description: z.string().optional(),
                requirements: z.array(z.string()).optional(),
                status: jobStatusSchema.optional(),
                salaryRange: salaryRangeSchema.optional(),
                salaryMin: z.number().optional(),
                salaryMax: z.number().optional(),
                pipeline: z.any().optional(),
            });

            const data = schema.parse(request.body);

            const job = await prisma.job.findFirst({
                where: { id, companyId: user.companyId }
            });
            if (!job) return reply.status(404).send({ error: 'Job not found' });

            const updateData: Record<string, unknown> = { ...data };
            delete updateData.description;
            delete updateData.salaryMin;
            delete updateData.salaryMax;

            if (typeof data.descriptionJd === 'string' || typeof data.description === 'string') {
                updateData.descriptionJd = (data.descriptionJd ?? data.description ?? '').trim();
            }

            if (data.salaryRange || typeof data.salaryMin === 'number' || typeof data.salaryMax === 'number') {
                const currentRange = (job.salaryRange || {}) as Record<string, unknown>;
                const currentMin = typeof currentRange.min === 'number' ? currentRange.min : 0;
                const currentMax = typeof currentRange.max === 'number' ? currentRange.max : 0;
                const currentCurrency = typeof currentRange.currency === 'string' ? currentRange.currency : 'CNY';

                updateData.salaryRange = data.salaryRange || {
                    min: typeof data.salaryMin === 'number' ? data.salaryMin : currentMin,
                    max: typeof data.salaryMax === 'number' ? data.salaryMax : currentMax,
                    currency: currentCurrency,
                };
            }

            const updated = await prisma.job.update({
                where: { id },
                data: updateData,
            });

            return success(updated);
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: extractErrorMessage(err) });
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
        } catch (err: unknown) {
            return reply.status(500).send({ error: extractErrorMessage(err) });
        }
    });
}
