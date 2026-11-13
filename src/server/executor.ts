import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import type { WebSocket } from 'ws';
import type { DevServerState } from '../shared/types.ts';

interface RunningCommand {
  id: string;
  process: ChildProcess;
  command: string;
  startedAt: number;
}

const terminalSubscribers = new Map<string, Set<WebSocket>>();
const terminalBuffers = new Map<string, string[]>();
const activeCommands = new Map<string, RunningCommand>();
const devServers = new Map<string, { state: DevServerState; process: ChildProcess | null }>();

const MAX_BUFFER_LINES = 400;
const DEFAULT_CMD_TIMEOUT_MS = 120_000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(^|\s)sudo(\s|$)/i, reason: 'Privilege escalation commands (sudo) are prohibited.' },
  { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+\/($|\s)/i, reason: 'Destructive root filesystem deletion is prohibited.' },
  { pattern: /(^|\s)(mkfs|dd|fdisk|shutdown|reboot|halt|poweroff)(\s|$)/i, reason: 'System administration commands are prohibited.' },
  { pattern: /\.\.\/\.\.\//, reason: 'Directory traversal outside project workspace is prohibited.' },
  { pattern: /(curl|wget)[^|]*\|\s*(sh|bash|zsh)/i, reason: 'Piped remote shell execution is prohibited.' },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/, reason: 'Fork bombs are prohibited.' },
];

export function sanitizeChildEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME || '/tmp',
    LANG: 'en_US.UTF-8',
    TERM: 'xterm-256color',
    NODE_ENV: 'development',
    FORCE_COLOR: '0',
    ...extra,
  };
  // Explicitly ensure no host AI or DB secrets ever enter project workspace shells
  delete safeEnv.GEMINI_API_KEY;
  delete safeEnv.SESSION_SECRET;
  delete safeEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete safeEnv.OPENAI_API_KEY;
  delete safeEnv.ANTHROPIC_API_KEY;
  return safeEnv;
}

export function validateCommand(command: string): void {
  const trimmed = command.trim();
  if (!trimmed) throw new Error('Command cannot be empty.');
  if (trimmed.length > 1000) throw new Error('Command exceeds maximum length.');
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      throw new Error(`Security restriction: ${rule.reason}`);
    }
  }
}

export function subscribeTerminal(projectId: string, ws: WebSocket) {
  if (!terminalSubscribers.has(projectId)) {
    terminalSubscribers.set(projectId, new Set());
  }
  terminalSubscribers.get(projectId)!.add(ws);

  const existing = terminalBuffers.get(projectId) || [];
  if (existing.length > 0 && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'history', lines: existing }));
  }
}

export function unsubscribeTerminal(projectId: string, ws: WebSocket) {
  terminalSubscribers.get(projectId)?.delete(ws);
}

export function appendTerminalOutput(projectId: string, chunk: string, stream: 'stdout' | 'stderr' | 'system' = 'stdout') {
  if (!terminalBuffers.has(projectId)) {
    terminalBuffers.set(projectId, []);
  }
  const buf = terminalBuffers.get(projectId)!;
  const lines = chunk.split(/\r?\n/);
  for (const line of lines) {
    if (line === '' && lines.length > 1) continue;
    buf.push(line);
    if (buf.length > MAX_BUFFER_LINES) {
      buf.shift();
    }
  }

  const payload = JSON.stringify({ type: 'output', stream, data: chunk, timestamp: new Date().toISOString() });
  const subs = terminalSubscribers.get(projectId);
  if (subs) {
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
}

export function getTerminalHistory(projectId: string): string[] {
  return [...(terminalBuffers.get(projectId) || [])];
}

export function clearTerminalHistory(projectId: string) {
  terminalBuffers.set(projectId, []);
  const subs = terminalSubscribers.get(projectId);
  if (subs) {
    const payload = JSON.stringify({ type: 'cleared' });
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}

export function killActiveCommand(projectId: string): boolean {
  const active = activeCommands.get(projectId);
  if (!active) return false;
  try {
    active.process.kill('SIGTERM');
    setTimeout(() => {
      try {
        active.process.kill('SIGKILL');
      } catch {
        // already dead
      }
    }, 1500);
    appendTerminalOutput(projectId, `\n[Process terminated by user]\n`, 'system');
    activeCommands.delete(projectId);
    return true;
  } catch {
    return false;
  }
}

export async function executeWorkspaceCommand(
  projectId: string,
  workspaceRoot: string,
  command: string,
  options?: { timeoutMs?: number }
): Promise<{
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}> {
  validateCommand(command);
  if (!fs.existsSync(workspaceRoot)) {
    throw new Error('Project workspace directory does not exist.');
  }

  const startedAt = Date.now();
  const timeoutMs = Math.min(options?.timeoutMs ?? DEFAULT_CMD_TIMEOUT_MS, 180_000);
  appendTerminalOutput(projectId, `$ ${command}\n`, 'system');

  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c', command], {
      cwd: workspaceRoot,
      env: sanitizeChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const cmdId = `${projectId}-${Date.now()}`;
    activeCommands.set(projectId, { id: cmdId, process: child, command, startedAt });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const MAX_CAP = 64_000;

    const timer = setTimeout(() => {
      timedOut = true;
      appendTerminalOutput(projectId, `\n[Execution timed out after ${timeoutMs / 1000}s]\n`, 'stderr');
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      if (stdout.length < MAX_CAP) stdout += text.slice(0, MAX_CAP - stdout.length);
      appendTerminalOutput(projectId, text, 'stdout');
    });

    child.stderr?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      if (stderr.length < MAX_CAP) stderr += text.slice(0, MAX_CAP - stderr.length);
      appendTerminalOutput(projectId, text, 'stderr');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (activeCommands.get(projectId)?.id === cmdId) {
        activeCommands.delete(projectId);
      }
      appendTerminalOutput(projectId, `Execution error: ${err.message}\n`, 'stderr');
      resolve({
        command,
        stdout,
        stderr: stderr + '\n' + err.message,
        exitCode: 1,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (activeCommands.get(projectId)?.id === cmdId) {
        activeCommands.delete(projectId);
      }
      const durationMs = Date.now() - startedAt;
      appendTerminalOutput(projectId, `[exit ${code ?? 0} in ${durationMs}ms]\n`, 'system');
      const subs = terminalSubscribers.get(projectId);
      if (subs) {
        const donePayload = JSON.stringify({ type: 'exit', exitCode: code ?? 0, durationMs });
        for (const ws of subs) {
          if (ws.readyState === ws.OPEN) ws.send(donePayload);
        }
      }
      resolve({
        command,
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        durationMs,
      });
    });
  });
}

async function findAvailablePort(startPort = 4100): Promise<number> {
  for (let port = startPort; port < startPort + 80; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => {
        srv.close(() => resolve(true));
      });
      srv.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error('No available preview port in range 4100-4179');
}

function detectDevCommand(workspaceRoot: string): string | null {
  const pkgPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts?.dev) return 'npm run dev';
      if (pkg.scripts?.start) return 'npm start';
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(path.join(workspaceRoot, 'server.mjs'))) return 'node server.mjs';
  if (fs.existsSync(path.join(workspaceRoot, 'server.js'))) return 'node server.js';
  if (fs.existsSync(path.join(workspaceRoot, 'main.py'))) return 'python3 main.py';
  if (fs.existsSync(path.join(workspaceRoot, 'index.html'))) {
    return 'python3 -m http.server $PORT';
  }
  return null;
}

export function getDevServerState(projectId: string): DevServerState {
  const entry = devServers.get(projectId);
  if (!entry) {
    return { projectId, status: 'stopped', logs: [] };
  }
  return entry.state;
}

export function stopProjectDevServer(projectId: string): DevServerState {
  const entry = devServers.get(projectId);
  if (entry?.process) {
    try {
      entry.process.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  const stopped: DevServerState = {
    projectId,
    status: 'stopped',
    logs: entry?.state.logs || [],
  };
  devServers.set(projectId, { state: stopped, process: null });
  return stopped;
}

export async function startProjectDevServer(
  projectId: string,
  workspaceRoot: string,
  customCommand?: string
): Promise<DevServerState> {
  stopProjectDevServer(projectId);

  const command = customCommand?.trim() || detectDevCommand(workspaceRoot);
  if (!command) {
    const errState: DevServerState = {
      projectId,
      status: 'error',
      error: 'No runnable server script detected (add package.json scripts.dev, server.mjs, main.py, or index.html).',
      logs: [],
    };
    devServers.set(projectId, { state: errState, process: null });
    return errState;
  }

  validateCommand(command);
  const port = await findAvailablePort();
  const state: DevServerState = {
    projectId,
    status: 'starting',
    port,
    command,
    previewUrl: `/api/preview/${projectId}/`,
    logs: [`Starting dev server on port ${port}: ${command}`],
  };

  const child = spawn('/bin/sh', ['-c', command], {
    cwd: workspaceRoot,
    env: sanitizeChildEnv({ PORT: String(port) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  state.pid = child.pid;
  devServers.set(projectId, { state, process: child });

  const pushLog = (text: string) => {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      state.logs.push(line);
      if (state.logs.length > 100) state.logs.shift();
    }
    appendTerminalOutput(projectId, `[preview-server] ${text}`, 'stdout');
  };

  child.stdout?.on('data', (d: Buffer) => pushLog(d.toString('utf8')));
  child.stderr?.on('data', (d: Buffer) => pushLog(d.toString('utf8')));

  child.on('exit', (code) => {
    const current = devServers.get(projectId);
    if (current && current.process === child) {
      current.state.status = code === 0 || code === null ? 'stopped' : 'error';
      if (code && code !== 0) {
        current.state.error = `Dev server exited with code ${code}`;
      }
      current.process = null;
    }
  });

  // Poll TCP port readiness up to 5 seconds so preview iframe opens immediately on a live socket
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (state.status === 'error' || state.status === 'stopped') break;
    const open = await new Promise<boolean>((resolve) => {
      const sock = net.connect({ port, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (open) {
      state.status = 'running';
      return state;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (state.status === 'starting') {
    state.status = 'running';
  }
  return state;
}

export function getProjectDevServerPort(projectId: string): number | null {
  const entry = devServers.get(projectId);
  if (!entry || entry.state.status === 'stopped' || !entry.state.port) return null;
  return entry.state.port;
}
