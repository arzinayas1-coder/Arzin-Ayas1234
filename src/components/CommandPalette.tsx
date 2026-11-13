import React, { useEffect, useMemo, useState } from 'react';
import {
  Command,
  Eye,
  FileCode,
  FolderGit2,
  Hammer,
  Home,
  Palette,
  PanelBottom,
  PanelRight,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ShowcaseProject } from '../data/mockWorkspace.ts';

export interface CommandAction {
  id: string;
  group: 'Commands' | 'Files' | 'Projects';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  files: string[];
  projects: ShowcaseProject[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onSelectProject: (proj: ShowcaseProject) => void;
  onToggleTheme: () => void;
  onToggleTerminal: () => void;
  onToggleAgent: () => void;
  onTogglePreview: () => void;
  onRunBuild: () => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  files,
  projects,
  onClose,
  onOpenFile,
  onSelectProject,
  onToggleTheme,
  onToggleTerminal,
  onToggleAgent,
  onTogglePreview,
  onRunBuild,
  onOpenSettings,
  onOpenDashboard,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const actions = useMemo<CommandAction[]>(() => {
    const coreCommands: CommandAction[] = [
      {
        id: 'cmd-terminal',
        group: 'Commands',
        label: 'Toggle Bottom Terminal',
        hint: '⌘J',
        icon: <PanelBottom className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />,
        onRun: onToggleTerminal,
      },
      {
        id: 'cmd-agent',
        group: 'Commands',
        label: 'Toggle Agent Panel',
        hint: '⌘I',
        icon: <PanelRight className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />,
        onRun: onToggleAgent,
      },
      {
        id: 'cmd-preview',
        group: 'Commands',
        label: 'Toggle Project Preview',
        hint: '⌥P',
        icon: <Eye className="w-3.5 h-3.5 text-[#36D399]" strokeWidth={1.75} />,
        onRun: onTogglePreview,
      },
      {
        id: 'cmd-build',
        group: 'Commands',
        label: 'Run Project Build (tsc + vite)',
        hint: '⌘⇧B',
        icon: <Hammer className="w-3.5 h-3.5 text-[#FBBF24]" strokeWidth={1.75} />,
        onRun: onRunBuild,
      },
      {
        id: 'cmd-theme',
        group: 'Commands',
        label: 'Switch Editor Theme (Obsidian / Midnight)',
        icon: <Palette className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />,
        onRun: onToggleTheme,
      },
      {
        id: 'cmd-settings',
        group: 'Commands',
        label: 'Open IDE Settings & AI Models',
        hint: '⌘,',
        icon: <Settings className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />,
        onRun: onOpenSettings,
      },
      {
        id: 'cmd-home',
        group: 'Commands',
        label: 'Return to Project Dashboard',
        icon: <Home className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />,
        onRun: onOpenDashboard,
      },
    ];

    const fileCommands: CommandAction[] = files.map((filePath) => ({
      id: `file-${filePath}`,
      group: 'Files',
      label: filePath,
      hint: 'Open file',
      icon: <FileCode className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />,
      onRun: () => onOpenFile(filePath),
    }));

    const projectCommands: CommandAction[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      group: 'Projects',
      label: `Switch to ${p.name}`,
      hint: p.branch,
      icon: <FolderGit2 className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />,
      onRun: () => onSelectProject(p),
    }));

    const all = [...coreCommands, ...fileCommands, ...projectCommands];
    const q = query.trim().toLowerCase();
    if (!q) return [...coreCommands, ...fileCommands.slice(0, 8)];
    return all.filter(
      (a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)
    );
  }, [
    files,
    projects,
    query,
    onOpenFile,
    onSelectProject,
    onToggleTheme,
    onToggleTerminal,
    onToggleAgent,
    onTogglePreview,
    onRunBuild,
    onOpenSettings,
    onOpenDashboard,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(actions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && actions[activeIndex]) {
      e.preventDefault();
      actions[activeIndex].onRun();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -6 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl bg-[#121217] border border-[#262630] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#262630] bg-[#0C0C0F]">
              <Search className="w-4 h-4 text-[#9999A5]" strokeWidth={1.75} />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, file name, or project…"
                className="flex-1 bg-transparent text-sm text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto py-1.5">
              {actions.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#666672]">
                  No commands or files match &ldquo;{query}&rdquo;.
                </div>
              ) : (
                actions.map((item, idx) => {
                  const selected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        item.onRun();
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs transition-colors ${
                        selected
                          ? 'bg-[#18181F] text-[#F4F4F7]'
                          : 'text-[#9999A5] hover:bg-[#18181F]/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.icon}
                        <span
                          className={`truncate ${
                            item.group === 'Files' ? 'font-mono text-[12px]' : 'font-medium'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {item.hint && (
                          <span className="text-[11px] font-mono text-[#666672]">
                            {item.hint}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-[#262630] bg-[#0C0C0F] flex items-center justify-between text-[11px] text-[#666672]">
              <span className="flex items-center gap-1.5">
                <Command className="w-3 h-3" strokeWidth={1.75} />
                <span>Command Palette</span>
              </span>
              <span className="font-mono">↑↓ navigate · ↵ execute · esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
