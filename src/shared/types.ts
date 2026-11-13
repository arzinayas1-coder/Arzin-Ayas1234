export type AgentStage =
  | 'understanding'
  | 'inspecting'
  | 'planning'
  | 'reading'
  | 'editing'
  | 'testing'
  | 'debugging'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ProviderId =
  | 'coarena'
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'nvidia'
  | 'apinex'
  | 'anyrouter'
  | 'openai'
  | 'anthropic'
  | 'custom';

export type AgentApplyMode = 'review' | 'auto';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  template: string;
  gitBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  gitStatus?: string;
  children?: FileTreeNode[];
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface GitStatusSummary {
  initialized: boolean;
  branch: string;
  files: Array<{
    path: string;
    index: string;
    workingDir: string;
    label: string;
  }>;
  commits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
  }>;
}

export interface ProviderConfigDTO {
  id?: string;
  provider: ProviderId;
  label: string;
  baseUrl: string;
  model: string;
  availableModels: string[];
  hasApiKey: boolean;
  managedServerSide: boolean;
  temperature: number;
  maxOutputTokens: number;
  maxContextFiles: number;
  isActive: boolean;
}

export interface PlanStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
}

export interface ToolExecutionEvent {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'error' | 'awaiting_approval';
  stage: AgentStage;
  durationMs?: number;
  summary?: string;
  outputPreview?: string;
  error?: string;
  timestamp: string;
}

export interface FileChangeSnapshot {
  id: string;
  projectId: string;
  runId: string;
  filePath: string;
  operation: 'create' | 'update' | 'delete' | 'rename';
  previousContent: string | null;
  newContent: string | null;
  diffText: string;
  status: 'pending' | 'approved' | 'rejected' | 'rolled_back';
  conflict?: boolean;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolEvents: ToolExecutionEvent[];
  plan: PlanStep[];
  model?: string;
  provider?: ProviderId;
  externalRequestId?: string;
  feedbackRating?: 'good' | 'bad';
  createdAt: string;
}

export interface AgentRunRecord {
  id: string;
  projectId: string;
  conversationId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval';
  currentStage: AgentStage;
  iterations: number;
  maxIterations: number;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  error?: string;
}

export interface ProjectMemoryItem {
  id: string;
  projectId: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface DevServerState {
  projectId: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  port?: number;
  command?: string;
  pid?: number;
  previewUrl?: string;
  error?: string;
  logs: string[];
}

export interface ProviderModelDTO {
  id: string;
  displayName: string;
  contextLength: number;
  supportsTools: boolean;
  isFree: boolean;
}

export type CoarenaModelDTO = ProviderModelDTO;

export interface AgentSSEEvent {
  type:
    | 'run_started'
    | 'stage_changed'
    | 'plan_updated'
    | 'tool_started'
    | 'tool_completed'
    | 'text_delta'
    | 'changes_pending'
    | 'run_completed'
    | 'run_error';
  runId?: string;
  stage?: AgentStage;
  plan?: PlanStep[];
  toolEvent?: ToolExecutionEvent;
  delta?: string;
  changes?: FileChangeSnapshot[];
  summary?: string;
  error?: string;
  iteration?: number;
  externalRequestId?: string;
}
