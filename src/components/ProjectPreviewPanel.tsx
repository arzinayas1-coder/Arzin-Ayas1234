import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';

interface ProjectPreviewPanelProps {
  onClose: () => void;
  onShareToast: (msg: string) => void;
}

export const ProjectPreviewPanel: React.FC<ProjectPreviewPanelProps> = ({
  onClose,
  onShareToast,
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewUrl, setPreviewUrl] = useState('https://localhost:5173/dashboard');
  const [previewState, setPreviewState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleRefresh = () => {
    setPreviewState('loading');
    setTimeout(() => setPreviewState('ready'), 420);
  };

  const widthClass =
    viewport === 'mobile'
      ? 'w-[375px]'
      : viewport === 'tablet'
      ? 'w-[768px]'
      : 'w-full';

  const bars =
    timeRange === '24h'
      ? [44, 58, 62, 51, 78, 86, 71, 65, 92, 84, 76, 89]
      : timeRange === '7d'
      ? [52, 68, 61, 74, 83, 79, 95, 88, 72, 81, 90, 94]
      : [38, 49, 55, 64, 59, 71, 80, 77, 85, 91, 88, 96];

  return (
    <div className="flex flex-col h-full bg-[#101014] border-l border-[#262630]">
      {/* Preview Toolbar */}
      <div className="h-9 px-3 bg-[#0C0C0F] border-b border-[#262630] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center p-0.5 rounded-md bg-[#121217] border border-[#262630] shrink-0">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              title="Desktop viewport"
              className={`p-1 rounded ${
                viewport === 'desktop' ? 'bg-[#18181F] text-[#40D9FF]' : 'text-[#666672]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              title="Tablet viewport (768px)"
              className={`p-1 rounded ${
                viewport === 'tablet' ? 'bg-[#18181F] text-[#40D9FF]' : 'text-[#666672]'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              title="Mobile viewport (375px)"
              className={`p-1 rounded ${
                viewport === 'mobile' ? 'bg-[#18181F] text-[#40D9FF]' : 'text-[#666672]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <input
            type="text"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-0.5 rounded bg-[#09090B] border border-[#262630] text-[11px] font-mono text-[#F4F4F7] focus:outline-none focus:border-[#40D9FF]"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewState((s) => (s === 'error' ? 'ready' : 'error'))}
            className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
              previewState === 'error'
                ? 'border-[#FB7185]/40 text-[#FB7185] bg-[#FB7185]/10'
                : 'border-[#262630] text-[#9999A5] hover:text-[#F4F4F7]'
            }`}
            title="Toggle Error State Preview"
          >
            Error State
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
            title="Refresh preview"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${previewState === 'loading' ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
          </button>
          <button
            type="button"
            onClick={() => onShareToast(`Opened ${previewUrl} preview target`)}
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
            title="Open externally"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
            title="Close Preview"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Viewport Stage */}
      <div className="flex-1 min-h-0 bg-[#09090B] p-3 overflow-auto flex justify-center">
        <div
          className={`${widthClass} max-w-full h-full rounded-lg border border-[#262630] bg-[#09090B] overflow-hidden flex flex-col transition-all duration-200`}
        >
          {previewState === 'loading' ? (
            <div className="p-6 space-y-4">
              <div className="h-6 w-44 rounded forge-skeleton" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded forge-skeleton" />
                <div className="h-20 rounded forge-skeleton" />
                <div className="h-20 rounded forge-skeleton" />
              </div>
              <div className="h-44 rounded forge-skeleton" />
            </div>
          ) : previewState === 'error' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#FB7185]/12 border border-[#FB7185]/35 flex items-center justify-center text-[#FB7185]">
                <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="text-sm font-medium text-[#F4F4F7]">
                Preview Render Exception (Simulated Error State)
              </div>
              <p className="text-xs font-mono text-[#9999A5] max-w-sm">
                ERR_CONNECTION_REFUSED: Unable to reach {previewUrl}. Check dev server port or
                inspect Problems tab.
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-md bg-[#8B7CFF] text-[#09090B] text-xs font-semibold"
              >
                Retry Render
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex bg-[#09090B] text-[#F4F4F7]">
              <aside
                className={`border-r border-[#262630] bg-[#0C0C0F] flex flex-col transition-all ${
                  sidebarCollapsed || viewport === 'mobile' ? 'w-12' : 'w-44'
                }`}
              >
                <div className="h-11 px-3 border-b border-[#262630] flex items-center justify-between">
                  {!sidebarCollapsed && viewport !== 'mobile' && (
                    <span className="text-xs font-semibold truncate">Pulse Console</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((c) => !c)}
                    className="text-[10px] font-mono text-[#9999A5] hover:text-[#F4F4F7]"
                  >
                    {sidebarCollapsed || viewport === 'mobile' ? '»' : '«'}
                  </button>
                </div>
                <nav className="p-1.5 space-y-1">
                  {[
                    { label: 'Overview', icon: LayoutDashboard, active: true },
                    { label: 'Telemetry', icon: Activity, active: false },
                    { label: 'Access Control', icon: Shield, active: false },
                    { label: 'API Keys', icon: KeyRound, active: false },
                    { label: 'Settings', icon: Settings, active: false },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${
                          item.active
                            ? 'bg-[#18181F] text-[#F4F4F7] border border-[#262630]'
                            : 'text-[#9999A5]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        {!sidebarCollapsed && viewport !== 'mobile' && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </aside>

              <div className="flex-1 min-w-0 p-4 overflow-y-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262630] pb-3">
                  <div>
                    <div className="text-sm font-semibold">System Analytics</div>
                    <div className="text-[11px] text-[#9999A5]">
                      Auth: Verified (engineer) · Stream: Connected
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['24h', '7d', '30d'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTimeRange(r)}
                        className={`px-2 py-1 rounded text-[10px] font-mono border ${
                          timeRange === r
                            ? 'bg-[#18181F] border-[#8B7CFF] text-[#F4F4F7]'
                            : 'border-[#262630] text-[#9999A5]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`grid gap-2.5 ${
                    viewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-3'
                  }`}
                >
                  {[
                    {
                      label: 'Edge Requests',
                      val: timeRange === '24h' ? '1.84M' : timeRange === '7d' ? '12.6M' : '54.1M',
                      delta: '+14.2%',
                    },
                    {
                      label: 'P95 Latency',
                      val: timeRange === '24h' ? '36.2ms' : timeRange === '7d' ? '38.9ms' : '41.0ms',
                      delta: '-6.4ms',
                    },
                    {
                      label: 'Active Sessions',
                      val: timeRange === '24h' ? '1,495' : timeRange === '7d' ? '4,820' : '18,910',
                      delta: '+9.8%',
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="p-3 rounded-lg bg-[#121217] border border-[#262630]"
                    >
                      <div className="text-[10px] text-[#9999A5]">{kpi.label}</div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-base font-semibold tabular-nums">{kpi.val}</span>
                        <span className="text-[10px] font-mono text-[#36D399] tabular-nums">
                          {kpi.delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-[#121217] border border-[#262630]">
                  <div className="text-[10px] text-[#9999A5] mb-2">
                    Request Throughput ({timeRange} window)
                  </div>
                  <div className="h-24 flex items-end gap-1">
                    {bars.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#8B7CFF]/75 hover:bg-[#40D9FF] rounded-t transition-all"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
