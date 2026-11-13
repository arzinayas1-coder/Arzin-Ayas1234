import fs from 'node:fs';
import path from 'node:path';
import { listFlatFiles } from './workspace.ts';

export interface IndexedFileSummary {
  path: string;
  lines: number;
  bytes: number;
  symbols: string[];
  score: number;
}

const SYMBOL_PATTERNS = [
  /export\s+(?:async\s+)?(?:function|class|const|let|interface|type|enum)\s+([A-Za-z0-9_]+)/g,
  /(?:^|\n)\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)/g,
  /(?:^|\n)\s*class\s+([A-Za-z0-9_]+)/g,
  /(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g,
];

function extractSymbols(content: string): string[] {
  const symbols = new Set<string>();
  for (const regex of SYMBOL_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[2]) {
        symbols.add(`${match[1].toUpperCase()} ${match[2]}`);
      } else if (match[1]) {
        symbols.add(match[1]);
      }
      if (symbols.size >= 20) return Array.from(symbols);
    }
  }
  return Array.from(symbols);
}

export function buildProjectIndex(workspaceRoot: string, query: string, maxContextFiles = 12): {
  totalFiles: number;
  fileTreeList: string[];
  relevantFiles: Array<{ path: string; lines: number; symbols: string[]; snippet: string }>;
} {
  const allFiles = listFlatFiles(workspaceRoot, 300);
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((t) => t.length >= 2);

  const scored: IndexedFileSummary[] = [];

  for (const relPath of allFiles) {
    const full = path.join(workspaceRoot, relPath);
    let content = '';
    let size = 0;
    try {
      const stat = fs.statSync(full);
      size = stat.size;
      if (size > 180_000) continue;
      content = fs.readFileSync(full, 'utf8');
      if (content.includes('\u0000')) continue;
    } catch {
      continue;
    }

    const symbols = extractSymbols(content);
    const lines = content.split('\n').length;
    let score = 0;

    // Architectural entrypoints get mild baseline weight
    const lowerPath = relPath.toLowerCase();
    if (
      lowerPath === 'package.json' ||
      lowerPath === 'readme.md' ||
      lowerPath.endsWith('server.ts') ||
      lowerPath.endsWith('server.mjs') ||
      lowerPath.endsWith('main.py') ||
      lowerPath.endsWith('app.tsx') ||
      lowerPath.endsWith('app.js') ||
      lowerPath === 'index.html'
    ) {
      score += 3;
    }

    const lowerContent = content.toLowerCase();
    for (const term of terms) {
      if (lowerPath.includes(term)) score += 6;
      if (symbols.some((s) => s.toLowerCase().includes(term))) score += 5;
      if (lowerContent.includes(term)) score += 2;
    }

    scored.push({ path: relPath, lines, bytes: size, symbols, score });
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const top = scored.slice(0, maxContextFiles);

  const relevantFiles = top.map((item) => {
    const full = path.join(workspaceRoot, item.path);
    let content = '';
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      content = '';
    }
    const maxChars = 4000;
    const snippet =
      content.length > maxChars
        ? `${content.slice(0, maxChars)}\n... [truncated ${content.length - maxChars} chars; use read_file for full content]`
        : content;
    return {
      path: item.path,
      lines: item.lines,
      symbols: item.symbols,
      snippet,
    };
  });

  return {
    totalFiles: allFiles.length,
    fileTreeList: allFiles.slice(0, 120),
    relevantFiles,
  };
}
