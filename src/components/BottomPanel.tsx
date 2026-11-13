import React, { useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eraser,
  Info,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Terminal as TerminalIcon,
  X,
  XCircle,
} from 'lucide-react';
import type {
  IdeSettingsState,
  ProblemDiagnostic,
  TestSuiteItem,
} from '../data/mockWorkspace.ts';

export type BottomTab = 'terminal' | 'problems' | 'output' | 'debug' | 'tests';

export interface TerminalTabSession {
  id: string;
  title: string;
  lines: string[];
}

interface BottomPanelProps {
  activeTab: BottomTab;
  collapsed: boolean;
  maximized: boolean;
  height: number;
  settings: IdeSettingsState;
  onSelectTab: (tab: BottomTab) => void;
  onToggleCollapse: () => void;
  onToggleMaximize: () => void;
  onClosePanel: () => void;
  terminalTabs: TerminalTabSession[];
  activeTerminalId: string;
  onSelectTerminal: (id: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (id: string) => void;
  onRunTerminalCommand: (termId: string, cmd: string) => void;
  onClearTerminal: (termId: string) => void;
  problems: ProblemDiagnostic[];
  onJumpToProblem: (filePath: string, line: number) => void;
  outputLogs: string[];
  debugLogs: Array<{ id: string; expr: string; result: string; type: 'log' | 'eval' }>;
  onEvalDebugExpr: (expr: string) => void;
  testSuites: TestSuiteItem[];
  runningTests: boolean;
  onRunTests: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  collapsed,
  maximized,
  height,
  settings,
  onSelectTab,
  onToggleCollapse,
  onToggleMaximize,
  onClosePanel,
  terminalTabs,
  activeTerminalId,
  onSelectTerminal,
  onNewTerminal,
  onCloseTerminal,
  onRunTerminalCommand,
  onClearTerminal,
  problems,
  onJumpToProblem,
  outputLogs,
  debugLogs,
  onEvalDebugExpr,
  testSuites,
  runningTests,
  onRunTests,
}) => {
  const [cmdInput, setCmdInput] = useState('');
  const [debugInput, setDebugInput] = useState('');
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(
    () => new Set([testSuites[0]?.id || ''])
  );

  const activeTerminal =
    terminalTabs.find((t) => t.id === activeTerminalId) || terminalTabs[0];

  const totalPassed = testSuites.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = testSuites.reduce((acc, s) => acc + s.failed, 0);

  if (collapsed) return null;

  return (
    <section
      style={maximized ? undefined : { height }}
      className={`flex flex-col bg-[#101014] border-t border-[#262630] shrink-0 overflow-hidden ${
        maximized ? 'flex-1 min-h-0' : ''
      }`}
    >
      {/* Panel Tab Header */}
      <div className="h-9 px-3 bg-[#0C0C0F] border-b border-[#262630] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {([
            { id: 'terminal', label: 'Terminal' },
            { id: 'problems', label: `Problems (${problems.length})` },
            { id: 'output', label: 'Output' },
            { id: 'debug', label: 'Debug Console' },
            { id: 'tests', label: `Tests (${totalPassed}/${totalPassed + totalFailed})` },
          ] as Array<{ id: BottomTab; label: string }>).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                  active ? 'text-[#F4F4F7]' : 'text-[#9999A5] hover:text-[#F4F4F7]'
                }`}
              >
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-[#40D9FF] rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab === 'terminal' && (
            <>
              <button
                type="button"
                onClick={onNewTerminal}
                title="New Terminal"
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">New Terminal</span>
              </button>
              {activeTerminal && (
                <button
                  type="button"
                  onClick={() => onClearTerminal(activeTerminal.id)}
                  title="Clear Terminal"
                  className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </>
          )}

          {activeTab === 'tests' && (
            <button
              type="button"
              onClick={onRunTests}
              disabled={runningTests}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181F] hover:bg-[#22222C] border border-[#262630] text-[11px] text-[#36D399] disabled:opacity-50"
            >
              <Play className="w-3 h-3" strokeWidth={2} />
              <span>{runningTests ? 'Running…' : 'Run All'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMaximize}
            title={maximized ? 'Restore panel size' : 'Maximize panel'}
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
          >
            {maximized ? (
              <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title="Minimize panel"
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onClosePanel}
            title="Close panel (⌘J)"
            className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {activeTab === 'terminal' && (
          <div className="flex-1 min-w-0 flex flex-col bg-[#09090B]">
            {/* macOS-inspired Terminal Session Tabs */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0C0C0F] border-b border-[#262630]/80 overflow-x-auto shrink-0">
              {terminalTabs.map((t) => {
                const selected = t.id === activeTerminal?.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTerminal(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#18181F] text-[#F4F4F7] border border-[#262630]'
                        : 'text-[#666672] hover:text-[#F4F4F7] border border-transparent'
                    }`}
                  >
                    <TerminalIcon
                      className={`w-3 h-3 ${selected ? 'text-[#40D9FF]' : 'text-[#666672]'}`}
                      strokeWidth={1.75}
                    />
                    <span>{t.title}</span>
                    {terminalTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTerminal(t.id);
                        }}
                        className="hover:text-[#FB7185] ml-1"
                      >
                        <X className="w-2.5 h-2.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Output Stream */}
            <div
              style={{ fontSize: `${settings.terminalFontSize}px` }}
              className="flex-1 overflow-y-auto px-4 py-3 font-mono leading-6 space-y-0.5"
            >
              {activeTerminal?.lines.map((line, i) => {
                const tone = line.startsWith('$ ')
                  ? 'text-[#40D9FF] font-medium'
                  : line.includes('✓') ||
                    line.includes('passed') ||
                    line.includes('ready') ||
                    line.includes('built in')
                  ? 'text-[#36D399]'
                  : line.toLowerCase().includes('warn')
                  ? 'text-[#FBBF24]'
                  : line.includes('ERR') || line.includes('FAIL') || line.toLowerCase().includes('error')
                  ? 'text-[#FB7185]'
                  : line.startsWith('FORGE ') || line.includes('➜')
                  ? 'text-[#9999A5]'
                  : 'text-[#F4F4F7]/90';

                return (
                  <div key={i} className={tone}>
                    {line}
                  </div>
                );
              })}
            </div>

            {/* Command Prompt Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cmdInput.trim() || !activeTerminal) return;
                onRunTerminalCommand(activeTerminal.id, cmdInput.trim());
                setCmdInput('');
              }}
              className="px-4 py-2 border-t border-[#262630] bg-[#0C0C0F] flex items-center gap-2 font-mono text-xs shrink-0"
            >
              <span className="text-[#8B7CFF] font-semibold">❯</span>
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                placeholder="Run command (e.g. pnpm build, vitest, git status, help)…"
                className="flex-1 bg-transparent text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
              />
            </form>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {problems.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onJumpToProblem(p.filePath, p.line)}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-[#18181F] text-left text-xs transition-colors"
              >
                {p.severity === 'error' ? (
                  <XCircle className="w-3.5 h-3.5 text-[#FB7185] mt-0.5 shrink-0" strokeWidth={1.75} />
                ) : p.severity === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24] mt-0.5 shrink-0" strokeWidth={1.75} />
                ) : (
                  <Info className="w-3.5 h-3.5 text-[#40D9FF] mt-0.5 shrink-0" strokeWidth={1.75} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[#F4F4F7]">{p.message}</div>
                  <div className="text-[11px] font-mono text-[#666672] mt-0.5 tabular-nums">
                    {p.filePath}:{p.line}:{p.column} · {p.source} ({p.code})
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#09090B] font-mono text-[11.5px] leading-6 space-y-0.5">
            {outputLogs.map((log, i) => (
              <div key={i} className="text-[#9999A5]">
                {log}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="flex-1 flex flex-col bg-[#09090B]">
            <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs space-y-2">
              {debugLogs.map((entry) => (
                <div key={entry.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[#9999A5]">
                    <Bug className="w-3 h-3 text-[#8B7CFF]" strokeWidth={1.75} />
                    <span>&gt; {entry.expr}</span>
                  </div>
                  <div className="pl-4 text-[#40D9FF]">{entry.result}</div>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!debugInput.trim()) return;
                onEvalDebugExpr(debugInput.trim());
                setDebugInput('');
              }}
              className="px-4 py-2 border-t border-[#262630] bg-[#0C0C0F] flex items-center gap-2 font-mono text-xs"
            >
              <span className="text-[#40D9FF]">&gt;</span>
              <input
                type="text"
                value={debugInput}
                onChange={(e) => setDebugInput(e.target.value)}
                placeholder="Evaluate expression in debug scope…"
                className="flex-1 bg-transparent text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
              />
            </form>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {testSuites.map((suite) => {
              const expanded = expandedSuites.has(suite.id);
              return (
                <div
                  key={suite.id}
                  className="rounded-lg bg-[#121217] border border-[#262630] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSuites((prev) => {
                        const next = new Set(prev);
                        if (next.has(suite.id)) next.delete(suite.id);
                        else next.add(suite.id);
                        return next;
                      })
                    }
                    className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#18181F]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />
                      )}
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36D399] shrink-0" strokeWidth={1.75} />
                      <span className="font-mono text-[#F4F4F7] truncate">{suite.file}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#36D399] tabular-nums shrink-0 ml-2">
                      {suite.passed} passed · {suite.durationMs}ms
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-2.5 pt-1 border-t border-[#262630]/80 space-y-1">
                      {suite.cases.map((tc) => (
                        <div
                          key={tc.name}
                          className="flex items-center justify-between pl-6 text-[11px] text-[#9999A5]"
                        >
                          <span className="flex items-center gap-1.5 text-[#F4F4F7]/90">
                            <CheckCircle2 className="w-3 h-3 text-[#36D399]" strokeWidth={1.75} />
                            <span>{tc.name}</span>
                          </span>
                          <span className="font-mono tabular-nums text-[#666672]">
                            {tc.durationMs}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
