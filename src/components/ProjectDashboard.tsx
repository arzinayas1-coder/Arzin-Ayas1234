import React, { useState } from 'react';
import {
  ArrowRight,
  Clock,
  Code2,
  Cpu,
  FolderOpen,
  GitBranch,
  GitFork,
  Plus,
  Terminal,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ShowcaseProject } from '../data/mockWorkspace.ts';

interface ProjectDashboardProps {
  projects: ShowcaseProject[];
  onOpenProject: (project: ShowcaseProject) => void;
  onCreateProjectFromPrompt: (prompt: string) => void;
  onCreateNewProject: (name: string, language: string) => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  projects,
  onOpenProject,
  onCreateProjectFromPrompt,
  onCreateNewProject,
}) => {
  const [prompt, setPrompt] = useState('');
  const [modalType, setModalType] = useState<'new' | 'clone' | null>(null);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectLangInput, setProjectLangInput] = useState('TypeScript');
  const [cloneUrlInput, setCloneUrlInput] = useState('');

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onCreateProjectFromPrompt(prompt.trim());
    setPrompt('');
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'new') {
      if (!projectNameInput.trim()) return;
      onCreateNewProject(projectNameInput.trim(), projectLangInput);
      setProjectNameInput('');
      setModalType(null);
    } else if (modalType === 'clone') {
      const repoName =
        cloneUrlInput.trim().split('/').pop()?.replace(/\.git$/, '') || 'cloned-workspace';
      onCreateNewProject(repoName, 'TypeScript');
      setCloneUrlInput('');
      setModalType(null);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-y-auto bg-[#09090B] text-[#F4F4F7] flex flex-col">
      {/* Subtle Hairline Architectural Grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #262630 1px, transparent 1px), linear-gradient(to bottom, #262630 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 h-11 px-6 border-b border-[#262630] bg-[#0C0C0F] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5L12 2L20 5.5V13.5L12 22L4 13.5V5.5Z"
              stroke="#8B7CFF"
              strokeWidth="1.9"
            />
            <path
              d="M8.5 9.5H15.5M8.5 13H13.5"
              stroke="#40D9FF"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-semibold tracking-tight">FORGE AI</span>
          <span className="text-xs text-[#666672] hidden sm:inline">· Build beyond imagination.</span>
        </div>

        <button
          type="button"
          onClick={() => onOpenProject(projects[0])}
          className="px-3 py-1.5 rounded-md bg-[#121217] hover:bg-[#18181F] border border-[#262630] text-xs font-medium text-[#F4F4F7] transition-colors"
        >
          Resume Active Workspace
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-10">
        {/* Welcome Hero */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F4F7] text-balance">
              Welcome to FORGE.
            </h1>
            <p className="text-sm text-[#9999A5]">Your next great build starts here.</p>
          </div>

          {/* Command Center AI Prompt Box */}
          <form
            onSubmit={handlePromptSubmit}
            className="rounded-xl bg-[#101014] border border-[#262630] focus-within:border-[#8B7CFF] transition-colors p-3.5"
          >
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePromptSubmit(e);
                }
              }}
              placeholder="What would you like to build today?"
              className="w-full resize-none bg-transparent text-sm text-[#F4F4F7] placeholder:text-[#666672] focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[#262630]">
              <div className="flex items-center gap-3 text-xs text-[#9999A5]">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#40D9FF]" strokeWidth={1.75} />
                  <span>Autonomous Agent Ready</span>
                </span>
                <span className="hidden sm:inline font-mono text-[11px] text-[#666672]">
                  ⌘↵ to launch
                </span>
              </div>

              <button
                type="submit"
                disabled={!prompt.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold disabled:opacity-35 transition-colors active:scale-[0.98]"
              >
                <span>Start Building</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </form>

          {/* Primary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setModalType('new')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-[#0C0C0F] hover:bg-[#121217] border border-[#262630] text-left transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-[#121217] border border-[#262630] flex items-center justify-center text-[#8B7CFF] group-hover:border-[#8B7CFF]/50">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#F4F4F7]">New project</div>
                <div className="text-[11px] text-[#9999A5]">Scaffold a fresh workspace</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onOpenProject(projects[0])}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-[#0C0C0F] hover:bg-[#121217] border border-[#262630] text-left transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-[#121217] border border-[#262630] flex items-center justify-center text-[#40D9FF] group-hover:border-[#40D9FF]/50">
                <FolderOpen className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#F4F4F7]">Open project</div>
                <div className="text-[11px] text-[#9999A5]">Inspect an existing codebase</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModalType('clone')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-[#0C0C0F] hover:bg-[#121217] border border-[#262630] text-left transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-[#121217] border border-[#262630] flex items-center justify-center text-[#36D399] group-hover:border-[#36D399]/50">
                <GitFork className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#F4F4F7]">Clone repository</div>
                <div className="text-[11px] text-[#9999A5]">Import from Git URL</div>
              </div>
            </button>
          </div>
        </motion.section>

        {/* Recent Projects */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#9999A5]">Recent Projects</h2>
            <span className="text-xs text-[#666672] font-mono tabular-nums">
              {projects.length} workspaces
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => onOpenProject(proj)}
                className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[#0C0C0F] hover:bg-[#121217] border border-[#262630] hover:border-[#8B7CFF]/45 text-left transition-colors group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-[#121217] border border-[#262630] flex items-center justify-center text-[#40D9FF] shrink-0">
                    {proj.language === 'Rust' || proj.language === 'Go' ? (
                      <Terminal className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Code2 className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium text-[#F4F4F7] group-hover:text-[#40D9FF] transition-colors truncate">
                      {proj.name}
                    </div>
                    <p className="text-xs text-[#9999A5] line-clamp-1">{proj.description}</p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-[#666672]">
                      <span>{proj.language}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-[#8B7CFF]" strokeWidth={1.75} />
                        {proj.branch}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-[#666672] shrink-0 whitespace-nowrap tabular-nums">
                  <Clock className="w-3 h-3" strokeWidth={1.75} />
                  <span>{proj.lastModified}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* New / Clone Modal */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#121217] border border-[#262630] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#262630] bg-[#0C0C0F]">
              <h3 className="text-sm font-semibold text-[#F4F4F7]">
                {modalType === 'new' ? 'Create New Project' : 'Clone Git Repository'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1 rounded text-[#9999A5] hover:text-[#F4F4F7]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-4 space-y-4">
              {modalType === 'new' ? (
                <>
                  <div>
                    <label className="block text-xs text-[#9999A5] mb-1.5">Project Name</label>
                    <input
                      type="text"
                      autoFocus
                      value={projectNameInput}
                      onChange={(e) => setProjectNameInput(e.target.value)}
                      placeholder="forge-billing-api"
                      className="w-full px-3 py-2 rounded-md bg-[#09090B] border border-[#262630] text-xs font-mono text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9999A5] mb-1.5">Primary Stack</label>
                    <select
                      value={projectLangInput}
                      onChange={(e) => setProjectLangInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#09090B] border border-[#262630] text-xs text-[#F4F4F7] focus:outline-none focus:border-[#8B7CFF]"
                    >
                      <option value="TypeScript">TypeScript · React / Vite</option>
                      <option value="Python">Python · FastAPI</option>
                      <option value="Go">Go · Microservice</option>
                      <option value="Rust">Rust · Tokio</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs text-[#9999A5] mb-1.5">Repository URL</label>
                  <input
                    type="url"
                    autoFocus
                    value={cloneUrlInput}
                    onChange={(e) => setCloneUrlInput(e.target.value)}
                    placeholder="https://github.com/acme/forge-dashboard.git"
                    className="w-full px-3 py-2 rounded-md bg-[#09090B] border border-[#262630] text-xs font-mono text-[#F4F4F7] focus:outline-none focus:border-[#40D9FF]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 rounded-md text-xs text-[#9999A5] hover:text-[#F4F4F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] text-xs font-semibold"
                >
                  {modalType === 'new' ? 'Create Workspace' : 'Clone & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
