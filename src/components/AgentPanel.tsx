import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AtSign,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FileCode,
  FileEdit,
  FilePlus2,
  FlaskConical,
  GitCompare,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  Square,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ProviderConfigDTO, ProviderId } from '../shared/types.ts';
import type {
  AgentActivityCard,
  AgentMode,
  ShowcaseMessage,
  TimelineStageItem,
} from '../data/mockWorkspace.ts';
import { ModelPicker } from './ModelPicker.tsx';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { ForgeSegmentedControl, ForgeStatusDot, ForgeTooltip } from './ui/ForgePrimitives.tsx';

interface AttachedImageChip {
  id: string;
  name: string;
  previewUrl: string;
}

interface AgentPanelProps {
  messages: ShowcaseMessage[];
  activeMode: AgentMode;
  isStreaming: boolean;
  streamingDraft: string;
  activeTimeline: TimelineStageItem[];
  activeActivities: AgentActivityCard[];
  contextUsedTokens: number;
  maxContextTokens: number;
  providers: ProviderConfigDTO[];
  activeProvider: ProviderConfigDTO | undefined;
  workspaceFiles: string[];
  pendingDiffCount: number;
  onChangeMode: (mode: AgentMode) => void;
  onSelectModel: (provider: ProviderId, model: string) => Promise<void>;
  onOpenSettings: () => void;
  onNewConversation: () => void;
  onSendPrompt: (
    prompt: string,
    attachedFiles: string[],
    attachedImages: AttachedImageChip[]
  ) => void;
  onStopStreaming: () => void;
  onApplyCodeSnippet: (code: string) => void;
  onOpenDiffReview: () => void;
  onRateMessage?: (messageId: string, rating: 'good' | 'bad') => void;
}

const MODE_OPTIONS: Array<{ value: AgentMode; label: string }> = [
  { value: 'Build', label: 'Build' },
  { value: 'Plan', label: 'Plan' },
  { value: 'Debug', label: 'Debug' },
  { value: 'Review', label: 'Review' },
  { value: 'Explain', label: 'Explain' },
];

const SUGGESTED_PROMPTS = [
  'Add role-based route protection and session refresh handling to AuthGuard.tsx.',
  'Refactor AnalyticsGrid.tsx to include an error-rate sparkline and CSV export.',
  'Write unit tests for useMetricsStream covering reconnect backoff.',
  'Explain the data flow between analyticsApi.ts and DashboardOverview.tsx.',
];

function ActivityIcon({ category }: { category: AgentActivityCard['category'] }) {
  switch (category) {
    case 'read':
      return <FileCode className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />;
    case 'search':
      return <Search className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />;
    case 'create':
      return <FilePlus2 className="w-3.5 h-3.5 text-[#36D399]" strokeWidth={1.75} />;
    case 'edit':
      return <FileEdit className="w-3.5 h-3.5 text-[#FBBF24]" strokeWidth={1.75} />;
    case 'test':
      return <FlaskConical className="w-3.5 h-3.5 text-[#36D399]" strokeWidth={1.75} />;
    case 'inspect':
      return <Terminal className="w-3.5 h-3.5 text-[#9999A5]" strokeWidth={1.75} />;
  }
}

function getStatusBadge(status: AgentActivityCard['status']) {
  if (status === 'running') {
    return {
      icon: <Loader2 className="w-3 h-3 text-[#40D9FF] animate-spin" strokeWidth={2} />,
      label: 'Running',
      tone: 'text-[#40D9FF]',
    };
  }
  if (status === 'warning') {
    return {
      icon: <ShieldAlert className="w-3 h-3 text-[#FBBF24]" strokeWidth={1.75} />,
      label: 'Needs review',
      tone: 'text-[#FBBF24]',
    };
  }
  return {
    icon: <Check className="w-3 h-3 text-[#36D399]" strokeWidth={2} />,
    label: 'Completed',
    tone: 'text-[#36D399]',
  };
}

function ActivityRow({ item }: { item: AgentActivityCard }) {
  const [expanded, setExpanded] = useState(false);
  const st = getStatusBadge(item.status);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-2.5 py-1.5 rounded-md hover:bg-[#18181F] flex items-center justify-between gap-2 text-left transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
          ) : (
            <ChevronRight
              className="w-3 h-3 text-[#666672] group-hover:text-[#9999A5] shrink-0"
              strokeWidth={1.75}
            />
          )}
          <ActivityIcon category={item.category} />
          <span className="font-mono text-[11px] font-medium text-[#F4F4F7] shrink-0">
            {item.toolName}
          </span>
          <span className="font-mono text-[11px] text-[#9999A5] truncate">{item.target}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline font-mono text-[10px] text-[#666672] tabular-nums">
            {item.timestamp}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10.5px] ${st.tone}`}>
            {st.icon}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14 }}
            className="ml-7 mr-2 mb-2 mt-0.5 p-2.5 rounded-md bg-[#09090B] border border-[#262630] space-y-1.5 text-[11px] font-mono"
          >
            <div className="flex items-center justify-between text-[#666672] text-[10.5px]">
              <span>
                Status: <span className={st.tone}>{st.label}</span>
              </span>
              <span className="tabular-nums">{item.duration}</span>
            </div>
            <div className="text-[#40D9FF] overflow-x-auto">{item.argsPreview}</div>
            <div className="pt-1 border-t border-[#262630] text-[#9999A5] leading-relaxed">
              {item.outputPreview}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimelineBlock({
  stages,
  activities,
}: {
  stages?: TimelineStageItem[];
  activities?: AgentActivityCard[];
}) {
  if ((!stages || stages.length === 0) && (!activities || activities.length === 0)) {
    return null;
  }

  return (
    <div className="ml-1.5 pl-3.5 border-l border-[#262630] space-y-2.5 py-0.5">
      {stages && stages.length > 0 && (
        <div className="space-y-1">
          {stages.map((st) => (
            <div key={st.id} className="flex items-center justify-between gap-2 text-[11.5px]">
              <div className="flex items-center gap-2 min-w-0">
                {st.status === 'completed' ? (
                  <Check className="w-3.5 h-3.5 text-[#36D399] shrink-0" strokeWidth={2} />
                ) : st.status === 'active' ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#40D9FF] animate-spin shrink-0" strokeWidth={2} />
                ) : (
                  <Clock className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
                )}
                <span
                  className={
                    st.status === 'completed'
                      ? 'text-[#9999A5]'
                      : st.status === 'active'
                      ? 'text-[#F4F4F7] font-medium'
                      : 'text-[#666672]'
                  }
                >
                  {st.label}
                </span>
              </div>
              {st.detail && (
                <span className="font-mono text-[10.5px] text-[#8B7CFF] shrink-0">
                  {st.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activities && activities.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-[#262630]/60">
          {activities.map((act) => (
            <ActivityRow key={act.id} item={act} />
          ))}
        </div>
      )}
    </div>
  );
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  messages,
  activeMode,
  isStreaming,
  streamingDraft,
  activeTimeline,
  activeActivities,
  contextUsedTokens,
  maxContextTokens,
  providers,
  activeProvider,
  workspaceFiles,
  pendingDiffCount,
  onChangeMode,
  onSelectModel,
  onOpenSettings,
  onNewConversation,
  onSendPrompt,
  onStopStreaming,
  onApplyCodeSnippet,
  onOpenDiffReview,
  onRateMessage,
}) => {
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImageChip[]>([]);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const contextPct = Math.min(100, Math.round((contextUsedTokens / maxContextTokens) * 100));

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    return workspaceFiles.filter((f) => !q || f.toLowerCase().includes(q));
  }, [workspaceFiles, fileFilter]);

  const submitPrompt = () => {
    const text = prompt.trim();
    if (!text || isStreaming) return;
    onSendPrompt(text, attachedFiles, attachedImages);
    setPrompt('');
    setAttachedFiles([]);
    setAttachedImages([]);
    setFilePickerOpen(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachedImages((prev) => [
            ...prev,
            { id: `${Date.now()}-${file.name}`, name: file.name, previewUrl: reader.result as string },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  return (
    <aside className="h-full flex flex-col bg-[#0C0C0F] border-l border-[#262630] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#262630] bg-[#0C0C0F] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ForgeStatusDot tone={isStreaming ? 'running' : 'ready'} />
            <span className="text-xs font-semibold tracking-tight text-[#F4F4F7] whitespace-nowrap">
              FORGE AGENT
            </span>
            <ModelPicker
              providers={providers}
              activeProvider={activeProvider}
              disabled={isStreaming}
              placement="down"
              align="left"
              onSelectModel={onSelectModel}
              onOpenSettings={onOpenSettings}
            />
          </div>

          <ForgeTooltip label="New Conversation">
            <button
              type="button"
              onClick={onNewConversation}
              className="p-1.5 rounded-md bg-[#121217] hover:bg-[#18181F] border border-[#262630] text-[#9999A5] hover:text-[#F4F4F7] transition-colors shrink-0"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </ForgeTooltip>
        </div>

        {/* Segmented Mode Control */}
        <ForgeSegmentedControl
          options={MODE_OPTIONS}
          value={activeMode}
          onChange={onChangeMode}
        />

        {/* Context Usage Bar */}
        <div className="flex items-center justify-between gap-3 text-[10.5px] font-mono text-[#666672]">
          <span>Context</span>
          <div className="flex items-center gap-2 flex-1 max-w-[180px]">
            <div className="flex-1 h-1 rounded-full bg-[#18181F] overflow-hidden">
              <div
                className="h-full bg-[#8B7CFF] transition-all duration-300"
                style={{ width: `${contextPct}%` }}
              />
            </div>
            <span className="tabular-nums text-[#9999A5]">
              {(contextUsedTokens / 1000).toFixed(1)}k/{Math.round(maxContextTokens / 1000)}k
            </span>
          </div>
        </div>
      </div>

      {/* Engineering Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && !isStreaming ? (
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#F4F4F7]">
                {activeMode} Workspace Ready
              </div>
              <p className="text-xs text-[#9999A5] leading-relaxed">
                Describe an architectural change, bug investigation, or feature. FORGE inspects
                files, runs diagnostics, and stages diffs for review.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[#666672]">Suggested tasks</div>
              {SUGGESTED_PROMPTS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setPrompt(sp)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#121217] hover:bg-[#18181F] border border-[#262630] hover:border-[#8B7CFF]/45 text-xs text-[#F4F4F7]/90 transition-colors leading-relaxed"
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="space-y-3"
            >
              {msg.role === 'user' ? (
                <div className="px-3.5 py-2.5 rounded-lg bg-[#121217] border border-[#262630] space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-[#666672]">
                    <span className="text-[#8B7CFF]">{msg.mode || activeMode}</span>
                    <span className="tabular-nums">{msg.timestamp}</span>
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-[#F4F4F7]">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-[#666672]">
                    <span className="text-[#40D9FF]">
                      FORGE · {msg.model || activeProvider?.model || 'claude-sonnet-5-5'}
                    </span>
                    <span className="tabular-nums">{msg.timestamp}</span>
                  </div>

                  {/* Execution Timeline & Tool Operations (clean rail, not heavy boxes) */}
                  <TimelineBlock stages={msg.timeline} activities={msg.activities} />

                  {/* Engineering Response Prose */}
                  <div className="space-y-2.5 pt-0.5">
                    <MarkdownRenderer content={msg.content} onApplyCode={onApplyCodeSnippet} />

                    <div className="pt-2 border-t border-[#262630]/80 flex items-center justify-between gap-2">
                      {pendingDiffCount > 0 ? (
                        <button
                          type="button"
                          onClick={onOpenDiffReview}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#8B7CFF]/12 hover:bg-[#8B7CFF]/20 border border-[#8B7CFF]/40 text-[11px] font-medium text-[#F4F4F7] transition-colors"
                        >
                          <GitCompare className="w-3.5 h-3.5 text-[#8B7CFF]" strokeWidth={1.75} />
                          <span>Review {pendingDiffCount} Staged Diffs</span>
                        </button>
                      ) : (
                        <span className="text-[10.5px] font-mono text-[#666672]">Completed</span>
                      )}

                      {onRateMessage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onRateMessage(msg.id, 'good')}
                            className={`p-1 rounded hover:bg-[#18181F] transition-colors ${
                              msg.feedbackRating === 'good'
                                ? 'text-[#36D399]'
                                : 'text-[#666672] hover:text-[#9999A5]'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRateMessage(msg.id, 'bad')}
                            className={`p-1 rounded hover:bg-[#18181F] transition-colors ${
                              msg.feedbackRating === 'bad'
                                ? 'text-[#FB7185]'
                                : 'text-[#666672] hover:text-[#9999A5]'
                            }`}
                            title="Needs improvement"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}

        {/* Active Execution Stream */}
        {isStreaming && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10.5px] font-mono text-[#40D9FF]">
              <span>FORGE · Running {activeMode} workflow…</span>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            </div>

            <TimelineBlock stages={activeTimeline} activities={activeActivities} />

            {streamingDraft && (
              <div className="pt-1">
                <MarkdownRenderer content={streamingDraft} onApplyCode={onApplyCodeSnippet} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Command-Center Composer */}
      <div className="p-3 border-t border-[#262630] bg-[#0C0C0F] shrink-0 relative">
        <AnimatePresence>
          {filePickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
              className="absolute left-3 right-3 bottom-full mb-2 rounded-lg bg-[#121217] border border-[#262630] shadow-2xl overflow-hidden z-40"
            >
              <div className="p-2 border-b border-[#262630] flex items-center justify-between gap-2">
                <input
                  type="text"
                  autoFocus
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  placeholder="Attach @file context…"
                  className="flex-1 bg-transparent text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setFilePickerOpen(false)}
                  className="text-[#9999A5] hover:text-[#F4F4F7]"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto p-1">
                {filteredFiles.map((file) => {
                  const selected = attachedFiles.includes(file);
                  return (
                    <button
                      key={file}
                      type="button"
                      onClick={() => {
                        setAttachedFiles((prev) =>
                          selected ? prev.filter((f) => f !== file) : [...prev, file]
                        );
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-[11px] font-mono ${
                        selected
                          ? 'bg-[#8B7CFF]/15 text-[#F4F4F7]'
                          : 'text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]'
                      }`}
                    >
                      <span className="truncate">{file}</span>
                      {selected && (
                        <Check className="w-3 h-3 text-[#40D9FF] shrink-0" strokeWidth={2} />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-xl bg-[#121217] border border-[#262630] focus-within:border-[#8B7CFF] transition-colors p-3 space-y-2.5">
          {(attachedFiles.length > 0 || attachedImages.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {attachedFiles.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#18181F] border border-[#262630] text-[10.5px] font-mono text-[#40D9FF]"
                >
                  <span>@{file.split('/').pop()}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedFiles((prev) => prev.filter((f) => f !== file))
                    }
                    className="text-[#9999A5] hover:text-[#F4F4F7]"
                  >
                    <X className="w-2.5 h-2.5" strokeWidth={1.75} />
                  </button>
                </span>
              ))}
              {attachedImages.map((img) => (
                <span
                  key={img.id}
                  className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#18181F] border border-[#262630] text-[10.5px] text-[#F4F4F7]"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    className="w-4 h-4 rounded object-cover"
                  />
                  <span className="max-w-[90px] truncate">{img.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedImages((prev) => prev.filter((i) => i.id !== img.id))
                    }
                    className="text-[#9999A5] hover:text-[#F4F4F7]"
                  >
                    <X className="w-2.5 h-2.5" strokeWidth={1.75} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                submitPrompt();
              }
            }}
            placeholder="Describe what you want to build, debug, or refactor…"
            className="w-full resize-none bg-transparent text-[12.5px] text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none leading-relaxed"
          />

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262630]">
            <div className="flex items-center gap-0.5 min-w-0">
              <button
                type="button"
                onClick={() => setFilePickerOpen((o) => !o)}
                title="Attach workspace file"
                className="p-1.5 rounded-md text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Attach UI reference image"
                className="p-1.5 rounded-md text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => setFilePickerOpen((o) => !o)}
                title="Select @files context"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-[#9999A5] hover:text-[#40D9FF] hover:bg-[#18181F] transition-colors"
              >
                <AtSign className="w-3 h-3" strokeWidth={1.75} />
                <span>files</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="hidden sm:block">
                <ModelPicker
                  providers={providers}
                  activeProvider={activeProvider}
                  disabled={isStreaming}
                  placement="up"
                  align="right"
                  onSelectModel={onSelectModel}
                  onOpenSettings={onOpenSettings}
                />
              </div>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#FB7185]/18 hover:bg-[#FB7185]/28 border border-[#FB7185]/45 text-xs font-medium text-[#FB7185] transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" strokeWidth={1.75} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!prompt.trim()}
                  onClick={submitPrompt}
                  title="Send prompt (Cmd/Ctrl + Enter)"
                  className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold disabled:opacity-35 transition-all active:scale-[0.98]"
                >
                  <Send className="w-3 h-3" strokeWidth={2} />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
