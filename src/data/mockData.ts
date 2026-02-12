// ================================================
// HireFlow AI - Mock Data for Development
// ================================================

import type { Candidate, Job, Interview, Evaluation, Notification, DailyMetric, StageMetric } from '@/types';

export const MOCK_CANDIDATES: Candidate[] = [
    { id: '1', jobId: 'j1', name: 'Sarah Jenkins', email: 'sarah@email.com', phone: '+1 555-0101', stage: 'Interview 2', score: 92, skills: ['React', 'TypeScript', 'GraphQL', 'Node.js'], appliedDate: '2026-02-10', avatar: '', resumeId: 'r1', verificationStatus: 'verified', tags: ['top-talent', 'referral'] },
    { id: '2', jobId: 'j1', name: 'Michael Chen', email: 'michael@email.com', phone: '+86 138-0000-0001', stage: 'Screening', score: 88, skills: ['Python', 'AWS', 'Docker', 'Kubernetes'], appliedDate: '2026-02-10', avatar: '', resumeId: 'r2', verificationStatus: 'pending', tags: [] },
    { id: '3', jobId: 'j2', name: 'Amara Okeke', email: 'amara@email.com', phone: '+44 20-1234-5678', stage: 'Offer', score: 95, skills: ['Product Strategy', 'Data Analysis', 'Agile', 'SQL'], appliedDate: '2026-02-09', avatar: '', resumeId: 'r3', verificationStatus: 'verified', tags: ['urgent'] },
    { id: '4', jobId: 'j1', name: 'David Kim', email: 'david@email.com', phone: '+82 10-1234-5678', stage: 'Applied', score: 76, skills: ['React', 'JavaScript', 'CSS'], appliedDate: '2026-02-09', avatar: '', resumeId: 'r4', verificationStatus: 'unverified', tags: [] },
    { id: '5', jobId: 'j1', name: 'Elena Rodriguez', email: 'elena@email.com', phone: '+34 612-345-678', stage: 'Interview 1', score: 85, skills: ['React', 'TypeScript', 'Testing', 'Node.js'], appliedDate: '2026-02-08', avatar: '', resumeId: 'r5', verificationStatus: 'verified', tags: ['referral'] },
    { id: '6', jobId: 'j3', name: 'James Wilson', email: 'james@email.com', phone: '+1 555-0202', stage: 'Applied', score: 71, skills: ['Python', 'TensorFlow', 'R'], appliedDate: '2026-02-08', avatar: '', resumeId: 'r6', verificationStatus: 'pending', tags: [] },
    { id: '7', jobId: 'j1', name: 'Liu Xiaoming', email: 'xiaoming@email.com', phone: '+86 139-0000-0002', stage: 'Screening', score: 91, skills: ['React', 'Vue', 'TypeScript', 'Go', 'PostgreSQL'], appliedDate: '2026-02-07', avatar: '', resumeId: 'r7', verificationStatus: 'verified', tags: ['top-talent'] },
    { id: '8', jobId: 'j2', name: 'Anna Petrova', email: 'anna@email.com', phone: '+7 999-123-4567', stage: 'Interview 1', score: 82, skills: ['Product Management', 'UX Research', 'Figma'], appliedDate: '2026-02-07', avatar: '', resumeId: 'r8', verificationStatus: 'disputed', tags: [] },
    { id: '9', jobId: 'j1', name: 'Ibrahim Hassan', email: 'ibrahim@email.com', phone: '+971 50-123-4567', stage: 'Rejected', score: 45, skills: ['HTML', 'CSS', 'jQuery'], appliedDate: '2026-02-06', avatar: '', resumeId: 'r9', verificationStatus: 'unverified', tags: [] },
    { id: '10', jobId: 'j3', name: 'Yuki Tanaka', email: 'yuki@email.com', phone: '+81 90-1234-5678', stage: 'Applied', score: 89, skills: ['Python', 'PyTorch', 'NLP', 'AWS'], appliedDate: '2026-02-06', avatar: '', resumeId: 'r10', verificationStatus: 'pending', tags: ['top-talent'] },
];

export const MOCK_JOBS: Job[] = [
    {
        id: 'j1',
        companyId: 'c1',
        title: 'Senior Frontend Engineer',
        department: 'Engineering',
        location: 'Remote / Shanghai',
        type: 'full-time',
        descriptionJd: 'We are looking for a Senior Frontend Engineer to lead our web platform development. You will work with React, TypeScript, and modern web technologies.',
        requirements: ['5+ years of frontend development', 'React & TypeScript expertise', 'System design experience'],
        status: 'active',
        salaryRange: { min: 40000, max: 65000, currency: 'USD' },
        pipeline: [
            { id: 'p1', name: 'Resume Screening', type: 'screening', order: 0 },
            { id: 'p2', name: 'AI Technical Interview', type: 'interview_1', order: 1 },
            { id: 'p3', name: 'Live Coding Round', type: 'interview_2', order: 2 },
            { id: 'p4', name: 'HR Final Round', type: 'hr_interview', order: 3 },
            { id: 'p5', name: 'Offer', type: 'offer', order: 4 },
        ],
        createdAt: '2026-01-15',
        updatedAt: '2026-02-10',
    },
    {
        id: 'j2',
        companyId: 'c1',
        title: 'Product Manager - Growth',
        department: 'Product',
        location: 'Beijing',
        type: 'full-time',
        descriptionJd: 'Lead growth initiatives and product strategy for our core platform.',
        requirements: ['5+ years in product management', 'Data-driven mindset', 'Growth hacking experience'],
        status: 'active',
        salaryRange: { min: 45000, max: 70000, currency: 'USD' },
        pipeline: [
            { id: 'p6', name: 'Resume Screening', type: 'screening', order: 0 },
            { id: 'p7', name: 'Case Study', type: 'interview_1', order: 1 },
            { id: 'p8', name: 'VP Interview', type: 'interview_2', order: 2 },
            { id: 'p9', name: 'Offer', type: 'offer', order: 3 },
        ],
        createdAt: '2026-02-01',
        updatedAt: '2026-02-08',
    },
    {
        id: 'j3',
        companyId: 'c1',
        title: 'Machine Learning Engineer',
        department: 'AI/ML',
        location: 'Remote',
        type: 'full-time',
        descriptionJd: 'Build and deploy ML models for our recruitment intelligence platform.',
        requirements: ['3+ years in ML/AI', 'Python & PyTorch/TensorFlow', 'NLP experience preferred'],
        status: 'active',
        salaryRange: { min: 50000, max: 80000, currency: 'USD' },
        pipeline: [
            { id: 'p10', name: 'Resume Screening', type: 'screening', order: 0 },
            { id: 'p11', name: 'Technical Interview', type: 'interview_1', order: 1 },
            { id: 'p12', name: 'System Design', type: 'interview_2', order: 2 },
            { id: 'p13', name: 'Offer', type: 'offer', order: 3 },
        ],
        createdAt: '2026-02-05',
        updatedAt: '2026-02-10',
    },
];

export const MOCK_FUNNEL_DATA: StageMetric[] = [
    { name: 'Applied', count: 1245, conversionRate: 100, avgTimeInStage: 0 },
    { name: 'Screening', count: 820, conversionRate: 65.9, avgTimeInStage: 24 },
    { name: 'Interview 1', count: 350, conversionRate: 42.7, avgTimeInStage: 72 },
    { name: 'Interview 2', count: 128, conversionRate: 36.6, avgTimeInStage: 96 },
    { name: 'Offer', count: 48, conversionRate: 37.5, avgTimeInStage: 48 },
    { name: 'Hired', count: 35, conversionRate: 72.9, avgTimeInStage: 24 },
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
    { id: 'n1', userId: 'u1', type: 'candidate_applied', title: 'New Application', message: 'Sarah Jenkins applied for Senior Frontend Engineer', read: false, actionUrl: '/candidates/1', createdAt: '2026-02-12T18:30:00Z' },
    { id: 'n2', userId: 'u1', type: 'evaluation_ready', title: 'Evaluation Complete', message: "AI evaluation for Michael Chen's interview is ready", read: false, actionUrl: '/evaluations/e2', createdAt: '2026-02-12T16:00:00Z' },
    { id: 'n3', userId: 'u1', type: 'interview_scheduled', title: 'Interview Scheduled', message: 'Elena Rodriguez — Interview 1 starts in 2 hours', read: true, actionUrl: '/interviews/i5', createdAt: '2026-02-12T14:00:00Z' },
    { id: 'n4', userId: 'u1', type: 'mention', title: '@Mentioned', message: 'Tom tagged you in a review for Amara Okeke', read: true, actionUrl: '/evaluations/e3', createdAt: '2026-02-11T10:00:00Z' },
    { id: 'n5', userId: 'u1', type: 'system', title: 'System Update', message: 'HireFlow AI v2.1 is available with new screening features', read: true, createdAt: '2026-02-10T08:00:00Z' },
];

export const MOCK_EVALUATIONS: Evaluation[] = [
    {
        id: 'e1',
        interviewId: 'i1',
        candidateId: '1',
        scoreTotal: 92,
        dimensionScores: [
            { dimension: 'Technical Skills', score: 95, weight: 0.35, aiComment: 'Excellent React and TypeScript knowledge. Demonstrated deep understanding of performance optimization.' },
            { dimension: 'Problem Solving', score: 90, weight: 0.25, aiComment: 'Methodical approach to algorithm challenges. Identified edge cases proactively.' },
            { dimension: 'Communication', score: 88, weight: 0.2, aiComment: 'Clear articulation of technical concepts. Good at asking clarifying questions.' },
            { dimension: 'Culture Fit', score: 93, weight: 0.2, aiComment: 'Values align well with team culture. Collaborative mindset evident.' },
        ],
        aiSummary: 'Sarah is an exceptional candidate with strong technical depth and excellent communication skills. Highly recommended for the role.',
        recommendation: 'strong_hire',
        reviewerComments: [
            { userId: 'u1', userName: 'Tom Zhang', comment: 'Agree with AI assessment. Very strong candidate.', vote: 'hire', createdAt: '2026-02-11T10:00:00Z' },
            { userId: 'u2', userName: 'Lisa Wang', comment: 'Would like to see more system design depth but overall strong.', vote: 'hire', createdAt: '2026-02-11T14:00:00Z' },
        ],
        createdAt: '2026-02-10T15:00:00Z',
    },
];
