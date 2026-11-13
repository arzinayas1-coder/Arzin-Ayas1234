import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Eye, MessageSquareCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ProviderConfigDTO, ProviderId } from './shared/types.ts';
import { api } from './lib/api.ts';
import {
  buildFileTreeFromPaths,
  DEFAULT_IDE_SETTINGS,
  INITIAL_AGENT_MESSAGES,
  INITIAL_DEBUG_LOGS,
  INITIAL_DIFF_CHANGES,
  INITIAL_EXTENSIONS,
  INITIAL_FILE_CONTENTS,
  INITIAL_OUTPUT_LOGS,
  INITIAL_PROBLEMS,
  INITIAL_TERMINAL_TABS,
  INITIAL_TEST_SUITES,
  RECENT_PROJECTS,
  type AgentActivityCard,
  type AgentMode,
  type DiffChangeItem,
  type ExtensionItem,
  type IdeSettingsState,
  type ShowcaseMessage,
  type ShowcaseProject,
  type TestSuiteItem,
  type TimelineStageItem,
} from './data/mockWorkspace.ts';
import { TopNavBar } from './components/TopNavBar.tsx';
import { LeftSidebar, type AgentSessionSummary, type SidebarTab } from './components/LeftSidebar.tsx';
import { EditorWorkspace, type OpenEditorTab } from './components/EditorWorkspace.tsx';
import {
  BottomPanel,
  type BottomTab,
  type TerminalTabSession,
} from './components/BottomPanel.tsx';
import { AgentPanel } from './components/AgentPanel.tsx';
import { ProjectDashboard } from './components/ProjectDashboard.tsx';
import { ProjectPreviewPanel } from './components/ProjectPreviewPanel.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { SettingsView } from './components/SettingsView.tsx';

interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

const BRANCH_LIST = [
  'feat/analytics-dashboard',
  'main',
  'fix/auth-guard-redirect',
  'chore/metrics-stream-cache',
];

export default function App() {
  const [viewMode, setViewMode] = useState<'ide' | 'dashboard'>('ide');
  const [projects, setProjects] = useState<ShowcaseProject[]>(RECENT_PROJECTS);
  const [activeProject, setActiveProject] = useState<ShowcaseProject>(RECENT_PROJECTS[0]);
  const [currentBranch, setCurrentBranch] = useState<string>(RECENT_PROJECTS[0].branch);

  // Live free-only provider state from backend vault
  const [providers, setProviders] = useState<ProviderConfigDTO[]>([]);

  // Settings
  const [settings, setSettings] = useState<IdeSettingsState>(DEFAULT_IDE_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Workspace Files & Folders
  const [filesMap, setFilesMap] = useState<Record<string, string>>(INITIAL_FILE_CONTENTS);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenEditorTab[]>([
    {
      path: 'src/pages/DashboardOverview.tsx',
      content: INITIAL_FILE_CONTENTS['src/pages/DashboardOverview.tsx'],
      savedContent: INITIAL_FILE_CONTENTS['src/pages/DashboardOverview.tsx'],
    },
    {
      path: 'src/components/ResponsiveSidebar.tsx',
      content: INITIAL_FILE_CONTENTS['src/components/ResponsiveSidebar.tsx'],
      savedContent: INITIAL_FILE_CONTENTS['src/components/ResponsiveSidebar.tsx'],
    },
  ]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(
    'src/pages/DashboardOverview.tsx'
  );

  // Diff Review State
  const [diffChanges, setDiffChanges] = useState<DiffChangeItem[]>(INITIAL_DIFF_CHANGES);
  const [diffMode, setDiffMode] = useState(false);
  const [activeDiffId, setActiveDiffId] = useState<string | null>(INITIAL_DIFF_CHANGES[0].id);

  // Sidebar & Panels (responsive proportions for Desktop + iPad)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('explorer');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [agentWidth, setAgentWidth] = useState(400);

  const [showPreview, setShowPreview] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(440);

  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [bottomMaximized, setBottomMaximized] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(215);

  // Mobile responsive view switcher
  const [mobilePane, setMobilePane] = useState<'code' | 'agent' | 'preview'>('code');
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);

  // Bottom Panel Interactive State
  const [terminalTabs, setTerminalTabs] = useState<TerminalTabSession[]>(INITIAL_TERMINAL_TABS);
  const [activeTerminalId, setActiveTerminalId] = useState(INITIAL_TERMINAL_TABS[0].id);
  const [outputLogs, setOutputLogs] = useState<string[]>(INITIAL_OUTPUT_LOGS);
  const [debugLogs, setDebugLogs] = useState(INITIAL_DEBUG_LOGS);
  const [testSuites, setTestSuites] = useState<TestSuiteItem[]>(INITIAL_TEST_SUITES);
  const [runningTests, setRunningTests] = useState(false);
  const [extensions, setExtensions] = useState<ExtensionItem[]>(INITIAL_EXTENSIONS);

  // Agent Sessions & Streaming Simulation
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([
    {
      id: 'sess-1',
      title: 'Analytics Dashboard & Auth Guard',
      updatedAt: 'Just now',
      mode: 'Build',
      messages: INITIAL_AGENT_MESSAGES,
    },
    {
      id: 'sess-2',
      title: 'Metrics Stream Reconnect Audit',
      updatedAt: '1h ago',
      mode: 'Review',
      messages: [
        {
          id: 'msg-hist-1',
          role: 'user',
          content: 'Audit useMetricsStream.ts for stale closure bugs on reconnect.',
          timestamp: '09:18:10',
          mode: 'Review',
        },
        {
          id: 'msg-hist-2',
          role: 'assistant',
          content:
            'Verified `useCallback` dependencies in `src/hooks/useMetricsStream.ts`. `workspaceId` and `range` are tracked properly and trigger a fresh snapshot fetch.',
          timestamp: '09:18:19',
          mode: 'Review',
          model: 'claude-sonnet-5-5',
        },
      ],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('sess-1');
  const [activeMode, setActiveMode] = useState<AgentMode>('Build');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDraft, setStreamingDraft] = useState('');
  const [activeTimeline, setActiveTimeline] = useState<TimelineStageItem[]>([]);
  const [activeActivities, setActiveActivities] = useState<AgentActivityCard[]>([]);
  const [contextUsedTokens, setContextUsedTokens] = useState(18400);
  const streamTimersRef = useRef<number[]>([]);

  // Overlays & Toasts
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load free-only provider configurations from backend
  useEffect(() => {
    api.providers
      .list()
      .then((res) => setProviders(res.providers))
      .catch(() => {
        // Fallback free providers in ModelPicker handles offline/UI-only preview cleanly
      });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
      } else if (key === 'b') {
        e.preventDefault();
        setSidebarCollapsed((c) => !c);
      } else if (key === 'j') {
        e.preventDefault();
        setBottomCollapsed((c) => !c);
      } else if (key === 'i') {
        e.preventDefault();
        setShowAgentPanel((a) => !a);
      } else if (e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clearStreamTimers = useCallback(() => {
    streamTimersRef.current.forEach((t) => window.clearTimeout(t));
    streamTimersRef.current = [];
  }, []);

  useEffect(() => clearStreamTimers, [clearStreamTimers]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const fileTree = useMemo(
    () => buildFileTreeFromPaths(filesMap, extraFolders),
    [filesMap, extraFolders]
  );

  const workspaceFiles = useMemo(() => Object.keys(filesMap).sort(), [filesMap]);

  const dirtyPaths = useMemo(
    () => new Set(openTabs.filter((t) => t.content !== t.savedContent).map((t) => t.path)),
    [openTabs]
  );

  const activeProvider = useMemo(
    () => providers.find((p) => p.isActive) || providers[0],
    [providers]
  );

  const diffTotals = useMemo(() => {
    return {
      additions: diffChanges.reduce((acc, d) => acc + d.additions, 0),
      deletions: diffChanges.reduce((acc, d) => acc + d.deletions, 0),
      pending: diffChanges.filter((d) => d.status === 'pending').length,
    };
  }, [diffChanges]);

  // Responsive iPad/Desktop effective widths so Editor remains dominant
  const isTablet = viewportWidth >= 768 && viewportWidth < 1180;
  const effectiveSidebarWidth = isTablet ? Math.min(sidebarWidth, 224) : sidebarWidth;
  const effectiveAgentWidth = isTablet ? Math.min(agentWidth, 330) : agentWidth;
  const effectivePreviewWidth = isTablet ? Math.min(previewWidth, 340) : previewWidth;

  // Drag-resize helper
  const startResize = (
    axis: 'x' | 'y',
    initialSize: number,
    min: number,
    max: number,
    invert: boolean,
    setter: (val: number) => void
  ) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startCoord = axis === 'x' ? e.clientX : e.clientY;
      const onMove = (ev: MouseEvent) => {
        const delta = (axis === 'x' ? ev.clientX : ev.clientY) - startCoord;
        const next = Math.max(min, Math.min(max, initialSize + (invert ? -delta : delta)));
        setter(next);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
  };

  // File & Editor Handlers
  const handleOpenFile = (filePath: string, targetLine?: number) => {
    setDiffMode(false);
    setMobilePane('code');
    setMobileExplorerOpen(false);
    setOpenTabs((prev) => {
      const existing = prev.find((t) => t.path === filePath);
      if (existing) {
        return targetLine
          ? prev.map((t) => (t.path === filePath ? { ...t, targetLine } : t))
          : prev;
      }
      const content = filesMap[filePath] ?? '';
      return [...prev, { path: filePath, content, savedContent: content, targetLine }];
    });
    setActiveTabPath(filePath);
  };

  const handleSaveFile = (filePath: string) => {
    const tab = openTabs.find((t) => t.path === filePath);
    if (!tab) return;
    setFilesMap((prev) => ({ ...prev, [filePath]: tab.content }));
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === filePath ? { ...t, savedContent: tab.content } : t))
    );
    pushToast(`Saved ${filePath}`, 'success');
  };

  const handleCloseTab = (filePath: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== filePath);
      if (activeTabPath === filePath) {
        setActiveTabPath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  };

  const handleCreateFile = (filePath: string) => {
    if (filesMap[filePath] !== undefined) {
      handleOpenFile(filePath);
      return;
    }
    const stub = `// ${filePath}\nexport {};\n`;
    setFilesMap((prev) => ({ ...prev, [filePath]: stub }));
    setOpenTabs((prev) => [...prev, { path: filePath, content: stub, savedContent: stub }]);
    setActiveTabPath(filePath);
    pushToast(`Created ${filePath}`, 'success');
  };

  const handleCreateFolder = (dirPath: string) => {
    setExtraFolders((prev) => (prev.includes(dirPath) ? prev : [...prev, dirPath]));
    pushToast(`Created folder ${dirPath}`, 'info');
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    setFilesMap((prev) => {
      const next = { ...prev };
      next[newPath] = next[oldPath] ?? '';
      delete next[oldPath];
      return next;
    });
    setOpenTabs((prev) => prev.map((t) => (t.path === oldPath ? { ...t, path: newPath } : t)));
    if (activeTabPath === oldPath) setActiveTabPath(newPath);
    pushToast(`Renamed to ${newPath}`, 'info');
  };

  const handleDuplicateFile = (filePath: string) => {
    const extIdx = filePath.lastIndexOf('.');
    const copyPath =
      extIdx > 0
        ? `${filePath.slice(0, extIdx)}.copy${filePath.slice(extIdx)}`
        : `${filePath}.copy`;
    const content = filesMap[filePath] ?? '';
    setFilesMap((prev) => ({ ...prev, [copyPath]: content }));
    handleOpenFile(copyPath);
    pushToast(`Duplicated as ${copyPath}`, 'info');
  };

  const handleDeleteFile = (filePath: string) => {
    setFilesMap((prev) => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
    handleCloseTab(filePath);
    pushToast(`Deleted ${filePath}`, 'info');
  };

  const handleMoveFile = (sourcePath: string, targetFolder: string) => {
    const fileName = sourcePath.split('/').pop() || sourcePath;
    const destPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    if (destPath === sourcePath) return;
    handleRenameFile(sourcePath, destPath);
  };

  // Diff Review Handlers
  const handleAcceptDiff = (id: string) => {
    const item = diffChanges.find((d) => d.id === id);
    if (!item) return;
    setDiffChanges((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'accepted' } : d)));
    setFilesMap((prev) => ({ ...prev, [item.filePath]: item.modified }));
    setOpenTabs((prev) =>
      prev.map((t) =>
        t.path === item.filePath ? { ...t, content: item.modified, savedContent: item.modified } : t
      )
    );
    pushToast(`Accepted changes to ${item.filePath}`, 'success');
  };

  const handleRejectDiff = (id: string) => {
    const item = diffChanges.find((d) => d.id === id);
    if (!item) return;
    setDiffChanges((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'rejected' } : d)));
    pushToast(`Rejected changes to ${item.filePath}`, 'info');
  };

  const handleRevertDiff = (id: string) => {
    const item = diffChanges.find((d) => d.id === id);
    if (!item) return;
    setDiffChanges((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'pending' } : d)));
    pushToast(`Reverted ${item.filePath} diff to pending review`, 'info');
  };

  const handleAcceptAllDiffs = () => {
    setDiffChanges((prev) =>
      prev.map((d) => (d.status === 'pending' ? { ...d, status: 'accepted' } : d))
    );
    pushToast('All staged changes accepted', 'success');
  };

  // Terminal & Build Handlers
  const handleRunTerminalCommand = (termId: string, cmd: string) => {
    if (cmd === 'clear') {
      setTerminalTabs((prev) => prev.map((t) => (t.id === termId ? { ...t, lines: [] } : t)));
      return;
    }

    let responseLines: string[] = [];
    if (cmd === 'help') {
      responseLines = [
        'Available commands: pnpm build, vitest, git status, ls, clear',
      ];
    } else if (cmd.includes('build')) {
      responseLines = [
        '> tsc -b && vite build',
        '✓ 42 modules transformed.',
        'dist/assets/index-8c4f1a.js   214.82 kB │ gzip: 68.14 kB',
        '✓ built in 612ms',
      ];
      setOutputLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [build] tsc -b && vite build succeeded (612ms)`,
      ]);
    } else if (cmd.includes('test') || cmd.includes('vitest')) {
      responseLines = [
        '✓ src/pages/__tests__/DashboardOverview.test.tsx (5 tests) 248ms',
        '✓ src/components/__tests__/ResponsiveSidebar.test.tsx (4 tests) 192ms',
        '✓ src/components/__tests__/AuthGuard.test.tsx (3 tests) 200ms',
        'Test Files  3 passed (3) · Tests  12 passed (12)',
      ];
    } else if (cmd.includes('git status')) {
      responseLines = [
        `On branch ${currentBranch}`,
        'Changes not staged for commit:',
        '  modified:   src/pages/DashboardOverview.tsx',
        '  modified:   src/components/ResponsiveSidebar.tsx',
        '  modified:   src/hooks/useMetricsStream.ts',
      ];
    } else if (cmd === 'ls') {
      responseLines = ['package.json  public/  README.md  src/  tsconfig.json'];
    } else {
      responseLines = [`[forge-sh] executed "${cmd}" (exit code 0)`];
    }

    setTerminalTabs((prev) =>
      prev.map((t) =>
        t.id === termId ? { ...t, lines: [...t.lines, `$ ${cmd}`, ...responseLines] } : t
      )
    );
  };

  const handleRunBuild = () => {
    setBottomCollapsed(false);
    setBottomTab('terminal');
    handleRunTerminalCommand(activeTerminalId, 'pnpm build');
    pushToast('Build completed with 0 errors', 'success');
  };

  const handleRunTests = () => {
    setRunningTests(true);
    window.setTimeout(() => {
      setRunningTests(false);
      setTestSuites((prev) =>
        prev.map((s) => ({ ...s, durationMs: Math.max(120, s.durationMs - 8) }))
      );
      pushToast('All 12 tests passed', 'success');
    }, 600);
  };

  // Free Model Switching
  const handleSelectModel = async (provider: ProviderId, model: string) => {
    try {
      const res = await api.providers.update({ provider, model, setActive: true });
      setProviders(res.providers);
      pushToast(`Switched active free model to ${model}`, 'success');
    } catch {
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === provider ? { ...p, model, isActive: true } : { ...p, isActive: false }
        )
      );
      pushToast(`Active model set to ${model}`, 'success');
    }
  };

  // Autonomous Agent Execution Stream
  const handleSendAgentPrompt = (
    promptText: string,
    attachedFiles: string[],
    attachedImages: Array<{ id: string; name: string; previewUrl: string }>
  ) => {
    clearStreamTimers();

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const contextSuffix = [
      attachedFiles.length > 0 ? `Context files: ${attachedFiles.join(', ')}` : '',
      attachedImages.length > 0 ? `Images: ${attachedImages.map((i) => i.name).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const userMsg: ShowcaseMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: contextSuffix ? `${promptText}\n\n_${contextSuffix}_` : promptText,
      timestamp: nowTime,
      mode: activeMode,
    };

    const targetSessionId = activeSessionId;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? promptText.slice(0, 42) : s.title,
              updatedAt: 'Just now',
              mode: activeMode,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    setIsStreaming(true);
    setStreamingDraft('');
    setContextUsedTokens((t) => Math.min(settings.maxContextTokens, t + 1800));

    const stagesTemplate: TimelineStageItem[] = [
      { id: 's1', label: 'Understanding requirements', status: 'active' },
      { id: 's2', label: 'Inspecting project structure', status: 'pending' },
      { id: 's3', label: 'Planning implementation', status: 'pending' },
      { id: 's4', label: 'Applying edits', status: 'pending' },
      { id: 's5', label: 'Running tests', status: 'pending' },
      { id: 's6', label: 'Verifying changes', status: 'pending' },
    ];
    setActiveTimeline(stagesTemplate);

    const newActivities: AgentActivityCard[] = [
      {
        id: `act-${Date.now()}-1`,
        toolName: 'read_file',
        category: 'read',
        target: attachedFiles[0] || activeTabPath || 'src/pages/DashboardOverview.tsx',
        status: 'completed',
        timestamp: nowTime,
        duration: '12ms',
        argsPreview: `{ "path": "${attachedFiles[0] || activeTabPath || 'src/pages/DashboardOverview.tsx'}" }`,
        outputPreview: 'Loaded module AST and TypeScript interface exports.',
      },
      {
        id: `act-${Date.now()}-2`,
        toolName: 'search_codebase',
        category: 'search',
        target: promptText.split(' ').slice(0, 3).join(' '),
        status: 'completed',
        timestamp: nowTime,
        duration: '24ms',
        argsPreview: `{ "query": "${promptText.slice(0, 32)}" }`,
        outputPreview: 'Located 3 related references in components/ and hooks/.',
      },
      {
        id: `act-${Date.now()}-3`,
        toolName: 'edit_file',
        category: 'edit',
        target: 'src/pages/DashboardOverview.tsx',
        status: 'completed',
        timestamp: nowTime,
        duration: '38ms',
        argsPreview: '{ "path": "src/pages/DashboardOverview.tsx", "mode": "patch" }',
        outputPreview: 'Prepared clean TypeScript diff aligned with existing design tokens.',
      },
      {
        id: `act-${Date.now()}-4`,
        toolName: 'run_tests',
        category: 'test',
        target: 'npx vitest run',
        status: 'completed',
        timestamp: nowTime,
        duration: '510ms',
        argsPreview: '{ "suite": "DashboardOverview.test.tsx" }',
        outputPreview: 'PASS 12/12 assertions · 0 regressions detected.',
      },
    ];

    setActiveActivities([newActivities[0]]);

    const pace = settings.streamSpeed === 'instant' ? 60 : settings.streamSpeed === 'fast' ? 180 : 300;

    const fullReply = `Completed **${activeMode}** pass for: _"${promptText}"_\n\n- Inspected workspace modules and validated strict TypeScript boundaries.\n- Synthesized updated logic using active model \`${activeProvider?.model || 'claude-sonnet-5-5'}\`.\n- Verified Vitest suite (\`12/12 passed\`) with zero blocking diagnostics.\n\n\`\`\`tsx\n// Verified integration hook\nconst { metrics, status, latencyP95 } = useMetricsStream({ workspaceId, range: '24h' });\n\`\`\``;

    const t1 = window.setTimeout(() => {
      setActiveTimeline((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: 'completed' } : i === 1 ? { ...s, status: 'active' } : s
        )
      );
      setActiveActivities(newActivities.slice(0, 2));
    }, pace);

    const t2 = window.setTimeout(() => {
      setActiveTimeline((prev) =>
        prev.map((s, i) =>
          i <= 2 ? { ...s, status: 'completed' } : i === 3 ? { ...s, status: 'active' } : s
        )
      );
      setActiveActivities(newActivities.slice(0, 3));
      setStreamingDraft(fullReply.slice(0, Math.floor(fullReply.length * 0.45)));
    }, pace * 2.2);

    const t3 = window.setTimeout(() => {
      setActiveTimeline((prev) =>
        prev.map((s, i) =>
          i <= 4 ? { ...s, status: 'completed' } : { ...s, status: 'active' }
        )
      );
      setActiveActivities(newActivities);
      setStreamingDraft(fullReply.slice(0, Math.floor(fullReply.length * 0.85)));
    }, pace * 3.5);

    const t4 = window.setTimeout(() => {
      const doneTimeline: TimelineStageItem[] = stagesTemplate.map((s) => ({
        ...s,
        status: 'completed',
      }));
      const assistantMsg: ShowcaseMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        content: fullReply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        mode: activeMode,
        provider: activeProvider?.provider || 'coarena',
        model: activeProvider?.model || 'claude-sonnet-5-5',
        timeline: doneTimeline,
        activities: newActivities,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: 'Just now' }
            : s
        )
      );
      setIsStreaming(false);
      setStreamingDraft('');
      setActiveTimeline([]);
      setActiveActivities([]);
    }, pace * 4.8);

    streamTimersRef.current = [t1, t2, t3, t4];
  };

  const handleStopStreaming = () => {
    clearStreamTimers();
    setIsStreaming(false);
    setStreamingDraft('');
    setActiveTimeline([]);
    setActiveActivities([]);
    pushToast('Stopped agent generation', 'info');
  };

  const handleNewSession = () => {
    const id = `sess-${Date.now()}`;
    const newSess: AgentSessionSummary = {
      id,
      title: 'New Agent Session',
      updatedAt: 'Just now',
      mode: activeMode,
      messages: [],
    };
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(id);
    setShowAgentPanel(true);
    setMobilePane('agent');
  };

  if (viewMode === 'dashboard') {
    return (
      <>
        <ProjectDashboard
          projects={projects}
          onOpenProject={(proj) => {
            setActiveProject(proj);
            setCurrentBranch(proj.branch);
            setViewMode('ide');
          }}
          onCreateProjectFromPrompt={(prompt) => {
            setViewMode('ide');
            setShowAgentPanel(true);
            setMobilePane('agent');
            handleNewSession();
            window.setTimeout(() => handleSendAgentPrompt(prompt, [], []), 80);
          }}
          onCreateNewProject={(name, language) => {
            const created: ShowcaseProject = {
              id: `proj-${Date.now()}`,
              name,
              description: `Autonomous ${language} workspace initialized inside FORGE AI.`,
              language,
              lastModified: 'Just now',
              branch: 'main',
              framework: language === 'TypeScript' ? 'React 19 · Vite' : language,
            };
            setProjects((prev) => [created, ...prev]);
            setActiveProject(created);
            setCurrentBranch(created.branch);
            setViewMode('ide');
            pushToast(`Initialized workspace "${name}"`, 'success');
          }}
        />
        <CommandPalette
          open={commandPaletteOpen}
          files={workspaceFiles}
          projects={projects}
          onClose={() => setCommandPaletteOpen(false)}
          onOpenFile={(p) => {
            setViewMode('ide');
            handleOpenFile(p);
          }}
          onSelectProject={(p) => {
            setActiveProject(p);
            setCurrentBranch(p.branch);
            setViewMode('ide');
          }}
          onToggleTheme={() =>
            setSettings((s) => ({
              ...s,
              theme: s.theme === 'forge-obsidian' ? 'forge-midnight' : 'forge-obsidian',
            }))
          }
          onToggleTerminal={() => {
            setViewMode('ide');
            setBottomCollapsed((c) => !c);
          }}
          onToggleAgent={() => {
            setViewMode('ide');
            setShowAgentPanel((a) => !a);
          }}
          onTogglePreview={() => {
            setViewMode('ide');
            setShowPreview((p) => !p);
          }}
          onRunBuild={() => {
            setViewMode('ide');
            handleRunBuild();
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDashboard={() => setViewMode('dashboard')}
        />
        <SettingsView
          open={settingsOpen}
          settings={settings}
          providers={providers}
          onClose={() => setSettingsOpen(false)}
          onChangeSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onResetSettings={() => setSettings(DEFAULT_IDE_SETTINGS)}
          onSelectModel={handleSelectModel}
        />
      </>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#09090B] text-[#F4F4F7]">
      <TopNavBar
        project={activeProject}
        projects={projects}
        currentBranch={currentBranch}
        branches={BRANCH_LIST}
        activeFilePath={diffMode ? 'diff-review' : activeTabPath}
        agentStatus={isStreaming ? 'running' : 'idle'}
        diffAdditions={diffTotals.additions}
        diffDeletions={diffTotals.deletions}
        pendingDiffCount={diffTotals.pending}
        showLeftSidebar={!sidebarCollapsed}
        showAgentPanel={showAgentPanel}
        showPreview={showPreview}
        onSelectProject={(proj) => {
          setActiveProject(proj);
          setCurrentBranch(proj.branch);
          pushToast(`Switched workspace to ${proj.name}`, 'info');
        }}
        onOpenDashboard={() => setViewMode('dashboard')}
        onSelectBranch={(br) => {
          setCurrentBranch(br);
          pushToast(`Checked out branch ${br}`, 'info');
        }}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onToggleLeftSidebar={() => {
          if (viewportWidth < 768) {
            setMobileExplorerOpen((o) => !o);
          } else {
            setSidebarCollapsed((c) => !c);
          }
        }}
        onToggleAgentPanel={() => setShowAgentPanel((a) => !a)}
        onTogglePreview={() => {
          setShowPreview((p) => !p);
          setMobilePane('preview');
        }}
        onOpenDiffReview={() => {
          setDiffMode(true);
          setMobilePane('code');
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onShareToast={(msg) => pushToast(msg, 'success')}
      />

      {/* 5-Region Resizable IDE Workspace */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Desktop & iPad Left Rail + Explorer */}
        <div className="hidden md:flex h-full shrink-0">
          <LeftSidebar
            activeTab={sidebarTab}
            collapsed={sidebarCollapsed}
            width={effectiveSidebarWidth}
            compactDensity={settings.compactDensity}
            onSelectTab={(tab) => {
              setSidebarTab(tab);
              setSidebarCollapsed(false);
            }}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            onOpenSettings={() => setSettingsOpen(true)}
            fileTree={fileTree}
            filesMap={filesMap}
            activeFilePath={activeTabPath}
            dirtyPaths={dirtyPaths}
            onOpenFile={handleOpenFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRenameFile={handleRenameFile}
            onDuplicateFile={handleDuplicateFile}
            onDeleteFile={handleDeleteFile}
            onMoveFile={handleMoveFile}
            currentBranch={currentBranch}
            diffChanges={diffChanges}
            onOpenDiffFile={(path) => {
              const found = diffChanges.find((d) => d.filePath === path);
              if (found) setActiveDiffId(found.id);
              setDiffMode(true);
            }}
            onCommitChanges={(msg) => {
              setDiffChanges((prev) => prev.map((d) => ({ ...d, status: 'accepted' })));
              pushToast(`Committed "${msg}" on ${currentBranch}`, 'success');
            }}
            extensions={extensions}
            onToggleExtension={(id) =>
              setExtensions((prev) =>
                prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
              )
            }
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setShowAgentPanel(true);
            }}
            onNewSession={handleNewSession}
          />
          {!sidebarCollapsed && (
            <div
              onMouseDown={startResize('x', sidebarWidth, 210, 420, false, setSidebarWidth)}
              className="w-1.5 h-full cursor-col-resize hover:bg-[#8B7CFF]/50 transition-colors shrink-0"
              title="Drag to resize Explorer"
            />
          )}
        </div>

        {/* Mobile Drawer Explorer */}
        <AnimatePresence>
          {mobileExplorerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="md:hidden fixed inset-0 top-10 z-40 flex bg-black/65"
              onClick={() => setMobileExplorerOpen(false)}
            >
              <motion.div
                initial={{ x: -24 }}
                animate={{ x: 0 }}
                exit={{ x: -24 }}
                transition={{ duration: 0.16 }}
                className="h-full bg-[#0C0C0F]"
                onClick={(e) => e.stopPropagation()}
              >
                <LeftSidebar
                  activeTab={sidebarTab}
                  collapsed={false}
                  width={256}
                  compactDensity={settings.compactDensity}
                  onSelectTab={setSidebarTab}
                  onToggleCollapse={() => setMobileExplorerOpen(false)}
                  onOpenSettings={() => {
                    setMobileExplorerOpen(false);
                    setSettingsOpen(true);
                  }}
                  fileTree={fileTree}
                  filesMap={filesMap}
                  activeFilePath={activeTabPath}
                  dirtyPaths={dirtyPaths}
                  onOpenFile={handleOpenFile}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onRenameFile={handleRenameFile}
                  onDuplicateFile={handleDuplicateFile}
                  onDeleteFile={handleDeleteFile}
                  onMoveFile={handleMoveFile}
                  currentBranch={currentBranch}
                  diffChanges={diffChanges}
                  onOpenDiffFile={(path) => {
                    const found = diffChanges.find((d) => d.filePath === path);
                    if (found) setActiveDiffId(found.id);
                    setDiffMode(true);
                    setMobileExplorerOpen(false);
                  }}
                  onCommitChanges={(msg) => pushToast(`Committed "${msg}"`, 'success')}
                  extensions={extensions}
                  onToggleExtension={(id) =>
                    setExtensions((prev) =>
                      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
                    )
                  }
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={(id) => {
                    setActiveSessionId(id);
                    setMobilePane('agent');
                    setMobileExplorerOpen(false);
                  }}
                  onNewSession={handleNewSession}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Code Editor + Optional Preview Split + Bottom Terminal */}
        <div
          className={`${
            mobilePane === 'agent' ? 'hidden md:flex' : 'flex'
          } flex-1 min-w-0 flex-col overflow-hidden`}
        >
          <div className={`flex-1 min-h-0 flex overflow-hidden ${bottomMaximized ? 'hidden' : ''}`}>
            <div
              className={`${
                mobilePane === 'preview' && showPreview ? 'hidden md:block' : 'block'
              } flex-1 min-w-0 h-full overflow-hidden`}
            >
              <EditorWorkspace
                tabs={openTabs}
                activeTabPath={activeTabPath}
                diffMode={diffMode}
                diffChanges={diffChanges}
                activeDiffId={activeDiffId}
                settings={settings}
                onSelectTab={setActiveTabPath}
                onCloseTab={handleCloseTab}
                onChangeContent={(path, content) =>
                  setOpenTabs((prev) =>
                    prev.map((t) => (t.path === path ? { ...t, content } : t))
                  )
                }
                onSaveFile={handleSaveFile}
                onToggleDiffMode={(open) =>
                  setDiffMode((prev) => (typeof open === 'boolean' ? open : !prev))
                }
                onSelectDiffItem={setActiveDiffId}
                onAcceptDiff={handleAcceptDiff}
                onRejectDiff={handleRejectDiff}
                onRevertDiff={handleRevertDiff}
                onAcceptAllDiffs={handleAcceptAllDiffs}
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              />
            </div>

            {showPreview && (
              <>
                <div
                  onMouseDown={startResize('x', previewWidth, 300, 720, true, setPreviewWidth)}
                  className="hidden md:block w-1.5 h-full cursor-col-resize hover:bg-[#40D9FF]/50 transition-colors shrink-0"
                  title="Drag to resize Preview"
                />
                <div
                  style={viewportWidth >= 768 ? { width: effectivePreviewWidth } : undefined}
                  className={`${
                    mobilePane === 'preview' ? 'w-full' : 'hidden md:block'
                  } h-full shrink-0 overflow-hidden`}
                >
                  <ProjectPreviewPanel
                    onClose={() => {
                      setShowPreview(false);
                      setMobilePane('code');
                    }}
                    onShareToast={(msg) => pushToast(msg, 'info')}
                  />
                </div>
              </>
            )}
          </div>

          {/* Vertical Resize Divider */}
          {!bottomCollapsed && !bottomMaximized && (
            <div
              onMouseDown={startResize('y', bottomHeight, 130, 480, true, setBottomHeight)}
              className="h-1.5 w-full cursor-row-resize hover:bg-[#8B7CFF]/50 transition-colors shrink-0"
              title="Drag to resize Terminal Panel"
            />
          )}

          <BottomPanel
            activeTab={bottomTab}
            collapsed={bottomCollapsed}
            maximized={bottomMaximized}
            height={bottomHeight}
            settings={settings}
            onSelectTab={setBottomTab}
            onToggleCollapse={() => {
              setBottomMaximized(false);
              setBottomCollapsed((c) => !c);
            }}
            onToggleMaximize={() => {
              setBottomCollapsed(false);
              setBottomMaximized((m) => !m);
            }}
            onClosePanel={() => {
              setBottomMaximized(false);
              setBottomCollapsed(true);
            }}
            terminalTabs={terminalTabs}
            activeTerminalId={activeTerminalId}
            onSelectTerminal={setActiveTerminalId}
            onNewTerminal={() => {
              const id = `term-${Date.now()}`;
              setTerminalTabs((prev) => [
                ...prev,
                {
                  id,
                  title: `zsh · shell-${prev.length + 1}`,
                  lines: [`FORGE Terminal (${settings.shellPath}) · ready`],
                },
              ]);
              setActiveTerminalId(id);
            }}
            onCloseTerminal={(id) => {
              setTerminalTabs((prev) => {
                const next = prev.filter((t) => t.id !== id);
                if (activeTerminalId === id && next.length > 0) {
                  setActiveTerminalId(next[0].id);
                }
                return next;
              });
            }}
            onRunTerminalCommand={handleRunTerminalCommand}
            onClearTerminal={(id) =>
              setTerminalTabs((prev) => prev.map((t) => (t.id === id ? { ...t, lines: [] } : t)))
            }
            problems={INITIAL_PROBLEMS}
            onJumpToProblem={(path, line) => handleOpenFile(path, line)}
            outputLogs={outputLogs}
            debugLogs={debugLogs}
            onEvalDebugExpr={(expr) =>
              setDebugLogs((prev) => [
                ...prev,
                {
                  id: `dbg-${Date.now()}`,
                  expr,
                  result: `"{ evaluated: '${expr.replace(/'/g, '')}', ok: true }"`,
                  type: 'eval',
                },
              ])
            }
            testSuites={testSuites}
            runningTests={runningTests}
            onRunTests={handleRunTests}
          />
        </div>

        {/* Right Autonomous Agent Workspace */}
        {showAgentPanel && (
          <>
            <div
              onMouseDown={startResize('x', agentWidth, 310, 560, true, setAgentWidth)}
              className="hidden md:block w-1.5 h-full cursor-col-resize hover:bg-[#8B7CFF]/50 transition-colors shrink-0"
              title="Drag to resize Agent Panel"
            />
            <div
              style={viewportWidth >= 768 ? { width: effectiveAgentWidth } : undefined}
              className={`${
                mobilePane === 'agent' ? 'flex w-full' : 'hidden md:flex'
              } h-full shrink-0 flex-col min-h-0`}
            >
              <AgentPanel
                messages={activeSession?.messages || []}
                activeMode={activeMode}
                isStreaming={isStreaming}
                streamingDraft={streamingDraft}
                activeTimeline={activeTimeline}
                activeActivities={activeActivities}
                contextUsedTokens={contextUsedTokens}
                maxContextTokens={settings.maxContextTokens}
                providers={providers}
                activeProvider={activeProvider}
                workspaceFiles={workspaceFiles}
                pendingDiffCount={diffTotals.pending}
                onChangeMode={setActiveMode}
                onSelectModel={handleSelectModel}
                onOpenSettings={() => setSettingsOpen(true)}
                onNewConversation={handleNewSession}
                onSendPrompt={handleSendAgentPrompt}
                onStopStreaming={handleStopStreaming}
                onApplyCodeSnippet={(code) => {
                  if (!activeTabPath) return;
                  setOpenTabs((prev) =>
                    prev.map((t) => (t.path === activeTabPath ? { ...t, content: code } : t))
                  );
                  pushToast(`Inserted code snippet into ${activeTabPath}`, 'success');
                }}
                onOpenDiffReview={() => {
                  setDiffMode(true);
                  setMobilePane('code');
                }}
                onRateMessage={(messageId, rating) => {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === activeSessionId
                        ? {
                            ...s,
                            messages: s.messages.map((m) =>
                              m.id === messageId ? { ...m, feedbackRating: rating } : m
                            ),
                          }
                        : s
                    )
                  );
                  void api.agent.submitFeedback(messageId, rating).catch(() => {});
                  pushToast(`Recorded ${rating} feedback`, 'success');
                }}
              />
            </div>
          </>
        )}
      </main>

      {/* Mobile Touch-Friendly View Switcher Bar (< md) */}
      <nav className="md:hidden h-12 pb-[env(safe-area-inset-bottom)] bg-[#0C0C0F] border-t border-[#262630] flex items-center justify-around shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane('code')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium ${
            mobilePane === 'code' ? 'text-[#40D9FF] bg-[#18181F]' : 'text-[#9999A5]'
          }`}
        >
          <Code2 className="w-4 h-4" strokeWidth={1.75} />
          <span>Code</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAgentPanel(true);
            setMobilePane('agent');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium ${
            mobilePane === 'agent' ? 'text-[#8B7CFF] bg-[#18181F]' : 'text-[#9999A5]'
          }`}
        >
          <MessageSquareCode className="w-4 h-4" strokeWidth={1.75} />
          <span>Agent</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowPreview(true);
            setMobilePane('preview');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium ${
            mobilePane === 'preview' ? 'text-[#36D399] bg-[#18181F]' : 'text-[#9999A5]'
          }`}
        >
          <Eye className="w-4 h-4" strokeWidth={1.75} />
          <span>Preview</span>
        </button>
      </nav>

      {/* Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        open={commandPaletteOpen}
        files={workspaceFiles}
        projects={projects}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenFile={handleOpenFile}
        onSelectProject={(proj) => {
          setActiveProject(proj);
          setCurrentBranch(proj.branch);
          pushToast(`Switched workspace to ${proj.name}`, 'info');
        }}
        onToggleTheme={() =>
          setSettings((s) => ({
            ...s,
            theme: s.theme === 'forge-obsidian' ? 'forge-midnight' : 'forge-obsidian',
          }))
        }
        onToggleTerminal={() => setBottomCollapsed((c) => !c)}
        onToggleAgent={() => setShowAgentPanel((a) => !a)}
        onTogglePreview={() => setShowPreview((p) => !p)}
        onRunBuild={handleRunBuild}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDashboard={() => setViewMode('dashboard')}
      />

      {/* Dedicated Settings Interface */}
      <SettingsView
        open={settingsOpen}
        settings={settings}
        providers={providers}
        onClose={() => setSettingsOpen(false)}
        onChangeSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onResetSettings={() => {
          setSettings(DEFAULT_IDE_SETTINGS);
          pushToast('Restored default IDE preferences', 'info');
        }}
        onSelectModel={handleSelectModel}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-14 md:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className={`px-3.5 py-2 rounded-lg border text-xs shadow-2xl ${
                t.tone === 'error'
                  ? 'bg-[#121217] border-[#FB7185]/45 text-[#FB7185]'
                  : t.tone === 'success'
                  ? 'bg-[#121217] border-[#36D399]/45 text-[#36D399]'
                  : 'bg-[#121217] border-[#262630] text-[#F4F4F7]'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
