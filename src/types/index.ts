// ================================================
// HireFlow AI - Core Type Definitions
// ================================================

// ======= AI Provider Types =======
export enum AIModelType {
    GEMINI_PRO = 'gemini-2.5-pro',
    GEMINI_FLASH = 'gemini-2.5-flash',
    GPT_4O = 'gpt-4o',
    GPT_4O_MINI = 'gpt-4o-mini',
    CLAUDE_SONNET = 'claude-sonnet-4-20250514',
    CLAUDE_OPUS = 'claude-opus-4-20250514',
    NOTEBOOK_LLM = 'notebook-llm',
    LOCAL = 'local-model',
    MOCK = 'mock-model',
}

export interface AIProviderConfig {
    model: AIModelType;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    baseUrl?: string; // For local/private deployments
    fallbackModel?: AIModelType;
}

export interface AIResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    latencyMs: number;
    model: string;
    costEstimate?: number; // USD estimate
}

export interface AIGatewayLog {
    id: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    costEstimate: number;
    timestamp: number;
    status: 'success' | 'fallback' | 'error';
    errorMessage?: string;
}

// ======= Company & User Types =======
export interface Company {
    id: string;
    name: string;
    domain: string;
    logo?: string;
    settings: CompanySettings;
    createdAt: string;
}

export interface CompanySettings {
    defaultModel: AIModelType;
    dataRetentionDays: number;
    enableAntiCheat: boolean;
    enableVideoRecording: boolean;
    timezone: string;
    language: 'zh-CN' | 'en-US';
}

export interface User {
    id: string;
    companyId: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'admin' | 'hr_manager' | 'interviewer' | 'viewer';
    createdAt: string;
}

// ======= Job Types =======
export interface Job {
    id: string;
    companyId: string;
    title: string;
    department: string;
    location: string;
    type: 'full-time' | 'part-time' | 'contract' | 'intern';
    descriptionJd: string;
    requirements: string[];
    status: 'draft' | 'active' | 'paused' | 'closed';
    salaryRange?: { min: number; max: number; currency: string };
    pipeline: PipelineStage[];
    createdAt: string;
    updatedAt: string;
}

export interface PipelineStage {
    id: string;
    name: string;
    type: 'screening' | 'interview_1' | 'interview_2' | 'hr_interview' | 'offer' | 'custom';
    order: number;
    aiModel?: AIModelType;
    timeLimit?: number; // minutes
    questionBankId?: string;
    scoringWeights?: Record<string, number>;
}

// ======= Candidate & Resume Types =======
export interface Candidate {
    id: string;
    jobId: string;
    name: string;
    email: string;
    phone?: string;
    stage: string;
    score: number;
    skills: string[];
    appliedDate: string;
    avatar?: string;
    resumeId?: string;
    verificationStatus: 'pending' | 'verified' | 'disputed' | 'unverified';
    tags?: string[];
}

export interface Resume {
    id: string;
    candidateId: string;
    s3Url: string;
    parsedContent: ParsedResume;
    matchScore: number;
    isDuplicate: boolean;
    uploadedAt: string;
}

export interface ParsedResume {
    name: string;
    email: string;
    phone?: string;
    education: Education[];
    experience: WorkExperience[];
    skills: string[];
    languages?: string[];
    summary?: string;
    totalYearsExperience: number;
}

export interface Education {
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: number;
    verified?: boolean;
}

export interface WorkExperience {
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string;
    current: boolean;
}

// ======= Interview Types =======
export interface Interview {
    id: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    stage: string;
    interviewLink: string;
    linkExpiresAt: string;
    scheduledAt?: string;
    status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
    aiModel: AIModelType;
    createdAt: string;
}

export interface InterviewSession {
    id: string;
    interviewId: string;
    candidateName: string;
    status: 'waiting' | 'device_check' | 'active' | 'completed';
    messages: ChatMessage[];
    videoS3Url?: string;
    transcript?: TranscriptEntry[];
    antiCheatEvents: AntiCheatEvent[];
    startedAt?: string;
    endedAt?: string;
}

export interface ChatMessage {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
    audioUrl?: string;
}

export interface TranscriptEntry {
    speaker: 'candidate' | 'ai';
    text: string;
    timestamp: number;
    confidence: number;
}

export interface AntiCheatEvent {
    type: 'VISIBILITY' | 'FOCUS_LOST' | 'MULTI_FACE' | 'NO_FACE' | 'LIVENESS_FAIL' | 'DEVICE_FINGERPRINT' | 'AI_DETECT';
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// ======= Evaluation Types =======
export interface Evaluation {
    id: string;
    interviewId: string;
    candidateId: string;
    scoreTotal: number;
    dimensionScores: DimensionScore[];
    aiSummary: string;
    recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
    reviewerComments?: ReviewComment[];
    createdAt: string;
}

export interface DimensionScore {
    dimension: string;
    score: number; // 0-100
    weight: number; // 0-1
    aiComment: string;
}

export interface ReviewComment {
    userId: string;
    userName: string;
    comment: string;
    vote?: 'hire' | 'pending' | 'reject';
    createdAt: string;
}

// ======= Rule Engine Types =======
export type RuleOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'GTE' | 'LTE' | 'GT' | 'LT' | 'IN' | 'BETWEEN' | 'REGEX' | 'AND' | 'OR' | 'NOT';

export interface RuleNode {
    id: string;
    type: 'condition' | 'group';
    operator?: RuleOperator;
    field?: string;
    value?: unknown;
    children?: RuleNode[];
    label?: string; // Friendly name in UI
}

export interface ScreeningRule {
    id: string;
    jobId: string;
    name: string;
    description?: string;
    ruleDsl: RuleNode;
    minScore: number;
    isActive: boolean;
    createdAt: string;
}

// ======= Stats & Analytics Types =======
export interface JobStats {
    totalCandidates: number;
    stages: StageMetric[];
    dailyApplications: DailyMetric[];
    topSkills: { skill: string; count: number }[];
}

export interface StageMetric {
    name: string;
    count: number;
    conversionRate: number;
    avgTimeInStage: number; // hours
}

export interface DailyMetric {
    date: string;
    applications: number;
    interviews: number;
    offers: number;
}

// ======= Notification Types =======
export interface Notification {
    id: string;
    userId: string;
    type: 'interview_scheduled' | 'candidate_applied' | 'evaluation_ready' | 'mention' | 'system';
    title: string;
    message: string;
    read: boolean;
    actionUrl?: string;
    createdAt: string;
}

// ======= Audit Log Types =======
export interface AuditLog {
    id: string;
    entityId: string;
    entityType: 'candidate' | 'interview' | 'job' | 'user' | 'evaluation';
    action: string;
    userId: string;
    userName: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

// ======= API Response Wrapper =======
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
    meta?: {
        page?: number;
        pageSize?: number;
        total?: number;
    };
}

// ======= Device Check Types =======
export interface DeviceCheckResult {
    camera: boolean;
    microphone: boolean;
    network: 'good' | 'fair' | 'poor';
    networkSpeed: number; // Mbps
    browser: string;
    isCompatible: boolean;
}
