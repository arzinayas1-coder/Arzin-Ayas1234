import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  getOrCreateWorkspaceUser,
  requireAuth,
  type AuthenticatedRequest,
} from './src/server/auth.ts';
import {
  DEFAULT_PROVIDERS,
  createConversation,
  deleteProjectRecord,
  getConversationForUser,
  getMessageById,
  getProjectForUser,
  getResolvedProviderById,
  insertProject,
  listAgentRuns,
  listConversations,
  listMessages,
  listProjectMemory,
  listProjectsForUser,
  listProviderConfigsForUser,
  newId,
  saveProviderConfigForUser,
  touchProject,
  updateMessageFeedback,
  upsertProjectMemory,
} from './src/server/db.ts';
import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  getWorkspacePath,
  listFileTree,
  readWorkspaceFile,
  renameWorkspacePath,
  searchCodeInWorkspace,
  seedProjectTemplate,
  writeWorkspaceFile,
} from './src/server/workspace.ts';
import {
  clearTerminalHistory,
  executeWorkspaceCommand,
  getDevServerState,
  getProjectDevServerPort,
  getTerminalHistory,
  killActiveCommand,
  startProjectDevServer,
  stopProjectDevServer,
  subscribeTerminal,
  unsubscribeTerminal,
} from './src/server/executor.ts';
import { commitGitChanges, ensureGitRepo, getGitDiff, getGitStatus } from './src/server/git.ts';
import {
  approveFileSnapshot,
  getSnapshotsWithConflictCheck,
  rejectFileSnapshot,
  rollbackFileSnapshot,
} from './src/server/changes.ts';
import { cancelAgentRun, runAutonomousAgent } from './src/server/agent.ts';
import {
  fetchCoarenaModels,
  fetchProviderFreeModels,
  submitCoarenaFeedback,
} from './src/server/providers.ts';
import type { AgentApplyMode, ProviderId } from './src/shared/types.ts';

async function bootstrapDefaultProjectIfNeeded(userId: string) {
  const existing = listProjectsForUser(userId);
  if (existing.length > 0) return existing[0];

  const projectId = newId();
  const workspacePath = getWorkspacePath(projectId);
  seedProjectTemplate(workspacePath, 'web-app', 'TaskFlow Studio');
  await ensureGitRepo(workspacePath);
  const project = insertProject({
    id: projectId,
    userId,
    name: 'TaskFlow Studio',
    description: 'Interactive task management web app with unit tests and live dev server.',
    template: 'web-app',
    workspacePath,
  });
  createConversation(project.id, userId, 'Architecture & Implementation');
  return project;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '10mb' }));

  const defaultUser = getOrCreateWorkspaceUser();
  await bootstrapDefaultProjectIfNeeded(defaultUser.id);

  // WebSocket server for real-time terminal streaming
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws', 'http://localhost');
    const projectId = reqUrl.searchParams.get('projectId') || '';

    if (!projectId) {
      ws.close(1008, 'projectId required');
      return;
    }
    const user = getOrCreateWorkspaceUser();
    const project = getProjectForUser(projectId, user.id);
    if (!project) {
      ws.close(1008, 'Project not found');
      return;
    }

    subscribeTerminal(projectId, ws);
    ws.on('close', () => {
      unsubscribeTerminal(projectId, ws);
    });
  });

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'forge-ai' });
  });

  // --- Provider Settings Routes ---
  app.get('/api/providers', requireAuth, (req: AuthenticatedRequest, res) => {
    const configs = listProviderConfigsForUser(req.user!.id);
    res.json({ providers: configs });
  });

  app.put('/api/providers', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as {
        provider: ProviderId;
        baseUrl?: string;
        model?: string;
        apiKey?: string;
        clearApiKey?: boolean;
        temperature?: number;
        maxOutputTokens?: number;
        maxContextFiles?: number;
        setActive?: boolean;
      };
      saveProviderConfigForUser(req.user!.id, body);
      res.json({ providers: listProviderConfigsForUser(req.user!.id) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update provider' });
    }
  });

  app.get('/api/providers/coarena/models', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const cfg = getResolvedProviderById(req.user!.id, 'coarena');
      const models = await fetchCoarenaModels(cfg.apiKey);
      res.json({ models });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch Coarena models',
      });
    }
  });

  app.get('/api/providers/:providerId/models', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const providerId = String(req.params.providerId) as ProviderId;
      const def = DEFAULT_PROVIDERS.find((p) => p.provider === providerId);
      if (!def) {
        return res.status(404).json({ error: `Unsupported provider: ${providerId}` });
      }
      const cfg = getResolvedProviderById(req.user!.id, providerId);
      const models = await fetchProviderFreeModels(providerId, cfg.apiKey, def.availableModels);
      res.json({ provider: providerId, models });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch provider free models',
      });
    }
  });

  // --- Project Routes ---
  app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const projects = listProjectsForUser(req.user!.id);
    res.json({ projects });
  });

  app.post('/api/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, description, template } = req.body as {
        name?: string;
        description?: string;
        template?: string;
      };
      const cleanName = (name || '').trim();
      if (!cleanName) {
        return res.status(400).json({ error: 'Project name is required.' });
      }
      const projectId = newId();
      const workspacePath = getWorkspacePath(projectId);
      seedProjectTemplate(workspacePath, template || 'web-app', cleanName);
      await ensureGitRepo(workspacePath);
      const project = insertProject({
        id: projectId,
        userId: req.user!.id,
        name: cleanName,
        description: (description || '').trim(),
        template: template || 'web-app',
        workspacePath,
      });
      createConversation(project.id, req.user!.id, 'Initial Session');
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create project' });
    }
  });

  app.delete('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const projectId = String(req.params.id);
    const project = getProjectForUser(projectId, req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    stopProjectDevServer(project.id);
    if (fs.existsSync(project.workspacePath)) {
      fs.rmSync(project.workspacePath, { recursive: true, force: true });
    }
    deleteProjectRecord(project.id, req.user!.id);
    res.json({ ok: true });
  });

  // --- Project Memory & Runs ---
  app.get('/api/projects/:id/memory', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ memory: listProjectMemory(project.id) });
  });

  app.post('/api/projects/:id/memory', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { key, value } = req.body as { key?: string; value?: string };
    if (!key?.trim() || !value?.trim()) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    const item = upsertProjectMemory(project.id, key.trim(), value.trim());
    res.json({ item });
  });

  app.get('/api/projects/:id/runs', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ runs: listAgentRuns(project.id) });
  });

  // --- Workspace Files Routes ---
  app.get('/api/projects/:id/files', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const git = await getGitStatus(project.workspacePath);
    const statusMap = new Map(git.files.map((f) => [f.path, f.label]));
    const tree = listFileTree(project.workspacePath, statusMap);
    res.json({ tree });
  });

  app.get('/api/projects/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const relPath = String(req.query.path || '');
    if (!relPath) return res.status(400).json({ error: 'path query parameter required' });
    try {
      const data = readWorkspaceFile(project.workspacePath, relPath);
      res.json({ path: relPath, ...data });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'File not found' });
    }
  });

  app.put('/api/projects/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { path: relPath, content } = req.body as { path?: string; content?: string };
    if (!relPath || content === undefined) {
      return res.status(400).json({ error: 'path and content are required' });
    }
    try {
      writeWorkspaceFile(project.workspacePath, relPath, content);
      touchProject(project.id);
      res.json({ ok: true, path: relPath });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save file' });
    }
  });

  app.post('/api/projects/:id/mkdir', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { path: relPath } = req.body as { path?: string };
    if (!relPath) return res.status(400).json({ error: 'path is required' });
    try {
      createWorkspaceDirectory(project.workspacePath, relPath);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create directory' });
    }
  });

  app.post('/api/projects/:id/rename', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { oldPath, newPath } = req.body as { oldPath?: string; newPath?: string };
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });
    try {
      renameWorkspacePath(project.workspacePath, oldPath, newPath);
      touchProject(project.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to rename' });
    }
  });

  app.delete('/api/projects/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const relPath = String(req.query.path || '');
    if (!relPath) return res.status(400).json({ error: 'path required' });
    try {
      deleteWorkspacePath(project.workspacePath, relPath);
      touchProject(project.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete' });
    }
  });

  app.post('/api/projects/:id/upload', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { files } = req.body as { files?: Array<{ path: string; content: string }> };
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }
    try {
      for (const f of files) {
        writeWorkspaceFile(project.workspacePath, f.path, f.content);
      }
      touchProject(project.id);
      res.json({ ok: true, count: files.length });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    }
  });

  app.get('/api/projects/:id/search', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const q = String(req.query.q || '');
    const isRegex = req.query.regex === 'true';
    const matches = searchCodeInWorkspace(project.workspacePath, q, { isRegex });
    res.json({ matches });
  });

  // --- Git Routes ---
  app.get('/api/projects/:id/git/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const status = await getGitStatus(project.workspacePath);
    res.json(status);
  });

  app.get('/api/projects/:id/git/diff', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const filePath = req.query.path ? String(req.query.path) : undefined;
    const diff = await getGitDiff(project.workspacePath, filePath);
    res.json({ diff });
  });

  app.post('/api/projects/:id/git/commit', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const { message } = req.body as { message?: string };
      const result = await commitGitChanges(project.workspacePath, message || '');
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Git commit failed' });
    }
  });

  // --- Execution & Terminal Routes ---
  app.post('/api/projects/:id/exec', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { command } = req.body as { command?: string };
    if (!command?.trim()) return res.status(400).json({ error: 'command is required' });
    try {
      const result = await executeWorkspaceCommand(project.id, project.workspacePath, command);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Execution rejected' });
    }
  });

  app.post('/api/projects/:id/exec/kill', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const killed = killActiveCommand(project.id);
    res.json({ killed });
  });

  app.get('/api/projects/:id/terminal/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ lines: getTerminalHistory(project.id) });
  });

  app.post('/api/projects/:id/terminal/clear', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    clearTerminalHistory(project.id);
    res.json({ ok: true });
  });

  // --- Live Dev Server & Reverse Proxy Routes ---
  app.get('/api/projects/:id/preview/status', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(getDevServerState(project.id));
  });

  app.post('/api/projects/:id/preview/start', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const { command } = (req.body || {}) as { command?: string };
      const state = await startProjectDevServer(project.id, project.workspacePath, command);
      res.json(state);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start dev server' });
    }
  });

  app.post('/api/projects/:id/preview/stop', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(stopProjectDevServer(project.id));
  });

  // Reverse proxy connecting the Preview iframe directly to the running project dev server
  app.use('/api/preview/:projectId', (req: Request, res: Response) => {
    const projectId = String(req.params.projectId);
    const port = getProjectDevServerPort(projectId);
    if (!port) {
      res.status(503).send(
        `<!doctype html><html><body style="background:#090b10;color:#94a3b8;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><p style="color:#e2e8f0;font-weight:600;margin-bottom:6px">Preview Server Offline</p><p style="font-size:13px">Click Start Server in the Preview toolbar to launch this workspace.</p></div></body></html>`
      );
      return;
    }

    const forwardPath = req.url || '/';
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: forwardPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${port}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).send(`Preview server unreachable: ${err.message}`);
      }
    });

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
      proxyReq.end();
    } else {
      req.pipe(proxyReq, { end: true });
    }
  });

  // --- Multi-File Changes, Diff Approval & Rollback ---
  app.get('/api/projects/:id/changes', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const changes = getSnapshotsWithConflictCheck(project.id, project.workspacePath);
    res.json({ changes });
  });

  app.post('/api/projects/:id/changes/:snapshotId/approve', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const force = Boolean(req.body?.force);
      const snapshot = approveFileSnapshot(project.id, project.workspacePath, String(req.params.snapshotId), force);
      res.json({ snapshot });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Approval failed' });
    }
  });

  app.post('/api/projects/:id/changes/:snapshotId/reject', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const snapshot = rejectFileSnapshot(project.id, String(req.params.snapshotId));
      res.json({ snapshot });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reject failed' });
    }
  });

  app.post('/api/projects/:id/changes/:snapshotId/rollback', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const snapshot = rollbackFileSnapshot(project.id, project.workspacePath, String(req.params.snapshotId));
      res.json({ snapshot });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Rollback failed' });
    }
  });

  app.post('/api/projects/:id/changes/approve-all', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const changes = getSnapshotsWithConflictCheck(project.id, project.workspacePath).filter(
      (c) => c.status === 'pending'
    );
    const approved = [];
    const errors = [];
    for (const ch of changes) {
      try {
        approved.push(approveFileSnapshot(project.id, project.workspacePath, ch.id, false));
      } catch (err) {
        errors.push({ id: ch.id, filePath: ch.filePath, error: err instanceof Error ? err.message : 'Conflict' });
      }
    }
    res.json({ approved, errors });
  });

  app.post('/api/projects/:id/changes/reject-all', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const changes = getSnapshotsWithConflictCheck(project.id, project.workspacePath).filter(
      (c) => c.status === 'pending'
    );
    for (const ch of changes) {
      rejectFileSnapshot(project.id, ch.id);
    }
    res.json({ ok: true });
  });

  // --- Conversations & Autonomous Agent SSE Routes ---
  app.get('/api/projects/:id/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ conversations: listConversations(project.id, req.user!.id) });
  });

  app.post('/api/projects/:id/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const title = String(req.body?.title || 'New Engineering Session').slice(0, 80);
    const conversation = createConversation(project.id, req.user!.id, title);
    res.json({ conversation });
  });

  app.get('/api/conversations/:id/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const conv = getConversationForUser(String(req.params.id), req.user!.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ messages: listMessages(conv.id) });
  });

  app.post('/api/messages/:messageId/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const messageId = String(req.params.messageId);
      const { rating, note } = req.body as { rating?: 'good' | 'bad'; note?: string };
      if (rating !== 'good' && rating !== 'bad') {
        return res.status(400).json({ error: 'rating must be "good" or "bad"' });
      }
      const msg = getMessageById(messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      const conv = getConversationForUser(msg.conversationId, req.user!.id);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });

      if (msg.externalRequestId) {
        const coarenaCfg = getResolvedProviderById(req.user!.id, 'coarena');
        await submitCoarenaFeedback({
          apiKey: coarenaCfg.apiKey,
          requestId: msg.externalRequestId,
          rating,
          note,
        });
      }

      updateMessageFeedback(messageId, rating);
      res.json({ ok: true, messageId, rating });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to submit feedback',
      });
    }
  });

  app.post('/api/agent/runs/:runId/cancel', requireAuth, (req, res) => {
    const cancelled = cancelAgentRun(String(req.params.runId));
    res.json({ cancelled });
  });

  app.post('/api/projects/:id/agent/run', requireAuth, async (req: AuthenticatedRequest, res) => {
    const project = getProjectForUser(String(req.params.id), req.user!.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { conversationId, prompt, attachedFiles, applyMode, maxIterations } = req.body as {
      conversationId?: string;
      prompt?: string;
      attachedFiles?: string[];
      applyMode?: AgentApplyMode;
      maxIterations?: number;
    };

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    let conv = conversationId ? getConversationForUser(conversationId, req.user!.id) : null;
    if (!conv) {
      conv = createConversation(project.id, req.user!.id, prompt.trim().slice(0, 56));
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: unknown) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    await runAutonomousAgent({
      userId: req.user!.id,
      projectId: project.id,
      projectName: project.name,
      workspaceRoot: project.workspacePath,
      conversationId: conv.id,
      userPrompt: prompt.trim(),
      attachedFiles: Array.isArray(attachedFiles) ? attachedFiles : [],
      applyMode: applyMode === 'auto' ? 'auto' : 'review',
      maxIterations: typeof maxIterations === 'number' ? maxIterations : 15,
      emit: sendEvent,
    });

    if (!res.writableEnded) {
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  });

  // --- Vite / Static Frontend Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`FORGE AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FORGE AI server:', err);
  process.exit(1);
});
