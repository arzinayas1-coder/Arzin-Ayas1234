import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GitStatusSummary } from '../shared/types.ts';

const execFileAsync = promisify(execFile);

async function runGit(workspaceRoot: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd: workspaceRoot,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: process.env.HOME || '/tmp',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
}

export async function ensureGitRepo(workspaceRoot: string): Promise<boolean> {
  if (fs.existsSync(path.join(workspaceRoot, '.git'))) return true;
  try {
    await runGit(workspaceRoot, ['init', '-b', 'main']);
    await runGit(workspaceRoot, ['config', 'user.name', 'FORGE Engineer']);
    await runGit(workspaceRoot, ['config', 'user.email', 'engineer@forge.local']);
    await runGit(workspaceRoot, ['add', '-A']);
    await runGit(workspaceRoot, ['commit', '-m', 'Initial workspace commit', '--allow-empty']);
    return true;
  } catch {
    return false;
  }
}

function decodeGitStatus(x: string, y: string): string {
  const code = `${x}${y}`.trim();
  if (code === '??') return 'Untracked';
  if (code.includes('A')) return 'Added';
  if (code.includes('D')) return 'Deleted';
  if (code.includes('R')) return 'Renamed';
  if (code.includes('M')) return 'Modified';
  return code || 'Changed';
}

export async function getGitStatus(workspaceRoot: string): Promise<GitStatusSummary> {
  const initialized = fs.existsSync(path.join(workspaceRoot, '.git'));
  if (!initialized) {
    return { initialized: false, branch: 'main', files: [], commits: [] };
  }

  let branch = 'main';
  try {
    const b = await runGit(workspaceRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    branch = b.stdout.trim() || 'main';
  } catch {
    branch = 'main';
  }

  const files: GitStatusSummary['files'] = [];
  try {
    const st = await runGit(workspaceRoot, ['status', '--porcelain']);
    for (const line of st.stdout.split('\n')) {
      if (!line.trim()) continue;
      const index = line[0] || ' ';
      const workingDir = line[1] || ' ';
      const filePath = line.slice(3).trim();
      files.push({
        path: filePath,
        index,
        workingDir,
        label: decodeGitStatus(index, workingDir),
      });
    }
  } catch {
    // ignore
  }

  const commits: GitStatusSummary['commits'] = [];
  try {
    const log = await runGit(workspaceRoot, [
      'log',
      '-n',
      '12',
      '--pretty=format:%h|%an|%aI|%s',
    ]);
    for (const line of log.stdout.split('\n')) {
      if (!line.trim()) continue;
      const [hash, author, date, ...rest] = line.split('|');
      commits.push({
        hash,
        author,
        date,
        message: rest.join('|'),
      });
    }
  } catch {
    // ignore empty history
  }

  return { initialized: true, branch, files, commits };
}

export async function getGitDiff(workspaceRoot: string, filePath?: string): Promise<string> {
  const initialized = fs.existsSync(path.join(workspaceRoot, '.git'));
  if (!initialized) return 'Git repository not initialized in this workspace.';
  try {
    const args = ['diff', 'HEAD'];
    if (filePath) args.push('--', filePath);
    const { stdout } = await runGit(workspaceRoot, args);
    if (stdout.trim()) return stdout;

    // Include untracked file preview if specific file requested
    if (filePath) {
      const full = path.resolve(workspaceRoot, filePath);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const content = fs.readFileSync(full, 'utf8');
        return `--- /dev/null\n+++ b/${filePath}\n${content
          .split('\n')
          .map((l) => `+${l}`)
          .join('\n')}`;
      }
    }
    return 'No uncommitted diff changes.';
  } catch (err) {
    return err instanceof Error ? err.message : 'Unable to compute git diff.';
  }
}

export async function commitGitChanges(
  workspaceRoot: string,
  message: string
): Promise<{ hash: string; message: string }> {
  const cleanMsg = message.trim();
  if (!cleanMsg) throw new Error('Commit message is required.');
  await ensureGitRepo(workspaceRoot);
  await runGit(workspaceRoot, ['config', 'user.name', 'FORGE Engineer']);
  await runGit(workspaceRoot, ['config', 'user.email', 'engineer@forge.local']);
  await runGit(workspaceRoot, ['add', '-A']);
  await runGit(workspaceRoot, ['commit', '-m', cleanMsg]);
  const { stdout } = await runGit(workspaceRoot, ['rev-parse', '--short', 'HEAD']);
  return { hash: stdout.trim(), message: cleanMsg };
}
