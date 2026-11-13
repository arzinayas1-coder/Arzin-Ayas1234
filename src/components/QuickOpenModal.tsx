import React, { useEffect, useMemo, useState } from 'react';
import { FileCode, Search, X } from 'lucide-react';
import type { FileTreeNode } from '../shared/types.ts';

interface QuickOpenModalProps {
  open: boolean;
  tree: FileTreeNode[];
  onClose: () => void;
  onSelectFile: (path: string) => void;
}

function flattenFiles(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path);
    else if (n.children) out.push(...flattenFiles(n.children));
  }
  return out;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  open,
  tree,
  onClose,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const files = useMemo(() => flattenFiles(tree), [tree]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 30);
    return files.filter((f) => f.toLowerCase().includes(q)).slice(0, 30);
  }, [files, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      onSelectFile(filtered[selectedIdx]);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[#121620] border border-white/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to file by name or path..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No matching files found in workspace.
            </div>
          ) : (
            filtered.map((filePath, idx) => (
              <button
                key={filePath}
                type="button"
                onClick={() => {
                  onSelectFile(filePath);
                  onClose();
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors ${
                  idx === selectedIdx
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono truncate">{filePath}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
