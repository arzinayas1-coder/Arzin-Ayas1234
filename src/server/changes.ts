import fs from 'node:fs';
import { createTwoFilesPatch } from 'diff';
import type { FileChangeSnapshot } from '../shared/types.ts';
import {
  getFileSnapshot,
  insertFileSnapshot,
  listFileSnapshots,
  touchProject,
  updateSnapshotStatus,
} from './db.ts';
import {
  deleteWorkspacePath,
  readWorkspaceFile,
  resolveSafePath,
  writeWorkspaceFile,
} from './workspace.ts';

export function computeUnifiedDiff(
  filePath: string,
  oldText: string | null,
  newText: string | null
): string {
  return createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    oldText ?? '',
    newText ?? '',
    'before',
    'after',
    { context: 3 }
  );
}

export function stageOrApplyFileChange(params: {
  projectId: string;
  workspaceRoot: string;
  runId: string;
  filePath: string;
  operation: FileChangeSnapshot['operation'];
  newContent: string | null;
  autoApply: boolean;
}): FileChangeSnapshot {
  const full = resolveSafePath(params.workspaceRoot, params.filePath);
  const exists = fs.existsSync(full) && fs.statSync(full).isFile();
  const previousContent = exists ? fs.readFileSync(full, 'utf8') : null;

  const diffText = computeUnifiedDiff(params.filePath, previousContent, params.newContent);

  // Deletions always require explicit user confirmation
  const shouldApplyImmediately = params.autoApply && params.operation !== 'delete';

  if (shouldApplyImmediately) {
    if (params.newContent !== null) {
      writeWorkspaceFile(params.workspaceRoot, params.filePath, params.newContent);
      touchProject(params.projectId);
    }
  }

  return insertFileSnapshot({
    projectId: params.projectId,
    runId: params.runId,
    filePath: params.filePath,
    operation: params.operation,
    previousContent,
    newContent: params.newContent,
    diffText,
    status: shouldApplyImmediately ? 'approved' : 'pending',
  });
}

export function getSnapshotsWithConflictCheck(
  projectId: string,
  workspaceRoot: string
): FileChangeSnapshot[] {
  const snapshots = listFileSnapshots(projectId);
  return snapshots.map((snap) => {
    if (snap.status !== 'pending') return snap;
    const full = resolveSafePath(workspaceRoot, snap.filePath);
    const currentOnDisk = fs.existsSync(full) && fs.statSync(full).isFile()
      ? fs.readFileSync(full, 'utf8')
      : null;
    const conflict = currentOnDisk !== snap.previousContent;
    return { ...snap, conflict };
  });
}

export function approveFileSnapshot(
  projectId: string,
  workspaceRoot: string,
  snapshotId: string,
  forceOverwrite = false
): FileChangeSnapshot {
  const snap = getFileSnapshot(snapshotId, projectId);
  if (!snap) throw new Error('Change snapshot not found.');
  if (snap.status !== 'pending') return snap;

  const full = resolveSafePath(workspaceRoot, snap.filePath);
  const currentOnDisk = fs.existsSync(full) && fs.statSync(full).isFile()
    ? fs.readFileSync(full, 'utf8')
    : null;

  if (!forceOverwrite && currentOnDisk !== snap.previousContent) {
    throw new Error(
      `Conflict detected on ${snap.filePath}: the file was modified externally since this proposal was generated.`
    );
  }

  if (snap.operation === 'delete') {
    if (fs.existsSync(full)) {
      deleteWorkspacePath(workspaceRoot, snap.filePath);
    }
  } else if (snap.newContent !== null) {
    writeWorkspaceFile(workspaceRoot, snap.filePath, snap.newContent);
  }

  updateSnapshotStatus(snapshotId, 'approved');
  touchProject(projectId);
  return { ...snap, status: 'approved' };
}

export function rejectFileSnapshot(
  projectId: string,
  snapshotId: string
): FileChangeSnapshot {
  const snap = getFileSnapshot(snapshotId, projectId);
  if (!snap) throw new Error('Change snapshot not found.');
  updateSnapshotStatus(snapshotId, 'rejected');
  return { ...snap, status: 'rejected' };
}

export function rollbackFileSnapshot(
  projectId: string,
  workspaceRoot: string,
  snapshotId: string
): FileChangeSnapshot {
  const snap = getFileSnapshot(snapshotId, projectId);
  if (!snap) throw new Error('Snapshot not found.');
  if (snap.status !== 'approved') {
    throw new Error('Only applied changes can be rolled back.');
  }

  if (snap.previousContent === null) {
    // File was created by this snapshot -> remove it
    try {
      readWorkspaceFile(workspaceRoot, snap.filePath);
      deleteWorkspacePath(workspaceRoot, snap.filePath);
    } catch {
      // already absent
    }
  } else {
    writeWorkspaceFile(workspaceRoot, snap.filePath, snap.previousContent);
  }

  updateSnapshotStatus(snapshotId, 'rolled_back');
  touchProject(projectId);
  return { ...snap, status: 'rolled_back' };
}
