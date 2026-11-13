import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AgentRunRecord,
  ChatMessageRecord,
  ConversationRecord,
  FileChangeSnapshot,
  PlanStep,
  ProjectMemoryItem,
  ProjectRecord,
  ProviderConfigDTO,
  ProviderId,
  ToolExecutionEvent,
  UserProfile,
} from '../shared/types.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';

function resolveWritableDataDir(): string {
  const preferred = path.resolve(process.cwd(), '.forge-data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK | fs.constants.R_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'forge-ai-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_PATH = path.join(DATA_DIR, 'forge.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'engineer',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    template TEXT NOT NULL DEFAULT 'react-vite',
    workspace_path TEXT NOT NULL,
    git_branch TEXT NOT NULL DEFAULT 'main',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_events_json TEXT NOT NULL DEFAULT '[]',
    plan_json TEXT NOT NULL DEFAULT '[]',
    model TEXT,
    provider TEXT,
    external_request_id TEXT,
    feedback_rating TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    iterations INTEGER NOT NULL DEFAULT 0,
    max_iterations INTEGER NOT NULL DEFAULT 15,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    summary TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS file_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL,
    previous_content TEXT,
    new_content TEXT,
    diff_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provider_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL DEFAULT '',
    temperature REAL NOT NULL DEFAULT 0.2,
    max_output_tokens INTEGER NOT NULL DEFAULT 8192,
    max_context_files INTEGER NOT NULL DEFAULT 12,
    is_active INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, provider)
  );

  CREATE TABLE IF NOT EXISTS project_memory (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    memory_key TEXT NOT NULL,
    memory_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, memory_key)
  );
`);

// Safe additive migration for existing SQLite databases
try {
  db.exec('ALTER TABLE messages ADD COLUMN external_request_id TEXT;');
} catch {
  // column already exists
}
try {
  db.exec('ALTER TABLE messages ADD COLUMN feedback_rating TEXT;');
} catch {
  // column already exists
}

export const DEFAULT_PROVIDERS: Array<{
  provider: ProviderId;
  label: string;
  baseUrl: string;
  model: string;
  availableModels: string[];
  managedServerSide: boolean;
  envVarName?: string;
}> = [
  {
    provider: 'coarena',
    label: 'Coarena Free Model API',
    baseUrl: 'https://coarena.ai/api/v1',
    model: 'claude-sonnet-5-5',
    availableModels: [
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-fable-5-2',
      'claude-haiku-5-5',
      'deepseek-v4-1-flash-1017',
      'gemini-4-argon',
      'gemini-4-carbon',
      'gemini-3-8-flash',
      'grok-4-7',
      'kimi-k3-1-pro',
      'qwen3-8-2-4t-a95b',
    ],
    managedServerSide: true,
    envVarName: 'COARENA_API_KEY',
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter (Free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    availableModels: [
      'openrouter/free',
      'cohere/north-mini-code:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'nvidia/nemotron-3.5-lightning:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'baidu/ernie-5.5-flash-preview:free',
      'particle-ai/particle-1:free',
      'recursive/flint-v1.0:free',
      'thinkingmachines/inkling-2-small:free',
    ],
    managedServerSide: true,
    envVarName: 'OPENROUTER_API_KEY',
  },
  {
    provider: 'groq',
    label: 'Groq (Free Tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    availableModels: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'allam-2-7b',
    ],
    managedServerSide: true,
    envVarName: 'GROQ_API_KEY',
  },
  {
    provider: 'nvidia',
    label: 'NVIDIA NIM (Free)',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'deepseek-ai/deepseek-v4.1-flash',
    availableModels: [
      'deepseek-ai/deepseek-v4.1-flash',
      'nvidia/nemotron-3-ultra-550b-a55b',
      'nvidia/nemotron-3-super-120b-a12b',
      'mistralai/codestral-22b-instruct-v0.1',
      'mistralai/mistral-large-4-1t-a52b',
      'moonshotai/kimi-k2.6',
      'z-ai/glm-5.3-flash',
      'minimaxai/minimax-m3.1-flash',
      'google/gemma-4-31b-it',
      'openai/gpt-oss-20b',
      'ibm/granite-34b-code-instruct',
    ],
    managedServerSide: true,
    envVarName: 'NVIDIA_API_KEY',
  },
  {
    provider: 'gemini',
    label: 'Google Gemini (Free Tier)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3.1-flash-lite',
    availableModels: [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
    ],
    managedServerSide: true,
    envVarName: 'GEMINI_API_KEY',
  },
  {
    provider: 'apinex',
    label: 'Apinex API (Free)',
    baseUrl: 'https://api.apinex.ai/v1',
    model: 'deepseek-chat',
    availableModels: [
      'deepseek-chat',
      'qwen-2.5-coder-32b-instruct',
      'glm-4-flash',
      'gemini-3.1-flash-lite',
    ],
    managedServerSide: true,
    envVarName: 'APINEX_API_KEY',
  },
  {
    provider: 'anyrouter',
    label: 'AnyRouter API (Free)',
    baseUrl: 'https://anyrouter.top/v1',
    model: 'deepseek-chat',
    availableModels: [
      'deepseek-chat',
      'glm-4-flash',
      'qwen-2.5-coder-32b-instruct',
      'gemini-3.1-flash-lite',
    ],
    managedServerSide: true,
    envVarName: 'ANYROUTER_API_KEY',
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini'],
    managedServerSide: true,
    envVarName: 'OPENAI_API_KEY',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-haiku-latest',
    availableModels: ['claude-3-5-haiku-latest'],
    managedServerSide: true,
    envVarName: 'ANTHROPIC_API_KEY',
  },
  {
    provider: 'custom',
    label: 'Custom OpenAI-Compatible (Local)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder:32b',
    availableModels: ['qwen2.5-coder:32b', 'deepseek-coder-v2', 'llama3.3:70b'],
    managedServerSide: true,
  },
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function getUserByEmail(email: string): (UserProfile & { passwordHash: string }) | null {
  const row = db
    .prepare('SELECT id, email, name, password_hash, role, created_at FROM users WHERE email = ?')
    .get(email.toLowerCase().trim()) as
    | { id: string; email: string; name: string; password_hash: string; role: string; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function getUserById(id: string): UserProfile | null {
  const row = db
    .prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?')
    .get(id) as
    | { id: string; email: string; name: string; role: string; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function createUser(params: { email: string; name: string; passwordHash: string }): UserProfile {
  const id = newId();
  const createdAt = nowIso();
  const email = params.email.toLowerCase().trim();
  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, params.name.trim(), params.passwordHash, 'engineer', createdAt);

  // Initialize default Coarena Free Model API provider as active
  db.prepare(
    `INSERT INTO provider_configs (id, user_id, provider, base_url, model, encrypted_api_key, temperature, max_output_tokens, max_context_files, is_active, updated_at)
     VALUES (?, ?, 'coarena', ?, 'claude-sonnet-5-5', '', 0.2, 8192, 12, 1, ?)`
  ).run(newId(), id, 'https://coarena.ai/api/v1', createdAt);

  return { id, email, name: params.name.trim(), role: 'engineer', createdAt };
}

export function listProjectsForUser(userId: string): ProjectRecord[] {
  const rows = db
    .prepare(
      'SELECT id, user_id, name, description, template, git_branch, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
    )
    .all(userId) as Array<{
    id: string;
    user_id: string;
    name: string;
    description: string;
    template: string;
    git_branch: string;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    template: r.template,
    gitBranch: r.git_branch,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getProjectForUser(projectId: string, userId: string): (ProjectRecord & { workspacePath: string }) | null {
  const r = db
    .prepare(
      'SELECT id, user_id, name, description, template, workspace_path, git_branch, created_at, updated_at FROM projects WHERE id = ? AND user_id = ?'
    )
    .get(projectId, userId) as
    | {
        id: string;
        user_id: string;
        name: string;
        description: string;
        template: string;
        workspace_path: string;
        git_branch: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    template: r.template,
    workspacePath: r.workspace_path,
    gitBranch: r.git_branch,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function insertProject(params: {
  id: string;
  userId: string;
  name: string;
  description: string;
  template: string;
  workspacePath: string;
}): ProjectRecord {
  const now = nowIso();
  db.prepare(
    `INSERT INTO projects (id, user_id, name, description, template, workspace_path, git_branch, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'main', ?, ?)`
  ).run(params.id, params.userId, params.name, params.description, params.template, params.workspacePath, now, now);
  return {
    id: params.id,
    userId: params.userId,
    name: params.name,
    description: params.description,
    template: params.template,
    gitBranch: 'main',
    createdAt: now,
    updatedAt: now,
  };
}

export function touchProject(projectId: string) {
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
}

export function deleteProjectRecord(projectId: string, userId: string) {
  db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(projectId, userId);
}

export function listConversations(projectId: string, userId: string): ConversationRecord[] {
  const rows = db
    .prepare(
      'SELECT id, project_id, title, created_at, updated_at FROM conversations WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC'
    )
    .all(projectId, userId) as Array<{
    id: string;
    project_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function createConversation(projectId: string, userId: string, title: string): ConversationRecord {
  const id = newId();
  const now = nowIso();
  db.prepare(
    'INSERT INTO conversations (id, project_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, userId, title, now, now);
  return { id, projectId, title, createdAt: now, updatedAt: now };
}

export function getConversationForUser(conversationId: string, userId: string): ConversationRecord | null {
  const r = db
    .prepare('SELECT id, project_id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?')
    .get(conversationId, userId) as
    | { id: string; project_id: string; title: string; created_at: string; updated_at: string }
    | undefined;
  if (!r) return null;
  return { id: r.id, projectId: r.project_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function listMessages(conversationId: string): ChatMessageRecord[] {
  const rows = db
    .prepare(
      'SELECT id, conversation_id, role, content, tool_events_json, plan_json, model, provider, external_request_id, feedback_rating, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
    .all(conversationId) as Array<{
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tool_events_json: string;
    plan_json: string;
    model: string | null;
    provider: ProviderId | null;
    external_request_id: string | null;
    feedback_rating: 'good' | 'bad' | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolEvents: JSON.parse(r.tool_events_json || '[]') as ToolExecutionEvent[],
    plan: JSON.parse(r.plan_json || '[]') as PlanStep[],
    model: r.model || undefined,
    provider: r.provider || undefined,
    externalRequestId: r.external_request_id || undefined,
    feedbackRating: r.feedback_rating || undefined,
    createdAt: r.created_at,
  }));
}

export function addMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolEvents?: ToolExecutionEvent[];
  plan?: PlanStep[];
  model?: string;
  provider?: ProviderId;
  externalRequestId?: string;
}): ChatMessageRecord {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, tool_events_json, plan_json, model, provider, external_request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.conversationId,
    params.role,
    params.content,
    JSON.stringify(params.toolEvents ?? []),
    JSON.stringify(params.plan ?? []),
    params.model ?? null,
    params.provider ?? null,
    params.externalRequestId ?? null,
    now
  );
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, params.conversationId);
  return {
    id,
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    toolEvents: params.toolEvents ?? [],
    plan: params.plan ?? [],
    model: params.model,
    provider: params.provider,
    externalRequestId: params.externalRequestId,
    createdAt: now,
  };
}

export function getMessageById(messageId: string): ChatMessageRecord | null {
  const r = db
    .prepare(
      'SELECT id, conversation_id, role, content, tool_events_json, plan_json, model, provider, external_request_id, feedback_rating, created_at FROM messages WHERE id = ?'
    )
    .get(messageId) as
    | {
        id: string;
        conversation_id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        tool_events_json: string;
        plan_json: string;
        model: string | null;
        provider: ProviderId | null;
        external_request_id: string | null;
        feedback_rating: 'good' | 'bad' | null;
        created_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolEvents: JSON.parse(r.tool_events_json || '[]') as ToolExecutionEvent[],
    plan: JSON.parse(r.plan_json || '[]') as PlanStep[],
    model: r.model || undefined,
    provider: r.provider || undefined,
    externalRequestId: r.external_request_id || undefined,
    feedbackRating: r.feedback_rating || undefined,
    createdAt: r.created_at,
  };
}

export function updateMessageFeedback(messageId: string, rating: 'good' | 'bad') {
  db.prepare('UPDATE messages SET feedback_rating = ? WHERE id = ?').run(rating, messageId);
}

export function createAgentRun(params: {
  projectId: string;
  conversationId: string;
  maxIterations: number;
}): AgentRunRecord {
  const id = newId();
  const startedAt = nowIso();
  db.prepare(
    `INSERT INTO agent_runs (id, project_id, conversation_id, status, current_stage, iterations, max_iterations, started_at)
     VALUES (?, ?, ?, 'running', 'understanding', 0, ?, ?)`
  ).run(id, params.projectId, params.conversationId, params.maxIterations, startedAt);
  return {
    id,
    projectId: params.projectId,
    conversationId: params.conversationId,
    status: 'running',
    currentStage: 'understanding',
    iterations: 0,
    maxIterations: params.maxIterations,
    startedAt,
  };
}

export function updateAgentRun(
  runId: string,
  patch: Partial<{
    status: AgentRunRecord['status'];
    currentStage: AgentRunRecord['currentStage'];
    iterations: number;
    endedAt: string;
    summary: string;
    error: string;
  }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.currentStage !== undefined) {
    fields.push('current_stage = ?');
    values.push(patch.currentStage);
  }
  if (patch.iterations !== undefined) {
    fields.push('iterations = ?');
    values.push(patch.iterations);
  }
  if (patch.endedAt !== undefined) {
    fields.push('ended_at = ?');
    values.push(patch.endedAt);
  }
  if (patch.summary !== undefined) {
    fields.push('summary = ?');
    values.push(patch.summary);
  }
  if (patch.error !== undefined) {
    fields.push('error = ?');
    values.push(patch.error);
  }
  if (fields.length === 0) return;
  values.push(runId);
  db.prepare(`UPDATE agent_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function listAgentRuns(projectId: string): AgentRunRecord[] {
  const rows = db
    .prepare(
      'SELECT id, project_id, conversation_id, status, current_stage, iterations, max_iterations, started_at, ended_at, summary, error FROM agent_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 30'
    )
    .all(projectId) as Array<{
    id: string;
    project_id: string;
    conversation_id: string;
    status: AgentRunRecord['status'];
    current_stage: AgentRunRecord['currentStage'];
    iterations: number;
    max_iterations: number;
    started_at: string;
    ended_at: string | null;
    summary: string | null;
    error: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    conversationId: r.conversation_id,
    status: r.status,
    currentStage: r.current_stage,
    iterations: r.iterations,
    maxIterations: r.max_iterations,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? undefined,
    summary: r.summary ?? undefined,
    error: r.error ?? undefined,
  }));
}

export function insertFileSnapshot(params: {
  projectId: string;
  runId: string;
  filePath: string;
  operation: FileChangeSnapshot['operation'];
  previousContent: string | null;
  newContent: string | null;
  diffText: string;
  status: FileChangeSnapshot['status'];
}): FileChangeSnapshot {
  const id = newId();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO file_snapshots (id, project_id, run_id, file_path, operation, previous_content, new_content, diff_text, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.projectId,
    params.runId,
    params.filePath,
    params.operation,
    params.previousContent,
    params.newContent,
    params.diffText,
    params.status,
    createdAt
  );
  return {
    id,
    projectId: params.projectId,
    runId: params.runId,
    filePath: params.filePath,
    operation: params.operation,
    previousContent: params.previousContent,
    newContent: params.newContent,
    diffText: params.diffText,
    status: params.status,
    createdAt,
  };
}

export function listFileSnapshots(projectId: string): FileChangeSnapshot[] {
  const rows = db
    .prepare(
      'SELECT id, project_id, run_id, file_path, operation, previous_content, new_content, diff_text, status, created_at FROM file_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 60'
    )
    .all(projectId) as Array<{
    id: string;
    project_id: string;
    run_id: string;
    file_path: string;
    operation: FileChangeSnapshot['operation'];
    previous_content: string | null;
    new_content: string | null;
    diff_text: string;
    status: FileChangeSnapshot['status'];
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    runId: r.run_id,
    filePath: r.file_path,
    operation: r.operation,
    previousContent: r.previous_content,
    newContent: r.new_content,
    diffText: r.diff_text,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function getFileSnapshot(snapshotId: string, projectId: string): FileChangeSnapshot | null {
  const r = db
    .prepare(
      'SELECT id, project_id, run_id, file_path, operation, previous_content, new_content, diff_text, status, created_at FROM file_snapshots WHERE id = ? AND project_id = ?'
    )
    .get(snapshotId, projectId) as
    | {
        id: string;
        project_id: string;
        run_id: string;
        file_path: string;
        operation: FileChangeSnapshot['operation'];
        previous_content: string | null;
        new_content: string | null;
        diff_text: string;
        status: FileChangeSnapshot['status'];
        created_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    runId: r.run_id,
    filePath: r.file_path,
    operation: r.operation,
    previousContent: r.previous_content,
    newContent: r.new_content,
    diffText: r.diff_text,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function updateSnapshotStatus(snapshotId: string, status: FileChangeSnapshot['status']) {
  db.prepare('UPDATE file_snapshots SET status = ? WHERE id = ?').run(status, snapshotId);
}

export function listProviderConfigsForUser(userId: string): ProviderConfigDTO[] {
  const rows = db
    .prepare(
      'SELECT id, provider, base_url, model, encrypted_api_key, temperature, max_output_tokens, max_context_files, is_active FROM provider_configs WHERE user_id = ?'
    )
    .all(userId) as Array<{
    id: string;
    provider: ProviderId;
    base_url: string;
    model: string;
    encrypted_api_key: string;
    temperature: number;
    max_output_tokens: number;
    max_context_files: number;
    is_active: number;
  }>;

  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return DEFAULT_PROVIDERS.map((def) => {
    const saved = byProvider.get(def.provider);
    const envVal = def.envVarName ? process.env[def.envVarName] : undefined;
    const hasKey = Boolean(saved?.encrypted_api_key) || Boolean(envVal);
    return {
      id: saved?.id,
      provider: def.provider,
      label: def.label,
      baseUrl: saved?.base_url || def.baseUrl,
      model: saved?.model || def.model,
      availableModels: def.availableModels,
      hasApiKey: hasKey,
      managedServerSide: def.managedServerSide,
      temperature: saved?.temperature ?? 0.2,
      maxOutputTokens: saved?.max_output_tokens ?? 8192,
      maxContextFiles: saved?.max_context_files ?? 12,
      isActive:
        Boolean(saved?.is_active) ||
        (!rows.some((r) => r.is_active === 1) && def.provider === 'coarena'),
    };
  });
}

export function saveProviderConfigForUser(
  userId: string,
  input: {
    provider: ProviderId;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
    maxContextFiles?: number;
    setActive?: boolean;
  }
) {
  const def = DEFAULT_PROVIDERS.find((p) => p.provider === input.provider);
  if (!def) throw new Error(`Unsupported provider: ${input.provider}`);

  const existing = db
    .prepare(
      'SELECT id, encrypted_api_key, base_url, model, temperature, max_output_tokens, max_context_files, is_active FROM provider_configs WHERE user_id = ? AND provider = ?'
    )
    .get(userId, input.provider) as
    | {
        id: string;
        encrypted_api_key: string;
        base_url: string;
        model: string;
        temperature: number;
        max_output_tokens: number;
        max_context_files: number;
        is_active: number;
      }
    | undefined;

  if (input.setActive) {
    db.prepare('UPDATE provider_configs SET is_active = 0 WHERE user_id = ?').run(userId);
  }

  let encryptedKey = existing?.encrypted_api_key ?? '';
  if (input.clearApiKey) {
    encryptedKey = '';
  } else if (input.apiKey && input.apiKey.trim()) {
    encryptedKey = encryptSecret(input.apiKey.trim());
  }

  const now = nowIso();
  const baseUrl = input.baseUrl ?? existing?.base_url ?? def.baseUrl;
  const model = input.model ?? existing?.model ?? def.model;
  const temperature = input.temperature ?? existing?.temperature ?? 0.2;
  const maxOutputTokens = input.maxOutputTokens ?? existing?.max_output_tokens ?? 8192;
  const maxContextFiles = input.maxContextFiles ?? existing?.max_context_files ?? 12;
  const isActive = input.setActive ? 1 : existing?.is_active ?? 0;

  if (existing) {
    db.prepare(
      `UPDATE provider_configs
       SET base_url = ?, model = ?, encrypted_api_key = ?, temperature = ?, max_output_tokens = ?, max_context_files = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      baseUrl,
      model,
      encryptedKey,
      temperature,
      maxOutputTokens,
      maxContextFiles,
      isActive,
      now,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO provider_configs (id, user_id, provider, base_url, model, encrypted_api_key, temperature, max_output_tokens, max_context_files, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId(),
      userId,
      input.provider,
      baseUrl,
      model,
      encryptedKey,
      temperature,
      maxOutputTokens,
      maxContextFiles,
      isActive,
      now
    );
  }
}

export function getResolvedProviderById(
  userId: string,
  providerId: ProviderId
): {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  maxContextFiles: number;
} {
  const def = DEFAULT_PROVIDERS.find((p) => p.provider === providerId) || DEFAULT_PROVIDERS[0];
  const row = db
    .prepare(
      'SELECT provider, base_url, model, encrypted_api_key, temperature, max_output_tokens, max_context_files FROM provider_configs WHERE user_id = ? AND provider = ? LIMIT 1'
    )
    .get(userId, providerId) as
    | {
        provider: ProviderId;
        base_url: string;
        model: string;
        encrypted_api_key: string;
        temperature: number;
        max_output_tokens: number;
        max_context_files: number;
      }
    | undefined;

  const envKey = def.envVarName ? process.env[def.envVarName] || '' : '';
  const storedKey = row?.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : '';

  return {
    provider: def.provider,
    baseUrl: row?.base_url || def.baseUrl,
    model: row?.model || def.model,
    apiKey: storedKey || envKey,
    temperature: row?.temperature ?? 0.2,
    maxOutputTokens: row?.max_output_tokens ?? 8192,
    maxContextFiles: row?.max_context_files ?? 12,
  };
}

export function getResolvedActiveProvider(userId: string): {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  maxContextFiles: number;
} {
  const row = db
    .prepare(
      'SELECT provider FROM provider_configs WHERE user_id = ? AND is_active = 1 LIMIT 1'
    )
    .get(userId) as { provider: ProviderId } | undefined;

  return getResolvedProviderById(userId, row?.provider || 'coarena');
}

export function listProjectMemory(projectId: string): ProjectMemoryItem[] {
  const rows = db
    .prepare('SELECT id, project_id, memory_key, memory_value, updated_at FROM project_memory WHERE project_id = ? ORDER BY updated_at DESC')
    .all(projectId) as Array<{
    id: string;
    project_id: string;
    memory_key: string;
    memory_value: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    key: r.memory_key,
    value: r.memory_value,
    updatedAt: r.updated_at,
  }));
}

export function upsertProjectMemory(projectId: string, key: string, value: string): ProjectMemoryItem {
  const now = nowIso();
  const id = newId();
  db.prepare(
    `INSERT INTO project_memory (id, project_id, memory_key, memory_value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, memory_key) DO UPDATE SET memory_value = excluded.memory_value, updated_at = excluded.updated_at`
  ).run(id, projectId, key, value, now);
  return { id, projectId, key, value, updatedAt: now };
}
