import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentApplyMode,
  AgentSSEEvent,
  AgentStage,
  FileChangeSnapshot,
  PlanStep,
  ToolExecutionEvent,
} from '../shared/types.ts';
import {
  addMessage,
  createAgentRun,
  getResolvedActiveProvider,
  getResolvedProviderById,
  listMessages,
  listProjectMemory,
  newId,
  updateAgentRun,
  upsertProjectMemory,
} from './db.ts';
import { buildProjectIndex } from './indexer.ts';
import {
  createWorkspaceDirectory,
  inspectDependencies,
  listFlatFiles,
  readWorkspaceFile,
  renameWorkspacePath,
  resolveSafePath,
  searchCodeInWorkspace,
  searchFilenamesInWorkspace,
} from './workspace.ts';
import { executeWorkspaceCommand, getTerminalHistory } from './executor.ts';
import { getGitDiff, getGitStatus } from './git.ts';
import { stageOrApplyFileChange } from './changes.ts';
import {
  runProviderStep,
  searchDocumentationWithGemini,
  type UnifiedMessage,
  type UnifiedToolDefinition,
} from './providers.ts';

const activeRunControllers = new Map<string, AbortController>();

export function cancelAgentRun(runId: string): boolean {
  const controller = activeRunControllers.get(runId);
  if (!controller) return false;
  controller.abort();
  activeRunControllers.delete(runId);
  updateAgentRun(runId, {
    status: 'cancelled',
    currentStage: 'cancelled',
    endedAt: new Date().toISOString(),
  });
  return true;
}

const AGENT_TOOLS: UnifiedToolDefinition[] = [
  {
    name: 'update_plan',
    description: 'Create or update the step-by-step engineering execution plan shown to the user.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Ordered list of implementation steps.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'] },
              detail: { type: 'string' },
            },
            required: ['id', 'title', 'status'],
          },
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max file count to return (default 200).' },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the project workspace.' },
        start_line: { type: 'number', description: 'Optional 1-indexed start line.' },
        end_line: { type: 'number', description: 'Optional 1-indexed end line.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or replace an existing file with complete content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the project workspace.' },
        content: { type: 'string', description: 'Complete file contents.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Apply a targeted search-and-replace edit to an existing file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to existing file.' },
        old_text: { type: 'string', description: 'Exact text block to find and replace.' },
        new_text: { type: 'string', description: 'Replacement text block.' },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
  {
    name: 'delete_file',
    description: 'Propose deleting a file (always staged for user confirmation).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path to delete.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'rename_file',
    description: 'Rename or move a file within the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        old_path: { type: 'string' },
        new_path: { type: 'string' },
      },
      required: ['old_path', 'new_path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a directory inside the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search across workspace files for a text string or regex pattern.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        is_regex: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_filenames',
    description: 'Search workspace file paths matching a substring.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'inspect_dependencies',
    description: 'Inspect package.json scripts/dependencies or requirements.txt.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the isolated project workspace and return stdout, stderr, and exit code.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_tests',
    description: 'Run the project test suite (e.g., npm test or pytest or custom test command).',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Optional override test command.' },
      },
    },
  },
  {
    name: 'run_build',
    description: 'Run the project build / typecheck command.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Optional override build command.' },
      },
    },
  },
  {
    name: 'read_terminal_output',
    description: 'Read recent lines from the project terminal output buffer.',
    parameters: {
      type: 'object',
      properties: {
        tail: { type: 'number' },
      },
    },
  },
  {
    name: 'git_status',
    description: 'Read current git branch, changed files, and recent commits.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'git_diff',
    description: 'Inspect uncommitted git diffs for the repository or a specific file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
    },
  },
  {
    name: 'search_documentation',
    description: 'Search up-to-date technical documentation via web grounding when unfamiliar APIs or libraries are involved.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_project_memory',
    description: 'Persist an architectural decision, preference, or key fact in project memory.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
];

function stageForTool(toolName: string): AgentStage {
  switch (toolName) {
    case 'update_plan':
      return 'planning';
    case 'list_files':
    case 'search_code':
    case 'search_filenames':
    case 'inspect_dependencies':
    case 'git_status':
    case 'git_diff':
      return 'inspecting';
    case 'read_file':
    case 'read_terminal_output':
    case 'search_documentation':
      return 'reading';
    case 'write_file':
    case 'edit_file':
    case 'delete_file':
    case 'rename_file':
    case 'create_directory':
    case 'save_project_memory':
      return 'editing';
    case 'run_tests':
    case 'run_build':
    case 'run_command':
      return 'testing';
    default:
      return 'verifying';
  }
}

export async function runAutonomousAgent(params: {
  userId: string;
  projectId: string;
  projectName: string;
  workspaceRoot: string;
  conversationId: string;
  userPrompt: string;
  attachedFiles?: string[];
  applyMode: AgentApplyMode;
  maxIterations?: number;
  emit: (event: AgentSSEEvent) => void;
}) {
  const maxIterations = Math.min(Math.max(params.maxIterations ?? 15, 2), 30);
  const providerCfg = getResolvedActiveProvider(params.userId);
  const run = createAgentRun({
    projectId: params.projectId,
    conversationId: params.conversationId,
    maxIterations,
  });

  const controller = new AbortController();
  activeRunControllers.set(run.id, controller);

  const emitStage = (stage: AgentStage) => {
    updateAgentRun(run.id, { currentStage: stage });
    params.emit({ type: 'stage_changed', runId: run.id, stage });
  };

  // Persist user message immediately
  addMessage({
    conversationId: params.conversationId,
    role: 'user',
    content: params.userPrompt,
  });

  params.emit({ type: 'run_started', runId: run.id, stage: 'understanding' });
  emitStage('understanding');

  const toolEvents: ToolExecutionEvent[] = [];
  let currentPlan: PlanStep[] = [];
  const producedChanges: FileChangeSnapshot[] = [];

  try {
    emitStage('inspecting');
    const index = buildProjectIndex(
      params.workspaceRoot,
      params.userPrompt,
      providerCfg.maxContextFiles
    );
    const memories = listProjectMemory(params.projectId);

    // Build attached context snippets if user explicitly pinned files
    const attachedSnippets: string[] = [];
    for (const rel of params.attachedFiles ?? []) {
      try {
        const { content } = readWorkspaceFile(params.workspaceRoot, rel);
        attachedSnippets.push(`### Attached File: ${rel}\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``);
      } catch {
        // ignore missing attached file
      }
    }

    const systemInstruction = [
      `You are FORGE AI, a senior autonomous software engineer operating inside the "${params.projectName}" workspace.`,
      `Your goal is to fulfill the user's engineering request using real tools, not hypothetical instructions.`,
      ``,
      `Operating Rules:`,
      `1. Inspect relevant files first if needed, then call update_plan to establish a concise execution plan before making multi-file edits.`,
      `2. Use write_file or edit_file to implement real code changes. Write complete, production-quality, strictly typed code with no placeholder stubs.`,
      `3. After making edits (when applyMode is "auto"), run tests or builds via run_tests / run_build / run_command to verify your work. If a command fails, analyze the real error output, fix the bug, and re-verify.`,
      `4. When applyMode is "review", edits are staged for user diff approval before being written to disk; explain clearly which files are staged for approval.`,
      `5. Never fabricate command output or file contents. Only report what tools actually returned.`,
      `6. Current edit mode: ${params.applyMode === 'review' ? 'REVIEW_AND_APPROVE (edits staged as diffs for user confirmation)' : 'AUTO_APPLY (edits written directly with rollback snapshots)'}.`,
      ``,
      memories.length > 0
        ? `Project Memory:\n${memories.map((m) => `- ${m.key}: ${m.value}`).join('\n')}`
        : '',
      ``,
      `Workspace File Tree (${index.totalFiles} files total):\n${index.fileTreeList.join('\n') || '(empty workspace)'}`,
      ``,
      index.relevantFiles.length > 0
        ? `Indexed Relevant Files:\n${index.relevantFiles
            .map(
              (f) =>
                `--- ${f.path} (${f.lines} lines, symbols: ${f.symbols.join(', ') || 'none'}) ---\n${f.snippet}`
            )
            .join('\n\n')}`
        : '',
      attachedSnippets.join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n');

    // Include recent conversation turns
    const prior = listMessages(params.conversationId).slice(-10);
    const messages: UnifiedMessage[] = prior.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      text: m.content,
    }));

    let finalText = '';
    let latestExternalRequestId: string | undefined;
    const deadline = Date.now() + 180_000;

    for (let iter = 1; iter <= maxIterations; iter++) {
      if (controller.signal.aborted) {
        throw new Error('Agent execution cancelled by user.');
      }
      if (Date.now() > deadline) {
        finalText += '\n\n[Execution stopped: reached 180s time limit.]';
        break;
      }

      updateAgentRun(run.id, { iterations: iter });

      const stepResult = await runProviderStep({
        provider: providerCfg.provider,
        baseUrl: providerCfg.baseUrl,
        model: providerCfg.model,
        apiKey: providerCfg.apiKey,
        temperature: providerCfg.temperature,
        maxOutputTokens: providerCfg.maxOutputTokens,
        systemInstruction,
        messages,
        tools: AGENT_TOOLS,
        signal: controller.signal,
      });

      if (stepResult.externalRequestId) {
        latestExternalRequestId = stepResult.externalRequestId;
      }

      if (stepResult.text) {
        finalText = stepResult.text;
        params.emit({ type: 'text_delta', runId: run.id, delta: stepResult.text, iteration: iter });
      }

      messages.push({
        role: 'assistant',
        text: stepResult.text,
        toolCalls: stepResult.toolCalls,
        rawGeminiContent: stepResult.rawGeminiContent,
      });

      if (stepResult.toolCalls.length === 0) {
        break;
      }

      const toolResultsPayload: Array<{ id: string; name: string; response: unknown }> = [];

      for (const tc of stepResult.toolCalls) {
        if (controller.signal.aborted) {
          throw new Error('Agent execution cancelled by user.');
        }

        const stage = stageForTool(tc.name);
        emitStage(stage);

        const toolEvent: ToolExecutionEvent = {
          id: newId(),
          toolName: tc.name,
          args: tc.args,
          status: 'running',
          stage,
          timestamp: new Date().toISOString(),
        };
        toolEvents.push(toolEvent);
        params.emit({ type: 'tool_started', runId: run.id, toolEvent });

        const t0 = Date.now();
        let output: unknown;
        let failed = false;

        try {
          output = await executeTool({
            userId: params.userId,
            toolName: tc.name,
            args: tc.args,
            projectId: params.projectId,
            workspaceRoot: params.workspaceRoot,
            runId: run.id,
            applyMode: params.applyMode,
            onPlan: (steps) => {
              currentPlan = steps;
              params.emit({ type: 'plan_updated', runId: run.id, plan: steps });
            },
            onChange: (snap) => {
              producedChanges.push(snap);
            },
          });

          // If a command/test/build failed with non-zero exit code, surface debugging stage
          if (
            (tc.name === 'run_command' || tc.name === 'run_tests' || tc.name === 'run_build') &&
            typeof output === 'object' &&
            output !== null &&
            'exitCode' in output &&
            (output as { exitCode: number | null }).exitCode !== 0
          ) {
            emitStage('debugging');
          }
        } catch (err) {
          failed = true;
          output = { error: err instanceof Error ? err.message : String(err) };
          emitStage('debugging');
        }

        toolEvent.durationMs = Date.now() - t0;
        toolEvent.status = failed ? 'error' : 'completed';
        const previewStr = typeof output === 'string' ? output : JSON.stringify(output);
        toolEvent.outputPreview = previewStr.slice(0, 600);
        if (failed) {
          toolEvent.error = previewStr.slice(0, 300);
        }

        params.emit({ type: 'tool_completed', runId: run.id, toolEvent });
        toolResultsPayload.push({ id: tc.id, name: tc.name, response: output });
      }

      messages.push({ role: 'tool_results', results: toolResultsPayload });
    }

    emitStage('verifying');

    if (producedChanges.some((c) => c.status === 'pending')) {
      params.emit({
        type: 'changes_pending',
        runId: run.id,
        changes: producedChanges.filter((c) => c.status === 'pending'),
      });
    }

    // Mark remaining in-progress plan steps completed if run succeeded cleanly
    if (currentPlan.length > 0) {
      currentPlan = currentPlan.map((s) =>
        s.status === 'in_progress' ? { ...s, status: 'completed' } : s
      );
      params.emit({ type: 'plan_updated', runId: run.id, plan: currentPlan });
    }

    const finalMessage =
      finalText.trim() ||
      `Completed ${toolEvents.length} tool execution(s).${
        producedChanges.length > 0 ? ` ${producedChanges.length} file change(s) recorded.` : ''
      }`;

    addMessage({
      conversationId: params.conversationId,
      role: 'assistant',
      content: finalMessage,
      toolEvents,
      plan: currentPlan,
      model: providerCfg.model,
      provider: providerCfg.provider,
      externalRequestId: latestExternalRequestId,
    });

    const hasPending = producedChanges.some((c) => c.status === 'pending');
    updateAgentRun(run.id, {
      status: hasPending ? 'awaiting_approval' : 'completed',
      currentStage: 'completed',
      endedAt: new Date().toISOString(),
      summary: finalMessage.slice(0, 300),
    });

    params.emit({
      type: 'run_completed',
      runId: run.id,
      stage: 'completed',
      summary: finalMessage,
      changes: producedChanges,
      externalRequestId: latestExternalRequestId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isCancel = msg.toLowerCase().includes('cancelled');
    updateAgentRun(run.id, {
      status: isCancel ? 'cancelled' : 'failed',
      currentStage: isCancel ? 'cancelled' : 'failed',
      endedAt: new Date().toISOString(),
      error: msg,
    });

    addMessage({
      conversationId: params.conversationId,
      role: 'assistant',
      content: isCancel ? 'Agent run was cancelled.' : `Agent encountered an error: ${msg}`,
      toolEvents,
      plan: currentPlan,
      model: providerCfg.model,
      provider: providerCfg.provider,
    });

    params.emit({
      type: 'run_error',
      runId: run.id,
      stage: isCancel ? 'cancelled' : 'failed',
      error: msg,
    });
  } finally {
    activeRunControllers.delete(run.id);
  }
}

async function executeTool(ctx: {
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  projectId: string;
  workspaceRoot: string;
  runId: string;
  applyMode: AgentApplyMode;
  onPlan: (steps: PlanStep[]) => void;
  onChange: (snap: FileChangeSnapshot) => void;
}): Promise<unknown> {
  const autoApply = ctx.applyMode === 'auto';

  switch (ctx.toolName) {
    case 'update_plan': {
      const rawSteps = Array.isArray(ctx.args.steps) ? ctx.args.steps : [];
      const steps: PlanStep[] = rawSteps.map((s: Record<string, unknown>, idx) => ({
        id: String(s.id || idx + 1),
        title: String(s.title || `Step ${idx + 1}`),
        status: (['pending', 'in_progress', 'completed', 'failed'].includes(String(s.status))
          ? String(s.status)
          : 'pending') as PlanStep['status'],
        detail: s.detail ? String(s.detail) : undefined,
      }));
      ctx.onPlan(steps);
      return { ok: true, count: steps.length };
    }

    case 'list_files': {
      const limit = Number(ctx.args.limit || 200);
      return { files: listFlatFiles(ctx.workspaceRoot, Math.min(limit, 500)) };
    }

    case 'read_file': {
      const filePath = String(ctx.args.path || '');
      const { content, size } = readWorkspaceFile(ctx.workspaceRoot, filePath);
      const lines = content.split('\n');
      const start = ctx.args.start_line ? Math.max(1, Number(ctx.args.start_line)) : 1;
      const end = ctx.args.end_line ? Math.min(lines.length, Number(ctx.args.end_line)) : lines.length;
      const sliced = lines.slice(start - 1, end).join('\n');
      return {
        path: filePath,
        size,
        totalLines: lines.length,
        startLine: start,
        endLine: end,
        content: sliced.slice(0, 24_000),
      };
    }

    case 'write_file': {
      const filePath = String(ctx.args.path || '');
      const content = String(ctx.args.content ?? '');
      const full = resolveSafePath(ctx.workspaceRoot, filePath);
      const exists = fs.existsSync(full);
      const snap = stageOrApplyFileChange({
        projectId: ctx.projectId,
        workspaceRoot: ctx.workspaceRoot,
        runId: ctx.runId,
        filePath,
        operation: exists ? 'update' : 'create',
        newContent: content,
        autoApply,
      });
      ctx.onChange(snap);
      return {
        ok: true,
        path: filePath,
        status: snap.status,
        operation: snap.operation,
        snapshotId: snap.id,
      };
    }

    case 'edit_file': {
      const filePath = String(ctx.args.path || '');
      const oldText = String(ctx.args.old_text ?? '');
      const newText = String(ctx.args.new_text ?? '');
      const { content } = readWorkspaceFile(ctx.workspaceRoot, filePath);
      if (!content.includes(oldText)) {
        throw new Error(`old_text block not found in ${filePath}. Read the file first to match exact lines.`);
      }
      const updated = content.replace(oldText, newText);
      const snap = stageOrApplyFileChange({
        projectId: ctx.projectId,
        workspaceRoot: ctx.workspaceRoot,
        runId: ctx.runId,
        filePath,
        operation: 'update',
        newContent: updated,
        autoApply,
      });
      ctx.onChange(snap);
      return {
        ok: true,
        path: filePath,
        status: snap.status,
        snapshotId: snap.id,
      };
    }

    case 'delete_file': {
      const filePath = String(ctx.args.path || '');
      const snap = stageOrApplyFileChange({
        projectId: ctx.projectId,
        workspaceRoot: ctx.workspaceRoot,
        runId: ctx.runId,
        filePath,
        operation: 'delete',
        newContent: null,
        autoApply: false, // Deletions always require explicit confirmation
      });
      ctx.onChange(snap);
      return {
        ok: true,
        path: filePath,
        status: 'pending',
        message: 'Deletion staged for user confirmation.',
        snapshotId: snap.id,
      };
    }

    case 'rename_file': {
      const oldPath = String(ctx.args.old_path || '');
      const newPath = String(ctx.args.new_path || '');
      renameWorkspacePath(ctx.workspaceRoot, oldPath, newPath);
      return { ok: true, oldPath, newPath };
    }

    case 'create_directory': {
      const dirPath = String(ctx.args.path || '');
      createWorkspaceDirectory(ctx.workspaceRoot, dirPath);
      return { ok: true, path: dirPath };
    }

    case 'search_code': {
      const query = String(ctx.args.query || '');
      const isRegex = Boolean(ctx.args.is_regex);
      return { matches: searchCodeInWorkspace(ctx.workspaceRoot, query, { isRegex }) };
    }

    case 'search_filenames': {
      const pattern = String(ctx.args.pattern || '');
      return { files: searchFilenamesInWorkspace(ctx.workspaceRoot, pattern) };
    }

    case 'inspect_dependencies': {
      return inspectDependencies(ctx.workspaceRoot);
    }

    case 'run_command': {
      const command = String(ctx.args.command || '');
      return executeWorkspaceCommand(ctx.projectId, ctx.workspaceRoot, command);
    }

    case 'run_tests': {
      let command = ctx.args.command ? String(ctx.args.command) : '';
      if (!command) {
        const pkgPath = path.join(ctx.workspaceRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
          command = 'npm test';
        } else if (fs.existsSync(path.join(ctx.workspaceRoot, 'test_main.py'))) {
          command = 'python3 -m unittest';
        } else {
          return { error: 'No default test runner found. Pass an explicit command.' };
        }
      }
      return executeWorkspaceCommand(ctx.projectId, ctx.workspaceRoot, command);
    }

    case 'run_build': {
      let command = ctx.args.command ? String(ctx.args.command) : '';
      if (!command) {
        const pkgPath = path.join(ctx.workspaceRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
          command = 'npm run build';
        } else {
          return { error: 'No build script found in package.json.' };
        }
      }
      return executeWorkspaceCommand(ctx.projectId, ctx.workspaceRoot, command);
    }

    case 'read_terminal_output': {
      const tail = Number(ctx.args.tail || 60);
      const lines = getTerminalHistory(ctx.projectId);
      return { lines: lines.slice(-tail) };
    }

    case 'git_status': {
      return getGitStatus(ctx.workspaceRoot);
    }

    case 'git_diff': {
      const filePath = ctx.args.path ? String(ctx.args.path) : undefined;
      return { diff: await getGitDiff(ctx.workspaceRoot, filePath) };
    }

    case 'search_documentation': {
      const query = String(ctx.args.query || '');
      const geminiCfg = getResolvedProviderById(ctx.userId, 'gemini');
      return searchDocumentationWithGemini(query, geminiCfg.apiKey);
    }

    case 'save_project_memory': {
      const key = String(ctx.args.key || '');
      const value = String(ctx.args.value || '');
      return upsertProjectMemory(ctx.projectId, key, value);
    }

    default:
      throw new Error(`Unknown tool: ${ctx.toolName}`);
  }
}
