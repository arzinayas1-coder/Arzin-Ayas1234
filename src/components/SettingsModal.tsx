import React, { useCallback, useEffect, useState } from 'react';
import { Check, Cpu, RefreshCw, ShieldCheck, Sliders, X } from 'lucide-react';
import type { ProviderConfigDTO, ProviderId, ProviderModelDTO } from '../shared/types.ts';
import { api } from '../lib/api.ts';

interface SettingsModalProps {
  open: boolean;
  providers: ProviderConfigDTO[];
  maxIterations: number;
  onChangeMaxIterations: (val: number) => void;
  onClose: () => void;
  onUpdated: (providers: ProviderConfigDTO[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  providers,
  maxIterations,
  onChangeMaxIterations,
  onClose,
  onUpdated,
}) => {
  const [selectedId, setSelectedId] = useState<ProviderId>('coarena');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
  const [maxContextFiles, setMaxContextFiles] = useState(12);
  const [liveModelsMap, setLiveModelsMap] = useState<Partial<Record<ProviderId, ProviderModelDTO[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    const active = providers.find((p) => p.isActive) || providers[0];
    if (active) {
      setSelectedId(active.provider);
    }
    setStatusMsg('');
    setErrorMsg('');
  }, [open, providers]);

  const current = providers.find((p) => p.provider === selectedId);

  useEffect(() => {
    if (!current) return;
    setBaseUrl(current.baseUrl);
    setModel(current.model);
    setTemperature(current.temperature);
    setMaxOutputTokens(current.maxOutputTokens);
    setMaxContextFiles(current.maxContextFiles);
    setStatusMsg('');
    setErrorMsg('');
  }, [selectedId, current]);

  const handleRefreshFreeModels = useCallback(async (providerId: ProviderId) => {
    setLoadingModels(true);
    setErrorMsg('');
    try {
      const res = await api.providers.models(providerId);
      setLiveModelsMap((prev) => ({ ...prev, [providerId]: res.models }));
      if (res.models.length > 0 && !res.models.some((m) => m.id === model)) {
        setModel(res.models[0].id);
      }
      setStatusMsg(`Loaded ${res.models.length} free model(s) for ${providerId}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch free models');
    } finally {
      setLoadingModels(false);
    }
  }, [model]);

  useEffect(() => {
    if (open && selectedId && !liveModelsMap[selectedId]) {
      void handleRefreshFreeModels(selectedId);
    }
  }, [open, selectedId, liveModelsMap, handleRefreshFreeModels]);

  if (!open || !current) return null;

  const liveModels = liveModelsMap[current.provider] ?? [];
  const modelChoices =
    liveModels.length > 0 ? liveModels.map((m) => m.id) : current.availableModels;

  const effectiveModel = modelChoices.includes(model) ? model : modelChoices[0] || model;
  const selectedMeta = liveModels.find((m) => m.id === effectiveModel);

  const handleSave = async (setActive = true) => {
    setSaving(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await api.providers.update({
        provider: current.provider,
        baseUrl: baseUrl.trim() || current.baseUrl,
        model: effectiveModel || current.model,
        temperature,
        maxOutputTokens,
        maxContextFiles,
        setActive,
      });
      onUpdated(res.providers);
      setStatusMsg(setActive ? `${current.label} saved and activated.` : 'Configuration saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save provider settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl bg-[#121620] border border-white/12 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Model Providers & Agent Runtime</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/8 bg-[#0D1017] p-3 space-y-1 overflow-y-auto">
            {providers.map((p) => {
              const selected = p.provider === selectedId;
              return (
                <button
                  key={p.provider}
                  type="button"
                  onClick={() => setSelectedId(p.provider)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                    selected
                      ? 'bg-[#171C28] text-white border border-white/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="truncate">{p.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-[150px]">
                      {p.model}
                    </div>
                  </div>
                  {p.isActive && (
                    <span className="text-[11px] font-medium text-cyan-400 shrink-0 ml-2">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-8 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/8 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{current.label}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Server-side encrypted credential routing restricted to free-tier models.
                </p>
              </div>
              {current.isActive && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  Active Engine
                </span>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#090B10] border border-white/8 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    current.hasApiKey ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <span>Backend Credential Vault</span>
              </div>
              <span
                className={`font-mono text-[11px] ${
                  current.hasApiKey ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {current.hasApiKey ? 'Configured on server' : 'Not configured on server'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Free-Tier Model</label>
                <button
                  type="button"
                  disabled={loadingModels}
                  onClick={() => void handleRefreshFreeModels(current.provider)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`}
                  />
                  <span>{loadingModels ? 'Refreshing...' : 'Refresh Free Models'}</span>
                </button>
              </div>
              <select
                value={effectiveModel}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              >
                {modelChoices.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {selectedMeta && (
                <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
                  {selectedMeta.displayName} ·{' '}
                  {Math.round(selectedMeta.contextLength / 1000)}k ctx ·{' '}
                  {selectedMeta.supportsTools ? 'Tool calling enabled' : 'Chat mode'}
                </div>
              )}
            </div>

            {current.provider !== 'gemini' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Endpoint Base URL</label>
                  {current.provider === 'coarena' && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBaseUrl('https://coarena.ai/api/v1')}
                        className="text-cyan-400 hover:underline"
                      >
                        OpenAI (/api/v1)
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => setBaseUrl('https://coarena.ai/api')}
                        className="text-cyan-400 hover:underline"
                      >
                        Anthropic (/api)
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://coarena.ai/api/v1"
                  className="w-full px-3 py-2 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1.5"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Output Tokens</label>
                <input
                  type="number"
                  step="512"
                  min="512"
                  max="65536"
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Context Files</label>
                <input
                  type="number"
                  min="3"
                  max="40"
                  value={maxContextFiles}
                  onChange={(e) => setMaxContextFiles(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Iterations</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={maxIterations}
                  onChange={(e) => onChangeMaxIterations(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono tabular-nums text-white"
                />
              </div>
            </div>

            {statusMsg && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                {statusMsg}
              </div>
            )}
            {errorMsg && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/8">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="px-3.5 py-2 rounded-lg bg-[#171C28] hover:bg-[#1F2637] text-xs font-medium text-slate-200 border border-white/10"
              >
                Save Config
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save & Set Active'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
