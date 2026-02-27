import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma';
import { authenticate } from '../utils/auth';
import { success, error } from '../utils/response';

export async function analyticsRoutes(app: FastifyInstance) {
    app.get('/api/analytics/overview', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const companyId = user.companyId;

            // Date ranges
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));

            // Parallel queries for dashboard stats
            const [
                totalCandidates,
                activeJobs,
                interviewsThisWeek,
                todaySchedule,
                candidateStages
            ] = await prisma.$transaction([
                // 1. Total Candidates
                prisma.candidate.count({ where: { companyId } }),

                // 2. Active Jobs
                prisma.job.count({ where: { companyId, status: 'active' } }),

                // 3. Interviews This Week (Upcoming or Completed)
                prisma.interview.count({
                    where: {
                        job: { companyId },
                        startTime: {
                            gte: startOfWeek.toISOString(),
                            lte: endOfWeek.toISOString()
                        }
                    }
                }),

                // 4. Today's Interviews (for Schedule)
                prisma.interview.findMany({
                    where: {
                        job: { companyId },
                        startTime: {
                            gte: startOfDay.toISOString(),
                            lt: endOfDay.toISOString()
                        }
                    },
                    include: {
                        candidate: { select: { name: true } },
                        job: { select: { title: true } }
                    },
                    orderBy: { startTime: 'asc' }
                }),

                // 5. Funnel Stats (Group by Stage)
                prisma.candidate.groupBy({
                    by: ['stage'],
                    where: { companyId },
                    _count: { stage: true },
                    orderBy: { stage: 'asc' } // Satisfy lint requirement
                })
            ]);

            // Process Funnel Data
            const funnelMap: Record<string, number> = {};
            candidateStages.forEach(s => {
                if (s._count) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    funnelMap[s.stage] = (s._count as any).stage || 0;
                }
            });

            const funnel = [
                { name: 'Applied', count: funnelMap['new'] || 0 }, // Assuming 'new' or 'applied'
                { name: 'Screening', count: funnelMap['screening'] || 0 },
                { name: 'Interview', count: (funnelMap['interview'] || 0) + (funnelMap['technical'] || 0) },
                { name: 'Offer', count: funnelMap['offer'] || 0 },
                { name: 'Hired', count: funnelMap['hired'] || 0 },
            ];

            // Calculate Hire Rate (Hired / Total * 100) - Simplified
            const hireRate = totalCandidates > 0
                ? ((funnelMap['hired'] || 0) / totalCandidates * 100).toFixed(1) + '%'
                : '0%';

            // Transform Schedule for Frontend
            const formattedSchedule = todaySchedule.map(iv => ({
                time: new Date(iv.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                candidate: iv.candidate.name,
                type: iv.type,
                jobTitle: iv.job.title
            }));

            // Mocking Daily Metrics & AI Cost for now (complex historical data logic skipped)
            const dailyMetrics = [
                { date: 'Mon', applications: 12, interviews: 4, offers: 1 },
                { date: 'Tue', applications: 18, interviews: 6, offers: 0 },
                { date: 'Wed', applications: 15, interviews: 8, offers: 2 },
                { date: 'Thu', applications: 22, interviews: 5, offers: 1 },
                { date: 'Fri', applications: 28, interviews: 9, offers: 3 },
                { date: 'Sat', applications: 8, interviews: 2, offers: 0 },
                { date: 'Sun', applications: 5, interviews: 0, offers: 0 },
            ];

            const aiCost = {
                tokensUsed: 145000,
                estimatedCost: 2.90, // $0.002 per 1k
                models: [
                    { model: 'GPT-4', percentage: 75 },
                    { model: 'Claude 3.5', percentage: 15 },
                    { model: 'DeepSeek', percentage: 10 },
                ]
            };

            return success({
                totalCandidates,
                activeJobs,
                interviewsThisWeek,
                hireRate,
                funnel,
                dailyMetrics,
                todaySchedule: formattedSchedule,
                aiCost
            });

        } catch (err: any) {
            return reply.status(err.statusCode || 500).send({ error: err.message });
        }
    });
}
