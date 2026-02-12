// AI Provider Types
export enum AIModelType {
  GEMINI_FLASH = 'gemini-2.5-flash-latest',
  GEMINI_PRO = 'gemini-3-pro-preview',
  GPT_4O = 'gpt-4o',
  CLAUDE_SONNET = 'claude-3-5-sonnet',
  MOCK = 'mock-model'
}

export interface AIProviderConfig {
  model: AIModelType;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

// Candidate & Job Types
export interface Candidate {
  id: string;
  name: string;
  email: string;
  stage: 'Applied' | 'Screening' | 'Interview 1' | 'Interview 2' | 'Offer' | 'Rejected';
  score: number;
  skills: string[];
  appliedDate: string;
}

export interface JobStats {
  totalCandidates: number;
  stages: {
    name: string;
    count: number;
    conversionRate: number;
  }[];
}

// Rule Engine Types
export type RuleOperator = 'EQUALS' | 'CONTAINS' | 'GTE' | 'LTE' | 'AND' | 'OR' | 'NOT';

export interface RuleNode {
  id: string;
  type: 'condition' | 'group';
  operator?: RuleOperator; // For groups (AND/OR) or conditions
  field?: string;          // e.g., "experience_years"
  value?: any;             // e.g., 3
  children?: RuleNode[];   // For groups
}

// Interview Types
export interface InterviewSession {
  id: string;
  candidateName: string;
  status: 'waiting' | 'active' | 'completed';
  messages: ChatMessage[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}
