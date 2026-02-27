import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Create Company
    const company = await prisma.company.create({
        data: {
            name: 'HireFlow AI',
            primaryColor: '#1A73E8',
            welcomeText: 'Welcome to the future of hiring.',
            settings: {
                create: {
                    // Default settings
                    maxTokens: 8192,
                    temperature: 0.7
                }
            }
        },
    });
    console.log('Created Company:', company.id);

    // 2. Create User (Admin)
    // Password: "password123" (Mock hash, in real app use bcrypt.hash)
    const user = await prisma.user.create({
        data: {
            email: 'zhangtong@hireflow.ai',
            name: '张通',
            role: 'admin',
            companyId: company.id,
            passwordHash: '$2b$10$EpWaTBcQ/..mockhash..',
        },
    });
    console.log('Created User:', user.name);

    // 3. Create Jobs
    const job1 = await prisma.job.create({
        data: {
            companyId: company.id,
            title: '高级前端工程师',
            department: '技术部',
            location: '上海 / 远程',
            type: 'full-time',
            status: 'active',
            descriptionJd: '负责公司核心 Web 平台的前端架构设计和开发...',
            requirements: ['5年以上前端开发经验', '精通 React & TypeScript'],
            salaryRange: { min: 30000, max: 50000, currency: 'CNY' },
            pipeline: [
                { id: 'p1', name: '简历筛选', type: 'screening', order: 0 },
                { id: 'p2', name: 'AI 技术一面', type: 'interview_1', order: 1 },
                { id: 'p3', name: '现场二面', type: 'interview_2', order: 2 },
                { id: 'p4', name: 'HR 终面', type: 'hr_interview', order: 3 },
                { id: 'p5', name: 'Offer', type: 'offer', order: 4 },
            ],
            candidateCount: 2
        }
    });

    const job2 = await prisma.job.create({
        data: {
            companyId: company.id,
            title: '产品经理 - 增长方向',
            department: '产品部',
            location: '北京',
            type: 'full-time',
            status: 'active',
            descriptionJd: '主导产品增长策略...',
            requirements: ['5年以上产品经验', '数据驱动思维'],
            salaryRange: { min: 35000, max: 55000, currency: 'CNY' },
            pipeline: [
                { id: 'p6', name: '简历筛选', type: 'screening', order: 0 },
                { id: 'p7', name: '案例分析', type: 'interview_1', order: 1 },
                { id: 'p8', name: 'VP 面试', type: 'interview_2', order: 2 },
                { id: 'p9', name: 'Offer', type: 'offer', order: 3 },
            ],
            candidateCount: 1
        }
    });
    console.log('Created Jobs:', job1.title, job2.title);

    // 4. Create Candidates
    const c1 = await prisma.candidate.create({
        data: {
            companyId: company.id,
            jobId: job1.id,
            name: '陈思远',
            email: 'siyuan@email.com',
            phone: '+86 138-0001-0001',
            stage: 'interview_2',
            score: 92,
            skills: ['React', 'TypeScript', 'GraphQL'],
            appliedDate: new Date('2026-02-10'),
            verificationStatus: 'verified',
            tags: ['top-talent', 'referral'],
            source: '内推'
        }
    });

    const c2 = await prisma.candidate.create({
        data: {
            companyId: company.id,
            jobId: job1.id,
            name: '李明辉',
            email: 'minghui@email.com',
            phone: '+86 139-0002-0002',
            stage: 'screening',
            score: 88,
            skills: ['Python', 'AWS', 'Docker'],
            appliedDate: new Date('2026-02-10'),
            verificationStatus: 'pending',
            tags: [],
            source: 'Boss直聘'
        }
    });

    const c3 = await prisma.candidate.create({
        data: {
            companyId: company.id,
            jobId: job2.id,
            name: '王芳菲',
            email: 'fangfei@email.com',
            phone: '+86 137-0003-0003',
            stage: 'offer',
            score: 95,
            skills: ['产品策略', '数据分析'],
            appliedDate: new Date('2026-02-09'),
            verificationStatus: 'verified',
            tags: ['urgent'],
            source: '猎聘'
        }
    });

    console.log('Created Candidates:', c1.name, c2.name, c3.name);

    // 5. Create Interview (Mock Session)
    await prisma.interview.create({
        data: {
            jobId: job1.id,
            candidateId: c1.id,
            token: 'mock-token-123',
            status: 'upcoming',
            type: 'ai_interview',
            startTime: new Date(Date.now() + 3600000) // 1 hour later
        }
    });
    console.log('Created Interviews');

    console.log('✅ Seed completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
