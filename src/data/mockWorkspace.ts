import type { FileTreeNode } from '../shared/types.ts';

export type AgentMode = 'Build' | 'Plan' | 'Debug' | 'Review' | 'Explain';

export interface ShowcaseProject {
  id: string;
  name: string;
  description: string;
  language: string;
  lastModified: string;
  branch: string;
  framework: string;
}

export interface TimelineStageItem {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
  detail?: string;
}

export interface AgentActivityCard {
  id: string;
  toolName: string;
  category: 'read' | 'search' | 'create' | 'edit' | 'test' | 'inspect';
  target: string;
  status: 'completed' | 'running' | 'warning';
  timestamp: string;
  duration: string;
  argsPreview: string;
  outputPreview: string;
}

export interface ShowcaseMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AgentMode;
  model?: string;
  provider?: string;
  externalRequestId?: string;
  feedbackRating?: 'good' | 'bad';
  timeline?: TimelineStageItem[];
  activities?: AgentActivityCard[];
}

export interface DiffChangeItem {
  id: string;
  filePath: string;
  additions: number;
  deletions: number;
  status: 'pending' | 'accepted' | 'rejected';
  summary: string;
  original: string;
  modified: string;
}

export interface ProblemDiagnostic {
  id: string;
  severity: 'warning' | 'error' | 'info';
  filePath: string;
  line: number;
  column: number;
  code: string;
  message: string;
  source: string;
}

export interface TestSuiteItem {
  id: string;
  file: string;
  passed: number;
  failed: number;
  durationMs: number;
  cases: Array<{ name: string; status: 'passed' | 'failed'; durationMs: number }>;
}

export interface ExtensionItem {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  enabled: boolean;
}

export interface IdeSettingsState {
  workspaceName: string;
  autoSave: 'off' | 'afterDelay' | 'onFocusChange';
  telemetryEnabled: boolean;
  theme: 'forge-obsidian' | 'forge-midnight';
  glassPanels: boolean;
  compactDensity: boolean;
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  indentGuides: boolean;
  agentModeDefault: AgentMode;
  streamSpeed: 'fast' | 'natural' | 'instant';
  autoApproveSmallDiffs: boolean;
  maxContextTokens: number;
  terminalFontSize: number;
  terminalCursorBlink: boolean;
  shellPath: string;
  redactEnvSecrets: boolean;
  localHistoryRetentionDays: number;
}

export const DEFAULT_IDE_SETTINGS: IdeSettingsState = {
  workspaceName: 'forge-analytics-suite',
  autoSave: 'afterDelay',
  telemetryEnabled: false,
  theme: 'forge-obsidian',
  glassPanels: true,
  compactDensity: false,
  fontSize: 13,
  tabSize: 2,
  minimap: true,
  wordWrap: false,
  lineNumbers: true,
  indentGuides: true,
  agentModeDefault: 'Build',
  streamSpeed: 'natural',
  autoApproveSmallDiffs: false,
  maxContextTokens: 128000,
  terminalFontSize: 12,
  terminalCursorBlink: true,
  shellPath: '/bin/zsh',
  redactEnvSecrets: true,
  localHistoryRetentionDays: 30,
};

export const RECENT_PROJECTS: ShowcaseProject[] = [
  {
    id: 'proj-analytics-suite',
    name: 'forge-analytics-suite',
    description: 'Enterprise observability & auth dashboard with streaming telemetry.',
    language: 'TypeScript',
    lastModified: '2 mins ago',
    branch: 'feat/analytics-dashboard',
    framework: 'React 19 · Vite',
  },
  {
    id: 'proj-pulse-gateway',
    name: 'pulse-realtime-gateway',
    description: 'Low-latency WebSocket edge router with token-bucket rate limiting.',
    language: 'Rust',
    lastModified: '3 hours ago',
    branch: 'main',
    framework: 'Axum · Tokio',
  },
  {
    id: 'proj-vanguard-auth',
    name: 'vanguard-rbac-service',
    description: 'Zero-trust RBAC policy engine and audit ledger API.',
    language: 'Go',
    lastModified: 'Yesterday',
    branch: 'fix/jwt-rotation',
    framework: 'Go 1.24 · gRPC',
  },
  {
    id: 'proj-aether-cli',
    name: 'aether-build-runner',
    description: 'Incremental monorepo build graph orchestrator.',
    language: 'TypeScript',
    lastModified: '3 days ago',
    branch: 'release/v2.4',
    framework: 'Node · ESBuild',
  },
];

export const INITIAL_FILE_CONTENTS: Record<string, string> = {
  'src/pages/DashboardOverview.tsx': `import React, { useMemo, useState } from 'react';
import { ResponsiveSidebar } from '../components/ResponsiveSidebar';
import { AnalyticsGrid } from '../components/AnalyticsGrid';
import { AuthGuard } from '../components/AuthGuard';
import { useMetricsStream } from '../hooks/useMetricsStream';
import { formatCompactNumber, formatLatency } from '../utils/formatters';

export interface DashboardOverviewProps {
  workspaceId: string;
  initialRange?: '24h' | '7d' | '30d';
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  workspaceId,
  initialRange = '24h',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>(initialRange);
  const { metrics, status, latencyP95, activeSessions, reconnect } = useMetricsStream({
    workspaceId,
    range: timeRange,
  });

  const kpiSummary = useMemo(
    () => [
      {
        id: 'requests',
        label: 'Edge Requests',
        value: formatCompactNumber(metrics.totalRequests),
        delta: '+14.2%',
      },
      {
        id: 'latency',
        label: 'P95 Latency',
        value: formatLatency(latencyP95),
        delta: '-6.4ms',
      },
      {
        id: 'sessions',
        label: 'Authenticated Sessions',
        value: formatCompactNumber(activeSessions),
        delta: '+9.8%',
      },
    ],
    [metrics.totalRequests, latencyP95, activeSessions]
  );

  return (
    <AuthGuard requiredRole="engineer">
      <div className="min-h-screen bg-[#09090B] text-[#F5F5F7] flex">
        <ResponsiveSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((prev) => !prev)}
          activeRoute="/dashboard"
        />

        <main className="flex-1 min-w-0 px-6 py-5 space-y-6">
          <header className="flex items-center justify-between border-b border-[#25252C] pb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">System Analytics</h1>
              <p className="text-xs text-[#85858F] mt-0.5">
                Live telemetry stream · Status: {status}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={\`px-3 py-1.5 rounded-md text-xs font-medium border \${
                    timeRange === range
                      ? 'bg-[#141419] border-[#8B7CFF] text-[#F5F5F7]'
                      : 'border-[#25252C] text-[#85858F] hover:text-[#F5F5F7]'
                  }\`}
                >
                  {range}
                </button>
              ))}
              {status === 'disconnected' && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#40D9FF] text-[#09090B]"
                >
                  Reconnect
                </button>
              )}
            </div>
          </header>

          <AnalyticsGrid summary={kpiSummary} series={metrics.timeseries} />
        </main>
      </div>
    </AuthGuard>
  );
};
`,
  'src/components/ResponsiveSidebar.tsx': `import React from 'react';
import { Activity, KeyRound, LayoutDashboard, Settings, Shield } from 'lucide-react';

interface ResponsiveSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeRoute: string;
}

const NAV_ITEMS = [
  { label: 'Overview', route: '/dashboard', icon: LayoutDashboard },
  { label: 'Telemetry', route: '/telemetry', icon: Activity },
  { label: 'Access Control', route: '/auth', icon: Shield },
  { label: 'API Keys', route: '/keys', icon: KeyRound },
  { label: 'Preferences', route: '/settings', icon: Settings },
];

export const ResponsiveSidebar: React.FC<ResponsiveSidebarProps> = ({
  open,
  onToggle,
  activeRoute,
}) => {
  return (
    <aside
      className={\`border-r border-[#25252C] bg-[#0D0D10] transition-all duration-200 flex flex-col \${
        open ? 'w-60' : 'w-16'
      }\`}
    >
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#25252C]">
        {open && <span className="text-sm font-semibold tracking-tight">Pulse Console</span>}
        <button
          type="button"
          onClick={onToggle}
          className="px-2 py-1 rounded border border-[#25252C] text-xs text-[#85858F] hover:text-[#F5F5F7]"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.route;
          return (
            <a
              key={item.route}
              href={item.route}
              className={\`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors \${
                active
                  ? 'bg-[#141419] text-[#F5F5F7] border border-[#25252C]'
                  : 'text-[#85858F] hover:text-[#F5F5F7] hover:bg-white/5'
              }\`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {open && <span>{item.label}</span>}
            </a>
          );
        })}
      </nav>
    </aside>
  );
};
`,
  'src/components/AnalyticsGrid.tsx': `import React from 'react';

interface MetricCard {
  id: string;
  label: string;
  value: string;
  delta: string;
}

interface AnalyticsGridProps {
  summary: MetricCard[];
  series: Array<{ timestamp: string; requests: number; errors: number }>;
}

export const AnalyticsGrid: React.FC<AnalyticsGridProps> = ({ summary, series }) => {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-lg bg-[#141419] border border-[#25252C] space-y-1.5"
          >
            <div className="text-xs text-[#85858F]">{item.label}</div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{item.value}</span>
              <span className="text-xs font-mono text-[#36D399]">{item.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-lg bg-[#141419] border border-[#25252C]">
        <div className="text-xs font-medium text-[#85858F] mb-3">
          Request Throughput ({series.length} buckets)
        </div>
        <div className="h-36 flex items-end gap-1.5">
          {series.map((pt) => (
            <div
              key={pt.timestamp}
              className="flex-1 bg-[#8B7CFF]/70 hover:bg-[#40D9FF] rounded-t transition-colors"
              style={{ height: \`\${Math.min(100, Math.max(12, pt.requests / 20))}%\` }}
              title={\`\${pt.timestamp}: \${pt.requests} req\`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
`,
  'src/components/AuthGuard.tsx': `import React from 'react';

interface AuthGuardProps {
  requiredRole: 'engineer' | 'admin' | 'viewer';
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ requiredRole, children }) => {
  const session = { authenticated: true, role: 'engineer' };

  if (!session.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] text-sm text-[#85858F]">
        Session expired. Redirecting to SSO gateway...
      </div>
    );
  }

  if (requiredRole === 'admin' && session.role !== 'admin') {
    return (
      <div className="p-6 text-xs text-[#FB7185] border border-[#25252C] rounded-lg">
        Insufficient permissions for role: {requiredRole}
      </div>
    );
  }

  return <>{children}</>;
};
`,
  'src/hooks/useMetricsStream.ts': `import { useCallback, useEffect, useState } from 'react';
import { fetchAnalyticsSnapshot } from '../services/analyticsApi';

export interface MetricsState {
  totalRequests: number;
  timeseries: Array<{ timestamp: string; requests: number; errors: number }>;
}

export function useMetricsStream(params: { workspaceId: string; range: '24h' | '7d' | '30d' }) {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [latencyP95, setLatencyP95] = useState(38.4);
  const [activeSessions, setActiveSessions] = useState(1420);
  const [metrics, setMetrics] = useState<MetricsState>({
    totalRequests: 1842900,
    timeseries: [],
  });

  const reconnect = useCallback(() => {
    setStatus('reconnecting');
    void fetchAnalyticsSnapshot(params.workspaceId, params.range).then((snap) => {
      setMetrics(snap);
      setLatencyP95(36.2);
      setActiveSessions(1495);
      setStatus('connected');
    });
  }, [params.workspaceId, params.range]);

  useEffect(() => {
    reconnect();
  }, [reconnect]);

  return { metrics, status, latencyP95, activeSessions, reconnect };
}
`,
  'src/services/analyticsApi.ts': `export interface SnapshotResponse {
  totalRequests: number;
  timeseries: Array<{ timestamp: string; requests: number; errors: number }>;
}

export async function fetchAnalyticsSnapshot(
  workspaceId: string,
  range: '24h' | '7d' | '30d'
): Promise<SnapshotResponse> {
  const bucketCount = range === '24h' ? 24 : range === '7d' ? 14 : 30;
  const timeseries = Array.from({ length: bucketCount }, (_, idx) => ({
    timestamp: \`T-\${bucketCount - idx}\`,
    requests: 640 + ((idx * 173 + workspaceId.length * 19) % 1250),
    errors: idx % 7 === 0 ? 4 : 1,
  }));

  return {
    totalRequests: timeseries.reduce((acc, item) => acc + item.requests * 100, 0),
    timeseries,
  };
}
`,
  'src/utils/formatters.ts': `export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatLatency(ms: number): string {
  return \`\${ms.toFixed(1)}ms\`;
}
`,
  'src/styles/tokens.css': `:root {
  --surface-bg: #09090b;
  --surface-panel: #141419;
  --border-subtle: #25252c;
  --accent-violet: #8b7cff;
  --accent-cyan: #40d9ff;
}
`,
  'public/images/architecture.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" fill="none">
  <rect x="4" y="4" width="312" height="112" rx="8" stroke="#25252C" fill="#101014"/>
  <rect x="24" y="34" width="76" height="52" rx="6" stroke="#8B7CFF" fill="#141419"/>
  <rect x="122" y="34" width="76" height="52" rx="6" stroke="#40D9FF" fill="#141419"/>
  <rect x="220" y="34" width="76" height="52" rx="6" stroke="#36D399" fill="#141419"/>
</svg>
`,
  'public/icons/forge-mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M4 5.5L12 2L20 5.5V13.5L12 22L4 13.5V5.5Z" stroke="#8B7CFF" stroke-width="1.75"/>
  <path d="M8.5 9.5H15.5M8.5 13H13.5" stroke="#40D9FF" stroke-width="1.75" stroke-linecap="round"/>
</svg>
`,
  'package.json': `{
  "name": "forge-analytics-suite",
  "version": "2.4.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "vite": "^6.2.0",
    "vitest": "^3.0.8"
  }
}
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
  'README.md': `# forge-analytics-suite

High-precision telemetry, authentication guardrails, and responsive navigation built inside FORGE AI.

## Architecture
- \`src/pages/DashboardOverview.tsx\` — Core KPI & live stream console
- \`src/components/ResponsiveSidebar.tsx\` — Collapsible workspace rail
- \`src/hooks/useMetricsStream.ts\` — Streaming analytics hook
`,
};

export function buildFileTreeFromPaths(
  filesMap: Record<string, string>,
  extraFolders: string[] = []
): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  const ensureFolder = (parts: string[]): FileTreeNode[] => {
    let currentLevel = root;
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let existing = currentLevel.find((n) => n.type === 'directory' && n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: 'directory',
          children: [],
        };
        currentLevel.push(existing);
      }
      currentLevel = existing.children!;
    }
    return currentLevel;
  };

  for (const folder of extraFolders) {
    ensureFolder(folder.split('/').filter(Boolean));
  }

  const modifiedSet = new Set([
    'src/pages/DashboardOverview.tsx',
    'src/components/ResponsiveSidebar.tsx',
    'src/hooks/useMetricsStream.ts',
  ]);

  for (const filePath of Object.keys(filesMap).sort()) {
    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const targetList = parts.length > 0 ? ensureFolder(parts) : root;
    targetList.push({
      name: fileName,
      path: filePath,
      type: 'file',
      size: filesMap[filePath].length,
      gitStatus: modifiedSet.has(filePath) ? 'Modified' : undefined,
    });
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  };
  sortNodes(root);
  return root;
}

export const INITIAL_AGENT_MESSAGES: ShowcaseMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Build a modern dashboard with authentication, analytics, and a responsive sidebar.',
    timestamp: '10:41:08',
    mode: 'Build',
  },
  {
    id: 'msg-agent-1',
    role: 'assistant',
    content:
      "Let’s inspect the project and establish the implementation plan.\n\nI have audited the existing component hierarchy, wrapped the dashboard route in `AuthGuard` with role enforcement, implemented the collapsible `ResponsiveSidebar`, and wired live telemetry metrics into `DashboardOverview.tsx` via `useMetricsStream`.\n\n```tsx\n<AuthGuard requiredRole=\"engineer\">\n  <DashboardOverview workspaceId=\"forge-prod\" initialRange=\"24h\" />\n</AuthGuard>\n```\n\nThe component changes are staged for your diff review (`3 files changed · 42 additions · 8 deletions`).",
    timestamp: '10:41:24',
    mode: 'Build',
    provider: 'coarena',
    model: 'claude-sonnet-5-5',
    timeline: [
      { id: 'st-1', label: 'Understanding requirements', status: 'completed' },
      { id: 'st-2', label: 'Inspecting project structure', status: 'completed' },
      { id: 'st-3', label: 'Planning architecture', status: 'completed' },
      { id: 'st-4', label: 'Implementing dashboard', status: 'active', detail: '3 files staged' },
      { id: 'st-5', label: 'Running tests', status: 'pending' },
      { id: 'st-6', label: 'Verifying changes', status: 'pending' },
    ],
    activities: [
      {
        id: 'act-1',
        toolName: 'read_file',
        category: 'read',
        target: 'package.json',
        status: 'completed',
        timestamp: '10:41:09',
        duration: '14ms',
        argsPreview: '{ "path": "package.json" }',
        outputPreview: 'Detected React 19.0.1, TypeScript 5.8.2, Vitest 3.0.8, Lucide React.',
      },
      {
        id: 'act-2',
        toolName: 'search_codebase',
        category: 'search',
        target: 'AuthGuard | useMetricsStream',
        status: 'completed',
        timestamp: '10:41:11',
        duration: '28ms',
        argsPreview: '{ "query": "AuthGuard|useMetricsStream", "isRegex": true }',
        outputPreview: 'Found 4 matches across src/components/AuthGuard.tsx and src/hooks/useMetricsStream.ts.',
      },
      {
        id: 'act-3',
        toolName: 'write_file',
        category: 'create',
        target: 'src/components/ResponsiveSidebar.tsx',
        status: 'completed',
        timestamp: '10:41:15',
        duration: '42ms',
        argsPreview: '{ "path": "src/components/ResponsiveSidebar.tsx", "bytes": 1480 }',
        outputPreview: 'Created collapsible sidebar navigation component with active route states.',
      },
      {
        id: 'act-4',
        toolName: 'edit_file',
        category: 'edit',
        target: 'src/pages/DashboardOverview.tsx',
        status: 'completed',
        timestamp: '10:41:18',
        duration: '36ms',
        argsPreview: '{ "path": "src/pages/DashboardOverview.tsx", "hunks": 2 }',
        outputPreview: 'Integrated AuthGuard, ResponsiveSidebar, and time-range analytics switcher (+24 / -4).',
      },
      {
        id: 'act-5',
        toolName: 'run_tests',
        category: 'test',
        target: 'vitest run src/pages/__tests__/DashboardOverview.test.tsx',
        status: 'completed',
        timestamp: '10:41:21',
        duration: '640ms',
        argsPreview: '{ "command": "npx vitest run DashboardOverview.test.tsx" }',
        outputPreview: 'PASS 12/12 assertions · AuthGuard, time-range filter, and sidebar collapse verified.',
      },
      {
        id: 'act-6',
        toolName: 'inspect_errors',
        category: 'inspect',
        target: 'tsc --noEmit',
        status: 'warning',
        timestamp: '10:41:23',
        duration: '310ms',
        argsPreview: '{ "scope": "src/**/*" }',
        outputPreview: '0 type errors · 2 non-blocking lint suggestions in useMetricsStream.ts & analyticsApi.ts.',
      },
    ],
  },
];

export const INITIAL_DIFF_CHANGES: DiffChangeItem[] = [
  {
    id: 'diff-1',
    filePath: 'src/pages/DashboardOverview.tsx',
    additions: 24,
    deletions: 4,
    status: 'pending',
    summary: 'Wrap dashboard in AuthGuard and wire ResponsiveSidebar + range selector',
    original: `import React, { useState } from 'react';
import { AnalyticsGrid } from '../components/AnalyticsGrid';
import { useMetricsStream } from '../hooks/useMetricsStream';

export const DashboardOverview: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const { metrics } = useMetricsStream({ workspaceId, range: '24h' });

  return (
    <main className="min-h-screen bg-[#09090B] text-[#F5F5F7] p-6">
      <h1 className="text-lg font-semibold mb-4">System Analytics</h1>
      <AnalyticsGrid summary={[]} series={metrics.timeseries} />
    </main>
  );
};
`,
    modified: INITIAL_FILE_CONTENTS['src/pages/DashboardOverview.tsx'],
  },
  {
    id: 'diff-2',
    filePath: 'src/components/ResponsiveSidebar.tsx',
    additions: 12,
    deletions: 2,
    status: 'pending',
    summary: 'Add mobile/desktop collapse toggle and active route indicator',
    original: `import React from 'react';

export const ResponsiveSidebar: React.FC = () => {
  return (
    <aside className="w-60 border-r border-[#25252C] bg-[#0D0D10] p-4">
      <div className="text-sm font-semibold">Pulse Console</div>
    </aside>
  );
};
`,
    modified: INITIAL_FILE_CONTENTS['src/components/ResponsiveSidebar.tsx'],
  },
  {
    id: 'diff-3',
    filePath: 'src/hooks/useMetricsStream.ts',
    additions: 6,
    deletions: 2,
    status: 'pending',
    summary: 'Expose activeSessions count and manual reconnect handler',
    original: `import { useEffect, useState } from 'react';
import { fetchAnalyticsSnapshot } from '../services/analyticsApi';

export function useMetricsStream(params: { workspaceId: string; range: '24h' | '7d' | '30d' }) {
  const [status] = useState<'connected' | 'disconnected'>('connected');
  const [metrics, setMetrics] = useState({ totalRequests: 0, timeseries: [] as any[] });

  useEffect(() => {
    void fetchAnalyticsSnapshot(params.workspaceId, params.range).then(setMetrics);
  }, [params.workspaceId, params.range]);

  return { metrics, status, latencyP95: 38.4 };
}
`,
    modified: INITIAL_FILE_CONTENTS['src/hooks/useMetricsStream.ts'],
  },
];

export const INITIAL_PROBLEMS: ProblemDiagnostic[] = [
  {
    id: 'prob-1',
    severity: 'warning',
    filePath: 'src/hooks/useMetricsStream.ts',
    line: 22,
    column: 5,
    code: 'TS-HINT',
    message: 'Promise returned from fetchAnalyticsSnapshot lacks explicit catch handler for offline fallback.',
    source: 'typescript',
  },
  {
    id: 'prob-2',
    severity: 'info',
    filePath: 'src/services/analyticsApi.ts',
    line: 11,
    column: 3,
    code: 'ESLINT',
    message: 'Consider memoizing bucket generation for 30d series windows.',
    source: 'eslint',
  },
];

export const INITIAL_OUTPUT_LOGS: string[] = [
  '[10:41:02.114] [vite] dev server ready in 184 ms — local: http://localhost:5173',
  '[10:41:09.402] [forge-agent] indexed 13 workspace files (18.4k tokens cached)',
  '[10:41:18.921] [hmr] updated /src/pages/DashboardOverview.tsx in 11 ms',
  '[10:41:21.608] [vitest] 12 passed (3 test files) in 640 ms',
  '[10:41:23.109] [tsc] 0 errors across tsconfig.json',
];

export const INITIAL_DEBUG_LOGS: Array<{ id: string; expr: string; result: string; type: 'log' | 'eval' }> = [
  {
    id: 'dbg-1',
    expr: 'authSession.currentUser',
    result: '{ id: "usr_01J9", role: "engineer", mfaVerified: true }',
    type: 'eval',
  },
  {
    id: 'dbg-2',
    expr: 'metricsStream.getBufferStats()',
    result: '{ connected: true, buckets: 24, latencyP95: 36.2 }',
    type: 'log',
  },
];

export const INITIAL_TEST_SUITES: TestSuiteItem[] = [
  {
    id: 'suite-1',
    file: 'src/pages/__tests__/DashboardOverview.test.tsx',
    passed: 5,
    failed: 0,
    durationMs: 248,
    cases: [
      { name: 'renders authenticated analytics header', status: 'passed', durationMs: 64 },
      { name: 'switches time range between 24h, 7d, and 30d', status: 'passed', durationMs: 82 },
      { name: 'toggles sidebar collapse cleanly', status: 'passed', durationMs: 49 },
      { name: 'displays reconnect trigger when disconnected', status: 'passed', durationMs: 53 },
    ],
  },
  {
    id: 'suite-2',
    file: 'src/components/__tests__/ResponsiveSidebar.test.tsx',
    passed: 4,
    failed: 0,
    durationMs: 192,
    cases: [
      { name: 'highlights active route link', status: 'passed', durationMs: 58 },
      { name: 'collapses to 64px rail on toggle', status: 'passed', durationMs: 71 },
      { name: 'renders accessible navigation items', status: 'passed', durationMs: 63 },
    ],
  },
  {
    id: 'suite-3',
    file: 'src/components/__tests__/AuthGuard.test.tsx',
    passed: 3,
    failed: 0,
    durationMs: 200,
    cases: [
      { name: 'allows engineer session on engineer route', status: 'passed', durationMs: 66 },
      { name: 'blocks engineer from admin-only view', status: 'passed', durationMs: 74 },
      { name: 'redirects unauthenticated users cleanly', status: 'passed', durationMs: 60 },
    ],
  },
];

export const INITIAL_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ext-ts',
    name: 'TypeScript Language Service',
    publisher: 'FORGE Core',
    version: '5.8.2',
    description: 'Strict type checking, jump-to-definition, and inline diagnostics.',
    enabled: true,
  },
  {
    id: 'ext-tw',
    name: 'Tailwind CSS IntelliSense',
    publisher: 'Tailwind Labs',
    version: '0.14.9',
    description: 'Autocomplete, linting, and color token previews for Tailwind v4.',
    enabled: true,
  },
  {
    id: 'ext-eslint',
    name: 'ESLint Diagnostics',
    publisher: 'Microsoft',
    version: '3.0.10',
    description: 'Real-time code quality rules and automated safe fixes.',
    enabled: true,
  },
  {
    id: 'ext-git',
    name: 'Git Graph & Diff Lens',
    publisher: 'FORGE Labs',
    version: '1.9.4',
    description: 'Inline blame annotations, hunk diffs, and branch history.',
    enabled: true,
  },
  {
    id: 'ext-vitest',
    name: 'Vitest Runner',
    publisher: 'Vitest',
    version: '3.0.8',
    description: 'In-editor test execution gutters and live watch coverage.',
    enabled: false,
  },
];

export const INITIAL_TERMINAL_TABS = [
  {
    id: 'term-1',
    title: 'zsh · forge-dev',
    lines: [
      'FORGE Terminal (Illustrative UI Session · ~/workspaces/forge-analytics-suite)',
      '$ pnpm dev',
      '  VITE v6.2.0  ready in 184 ms',
      '  ➜  Local:   http://localhost:5173/',
      '  ➜  Status:  24h telemetry mock stream active',
    ],
  },
  {
    id: 'term-2',
    title: 'vitest · watch',
    lines: [
      'FORGE Test Runner (Illustrative UI Session)',
      '$ npx vitest run',
      ' ✓ src/pages/__tests__/DashboardOverview.test.tsx (5 tests) 248ms',
      ' ✓ src/components/__tests__/ResponsiveSidebar.test.tsx (4 tests) 192ms',
      ' ✓ src/components/__tests__/AuthGuard.test.tsx (3 tests) 200ms',
      ' Test Files  3 passed (3) · Tests  12 passed (12)',
    ],
  },
];
