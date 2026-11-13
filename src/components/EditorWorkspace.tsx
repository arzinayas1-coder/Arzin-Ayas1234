import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor, type OnMount } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';
import {
  Check,
  ChevronRight,
  Code2,
  FileCode2,
  GitCompare,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react';
import { detectMonacoLanguage, ensureMonacoConfigured } from '../lib/monacoSetup.ts';
import type { DiffChangeItem, IdeSettingsState } from '../data/mockWorkspace.ts';
import { ForgeDivider, ForgeTooltip } from './ui/ForgePrimitives.tsx';

ensureMonacoConfigured();

export interface OpenEditorTab {
  path: string;
  content: string;
  savedContent: string;
  targetLine?: number;
}

interface EditorWorkspaceProps {
  tabs: OpenEditorTab[];
  activeTabPath: string | null;
  diffMode: boolean;
  diffChanges: DiffChangeItem[];
  activeDiffId: string | null;
  settings: IdeSettingsState;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, content: string) => void;
  onSaveFile: (path: string) => void;
  onToggleDiffMode: (open?: boolean) => void;
  onSelectDiffItem: (id: string) => void;
  onAcceptDiff: (id: string) => void;
  onRejectDiff: (id: string) => void;
  onRevertDiff: (id: string) => void;
  onAcceptAllDiffs: () => void;
  onOpenCommandPalette: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  tabs,
  activeTabPath,
  diffMode,
  diffChanges,
  activeDiffId,
  settings,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSaveFile,
  onToggleDiffMode,
  onSelectDiffItem,
  onAcceptDiff,
  onRejectDiff,
  onRevertDiff,
  onAcceptAllDiffs,
  onOpenCommandPalette,
}) => {
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath) || null,
    [tabs, activeTabPath]
  );

  const activeDiff = useMemo(
    () => diffChanges.find((d) => d.id === activeDiffId) || diffChanges[0] || null,
    [diffChanges, activeDiffId]
  );

  const diffTotals = useMemo(() => {
    const additions = diffChanges.reduce((acc, d) => acc + d.additions, 0);
    const deletions = diffChanges.reduce((acc, d) => acc + d.deletions, 0);
    const pending = diffChanges.filter((d) => d.status === 'pending').length;
    return { additions, deletions, pending };
  }, [diffChanges]);

  useEffect(() => {
    if (activeTab?.targetLine && editorRef.current) {
      editorRef.current.revealLineInCenter(activeTab.targetLine);
      editorRef.current.setPosition({ lineNumber: activeTab.targetLine, column: 1 });
      editorRef.current.focus();
    }
  }, [activeTab?.path, activeTab?.targetLine]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((ev) => {
      setCursorPos({ line: ev.position.lineNumber, col: ev.position.column });
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTabPath) onSaveFile(activeTabPath);
    });
  };

  const breadcrumbs = activeTab ? activeTab.path.split('/') : [];
  const isActiveDirty = activeTab ? activeTab.content !== activeTab.savedContent : false;

  if (diffMode && activeDiff) {
    return (
      <div className="h-full flex flex-col bg-[#101014] overflow-hidden">
        {/* Git Diff Header */}
        <div className="px-4 py-2 bg-[#0C0C0F] border-b border-[#262630] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <GitCompare className="w-4 h-4 text-[#8B7CFF] shrink-0" strokeWidth={1.75} />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#F4F4F7]">Diff Review</span>
              <span className="text-[#666672]">·</span>
              <span className="text-[#9999A5]">{diffChanges.length} files changed</span>
              <span className="font-mono text-[#36D399] tabular-nums">
                +{diffTotals.additions}
              </span>
              <span className="font-mono text-[#FB7185] tabular-nums">
                -{diffTotals.deletions}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeDiff.status === 'pending' ? (
              <>
                <button
                  type="button"
                  onClick={() => onAcceptDiff(activeDiff.id)}
                  className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-[#36D399]/12 hover:bg-[#36D399]/20 border border-[#36D399]/40 text-xs font-medium text-[#36D399] transition-colors active:scale-[0.98]"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Accept</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRejectDiff(activeDiff.id)}
                  className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-[#FB7185]/12 hover:bg-[#FB7185]/20 border border-[#FB7185]/40 text-xs font-medium text-[#FB7185] transition-colors active:scale-[0.98]"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Reject</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onRevertDiff(activeDiff.id)}
                className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-[#18181F] hover:bg-[#22222B] border border-[#262630] text-xs font-medium text-[#FBBF24] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Revert to Pending</span>
              </button>
            )}

            {diffTotals.pending > 1 && (
              <button
                type="button"
                onClick={onAcceptAllDiffs}
                className="px-2.5 h-7 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold transition-colors active:scale-[0.98]"
              >
                Accept All
              </button>
            )}

            <ForgeDivider />

            <button
              type="button"
              onClick={() => onToggleDiffMode(false)}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-[#121217] hover:bg-[#18181F] border border-[#262630] text-xs text-[#F4F4F7] transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />
              <span>Code Editor</span>
            </button>
          </div>
        </div>

        {/* File Switcher Strip */}
        <div className="px-3 py-1.5 bg-[#09090B] border-b border-[#262630] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {diffChanges.map((d) => {
            const selected = d.id === activeDiff.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDiffItem(d.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-mono border whitespace-nowrap transition-colors ${
                  selected
                    ? 'bg-[#18181F] border-[#8B7CFF]/60 text-[#F4F4F7]'
                    : 'bg-[#121217] border-[#262630] text-[#9999A5] hover:text-[#F4F4F7]'
                }`}
              >
                <span>{d.filePath}</span>
                <span className="text-[#36D399] tabular-nums">+{d.additions}</span>
                <span className="text-[#FB7185] tabular-nums">-{d.deletions}</span>
                {d.status === 'accepted' && (
                  <Check className="w-3 h-3 text-[#36D399]" strokeWidth={2} />
                )}
                {d.status === 'rejected' && (
                  <X className="w-3 h-3 text-[#FB7185]" strokeWidth={2} />
                )}
              </button>
            );
          })}
        </div>

        {/* File Change Summary */}
        <div className="px-4 py-1.5 bg-[#121217] border-b border-[#262630] flex items-center justify-between text-[11.5px] text-[#9999A5] shrink-0">
          <span className="truncate">{activeDiff.summary}</span>
          <span className="font-mono text-[10.5px] text-[#666672] shrink-0 ml-3">
            {activeDiff.filePath}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          <DiffEditor
            height="100%"
            theme={settings.theme}
            language={detectMonacoLanguage(activeDiff.filePath)}
            original={activeDiff.original}
            modified={activeDiff.modified}
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * 1.54),
              fontFamily: 'JetBrains Mono, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#101014] overflow-hidden">
      {/* Tab Bar */}
      <div className="h-9 bg-[#0C0C0F] border-b border-[#262630] flex items-center justify-between shrink-0">
        <div className="flex items-center h-full overflow-x-auto min-w-0">
          {tabs.map((tab) => {
            const active = tab.path === activeTabPath;
            const dirty = tab.content !== tab.savedContent;
            const fileName = tab.path.split('/').pop() || tab.path;
            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                className={`group relative h-full flex items-center gap-2 px-3.5 border-r border-[#262630] cursor-pointer text-xs whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#101014] text-[#F4F4F7]'
                    : 'bg-[#0C0C0F] text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#121217]'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-0 right-0 h-[2px] bg-[#40D9FF]" />
                )}
                <FileCode2
                  className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#40D9FF]' : 'text-[#666672]'}`}
                  strokeWidth={1.75}
                />
                <span className="font-mono text-[11.5px]">{fileName}</span>
                {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF]" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className="p-0.5 rounded opacity-55 group-hover:opacity-100 hover:bg-[#18181F]"
                  title="Close tab"
                >
                  <X className="w-3 h-3" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Organized Editor Toolbar */}
        <div className="flex items-center gap-1.5 px-2.5 shrink-0">
          {activeTab && (
            <>
              <button
                type="button"
                onClick={() => onSaveFile(activeTab.path)}
                title="Save File (Cmd/Ctrl+S)"
                className={`flex items-center gap-1.5 px-2 h-6 rounded text-[11px] font-medium transition-colors ${
                  isActiveDirty
                    ? 'bg-[#40D9FF]/12 text-[#40D9FF] border border-[#40D9FF]/40'
                    : 'text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]'
                }`}
              >
                <Save className="w-3 h-3" strokeWidth={1.75} />
                <span className="hidden sm:inline">{isActiveDirty ? 'Save*' : 'Saved'}</span>
              </button>

              <ForgeTooltip label="Find & Replace" shortcut="⌘F">
                <button
                  type="button"
                  onClick={() => editorRef.current?.getAction('actions.find')?.run()}
                  className="p-1.5 rounded text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </ForgeTooltip>
            </>
          )}

          {diffChanges.length > 0 && (
            <>
              <ForgeDivider />
              <button
                type="button"
                onClick={() => onToggleDiffMode(true)}
                className="flex items-center gap-1.5 px-2.5 h-6 rounded bg-[#18181F] hover:bg-[#22222C] border border-[#262630] text-[11px] font-medium text-[#F4F4F7] whitespace-nowrap transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />
                <span className="hidden md:inline">Review Diff</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Breadcrumbs + Cursor Status */}
      {activeTab && (
        <div className="h-7 px-3.5 bg-[#101014] border-b border-[#262630] flex items-center justify-between text-[11px] text-[#666672] shrink-0">
          <div className="flex items-center gap-1 font-mono truncate">
            {breadcrumbs.map((seg, idx) => (
              <React.Fragment key={`${seg}-${idx}`}>
                {idx > 0 && <ChevronRight className="w-3 h-3 shrink-0" strokeWidth={1.75} />}
                <span
                  className={
                    idx === breadcrumbs.length - 1 ? 'text-[#9999A5]' : 'text-[#666672]'
                  }
                >
                  {seg}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] text-[#666672] tabular-nums shrink-0">
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="hidden sm:inline">
              {detectMonacoLanguage(activeTab.path).toUpperCase()}
            </span>
            <span className="hidden sm:inline">UTF-8</span>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        {activeTab ? (
          <Editor
            height="100%"
            theme={settings.theme}
            path={activeTab.path}
            language={detectMonacoLanguage(activeTab.path)}
            value={activeTab.content}
            onMount={handleEditorMount}
            onChange={(val) => onChangeContent(activeTab.path, val ?? '')}
            options={{
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * 1.54),
              letterSpacing: 0.15,
              fontFamily: 'JetBrains Mono, monospace',
              fontLigatures: true,
              tabSize: settings.tabSize,
              minimap: { enabled: settings.minimap, scale: 1, showSlider: 'mouseover' },
              wordWrap: settings.wordWrap ? 'on' : 'off',
              lineNumbers: settings.lineNumbers ? 'on' : 'off',
              guides: { indentation: settings.indentGuides, highlightActiveIndentation: true },
              bracketPairColorization: { enabled: true },
              folding: true,
              foldingHighlight: true,
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorWidth: 2,
              padding: { top: 14, bottom: 14 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Code2 className="w-8 h-8 text-[#666672]" strokeWidth={1.5} />
            <div className="text-sm font-medium text-[#F4F4F7]">No active buffer</div>
            <p className="text-xs text-[#9999A5] max-w-xs">
              Select a file in the Explorer or use the Command Palette to jump directly to a module.
            </p>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="px-3 py-1.5 rounded-md bg-[#18181F] hover:bg-[#22222B] border border-[#262630] text-xs text-[#F4F4F7]"
            >
              Open Command Palette (⌘K)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
