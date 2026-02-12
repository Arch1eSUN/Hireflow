// ================================================
// HireFlow AI — 模拟数据 (开发用)
// ================================================

import type { Candidate, Job, Notification, DailyMetric, StageMetric, Interview, Evaluation } from '@hireflow/types';

export const MOCK_CANDIDATES: Candidate[] = [
    { id: '1', jobId: 'j1', name: '陈思远', email: 'siyuan@email.com', phone: '+86 138-0001-0001', stage: 'interview_2', score: 92, skills: ['React', 'TypeScript', 'GraphQL', 'Node.js'], appliedDate: '2026-02-10', verificationStatus: 'verified', tags: ['top-talent', 'referral'], source: '内推' },
    { id: '2', jobId: 'j1', name: '李明辉', email: 'minghui@email.com', phone: '+86 139-0002-0002', stage: 'screening', score: 88, skills: ['Python', 'AWS', 'Docker', 'Kubernetes'], appliedDate: '2026-02-10', verificationStatus: 'pending', tags: [], source: 'Boss直聘' },
    { id: '3', jobId: 'j2', name: '王芳菲', email: 'fangfei@email.com', phone: '+86 137-0003-0003', stage: 'offer', score: 95, skills: ['产品策略', '数据分析', '敏捷开发', 'SQL'], appliedDate: '2026-02-09', verificationStatus: 'verified', tags: ['urgent'], source: '猎聘' },
    { id: '4', jobId: 'j1', name: '张伟杰', email: 'weijie@email.com', phone: '+86 136-0004-0004', stage: 'applied', score: 76, skills: ['React', 'JavaScript', 'CSS'], appliedDate: '2026-02-09', verificationStatus: 'unverified', tags: [], source: '拉勾' },
    { id: '5', jobId: 'j1', name: '刘雪晴', email: 'xueqing@email.com', phone: '+86 135-0005-0005', stage: 'interview_1', score: 85, skills: ['React', 'TypeScript', 'Testing', 'Node.js'], appliedDate: '2026-02-08', verificationStatus: 'verified', tags: ['referral'], source: '内推' },
    { id: '6', jobId: 'j3', name: '赵浩然', email: 'haoran@email.com', phone: '+86 134-0006-0006', stage: 'applied', score: 71, skills: ['Python', 'TensorFlow', 'R'], appliedDate: '2026-02-08', verificationStatus: 'pending', tags: [], source: '智联' },
    { id: '7', jobId: 'j1', name: '孙婉莹', email: 'wanying@email.com', phone: '+86 133-0007-0007', stage: 'screening', score: 91, skills: ['React', 'Vue', 'TypeScript', 'Go', 'PostgreSQL'], appliedDate: '2026-02-07', verificationStatus: 'verified', tags: ['top-talent'], source: 'LinkedIn' },
    { id: '8', jobId: 'j2', name: '吴子涵', email: 'zihan@email.com', phone: '+86 132-0008-0008', stage: 'interview_1', score: 82, skills: ['产品管理', 'UX设计', 'Figma'], appliedDate: '2026-02-07', verificationStatus: 'disputed', tags: [], source: '脉脉' },
    { id: '9', jobId: 'j1', name: '周志远', email: 'zhiyuan@email.com', phone: '+86 131-0009-0009', stage: 'rejected', score: 45, skills: ['HTML', 'CSS', 'jQuery'], appliedDate: '2026-02-06', verificationStatus: 'unverified', tags: [], source: '官网' },
    { id: '10', jobId: 'j3', name: '郑天宇', email: 'tianyu@email.com', phone: '+86 130-0010-0010', stage: 'applied', score: 89, skills: ['Python', 'PyTorch', 'NLP', 'AWS'], appliedDate: '2026-02-06', verificationStatus: 'pending', tags: ['top-talent'], source: 'Boss直聘' },
];

export const MOCK_JOBS: Job[] = [
    {
        id: 'j1', companyId: 'c1', title: '高级前端工程师', department: '技术部', location: '上海 / 远程',
        type: 'full-time', descriptionJd: '负责公司核心 Web 平台的前端架构设计和开发，使用 React、TypeScript、现代 Web 技术。',
        requirements: ['5年以上前端开发经验', '精通 React & TypeScript', '有系统设计经验'],
        status: 'active', salaryRange: { min: 30000, max: 50000, currency: 'CNY' },
        candidateCount: 7,
        pipeline: [
            { id: 'p1', name: '简历筛选', type: 'screening', order: 0 },
            { id: 'p2', name: 'AI 技术一面', type: 'interview_1', order: 1 },
            { id: 'p3', name: '现场二面', type: 'interview_2', order: 2 },
            { id: 'p4', name: 'HR 终面', type: 'hr_interview', order: 3 },
            { id: 'p5', name: 'Offer', type: 'offer', order: 4 },
        ],
        createdAt: '2026-01-15', updatedAt: '2026-02-10',
    },
    {
        id: 'j2', companyId: 'c1', title: '产品经理 - 增长方向', department: '产品部', location: '北京',
        type: 'full-time', descriptionJd: '主导产品增长策略，负责核心平台的用户增长和留存。',
        requirements: ['5年以上产品经验', '数据驱动思维', '有增长黑客经验'],
        status: 'active', salaryRange: { min: 35000, max: 55000, currency: 'CNY' },
        candidateCount: 3,
        pipeline: [
            { id: 'p6', name: '简历筛选', type: 'screening', order: 0 },
            { id: 'p7', name: '案例分析', type: 'interview_1', order: 1 },
            { id: 'p8', name: 'VP 面试', type: 'interview_2', order: 2 },
            { id: 'p9', name: 'Offer', type: 'offer', order: 3 },
        ],
        createdAt: '2026-02-01', updatedAt: '2026-02-08',
    },
    {
        id: 'j3', companyId: 'c1', title: '机器学习工程师', department: 'AI/ML 部', location: '远程',
        type: 'full-time', descriptionJd: '构建和部署机器学习模型，驱动智能招聘平台的核心 AI 能力。',
        requirements: ['3年以上 ML/AI 经验', '精通 Python & PyTorch/TensorFlow', '有 NLP 经验优先'],
        status: 'active', salaryRange: { min: 40000, max: 65000, currency: 'CNY' },
        candidateCount: 2,
        pipeline: [
            { id: 'p10', name: '简历筛选', type: 'screening', order: 0 },
            { id: 'p11', name: '技术面试', type: 'interview_1', order: 1 },
            { id: 'p12', name: '系统设计', type: 'interview_2', order: 2 },
            { id: 'p13', name: 'Offer', type: 'offer', order: 3 },
        ],
        createdAt: '2026-02-05', updatedAt: '2026-02-10',
    },
];

export const MOCK_FUNNEL: StageMetric[] = [
    { name: '投递', count: 1245, conversionRate: 100, avgTimeInStage: 0 },
    { name: '筛选', count: 820, conversionRate: 65.9, avgTimeInStage: 24 },
    { name: '一面', count: 350, conversionRate: 42.7, avgTimeInStage: 72 },
    { name: '二面', count: 128, conversionRate: 36.6, avgTimeInStage: 96 },
    { name: 'Offer', count: 48, conversionRate: 37.5, avgTimeInStage: 48 },
    { name: '入职', count: 35, conversionRate: 72.9, avgTimeInStage: 24 },
];

export const MOCK_DAILY_METRICS: DailyMetric[] = [
    { date: '02/01', applications: 45, interviews: 12, offers: 2 },
    { date: '02/02', applications: 52, interviews: 8, offers: 1 },
    { date: '02/03', applications: 38, interviews: 15, offers: 3 },
    { date: '02/04', applications: 61, interviews: 10, offers: 2 },
    { date: '02/05', applications: 48, interviews: 14, offers: 4 },
    { date: '02/06', applications: 55, interviews: 11, offers: 1 },
    { date: '02/07', applications: 42, interviews: 9, offers: 2 },
    { date: '02/08', applications: 67, interviews: 16, offers: 3 },
    { date: '02/09', applications: 53, interviews: 13, offers: 2 },
    { date: '02/10', applications: 71, interviews: 18, offers: 5 },
    { date: '02/11', applications: 49, interviews: 11, offers: 2 },
    { date: '02/12', applications: 58, interviews: 15, offers: 3 },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
    { id: 'n1', userId: 'u1', type: 'candidate_applied', title: '新简历投递', message: '陈思远投递了高级前端工程师', read: false, actionUrl: '/candidates/1', createdAt: '2026-02-12T18:30:00Z' },
    { id: 'n2', userId: 'u1', type: 'evaluation_ready', title: '评估完成', message: '李明辉的 AI 面试评估已完成', read: false, actionUrl: '/candidates/2', createdAt: '2026-02-12T16:00:00Z' },
    { id: 'n3', userId: 'u1', type: 'interview_scheduled', title: '面试提醒', message: '刘雪晴一面将在 2 小时后开始', read: true, actionUrl: '/interviews', createdAt: '2026-02-12T14:00:00Z' },
    { id: 'n4', userId: 'u1', type: 'mention', title: '被@提及', message: '张通在王芳菲的评审中提到了你', read: true, createdAt: '2026-02-11T10:00:00Z' },
    { id: 'n5', userId: 'u1', type: 'system', title: '系统更新', message: 'HireFlow AI v2.1 发布，新增筛选规则功能', read: true, createdAt: '2026-02-10T08:00:00Z' },
];

export const MOCK_TODAY_SCHEDULE = [
    { time: '09:00', candidate: '陈思远', type: '技术二面', jobTitle: '高级前端工程师' },
    { time: '10:30', candidate: '李明辉', type: 'AI 一面', jobTitle: '高级前端工程师' },
    { time: '14:00', candidate: '吴子涵', type: '案例分析', jobTitle: '产品经理 - 增长方向' },
];

export const MOCK_AI_COST = {
    tokensUsed: 284500,
    estimatedCost: 12.38,
    models: [
        { model: 'Gemini 2.5 Flash', percentage: 62, tokens: 176390, cost: 3.52 },
        { model: 'GPT-4o Mini', percentage: 28, tokens: 79660, cost: 4.78 },
        { model: 'Mock Model', percentage: 10, tokens: 28450, cost: 0 },
    ],
};
