import React, { useMemo, useState } from 'react';
import {
  Blocks,
  Braces,
  Check,
  ChevronRight,
  ChevronsDownUp,
  Copy,
  FileCode2,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  History,
  Image as ImageIcon,
  MessageSquarePlus,
  Palette,
  Pencil,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { FileTreeNode } from '../shared/types.ts';
import type {
  DiffChangeItem,
  ExtensionItem,
  ShowcaseMessage,
} from '../data/mockWorkspace.ts';
import { ForgeTooltip } from './ui/ForgePrimitives.tsx';

export type SidebarTab = 'explorer' | 'search' | 'git' | 'extensions' | 'history';

export interface AgentSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  mode: string;
  messages: ShowcaseMessage[];
}

interface LeftSidebarProps {
  activeTab: SidebarTab;
  collapsed: boolean;
  width: number;
  compactDensity: boolean;
  onSelectTab: (tab: SidebarTab) => void;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  fileTree: FileTreeNode[];
  filesMap: Record<string, string>;
  activeFilePath: string | null;
  dirtyPaths: Set<string>;
  onOpenFile: (filePath: string, line?: number) => void;
  onCreateFile: (filePath: string) => void;
  onCreateFolder: (dirPath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDuplicateFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onMoveFile: (sourcePath: string, targetFolder: string) => void;
  currentBranch: string;
  diffChanges: DiffChangeItem[];
  onOpenDiffFile: (filePath: string) => void;
  onCommitChanges: (message: string) => void;
  extensions: ExtensionItem[];
  onToggleExtension: (id: string) => void;
  sessions: AgentSessionSummary[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

function renderFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'tsx' || ext === 'ts' || ext === 'jsx' || ext === 'js') {
    return <FileCode2 className="w-3.5 h-3.5 text-[#40D9FF] shrink-0" strokeWidth={1.75} />;
  }
  if (ext === 'json') {
    return <Braces className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" strokeWidth={1.75} />;
  }
  if (ext === 'css' || ext === 'scss') {
    return <Palette className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0" strokeWidth={1.75} />;
  }
  if (ext === 'svg' || ext === 'png' || ext === 'jpg') {
    return <ImageIcon className="w-3.5 h-3.5 text-[#36D399] shrink-0" strokeWidth={1.75} />;
  }
  return <FileText className="w-3.5 h-3.5 text-[#9999A5] shrink-0" strokeWidth={1.75} />;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  collapsed,
  width,
  compactDensity,
  onSelectTab,
  onToggleCollapse,
  onOpenSettings,
  fileTree,
  filesMap,
  activeFilePath,
  dirtyPaths,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onMoveFile,
  currentBranch,
  diffChanges,
  onOpenDiffFile,
  onCommitChanges,
  extensions,
  onToggleExtension,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () =>
      new Set([
        'src',
        'src/components',
        'src/pages',
        'src/hooks',
        'src/services',
        'src/utils',
        'src/styles',
        'public',
        'public/images',
        'public/icons',
      ])
  );
  const [fileFilter, setFileFilter] = useState('');
  const [creatingKind, setCreatingKind] = useState<'file' | 'folder' | null>(null);
  const [creatingParent, setCreatingParent] = useState('');
  const [creatingName, setCreatingName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileTreeNode;
  } | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTargetDir, setDropTargetDir] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const railItems: Array<{
    id: SidebarTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    { id: 'explorer', label: 'Explorer', icon: FolderOpen },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'git', label: 'Source Control', icon: GitBranch },
    { id: 'extensions', label: 'Extensions', icon: Blocks },
    { id: 'history', label: 'Agent History', icon: History },
  ];

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const handleStartCreate = (kind: 'file' | 'folder', parentDir = '') => {
    setCreatingKind(kind);
    setCreatingParent(parentDir);
    setCreatingName('');
    if (parentDir) {
      setExpandedDirs((prev) => new Set(prev).add(parentDir));
    }
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = creatingName.trim().replace(/^\/+/, '');
    if (!cleaned || !creatingKind) {
      setCreatingKind(null);
      return;
    }
    const fullPath = creatingParent ? `${creatingParent}/${cleaned}` : cleaned;
    if (creatingKind === 'file') {
      onCreateFile(fullPath);
    } else {
      onCreateFolder(fullPath);
      setExpandedDirs((prev) => new Set(prev).add(fullPath));
    }
    setCreatingKind(null);
    setCreatingName('');
  };

  const filteredTree = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    if (!q) return fileTree;
    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      const out: FileTreeNode[] = [];
      for (const n of nodes) {
        if (n.type === 'file') {
          if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) {
            out.push(n);
          }
        } else if (n.children) {
          const kids = filterNodes(n.children);
          if (kids.length > 0 || n.name.toLowerCase().includes(q)) {
            out.push({ ...n, children: kids });
          }
        }
      }
      return out;
    };
    return filterNodes(fileTree);
  }, [fileTree, fileFilter]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const hits: Array<{ path: string; line: number; preview: string }> = [];
    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(q, 'i');
      } catch {
        return [];
      }
    }

    for (const [filePath, content] of Object.entries(filesMap)) {
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        const matched = regex
          ? regex.test(lineText)
          : lineText.toLowerCase().includes(q.toLowerCase());
        if (matched && hits.length < 80) {
          hits.push({
            path: filePath,
            line: idx + 1,
            preview: lineText.trim(),
          });
        }
      });
    }
    return hits;
  }, [filesMap, searchQuery, useRegex]);

  const renderNodes = (nodes: FileTreeNode[], depth = 0) => {
    const rowPadding = compactDensity ? 'py-[3px]' : 'py-[5px]';
    return nodes.map((node) => {
      if (node.type === 'directory') {
        const isOpen = fileFilter.trim().length > 0 || expandedDirs.has(node.path);
        const isDropTarget = dropTargetDir === node.path;

        return (
          <div key={node.path}>
            <div
              onClick={() => toggleDir(node.path)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, node });
              }}
              onDragOver={(e) => {
                if (draggedPath && !draggedPath.startsWith(`${node.path}/`)) {
                  e.preventDefault();
                  setDropTargetDir(node.path);
                }
              }}
              onDragLeave={() => {
                if (dropTargetDir === node.path) setDropTargetDir(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedPath) {
                  onMoveFile(draggedPath, node.path);
                }
                setDraggedPath(null);
                setDropTargetDir(null);
              }}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              className={`flex items-center gap-1.5 pr-2 ${rowPadding} text-[12px] cursor-pointer select-none rounded-md mx-1.5 transition-colors ${
                isDropTarget
                  ? 'bg-[#8B7CFF]/18 ring-1 ring-[#8B7CFF] text-[#F4F4F7]'
                  : 'text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]/80'
              }`}
            >
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 text-[#666672] transition-transform duration-150 ${
                  isOpen ? 'rotate-90 text-[#9999A5]' : ''
                }`}
                strokeWidth={1.75}
              />
              {isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0" strokeWidth={1.75} />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#8B7CFF]/75 shrink-0" strokeWidth={1.75} />
              )}
              <span className="truncate font-medium">{node.name}</span>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && node.children && (
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.14 }}
                  className="relative"
                >
                  <div
                    style={{ left: `${15 + depth * 14}px` }}
                    className="absolute top-0 bottom-1 w-px bg-[#262630]/60 pointer-events-none"
                  />
                  {renderNodes(node.children, depth + 1)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }

      const isActive = activeFilePath === node.path;
      const isDirty = dirtyPaths.has(node.path);
      const isModified = node.gitStatus === 'Modified';
      const isRenaming = renamingPath === node.path;

      if (isRenaming) {
        return (
          <form
            key={node.path}
            style={{ paddingLeft: `${24 + depth * 14}px` }}
            className="pr-2 py-0.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (renameDraft.trim() && renameDraft.trim() !== node.path) {
                onRenameFile(node.path, renameDraft.trim());
              }
              setRenamingPath(null);
            }}
          >
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => setRenamingPath(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRenamingPath(null);
              }}
              className="w-full px-2 py-0.5 rounded bg-[#09090B] border border-[#40D9FF] text-xs font-mono text-[#F4F4F7] focus:outline-none"
            />
          </form>
        );
      }

      return (
        <div
          key={node.path}
          draggable
          onDragStart={() => setDraggedPath(node.path)}
          onDragEnd={() => {
            setDraggedPath(null);
            setDropTargetDir(null);
          }}
          onClick={() => onOpenFile(node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, node });
          }}
          style={{ paddingLeft: `${24 + depth * 14}px` }}
          className={`flex items-center justify-between gap-2 pr-2.5 ${rowPadding} mx-1.5 rounded-md text-[12px] cursor-pointer select-none transition-colors ${
            isActive
              ? 'bg-[#8B7CFF]/12 text-[#F4F4F7] border border-[#8B7CFF]/35'
              : 'text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]/80 border border-transparent'
          } ${draggedPath === node.path ? 'opacity-45' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {renderFileIcon(node.name)}
            <span className="truncate font-mono text-[11.5px]">{node.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#40D9FF]" title="Unsaved changes" />
            )}
            {isModified && (
              <span className="text-[10px] font-mono text-[#FBBF24]" title="Modified">
                M
              </span>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <aside className="flex h-full shrink-0 bg-[#0C0C0F] select-none relative">
      {/* Narrow Navigation Rail */}
      <div className="w-11 shrink-0 bg-[#0C0C0F] border-r border-[#262630] flex flex-col items-center justify-between py-2.5">
        <div className="flex flex-col items-center gap-1.5">
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = !collapsed && activeTab === item.id;
            return (
              <ForgeTooltip key={item.id} label={item.label} side="right">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === item.id) {
                      onToggleCollapse();
                    } else {
                      onSelectTab(item.id);
                    }
                  }}
                  className={`relative w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-[#18181F] text-[#F4F4F7]'
                      : 'text-[#666672] hover:text-[#F4F4F7] hover:bg-[#18181F]/60'
                  }`}
                >
                  {active && (
                    <span className="absolute -left-1.5 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[#8B7CFF]" />
                  )}
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </ForgeTooltip>
            );
          })}
        </div>

        <ForgeTooltip label="Project Settings" shortcut="⌘," side="right">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#666672] hover:text-[#F4F4F7] hover:bg-[#18181F]/60 transition-colors"
          >
            <Settings className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </ForgeTooltip>
      </div>

      {/* Expandable Sidebar Panel */}
      {!collapsed && (
        <div
          style={{ width }}
          className="flex flex-col h-full bg-[#0C0C0F] border-r border-[#262630] min-w-[215px] overflow-hidden"
        >
          {activeTab === 'explorer' && (
            <>
              <div className="h-9 px-3 border-b border-[#262630] flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold tracking-wide text-[#9999A5]">
                  Explorer
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleStartCreate('file', 'src')}
                    title="New File"
                    className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
                  >
                    <FilePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCreate('folder', 'src')}
                    title="New Folder"
                    className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
                  >
                    <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedDirs(new Set())}
                    title="Collapse Folders"
                    className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="p-2 border-b border-[#262630] shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#121217] border border-[#262630] focus-within:border-[#8B7CFF] transition-colors">
                  <Search className="w-3.5 h-3.5 text-[#666672] shrink-0" strokeWidth={1.75} />
                  <input
                    type="text"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    placeholder="Filter files…"
                    className="w-full bg-transparent text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
                  />
                </div>
              </div>

              {creatingKind && (
                <form
                  onSubmit={handleSubmitCreate}
                  className="p-2.5 border-b border-[#262630] bg-[#121217] space-y-1.5 shrink-0"
                >
                  <div className="text-[10.5px] font-mono text-[#9999A5]">
                    New {creatingKind} {creatingParent ? `in ${creatingParent}/` : 'at root'}
                  </div>
                  <input
                    autoFocus
                    type="text"
                    value={creatingName}
                    onChange={(e) => setCreatingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setCreatingKind(null);
                    }}
                    placeholder={creatingKind === 'file' ? 'MetricsCard.tsx' : 'adapters'}
                    className="w-full px-2 py-1 rounded bg-[#09090B] border border-[#40D9FF] text-xs font-mono text-[#F4F4F7] focus:outline-none"
                  />
                </form>
              )}

              <div
                className={`flex-1 overflow-y-auto py-2 ${
                  dropTargetDir === '' ? 'bg-[#8B7CFF]/10' : ''
                }`}
                onDragOver={(e) => {
                  if (draggedPath && draggedPath.includes('/')) {
                    e.preventDefault();
                    setDropTargetDir('');
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedPath) {
                    onMoveFile(draggedPath, '');
                  }
                  setDraggedPath(null);
                  setDropTargetDir(null);
                }}
              >
                {renderNodes(filteredTree)}
              </div>
            </>
          )}

          {activeTab === 'search' && (
            <>
              <div className="h-9 px-3 border-b border-[#262630] flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold tracking-wide text-[#9999A5]">
                  Search
                </span>
                <button
                  type="button"
                  onClick={() => setUseRegex((r) => !r)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                    useRegex
                      ? 'bg-[#8B7CFF]/20 border-[#8B7CFF] text-[#F4F4F7]'
                      : 'border-[#262630] text-[#9999A5]'
                  }`}
                  title="Toggle Regular Expression"
                >
                  .*
                </button>
              </div>
              <div className="p-2 border-b border-[#262630] shrink-0">
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across workspace…"
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#121217] border border-[#262630] focus:border-[#40D9FF] text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {!searchQuery.trim() ? (
                  <div className="text-xs text-[#666672] p-2">
                    Enter a symbol, component name, or regex pattern.
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-xs text-[#666672] p-2">No matches found.</div>
                ) : (
                  searchResults.map((hit, idx) => (
                    <button
                      key={`${hit.path}-${hit.line}-${idx}`}
                      type="button"
                      onClick={() => onOpenFile(hit.path, hit.line)}
                      className="w-full text-left p-2 rounded-md hover:bg-[#18181F] transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#40D9FF]">
                        <span className="truncate">{hit.path}</span>
                        <span className="text-[#666672] shrink-0 ml-2 tabular-nums">
                          :{hit.line}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#9999A5] truncate">
                        {hit.preview}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'git' && (
            <>
              <div className="h-9 px-3 border-b border-[#262630] flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold tracking-wide text-[#9999A5]">
                  Source Control
                </span>
                <span className="text-[10.5px] font-mono text-[#40D9FF] truncate max-w-[120px]">
                  {currentBranch}
                </span>
              </div>
              <div className="p-2.5 border-b border-[#262630] space-y-2 shrink-0">
                <textarea
                  rows={2}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message…"
                  className="w-full resize-none px-2.5 py-1.5 rounded-md bg-[#121217] border border-[#262630] focus:border-[#8B7CFF] text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!commitMessage.trim() || diffChanges.length === 0}
                  onClick={() => {
                    onCommitChanges(commitMessage.trim());
                    setCommitMessage('');
                  }}
                  className="w-full py-1.5 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.99]"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Commit Changes</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="px-1.5 py-1 text-[10.5px] font-medium text-[#666672]">
                  Changed Files ({diffChanges.length})
                </div>
                {diffChanges.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onOpenDiffFile(d.filePath)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-[#18181F] text-left text-xs transition-colors"
                  >
                    <span className="font-mono text-[11px] text-[#F4F4F7] truncate">
                      {d.filePath}
                    </span>
                    <span className="font-mono text-[10.5px] tabular-nums shrink-0">
                      <span className="text-[#36D399]">+{d.additions}</span>{' '}
                      <span className="text-[#FB7185]">-{d.deletions}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'extensions' && (
            <>
              <div className="h-9 px-3 border-b border-[#262630] flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold tracking-wide text-[#9999A5]">
                  Extensions
                </span>
                <span className="text-[10.5px] font-mono text-[#666672] tabular-nums">
                  {extensions.filter((e) => e.enabled).length}/{extensions.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#262630]/60">
                {extensions.map((ext) => (
                  <div key={ext.id} className="p-3 space-y-1.5 hover:bg-[#121217] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#F4F4F7] truncate">
                          {ext.name}
                        </div>
                        <div className="text-[10.5px] font-mono text-[#666672]">
                          {ext.publisher} · v{ext.version}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleExtension(ext.id)}
                        className={`px-2 py-0.5 rounded text-[10.5px] font-medium border shrink-0 transition-colors ${
                          ext.enabled
                            ? 'bg-[#36D399]/12 border-[#36D399]/35 text-[#36D399]'
                            : 'bg-[#121217] border-[#262630] text-[#9999A5]'
                        }`}
                      >
                        {ext.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#9999A5] leading-relaxed">{ext.description}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              <div className="h-9 px-3 border-b border-[#262630] flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold tracking-wide text-[#9999A5]">
                  Agent History
                </span>
                <button
                  type="button"
                  onClick={onNewSession}
                  title="New agent session"
                  className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {sessions.map((s) => {
                  const active = s.id === activeSessionId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSession(s.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors space-y-1 ${
                        active
                          ? 'bg-[#18181F] border-[#8B7CFF]/50 text-[#F4F4F7]'
                          : 'bg-[#121217]/50 border-[#262630] text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]'
                      }`}
                    >
                      <div className="text-xs font-medium text-[#F4F4F7] truncate">{s.title}</div>
                      <div className="flex items-center justify-between text-[10.5px] font-mono">
                        <span className="text-[#40D9FF]">{s.mode}</span>
                        <span className="text-[#666672]">{s.updatedAt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 w-44 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl py-1 text-xs"
          >
            {contextMenu.node.type === 'directory' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleStartCreate('file', contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <FilePlus className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />
                  <span>New File Here</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleStartCreate('folder', contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />
                  <span>New Subfolder</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onOpenFile(contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />
                  <span>Open in Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingPath(contextMenu.node.path);
                    setRenameDraft(contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDuplicateFile(contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <Copy className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                  <span>Duplicate</span>
                </button>
                <div className="my-1 border-t border-[#262630]" />
                <button
                  type="button"
                  onClick={() => {
                    onDeleteFile(contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#FB7185] hover:bg-[#FB7185]/10"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
