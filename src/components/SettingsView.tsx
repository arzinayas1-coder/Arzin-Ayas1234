import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Code2,
  Cpu,
  Eye,
  Keyboard,
  Loader2,
  RefreshCw,
  Shield,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ProviderConfigDTO, ProviderId, ProviderModelDTO } from '../shared/types.ts';
import type { AgentMode, IdeSettingsState } from '../data/mockWorkspace.ts';
import { api } from '../lib/api.ts';

export type SettingsSection =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'models'
  | 'agent'
  | 'shortcuts'
  | 'terminal'
  | 'privacy';

interface SettingsViewProps {
  open: boolean;
  initialSection?: SettingsSection;
  settings: IdeSettingsState;
  providers: ProviderConfigDTO[];
  onClose: () => void;
  onChangeSettings: (patch: Partial<IdeSettingsState>) => void;
  onResetSettings: () => void;
  onSelectModel: (provider: ProviderId, model: string) => Promise<void>;
}

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'appearance', label: 'Appearance', icon: Eye },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'models', label: 'AI models', icon: Cpu },
  { id: 'agent', label: 'Agent behavior', icon: Bot },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'privacy', label: 'Privacy', icon: Shield },
];

const SHORTCUTS_LIST = [
  { keys: '⌘ K', action: 'Open Command Palette (files, commands, projects)' },
  { keys: '⌘ B', action: 'Toggle Left File Explorer' },
  { keys: '⌘ J', action: 'Toggle Bottom Terminal & Diagnostics' },
  { keys: '⌘ I', action: 'Toggle Autonomous AI Agent Panel' },
  { keys: '⌘ S', action: 'Save Active Editor Tab' },
  { keys: '⌘ F', action: 'Find & Replace in Active File' },
  { keys: '⌘ ,', action: 'Open IDE Settings & Model Catalog' },
  { keys: '⌘ ↵', action: 'Submit Prompt to FORGE Agent' },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#262630]/80 last:border-b-0">
      <div className="min-w-0">
        <div className="text-xs font-medium text-[#F4F4F7]">{label}</div>
        <div className="text-[11px] text-[#9999A5] mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 border ${
          checked
            ? 'bg-[#8B7CFF] border-[#8B7CFF]'
            : 'bg-[#09090B] border-[#262630]'
        }`}
      >
        <span
          className={`block w-3.5 h-3.5 rounded-full bg-[#F4F4F7] transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  open,
  initialSection = 'models',
  settings,
  providers,
  onClose,
  onChangeSettings,
  onResetSettings,
  onSelectModel,
}) => {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderId, ProviderModelDTO[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');

  useEffect(() => {
    if (open) {
      setSection(initialSection);
    }
  }, [open, initialSection]);

  const freeProviders = useMemo(
    () =>
      providers.filter(
        (p) => p.hasApiKey && p.provider !== 'openai' && p.provider !== 'anthropic'
      ),
    [providers]
  );

  const loadModels = async () => {
    if (freeProviders.length === 0) return;
    setLoadingModels(true);
    try {
      const results = await Promise.allSettled(
        freeProviders.map((p) => api.providers.models(p.provider))
      );
      const next: Partial<Record<ProviderId, ProviderModelDTO[]>> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.provider] = r.value.models;
        }
      }
      setModelsByProvider((prev) => ({ ...prev, ...next }));
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (open && section === 'models' && Object.keys(modelsByProvider).length === 0) {
      void loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleModelPick = async (providerId: ProviderId, modelId: string) => {
    setSwitchingKey(`${providerId}:${modelId}`);
    try {
      await onSelectModel(providerId, modelId);
    } finally {
      setSwitchingKey(null);
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 8 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl h-[82vh] max-h-[680px] rounded-xl bg-[#101014] border border-[#262630] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-12 px-5 bg-[#0C0C0F] border-b border-[#262630] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-[#8B7CFF]" strokeWidth={1.75} />
                <span className="text-sm font-semibold text-[#F4F4F7]">FORGE IDE Preferences</span>
                <span className="text-[11px] font-mono text-[#666672] hidden sm:inline">
                  · Workspace & Free Model Catalog
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
              <nav className="sm:w-52 shrink-0 bg-[#0C0C0F] border-b sm:border-b-0 sm:border-r border-[#262630] p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto">
                {SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#18181F] text-[#F4F4F7] border border-[#262630]'
                          : 'text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#121217] border border-transparent'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#8B7CFF]' : ''}`}
                        strokeWidth={1.75}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-6 space-y-6">
                {section === 'general' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">General Workspace</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Configure workspace identity and file persistence rules.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-[#121217] border border-[#262630] space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                          Workspace Display Name
                        </label>
                        <input
                          type="text"
                          value={settings.workspaceName}
                          onChange={(e) => onChangeSettings({ workspaceName: e.target.value })}
                          className="w-full max-w-sm px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs font-mono text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                          Auto Save Strategy
                        </label>
                        <select
                          value={settings.autoSave}
                          onChange={(e) =>
                            onChangeSettings({
                              autoSave: e.target.value as IdeSettingsState['autoSave'],
                            })
                          }
                          className="w-full max-w-sm px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                        >
                          <option value="afterDelay">After Delay (800ms)</option>
                          <option value="onFocusChange">On Focus Change</option>
                          <option value="off">Manual Save Only (⌘S)</option>
                        </select>
                      </div>

                      <div className="pt-2 border-t border-[#262630] flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-[#F4F4F7]">
                            Restore Default Settings
                          </div>
                          <div className="text-[11px] text-[#9999A5]">
                            Reset typography, layout, and agent preferences.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onResetSettings}
                          className="px-3 py-1.5 rounded-md bg-[#18181F] hover:bg-[#22222B] border border-[#262630] text-xs text-[#F4F4F7]"
                        >
                          Reset Defaults
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {section === 'appearance' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">Appearance & Surfaces</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Customize obsidian theme variants and panel density.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        {
                          id: 'forge-obsidian',
                          name: 'Forge Obsidian',
                          desc: 'Deep #09090B canvas with #8B7CFF violet accents',
                          bg: '#101014',
                          accent: '#8B7CFF',
                        },
                        {
                          id: 'forge-midnight',
                          name: 'Forge Midnight',
                          desc: 'Cool slate-black #0B0D12 surface with cyan highlights',
                          bg: '#0B0D12',
                          accent: '#40D9FF',
                        },
                      ] as const).map((themeOption) => {
                        const active = settings.theme === themeOption.id;
                        return (
                          <button
                            key={themeOption.id}
                            type="button"
                            onClick={() => onChangeSettings({ theme: themeOption.id })}
                            className={`p-3.5 rounded-lg border text-left transition-colors ${
                              active
                                ? 'bg-[#18181F] border-[#8B7CFF]'
                                : 'bg-[#121217] border-[#262630] hover:border-[#666672]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-[#F4F4F7]">
                                {themeOption.name}
                              </span>
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: themeOption.accent }}
                              />
                            </div>
                            <div
                              className="h-8 rounded border border-[#262630] mb-2 flex items-center px-2 gap-1.5"
                              style={{ backgroundColor: themeOption.bg }}
                            >
                              <span className="w-8 h-1.5 rounded bg-[#8B7CFF]/70" />
                              <span className="w-12 h-1.5 rounded bg-[#40D9FF]/60" />
                            </div>
                            <div className="text-[11px] text-[#9999A5]">{themeOption.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-4 rounded-lg bg-[#121217] border border-[#262630]">
                      <ToggleRow
                        label="Compact File Tree Density"
                        description="Tighten vertical spacing in the explorer and diagnostics tables."
                        checked={settings.compactDensity}
                        onChange={(compactDensity) => onChangeSettings({ compactDensity })}
                      />
                    </div>
                  </div>
                )}

                {section === 'editor' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">Monaco Code Editor</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Controls apply immediately to all open code and diff buffers.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-[#121217] border border-[#262630] space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center justify-between text-xs font-medium text-[#F4F4F7] mb-1.5">
                            <span>Editor Font Size</span>
                            <span className="font-mono text-[#40D9FF] tabular-nums">
                              {settings.fontSize}px
                            </span>
                          </label>
                          <input
                            type="range"
                            min={11}
                            max={18}
                            value={settings.fontSize}
                            onChange={(e) =>
                              onChangeSettings({ fontSize: Number(e.target.value) })
                            }
                            className="w-full accent-[#8B7CFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                            Indentation Tab Size
                          </label>
                          <div className="flex gap-2">
                            {[2, 4].map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => onChangeSettings({ tabSize: size })}
                                className={`flex-1 py-1.5 rounded-md text-xs font-mono border ${
                                  settings.tabSize === size
                                    ? 'bg-[#8B7CFF]/15 border-[#8B7CFF] text-[#F4F4F7]'
                                    : 'bg-[#09090B] border-[#262630] text-[#9999A5]'
                                }`}
                              >
                                {size} spaces
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#262630]">
                        <ToggleRow
                          label="Show Minimap"
                          description="Render high-level code overview on the right gutter."
                          checked={settings.minimap}
                          onChange={(minimap) => onChangeSettings({ minimap })}
                        />
                        <ToggleRow
                          label="Word Wrap"
                          description="Wrap long lines at the viewport boundary."
                          checked={settings.wordWrap}
                          onChange={(wordWrap) => onChangeSettings({ wordWrap })}
                        />
                        <ToggleRow
                          label="Line Numbers"
                          description="Display gutter line numbers and current-line highlight."
                          checked={settings.lineNumbers}
                          onChange={(lineNumbers) => onChangeSettings({ lineNumbers })}
                        />
                        <ToggleRow
                          label="Indentation Guides"
                          description="Render vertical scope alignment guides inside blocks."
                          checked={settings.indentGuides}
                          onChange={(indentGuides) => onChangeSettings({ indentGuides })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {section === 'models' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-[#F4F4F7]">
                          Free AI Model Catalog
                        </h2>
                        <p className="text-xs text-[#9999A5] mt-0.5">
                          Only free-tier models across your server-vault providers are listed.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadModels()}
                        disabled={loadingModels}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#18181F] hover:bg-[#22222B] border border-[#262630] text-xs text-[#F4F4F7] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-[#40D9FF] ${
                            loadingModels ? 'animate-spin' : ''
                          }`}
                          strokeWidth={1.75}
                        />
                        <span>Refresh Catalog</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Filter free models by name or provider…"
                      className="w-full px-3 py-2 rounded-md bg-[#09090B] border border-[#262630] text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none focus:border-[#40D9FF]"
                    />

                    {freeProviders.length === 0 ? (
                      <div className="p-6 rounded-lg bg-[#121217] border border-[#262630] text-xs text-[#9999A5] text-center">
                        Provider vault is syncing with backend. Use the quick Model Picker in the
                        Agent header once connected.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {freeProviders.map((prov) => {
                          const catalog =
                            modelsByProvider[prov.provider] &&
                            modelsByProvider[prov.provider]!.length > 0
                              ? modelsByProvider[prov.provider]!
                              : prov.availableModels.map((id) => ({
                                  id,
                                  displayName: id,
                                  contextLength: 128000,
                                  supportsTools: true,
                                  isFree: true,
                                }));

                          const filtered = catalog.filter((m) => {
                            const q = modelSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              m.id.toLowerCase().includes(q) ||
                              m.displayName.toLowerCase().includes(q) ||
                              prov.label.toLowerCase().includes(q)
                            );
                          });

                          if (filtered.length === 0) return null;

                          return (
                            <div
                              key={prov.provider}
                              className="rounded-lg bg-[#121217] border border-[#262630] overflow-hidden"
                            >
                              <div className="px-3.5 py-2 bg-[#0C0C0F] border-b border-[#262630] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-[#F4F4F7]">
                                    {prov.label}
                                  </span>
                                  {prov.isActive && (
                                    <span className="text-[10.5px] font-mono text-[#36D399]">
                                      · Active
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-[#666672] tabular-nums">
                                  {filtered.length} free
                                </span>
                              </div>

                              <div className="divide-y divide-[#262630]/60 max-h-56 overflow-y-auto">
                                {filtered.map((m) => {
                                  const isSelected = prov.isActive && prov.model === m.id;
                                  const busy = switchingKey === `${prov.provider}:${m.id}`;
                                  return (
                                    <button
                                      key={`${prov.provider}-${m.id}`}
                                      type="button"
                                      onClick={() => void handleModelPick(prov.provider, m.id)}
                                      className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors ${
                                        isSelected
                                          ? 'bg-[#18181F] text-[#F4F4F7]'
                                          : 'hover:bg-[#18181F]/60 text-[#F4F4F7]/85'
                                      }`}
                                    >
                                      <div className="min-w-0 pr-3">
                                        <div className="font-mono text-[11px] truncate">{m.id}</div>
                                        <div className="text-[10px] text-[#666672] truncate tabular-nums">
                                          {Math.round(m.contextLength / 1000)}k context
                                          {m.supportsTools ? ' · function calling' : ''}
                                          {' · Free tier'}
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        {busy ? (
                                          <Loader2
                                            className="w-3.5 h-3.5 text-[#40D9FF] animate-spin"
                                            strokeWidth={2}
                                          />
                                        ) : isSelected ? (
                                          <Check
                                            className="w-3.5 h-3.5 text-[#40D9FF]"
                                            strokeWidth={2}
                                          />
                                        ) : (
                                          <span className="text-[11px] text-[#9999A5]">Select</span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {section === 'agent' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">
                        Autonomous Agent Behavior
                      </h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Configure execution cadence, context budget, and diff approval defaults.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-[#121217] border border-[#262630] space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                          Default Agent Mode
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(['Build', 'Plan', 'Debug', 'Review', 'Explain'] as AgentMode[]).map(
                            (mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => onChangeSettings({ agentModeDefault: mode })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  settings.agentModeDefault === mode
                                    ? 'bg-[#18181F] border-[#8B7CFF] text-[#F4F4F7]'
                                    : 'bg-[#09090B] border-[#262630] text-[#9999A5] hover:text-[#F4F4F7]'
                                }`}
                              >
                                {mode}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                            Response Streaming Pace
                          </label>
                          <select
                            value={settings.streamSpeed}
                            onChange={(e) =>
                              onChangeSettings({
                                streamSpeed: e.target.value as IdeSettingsState['streamSpeed'],
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                          >
                            <option value="natural">Natural (token cadence)</option>
                            <option value="fast">Fast</option>
                            <option value="instant">Instant</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                            Context Token Budget
                          </label>
                          <select
                            value={settings.maxContextTokens}
                            onChange={(e) =>
                              onChangeSettings({ maxContextTokens: Number(e.target.value) })
                            }
                            className="w-full px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs font-mono text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                          >
                            <option value={32000}>32,000 tokens</option>
                            <option value={64000}>64,000 tokens</option>
                            <option value={128000}>128,000 tokens</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#262630]">
                        <ToggleRow
                          label="Auto-approve non-breaking single-file diffs"
                          description="Bypass manual review only when fewer than 5 lines change."
                          checked={settings.autoApproveSmallDiffs}
                          onChange={(autoApproveSmallDiffs) =>
                            onChangeSettings({ autoApproveSmallDiffs })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {section === 'shortcuts' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">Keyboard Shortcuts</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Global navigation and editing bindings across FORGE AI.
                      </p>
                    </div>

                    <div className="rounded-lg bg-[#121217] border border-[#262630] divide-y divide-[#262630]/80">
                      {SHORTCUTS_LIST.map((sc) => (
                        <div
                          key={sc.keys}
                          className="flex items-center justify-between px-4 py-2.5 text-xs"
                        >
                          <span className="text-[#F4F4F7]">{sc.action}</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#09090B] border border-[#262630] font-mono text-[11px] text-[#40D9FF]">
                            {sc.keys}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section === 'terminal' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">Integrated Terminal</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Shell defaults and font rendering in the bottom diagnostics pane.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-[#121217] border border-[#262630] space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center justify-between text-xs font-medium text-[#F4F4F7] mb-1.5">
                            <span>Terminal Font Size</span>
                            <span className="font-mono text-[#40D9FF] tabular-nums">
                              {settings.terminalFontSize}px
                            </span>
                          </label>
                          <input
                            type="range"
                            min={11}
                            max={16}
                            value={settings.terminalFontSize}
                            onChange={(e) =>
                              onChangeSettings({ terminalFontSize: Number(e.target.value) })
                            }
                            className="w-full accent-[#40D9FF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                            Default Shell Profile
                          </label>
                          <select
                            value={settings.shellPath}
                            onChange={(e) => onChangeSettings({ shellPath: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs font-mono text-[#F4F4F7] focus:outline-none focus:border-[#40D9FF]"
                          >
                            <option value="/bin/zsh">/bin/zsh</option>
                            <option value="/bin/bash">/bin/bash</option>
                            <option value="/usr/bin/fish">/usr/bin/fish</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#262630]">
                        <ToggleRow
                          label="Blinking Terminal Cursor"
                          description="Animate active prompt caret in terminal sessions."
                          checked={settings.terminalCursorBlink}
                          onChange={(terminalCursorBlink) =>
                            onChangeSettings({ terminalCursorBlink })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {section === 'privacy' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F4F4F7]">Privacy & Security</h2>
                      <p className="text-xs text-[#9999A5] mt-0.5">
                        Control secret redaction and local session retention.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-[#121217] border border-[#262630] space-y-4">
                      <ToggleRow
                        label="Redact .env Secrets from Context"
                        description="Strip API keys and private tokens before indexing files for agent context."
                        checked={settings.redactEnvSecrets}
                        onChange={(redactEnvSecrets) => onChangeSettings({ redactEnvSecrets })}
                      />
                      <ToggleRow
                        label="Share Anonymous Crash Diagnostics"
                        description="Send sanitized stack traces to help improve editor stability."
                        checked={settings.telemetryEnabled}
                        onChange={(telemetryEnabled) => onChangeSettings({ telemetryEnabled })}
                      />

                      <div className="pt-2">
                        <label className="block text-xs font-medium text-[#F4F4F7] mb-1.5">
                          Local Agent History Retention
                        </label>
                        <select
                          value={settings.localHistoryRetentionDays}
                          onChange={(e) =>
                            onChangeSettings({
                              localHistoryRetentionDays: Number(e.target.value),
                            })
                          }
                          className="w-full max-w-xs px-3 py-1.5 rounded-md bg-[#09090B] border border-[#262630] text-xs text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                        >
                          <option value={7}>7 days</option>
                          <option value={14}>14 days</option>
                          <option value={30}>30 days</option>
                          <option value={90}>90 days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
