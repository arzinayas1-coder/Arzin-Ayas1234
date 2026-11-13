import type {
  AgentApplyMode,
  AgentRunRecord,
  AgentSSEEvent,
  ChatMessageRecord,
  CoarenaModelDTO,
  ConversationRecord,
  DevServerState,
  FileChangeSnapshot,
  FileTreeNode,
  GitStatusSummary,
  ProjectMemoryItem,
  ProjectRecord,
  ProviderConfigDTO,
  ProviderId,
  ProviderModelDTO,
  SearchMatch,
} from '../shared/types.ts';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  providers: {
    list: () => request<{ providers: ProviderConfigDTO[] }>('/api/providers'),
    update: (payload: {
      provider: ProviderId;
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      temperature?: number;
      maxOutputTokens?: number;
      maxContextFiles?: number;
      setActive?: boolean;
    }) =>
      request<{ providers: ProviderConfigDTO[] }>('/api/providers', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    coarenaModels: () =>
      request<{ models: CoarenaModelDTO[] }>('/api/providers/coarena/models'),
    models: (provider: ProviderId) =>
      request<{ provider: ProviderId; models: ProviderModelDTO[] }>(
        `/api/providers/${provider}/models`
      ),
  },

  projects: {
    list: () => request<{ projects: ProjectRecord[] }>('/api/projects'),
    create: (payload: { name: string; description: string; template: string }) =>
      request<{ project: ProjectRecord }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
    runs: (id: string) => request<{ runs: AgentRunRecord[] }>(`/api/projects/${id}/runs`),
    memory: (id: string) => request<{ memory: ProjectMemoryItem[] }>(`/api/projects/${id}/memory`),
    saveMemory: (id: string, key: string, value: string) =>
      request<{ item: ProjectMemoryItem }>(`/api/projects/${id}/memory`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      }),
  },

  files: {
    tree: (projectId: string) => request<{ tree: FileTreeNode[] }>(`/api/projects/${projectId}/files`),
    read: (projectId: string, filePath: string) =>
      request<{ path: string; content: string; size: number }>(
        `/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`
      ),
    write: (projectId: string, filePath: string, content: string) =>
      request<{ ok: boolean; path: string }>(`/api/projects/${projectId}/file`, {
        method: 'PUT',
        body: JSON.stringify({ path: filePath, content }),
      }),
    mkdir: (projectId: string, dirPath: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path: dirPath }),
      }),
    rename: (projectId: string, oldPath: string, newPath: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
      }),
    delete: (projectId: string, filePath: string) =>
      request<{ ok: boolean }>(
        `/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`,
        { method: 'DELETE' }
      ),
    upload: (projectId: string, files: Array<{ path: string; content: string }>) =>
      request<{ ok: boolean; count: number }>(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
    search: (projectId: string, q: string, regex = false) =>
      request<{ matches: SearchMatch[] }>(
        `/api/projects/${projectId}/search?q=${encodeURIComponent(q)}&regex=${regex}`
      ),
  },

  git: {
    status: (projectId: string) => request<GitStatusSummary>(`/api/projects/${projectId}/git/status`),
    diff: (projectId: string, filePath?: string) =>
      request<{ diff: string }>(
        `/api/projects/${projectId}/git/diff${filePath ? `?path=${encodeURIComponent(filePath)}` : ''}`
      ),
    commit: (projectId: string, message: string) =>
      request<{ hash: string; message: string }>(`/api/projects/${projectId}/git/commit`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  },

  terminal: {
    exec: (projectId: string, command: string) =>
      request<{
        command: string;
        stdout: string;
        stderr: string;
        exitCode: number | null;
        timedOut: boolean;
        durationMs: number;
      }>(`/api/projects/${projectId}/exec`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      }),
    kill: (projectId: string) =>
      request<{ killed: boolean }>(`/api/projects/${projectId}/exec/kill`, { method: 'POST' }),
    history: (projectId: string) =>
      request<{ lines: string[] }>(`/api/projects/${projectId}/terminal/history`),
    clear: (projectId: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/terminal/clear`, { method: 'POST' }),
  },

  preview: {
    status: (projectId: string) => request<DevServerState>(`/api/projects/${projectId}/preview/status`),
    start: (projectId: string, command?: string) =>
      request<DevServerState>(`/api/projects/${projectId}/preview/start`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      }),
    stop: (projectId: string) =>
      request<DevServerState>(`/api/projects/${projectId}/preview/stop`, { method: 'POST' }),
  },

  changes: {
    list: (projectId: string) =>
      request<{ changes: FileChangeSnapshot[] }>(`/api/projects/${projectId}/changes`),
    approve: (projectId: string, snapshotId: string, force = false) =>
      request<{ snapshot: FileChangeSnapshot }>(
        `/api/projects/${projectId}/changes/${snapshotId}/approve`,
        { method: 'POST', body: JSON.stringify({ force }) }
      ),
    reject: (projectId: string, snapshotId: string) =>
      request<{ snapshot: FileChangeSnapshot }>(
        `/api/projects/${projectId}/changes/${snapshotId}/reject`,
        { method: 'POST' }
      ),
    rollback: (projectId: string, snapshotId: string) =>
      request<{ snapshot: FileChangeSnapshot }>(
        `/api/projects/${projectId}/changes/${snapshotId}/rollback`,
        { method: 'POST' }
      ),
    approveAll: (projectId: string) =>
      request<{ approved: FileChangeSnapshot[]; errors: Array<{ id: string; filePath: string; error: string }> }>(
        `/api/projects/${projectId}/changes/approve-all`,
        { method: 'POST' }
      ),
    rejectAll: (projectId: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/changes/reject-all`, { method: 'POST' }),
  },

  agent: {
    conversations: (projectId: string) =>
      request<{ conversations: ConversationRecord[] }>(`/api/projects/${projectId}/conversations`),
    createConversation: (projectId: string, title?: string) =>
      request<{ conversation: ConversationRecord }>(`/api/projects/${projectId}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
    messages: (conversationId: string) =>
      request<{ messages: ChatMessageRecord[] }>(`/api/conversations/${conversationId}/messages`),
    submitFeedback: (messageId: string, rating: 'good' | 'bad', note?: string) =>
      request<{ ok: boolean; messageId: string; rating: 'good' | 'bad' }>(
        `/api/messages/${messageId}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ rating, note }),
        }
      ),
    cancelRun: (runId: string) =>
      request<{ cancelled: boolean }>(`/api/agent/runs/${runId}/cancel`, { method: 'POST' }),
    streamRun: async (
      projectId: string,
      payload: {
        conversationId?: string;
        prompt: string;
        attachedFiles?: string[];
        applyMode: AgentApplyMode;
        maxIterations?: number;
      },
      onEvent: (ev: AgentSSEEvent) => void,
      signal?: AbortSignal
    ) => {
      const res = await fetch(`/api/projects/${projectId}/agent/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Agent request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const chunk of parts) {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (!raw || raw === '{}') continue;
              try {
                const parsed = JSON.parse(raw) as AgentSSEEvent;
                onEvent(parsed);
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      }
    },
  },
};
