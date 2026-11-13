import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import type { ProjectRecord } from '../shared/types.ts';
import { api } from '../lib/api.ts';

interface ProjectWizardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectRecord) => void;
}

const TEMPLATES = [
  {
    id: 'web-app',
    title: 'Web Application',
    subtitle: 'Interactive HTML/CSS/JS workspace with Node test suite and live server',
  },
  {
    id: 'node-express',
    title: 'Node.js API Service',
    subtitle: 'HTTP API server with unit tests and health endpoint',
  },
  {
    id: 'python-service',
    title: 'Python Service',
    subtitle: 'Python HTTP service with unittest suite and requirements.txt',
  },
  {
    id: 'blank',
    title: 'Blank Workspace',
    subtitle: 'Clean directory ready for custom scaffolding or file uploads',
  },
];

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('web-app');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { project } = await api.projects.create({ name, description, template });
      setName('');
      setDescription('');
      onCreated(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-[#121620] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">New Engineering Project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Project Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. billing-engine or sprint-board"
              className="w-full px-3.5 py-2 rounded-lg bg-[#090B10] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short architecture summary"
              className="w-full px-3.5 py-2 rounded-lg bg-[#090B10] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Starter Template</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEMPLATES.map((tpl) => {
                const selected = template === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplate(tpl.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-cyan-500/10 border-cyan-400/60 text-white'
                        : 'bg-[#090B10] border-white/8 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold">{tpl.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{tpl.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
