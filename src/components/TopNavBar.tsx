import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FolderGit2,
  GitBranch,
  Home,
  LayoutGrid,
  Loader2,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Share2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ShowcaseProject } from '../data/mockWorkspace.ts';
import { ForgeDivider, ForgeStatusDot, ForgeTooltip } from './ui/ForgePrimitives.tsx';

interface TopNavBarProps {
  project: ShowcaseProject;
  projects: ShowcaseProject[];
  currentBranch: string;
  branches: string[];
  activeFilePath: string | null;
  agentStatus: 'idle' | 'running';
  diffAdditions: number;
  diffDeletions: number;
  pendingDiffCount: number;
  showLeftSidebar: boolean;
  showAgentPanel: boolean;
  showPreview: boolean;
  onSelectProject: (proj: ShowcaseProject) => void;
  onOpenDashboard: () => void;
  onSelectBranch: (branch: string) => void;
  onOpenCommandPalette: () => void;
  onToggleLeftSidebar: () => void;
  onToggleAgentPanel: () => void;
  onTogglePreview: () => void;
  onOpenDiffReview: () => void;
  onOpenSettings: () => void;
  onShareToast: (msg: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  project,
  projects,
  currentBranch,
  branches,
  activeFilePath,
  agentStatus,
  diffAdditions,
  diffDeletions,
  pendingDiffCount,
  showLeftSidebar,
  showAgentPanel,
  showPreview,
  onSelectProject,
  onOpenDashboard,
  onSelectBranch,
  onOpenCommandPalette,
  onToggleLeftSidebar,
  onToggleAgentPanel,
  onTogglePreview,
  onOpenDiffReview,
  onOpenSettings,
  onShareToast,
}) => {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeAll = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setWorkspaceMenuOpen(false);
        setBranchMenuOpen(false);
        setShareMenuOpen(false);
        setAvatarMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', closeAll);
    return () => window.removeEventListener('mousedown', closeAll);
  }, []);

  const breadcrumbs = activeFilePath ? activeFilePath.split('/') : ['workspace'];

  return (
    <header
      ref={navRef}
      className="h-10 shrink-0 flex items-center justify-between gap-3 px-3 bg-[#0C0C0F] border-b border-[#262630] select-none z-30"
    >
      {/* Left: Brand + Project + Branch */}
      <div className="flex items-center gap-2 min-w-0">
        <ForgeTooltip label="Project Dashboard">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-[#18181F] transition-colors shrink-0 active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5.5L12 2L20 5.5V13.5L12 22L4 13.5V5.5Z"
                stroke="#8B7CFF"
                strokeWidth="1.9"
              />
              <path
                d="M8.5 9.5H15.5M8.5 13H13.5"
                stroke="#40D9FF"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[12.5px] font-semibold tracking-tight text-[#F4F4F7] whitespace-nowrap">
              FORGE
            </span>
          </button>
        </ForgeTooltip>

        <ForgeDivider />

        {/* Project Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setWorkspaceMenuOpen((o) => !o);
              setBranchMenuOpen(false);
              setShareMenuOpen(false);
              setAvatarMenuOpen(false);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#18181F] text-xs font-medium text-[#F4F4F7] transition-colors whitespace-nowrap"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0" strokeWidth={1.75} />
            <span className="max-w-[140px] truncate">{project.name}</span>
            <ChevronDown className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
          </button>

          <AnimatePresence>
            {workspaceMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute left-0 top-full mt-1.5 w-64 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl py-1.5 z-50"
              >
                <div className="px-3 py-1 text-[10.5px] font-medium text-[#666672]">
                  Workspaces
                </div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(p);
                      setWorkspaceMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[#18181F] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[#F4F4F7] font-medium truncate">{p.name}</div>
                      <div className="text-[10.5px] text-[#9999A5] truncate">
                        {p.language} · {p.branch}
                      </div>
                    </div>
                    {p.id === project.id && (
                      <Check className="w-3.5 h-3.5 text-[#40D9FF] shrink-0" strokeWidth={2} />
                    )}
                  </button>
                ))}
                <div className="my-1 border-t border-[#262630]" />
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    onOpenDashboard();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
                >
                  <Home className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Project Dashboard</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Git Branch Selector */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => {
              setBranchMenuOpen((o) => !o);
              setWorkspaceMenuOpen(false);
              setShareMenuOpen(false);
              setAvatarMenuOpen(false);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#18181F] text-[11.5px] font-mono text-[#9999A5] hover:text-[#F4F4F7] transition-colors whitespace-nowrap"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#40D9FF] shrink-0" strokeWidth={1.75} />
            <span className="max-w-[140px] truncate">{currentBranch}</span>
            <ChevronDown className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
          </button>

          <AnimatePresence>
            {branchMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute left-0 top-full mt-1.5 w-60 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl py-1.5 z-50"
              >
                <div className="px-3 py-1 text-[10.5px] font-medium text-[#666672]">
                  Git Branches
                </div>
                {branches.map((br) => (
                  <button
                    key={br}
                    type="button"
                    onClick={() => {
                      onSelectBranch(br);
                      setBranchMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs font-mono hover:bg-[#18181F] transition-colors"
                  >
                    <span className={br === currentBranch ? 'text-[#F4F4F7]' : 'text-[#9999A5]'}>
                      {br}
                    </span>
                    {br === currentBranch && (
                      <Check className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={2} />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center: Command Search Interface + File Breadcrumbs */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1 justify-center max-w-xl">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center justify-between gap-4 px-3 h-7 rounded-md bg-[#121217] hover:bg-[#18181F] border border-[#262630] hover:border-[#3A3A48] text-xs text-[#9999A5] hover:text-[#F4F4F7] transition-all w-full max-w-[320px]"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#666672] shrink-0" strokeWidth={1.75} />
            <span className="truncate">Search files, symbols, or commands…</span>
          </span>
          <kbd className="text-[10px] font-mono text-[#9999A5] px-1.5 py-0.5 rounded bg-[#0C0C0F] border border-[#262630] shrink-0">
            ⌘K
          </kbd>
        </button>

        <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-[#666672] truncate max-w-[240px]">
          {breadcrumbs.map((part, idx) => (
            <React.Fragment key={`${part}-${idx}`}>
              {idx > 0 && <ChevronRight className="w-3 h-3 shrink-0" strokeWidth={1.75} />}
              <span
                className={
                  idx === breadcrumbs.length - 1 ? 'text-[#9999A5] truncate' : 'truncate'
                }
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Status + Git Diff + Layout Toggles + Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="lg:hidden p-1.5 rounded-md text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
          title="Command Palette (Cmd/Ctrl+K)"
        >
          <Search className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Agent Status */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] whitespace-nowrap">
          {agentStatus === 'running' ? (
            <>
              <Loader2 className="w-3 h-3 text-[#40D9FF] animate-spin shrink-0" strokeWidth={2} />
              <span className="text-[#40D9FF] font-medium">Executing</span>
            </>
          ) : (
            <>
              <ForgeStatusDot tone="ready" />
              <span className="text-[#9999A5]">Agent Ready</span>
            </>
          )}
        </div>

        <ForgeDivider className="hidden md:block" />

        {/* Git Change Counter */}
        <ForgeTooltip label="Review staged changes">
          <button
            type="button"
            onClick={onOpenDiffReview}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#18181F] text-[11px] font-mono tabular-nums whitespace-nowrap transition-colors"
          >
            <span className="text-[#36D399]">+{diffAdditions}</span>
            <span className="text-[#FB7185]">-{diffDeletions}</span>
            {pendingDiffCount > 0 && (
              <span className="text-[#8B7CFF]">· {pendingDiffCount}</span>
            )}
          </button>
        </ForgeTooltip>

        <ForgeDivider className="hidden sm:block" />

        {/* Panel Toggles */}
        <div className="flex items-center gap-0.5">
          <ForgeTooltip label="Toggle Explorer" shortcut="⌘B">
            <button
              type="button"
              onClick={onToggleLeftSidebar}
              className={`p-1.5 rounded-md transition-colors ${
                showLeftSidebar
                  ? 'bg-[#18181F] text-[#F4F4F7]'
                  : 'text-[#666672] hover:text-[#F4F4F7] hover:bg-[#18181F]'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </ForgeTooltip>

          <ForgeTooltip label="Toggle Agent" shortcut="⌘I">
            <button
              type="button"
              onClick={onToggleAgentPanel}
              className={`p-1.5 rounded-md transition-colors ${
                showAgentPanel
                  ? 'bg-[#18181F] text-[#8B7CFF]'
                  : 'text-[#666672] hover:text-[#F4F4F7] hover:bg-[#18181F]'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </ForgeTooltip>
        </div>

        {/* Preview Button */}
        <button
          type="button"
          onClick={onTogglePreview}
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium whitespace-nowrap border transition-colors active:scale-[0.98] ${
            showPreview
              ? 'bg-[#40D9FF]/12 border-[#40D9FF]/45 text-[#40D9FF]'
              : 'bg-[#121217] hover:bg-[#18181F] border-[#262630] text-[#F4F4F7]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Preview</span>
        </button>

        {/* Share */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShareMenuOpen((o) => !o);
              setWorkspaceMenuOpen(false);
              setBranchMenuOpen(false);
              setAvatarMenuOpen(false);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold whitespace-nowrap transition-colors active:scale-[0.98]"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Share</span>
          </button>

          <AnimatePresence>
            {shareMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1.5 w-72 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl p-3 space-y-2.5 z-50"
              >
                <div className="text-xs font-medium text-[#F4F4F7]">Share Workspace Snapshot</div>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    value={`https://forge.dev/w/${project.id}`}
                    className="flex-1 px-2.5 py-1.5 rounded bg-[#09090B] border border-[#262630] text-[11px] font-mono text-[#9999A5] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`https://forge.dev/w/${project.id}`);
                      setShareMenuOpen(false);
                      onShareToast('Workspace link copied to clipboard');
                    }}
                    className="p-1.5 rounded bg-[#18181F] hover:bg-[#22222B] border border-[#262630] text-[#F4F4F7]"
                    title="Copy link"
                  >
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings */}
        <ForgeTooltip label="Settings" shortcut="⌘,">
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </ForgeTooltip>

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAvatarMenuOpen((o) => !o);
              setWorkspaceMenuOpen(false);
              setBranchMenuOpen(false);
              setShareMenuOpen(false);
            }}
            className="w-7 h-7 rounded-md bg-[#18181F] border border-[#262630] hover:border-[#8B7CFF]/60 flex items-center justify-center text-[11px] font-semibold text-[#F4F4F7] transition-colors"
            title="Profile & Workspace"
          >
            AN
          </button>

          <AnimatePresence>
            {avatarMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1.5 w-56 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl py-1.5 z-50"
              >
                <div className="px-3 py-1.5 border-b border-[#262630]">
                  <div className="text-xs font-medium text-[#F4F4F7]">Principal Engineer</div>
                  <div className="text-[11px] text-[#9999A5] truncate">arzinayas1@gmail.com</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    onOpenDashboard();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                  <span>Project Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[#F4F4F7] hover:bg-[#18181F]"
                >
                  <Settings className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                  <span>Preferences & Models</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
