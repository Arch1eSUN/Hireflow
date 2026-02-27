import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';
import { randomUUID } from 'crypto';

export async function interviewRoutes(app: FastifyInstance) {
    // === Private Company Routes ===

    // List Interviews
    app.get('/api/interviews', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { status, date } = request.query as any;

            const where: any = {
                job: { companyId: user.companyId }
            };

            if (status) where.status = status;
            // Date filtering typically requires range (start/end of day)
            // Skipping complex date logic for brevity, implementing basic equality if needed

            const interviews = await prisma.interview.findMany({
                where,
                include: {
                    candidate: { select: { id: true, name: true, email: true } },
                    job: { select: { id: true, title: true } }
                },
                orderBy: { startTime: 'asc' }
            });

            return success(interviews);
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Create Interview Link
    app.post('/api/interviews', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const schema = z.object({
                candidateId: z.string(),
                jobId: z.string(),
                type: z.string().default('ai_interview'),
                startTime: z.string().datetime(), // ISO string
                // duration? config?
            });

            const data = schema.parse(request.body);

            // Verify ownership
            const job = await prisma.job.findFirst({
                where: { id: data.jobId, companyId: user.companyId }
            });
            if (!job) return reply.status(400).send({ error: 'Invalid Job' });

            // Generate unique token
            const token = randomUUID(); // or nanoid

            const interview = await prisma.interview.create({
                data: {
                    jobId: data.jobId,
                    candidateId: data.candidateId,
                    type: data.type,
                    startTime: data.startTime,
                    status: 'upcoming',
                    token,
                }
            });

            return success(interview);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // Get Interview Detail (Company)
    app.get('/api/interviews/:id', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const interview = await prisma.interview.findFirst({
                where: {
                    id,
                    job: { companyId: user.companyId }
                },
                include: {
                    candidate: true,
                    job: true,
                    feedbacks: true,
                    evaluations: true
                }
            });

            if (!interview) return reply.status(404).send({ error: 'Interview not found' });

            return success(interview);
        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });

    // === Public Candidate Routes ===

    // Validate Interview Token
    app.get('/api/public/interview/:token', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };

            const interview = await prisma.interview.findUnique({
                where: { token },
                include: {
                    job: {
                        select: {
                            title: true,
                            company: { select: { name: true, logo: true, welcomeText: true } }
                        }
                    },
                    candidate: { select: { name: true } }
                }
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found or expired' });
            }

            if (interview.status === 'completed' || interview.status === 'cancelled') {
                return reply.status(400).send({ error: 'Interview is no longer active' });
            }

            // Check expiry if needed (e.g. endTime < now)

            return success({
                valid: true,
                id: interview.id,
                jobTitle: interview.job.title,
                companyName: interview.job.company.name,
                companyLogo: interview.job.company.logo,
                welcomeText: interview.job.company.welcomeText,
                candidateName: interview.candidate.name,
                type: interview.type,
                startTime: interview.startTime,
                status: interview.status
            });

        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Start Interview (Public)
    app.post('/api/public/interview/:token/start', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const interview = await prisma.interview.update({
                where: { token },
                data: { status: 'active' } // Set startedAt?
            });
            return success({ status: 'active' });
        } catch (err) {
            return reply.status(404).send({ error: 'Interview not found' });
        }
    });

    // End Interview (Public)
    app.post('/api/public/interview/:token/end', async (request, reply) => {
        try {
            const { token } = request.params as { token: string };
            const interview = await prisma.interview.update({
                where: { token },
                data: {
                    status: 'completed',
                    endTime: new Date()
                }
            });
            // Trigger report generation logic here (queueing)
            return success({ status: 'completed' });
        } catch (err) {
            return reply.status(404).send({ error: 'Interview not found' });
        }
    });
}
