export type AIProviderId = 'nvidia' | 'openrouter' | 'openai' | 'gemini' | string;

export type AIModelCapability =
  | 'chat'
  | 'coding'
  | 'debugging'
  | 'architecture'
  | 'security'
  | 'documentation'
  | 'testing'
  | 'reasoning'
  | 'streaming'
  | 'structured_json'
  | 'embeddings';

export type TaskType =
  | 'chat'
  | 'coding'
  | 'debugging'
  | 'architecture'
  | 'security'
  | 'documentation'
  | 'testing'
  | 'reasoning'
  | 'general'
  | 'code_review'
  | 'doc_generation'
  | 'bug_detection'
  | 'security_scan'
  | 'test_generation'
  | 'explanation'
  | 'impact_analysis';

export type AIRouterMode = 'auto' | 'forced';

export interface AIProvider {
  id: AIProviderId;
  name: string;
  baseUrl: string;
  isOpenAICompatible: boolean;
  enabled: boolean;
  priority: number;
  defaultModel: string;
  supportedModels: string[];
  capabilities: AIModelCapability[];
}

export interface AIModel {
  id: string;
  name: string;
  providerId: AIProviderId;
  contextWindow: number;
  capabilities: AIModelCapability[];
  priority: number; // Higher number = higher preference for matching tasks
  enabled: boolean;
}

export interface AIProviderKey {
  id: string; // Sanitized identifier, e.g. "nvidia-key-1" (safe to log)
  providerId: AIProviderId;
  key: string; // The secret key itself (never exposed or logged)
  index: number;
  lastUsed?: number;
  failureCount?: number;
  rateLimitedUntil?: number;
}

export interface OrchestratorRequest {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
  taskType?: TaskType;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  preferredProvider?: AIProviderId;
  preferredModel?: string;
  rawContextText?: string;
  requiresJson?: boolean;
}

export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'critical';

export interface CandidateExecutionResult {
  candidateId: string;
  providerId: AIProviderId;
  modelId: string;
  keyId: string;
  status: 'success' | 'failed';
  response?: string;
  error?: string;
  elapsedMs: number;
}

export interface OrchestratorExecutionPlan {
  provider: AIProvider;
  model: AIModel;
  key: AIProviderKey;
  routerMode: AIRouterMode;
  taskType: TaskType;
  score?: number;
}

export interface MultiModelExecutionPlan {
  taskType: TaskType;
  complexity: TaskComplexity;
  candidates: OrchestratorExecutionPlan[];
  evaluator?: OrchestratorExecutionPlan;
  requiresEvaluation: boolean;
}

