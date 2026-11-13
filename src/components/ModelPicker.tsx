import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Cpu, Loader2, RefreshCw, Search, Sliders } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ProviderConfigDTO, ProviderId, ProviderModelDTO } from '../shared/types.ts';
import { api } from '../lib/api.ts';

interface ModelPickerProps {
  providers: ProviderConfigDTO[];
  activeProvider: ProviderConfigDTO | undefined;
  disabled?: boolean;
  placement?: 'up' | 'down';
  align?: 'left' | 'right';
  onSelectModel: (provider: ProviderId, model: string) => Promise<void>;
  onOpenSettings?: () => void;
}

const FALLBACK_FREE_PROVIDERS: ProviderConfigDTO[] = [
  {
    provider: 'coarena',
    label: 'Coarena (Free API)',
    baseUrl: 'https://coarena.ai/api/v1',
    model: 'claude-sonnet-5-5',
    availableModels: ['claude-sonnet-5-5', 'claude-opus-4-6', 'gpt-5.2', 'gemini-3-pro'],
    hasApiKey: true,
    managedServerSide: true,
    temperature: 0.2,
    maxOutputTokens: 8192,
    maxContextFiles: 12,
    isActive: true,
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter (Free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    availableModels: ['openrouter/free', 'qwen/qwen3-coder:free', 'deepseek/deepseek-r1:free'],
    hasApiKey: true,
    managedServerSide: true,
    temperature: 0.2,
    maxOutputTokens: 8192,
    maxContextFiles: 12,
    isActive: false,
  },
  {
    provider: 'groq',
    label: 'Groq (Free Tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    availableModels: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    hasApiKey: true,
    managedServerSide: true,
    temperature: 0.2,
    maxOutputTokens: 8192,
    maxContextFiles: 12,
    isActive: false,
  },
  {
    provider: 'gemini',
    label: 'Google Gemini (Free Tier)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3.1-flash-lite',
    availableModels: ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
    hasApiKey: true,
    managedServerSide: true,
    temperature: 0.2,
    maxOutputTokens: 8192,
    maxContextFiles: 12,
    isActive: false,
  },
];

export const ModelPicker: React.FC<ModelPickerProps> = ({
  providers,
  activeProvider,
  disabled = false,
  placement = 'up',
  align = 'left',
  onSelectModel,
  onOpenSettings,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderId, ProviderModelDTO[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const configuredFreeProviders = useMemo(() => {
    const liveFree = providers.filter(
      (p) => p.hasApiKey && p.provider !== 'openai' && p.provider !== 'anthropic'
    );
    return liveFree.length > 0 ? liveFree : FALLBACK_FREE_PROVIDERS;
  }, [providers]);

  const resolvedActive =
    activeProvider || configuredFreeProviders.find((p) => p.isActive) || configuredFreeProviders[0];

  const loadAllFreeModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const results = await Promise.allSettled(
        configuredFreeProviders.map((p) => api.providers.models(p.provider))
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
  }, [configuredFreeProviders]);

  useEffect(() => {
    if (!open) return;
    if (Object.keys(modelsByProvider).length === 0) {
      void loadAllFreeModels();
    }
    setTimeout(() => inputRef.current?.focus(), 20);

    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, modelsByProvider, loadAllFreeModels]);

  const groupedProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...configuredFreeProviders].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return 0;
    });

    return sorted
      .map((p) => {
        const liveList = modelsByProvider[p.provider];
        const entries: ProviderModelDTO[] =
          liveList && liveList.length > 0
            ? liveList
            : p.availableModels.map((id) => ({
                id,
                displayName: id,
                contextLength: 128000,
                supportsTools: true,
                isFree: true,
              }));

        const filtered = entries.filter((m) => {
          if (!q) return true;
          return (
            m.id.toLowerCase().includes(q) ||
            m.displayName.toLowerCase().includes(q) ||
            p.label.toLowerCase().includes(q) ||
            p.provider.toLowerCase().includes(q)
          );
        });

        return { provider: p, models: filtered };
      })
      .filter((g) => g.models.length > 0);
  }, [configuredFreeProviders, modelsByProvider, query]);

  const handlePick = async (providerId: ProviderId, modelId: string) => {
    const key = `${providerId}:${modelId}`;
    setSwitchingKey(key);
    try {
      await onSelectModel(providerId, modelId);
      setOpen(false);
      setQuery('');
    } finally {
      setSwitchingKey(null);
    }
  };

  const currentModelLabel = resolvedActive?.model || 'claude-sonnet-5-5';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={`Switch free model (${resolvedActive?.label || 'Coarena'}: ${currentModelLabel})`}
        className="flex items-center gap-1.5 px-2 h-6 rounded-md bg-[#121217] hover:bg-[#18181F] border border-[#262630] text-[11px] font-mono text-[#F4F4F7] transition-colors disabled:opacity-45 whitespace-nowrap max-w-[180px]"
      >
        <Cpu className="w-3 h-3 text-[#40D9FF] shrink-0" strokeWidth={1.75} />
        <span className="truncate">{currentModelLabel}</span>
        {placement === 'up' ? (
          <ChevronUp className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
        ) : (
          <ChevronDown className="w-3 h-3 text-[#666672] shrink-0" strokeWidth={1.75} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: placement === 'up' ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'up' ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={`absolute z-50 w-[320px] sm:w-[350px] rounded-xl bg-[#121217] border border-[#262630] shadow-2xl overflow-hidden flex flex-col ${
              placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            } ${align === 'right' ? 'right-0' : 'left-0'}`}
          >
            <div className="p-2 border-b border-[#262630] bg-[#0C0C0F] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#666672] ml-1 shrink-0" strokeWidth={1.75} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter free models across providers…"
                className="flex-1 bg-transparent text-xs text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none py-1"
              />
              <button
                type="button"
                onClick={() => void loadAllFreeModels()}
                disabled={loadingModels}
                title="Refresh live free models"
                className="p-1 rounded hover:bg-[#18181F] text-[#9999A5] hover:text-[#40D9FF] disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                />
              </button>
            </div>

            <div className="px-3 py-1.5 bg-[#09090B] border-b border-[#262630] flex items-center justify-between text-[10.5px] text-[#9999A5]">
              <span>Free-tier models only</span>
              <span className="font-mono text-[#36D399] tabular-nums">
                {configuredFreeProviders.length} active providers
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5 space-y-2.5">
              {groupedProviders.length === 0 && (
                <div className="py-6 text-center text-xs text-[#666672]">
                  No matching free models found.
                </div>
              )}

              {groupedProviders.map(({ provider: p, models }) => (
                <div key={p.provider} className="space-y-0.5">
                  <div className="px-2 py-1 flex items-center justify-between text-[10.5px] font-medium text-[#9999A5]">
                    <span className="truncate">{p.label}</span>
                    <span className="font-mono text-[#666672] tabular-nums">
                      {models.length} free
                    </span>
                  </div>

                  {models.map((m) => {
                    const isSelected = p.isActive && p.model === m.id;
                    const busy = switchingKey === `${p.provider}:${m.id}`;

                    return (
                      <button
                        key={`${p.provider}-${m.id}`}
                        type="button"
                        onClick={() => void handlePick(p.provider, m.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-[#18181F] text-[#F4F4F7] border border-[#8B7CFF]/45'
                            : 'text-[#9999A5] hover:bg-[#18181F]/70 hover:text-[#F4F4F7] border border-transparent'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-mono text-[11px] text-[#F4F4F7] truncate">
                            {m.id}
                          </div>
                          <div className="text-[10px] text-[#666672] truncate tabular-nums">
                            {m.displayName !== m.id ? `${m.displayName} · ` : ''}
                            {Math.round(m.contextLength / 1000)}k ctx
                            {m.supportsTools ? ' · tools' : ''}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {busy ? (
                            <Loader2
                              className="w-3.5 h-3.5 text-[#40D9FF] animate-spin"
                              strokeWidth={2}
                            />
                          ) : isSelected ? (
                            <Check className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={2} />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {onOpenSettings && (
              <div className="p-1.5 border-t border-[#262630] bg-[#0C0C0F]">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#9999A5] hover:text-[#F4F4F7] hover:bg-[#18181F] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Open Full Model Catalog</span>
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
