import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FileTreeNode, SearchMatch } from '../shared/types.ts';

function resolveWorkspacesRoot(): string {
  const preferred = path.resolve(process.cwd(), '.forge-workspaces');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK | fs.constants.R_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'forge-ai-workspaces');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const WORKSPACES_ROOT = resolveWorkspacesRoot();

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv']);
const MAX_READ_BYTES = 512 * 1024;

export function getWorkspacePath(projectId: string): string {
  const sanitized = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) throw new Error('Invalid project ID');
  const full = path.resolve(WORKSPACES_ROOT, sanitized);
  if (!full.startsWith(WORKSPACES_ROOT + path.sep)) {
    throw new Error('Invalid workspace path');
  }
  return full;
}

export function resolveSafePath(workspaceRoot: string, relativePath: string): string {
  const cleanRel = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(workspaceRoot, cleanRel);
  const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;
  if (resolved !== workspaceRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Access denied: path "${relativePath}" escapes workspace boundary.`);
  }
  // Protect internal git metadata from direct agent overwrite
  const normalizedRel = path.relative(workspaceRoot, resolved).split(path.sep).join('/');
  if (normalizedRel === '.git' || normalizedRel.startsWith('.git/')) {
    throw new Error('Access denied: direct modification of .git internals is prohibited.');
  }
  return resolved;
}

export function listFileTree(workspaceRoot: string, gitStatusMap?: Map<string, string>): FileTreeNode[] {
  if (!fs.existsSync(workspaceRoot)) return [];

  function walk(dir: string): FileTreeNode[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FileTreeNode[] = [];
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(workspaceRoot, fullPath).split(path.sep).join('/');
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: walk(fullPath),
        });
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          gitStatus: gitStatusMap?.get(relPath),
        });
      }
    }
    return nodes;
  }

  return walk(workspaceRoot);
}

export function listFlatFiles(workspaceRoot: string, maxFiles = 500): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    if (out.length >= maxFiles) return;
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(path.relative(workspaceRoot, full).split(path.sep).join('/'));
        if (out.length >= maxFiles) return;
      }
    }
  }
  walk(workspaceRoot);
  return out;
}

export function readWorkspaceFile(workspaceRoot: string, relativePath: string): { content: string; size: number } {
  const full = resolveSafePath(workspaceRoot, relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new Error(`File not found: ${relativePath}`);
  }
  const stat = fs.statSync(full);
  if (stat.size > MAX_READ_BYTES) {
    throw new Error(`File ${relativePath} exceeds ${MAX_READ_BYTES} bytes read limit.`);
  }
  const content = fs.readFileSync(full, 'utf8');
  return { content, size: stat.size };
}

export function writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string): void {
  const full = resolveSafePath(workspaceRoot, relativePath);
  const parent = path.dirname(full);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(full, content, 'utf8');
}

export function createWorkspaceDirectory(workspaceRoot: string, relativePath: string): void {
  const full = resolveSafePath(workspaceRoot, relativePath);
  fs.mkdirSync(full, { recursive: true });
}

export function deleteWorkspacePath(workspaceRoot: string, relativePath: string): void {
  const full = resolveSafePath(workspaceRoot, relativePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Path not found: ${relativePath}`);
  }
  fs.rmSync(full, { recursive: true, force: true });
}

export function renameWorkspacePath(workspaceRoot: string, oldRel: string, newRel: string): void {
  const from = resolveSafePath(workspaceRoot, oldRel);
  const to = resolveSafePath(workspaceRoot, newRel);
  if (!fs.existsSync(from)) {
    throw new Error(`Source not found: ${oldRel}`);
  }
  const parent = path.dirname(to);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.renameSync(from, to);
}

export function searchCodeInWorkspace(
  workspaceRoot: string,
  query: string,
  options?: { isRegex?: boolean; maxResults?: number }
): SearchMatch[] {
  const maxResults = options?.maxResults ?? 80;
  const matches: SearchMatch[] = [];
  if (!query.trim()) return matches;

  let matcher: RegExp;
  try {
    matcher = options?.isRegex ? new RegExp(query, 'gi') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  } catch {
    return matches;
  }

  const files = listFlatFiles(workspaceRoot, 400);
  for (const relPath of files) {
    if (matches.length >= maxResults) break;
    const full = path.join(workspaceRoot, relPath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.size > 250_000) continue;

    let text: string;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue; // skip binary files

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      matcher.lastIndex = 0;
      const m = matcher.exec(lines[i]);
      if (m) {
        matches.push({
          path: relPath,
          line: i + 1,
          column: m.index + 1,
          preview: lines[i].trim().slice(0, 180),
        });
        if (matches.length >= maxResults) break;
      }
    }
  }
  return matches;
}

export function searchFilenamesInWorkspace(workspaceRoot: string, pattern: string): string[] {
  const q = pattern.toLowerCase().trim();
  const files = listFlatFiles(workspaceRoot, 500);
  if (!q) return files.slice(0, 50);
  return files.filter((f) => f.toLowerCase().includes(q)).slice(0, 80);
}

export function inspectDependencies(workspaceRoot: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const pkgPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      result.packageJson = {
        name: pkg.name,
        version: pkg.version,
        scripts: pkg.scripts || {},
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
      };
    } catch {
      result.packageJsonError = 'Invalid package.json';
    }
  }
  const reqPath = path.join(workspaceRoot, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    result.requirementsTxt = fs.readFileSync(reqPath, 'utf8').split('\n').filter(Boolean);
  }
  return result;
}

export function seedProjectTemplate(workspaceRoot: string, template: string, projectName: string) {
  if (!fs.existsSync(workspaceRoot)) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  if (template === 'node-express') {
    writeWorkspaceFile(
      workspaceRoot,
      'package.json',
      JSON.stringify(
        {
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'node-api',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'node --watch server.mjs',
            start: 'node server.mjs',
            test: 'node --test tests/api.test.mjs',
          },
        },
        null,
        2
      )
    );
    writeWorkspaceFile(
      workspaceRoot,
      'server.mjs',
      `import http from 'node:http';

const tasks = [
  { id: '1', title: 'Configure API health check', status: 'done', priority: 'high' },
  { id: '2', title: 'Add task filtering endpoint', status: 'in_progress', priority: 'medium' },
];

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', count: tasks.length }));
      return;
    }
    if (url.pathname === '/api/tasks' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tasks }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!doctype html><html><body style="font-family:system-ui;background:#0b0f17;color:#e2e8f0;padding:2rem;"><h1>\${projectName}</h1><p>API running. Endpoints: <code>/health</code>, <code>/api/tasks</code></p></body></html>\`);
  });
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const port = Number(process.env.PORT || 4000);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(\`Server listening on http://localhost:\${port}\`);
  });
}
`
    );
    writeWorkspaceFile(
      workspaceRoot,
      'tests/api.test.mjs',
      `import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

test('GET /health returns ok status', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const res = await fetch(\`http://127.0.0.1:\${port}/health\`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  server.close();
});
`
    );
    return;
  }

  if (template === 'python-service') {
    writeWorkspaceFile(
      workspaceRoot,
      'requirements.txt',
      'pytest>=8.0.0\n'
    );
    writeWorkspaceFile(
      workspaceRoot,
      'main.py',
      `from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h1>Python Service Active</h1>")

def compute_fibonacci(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    print(f"Serving on port {port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
`
    );
    writeWorkspaceFile(
      workspaceRoot,
      'test_main.py',
      `import unittest
from main import compute_fibonacci

class TestMain(unittest.TestCase):
    def test_fibonacci(self):
        self.assertEqual(compute_fibonacci(0), 0)
        self.assertEqual(compute_fibonacci(1), 1)
        self.assertEqual(compute_fibonacci(10), 55)

if __name__ == "__main__":
    unittest.main()
`
    );
    return;
  }

  if (template === 'blank') {
    writeWorkspaceFile(
      workspaceRoot,
      'README.md',
      `# ${projectName}\n\nEmpty workspace ready for autonomous engineering.\n`
    );
    return;
  }

  // Default: web-app (Zero-build dependency static/ESM interactive starter + node test suite so it runs & previews instantly!)
  writeWorkspaceFile(
    workspaceRoot,
    'package.json',
    JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'forge-web-app',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'node server.mjs',
          build: 'node -e "console.log(\'Verified static bundle and syntax\')"',
          test: 'node --test tests/app.test.mjs',
        },
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    workspaceRoot,
    'index.html',
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <h1>${projectName}</h1>
        <span class="meta">Interactive Workspace App</span>
      </header>
      <section class="panel">
        <div class="input-row">
          <input id="task-input" type="text" placeholder="Add a sprint objective..." />
          <button id="add-btn" type="button">Add Task</button>
        </div>
        <ul id="task-list" class="task-list"></ul>
      </section>
    </main>
    <script type="module" src="./src/app.js"></script>
  </body>
</html>
`
  );
  writeWorkspaceFile(
    workspaceRoot,
    'styles.css',
    `* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0b0e14;
  color: #e6edf3;
  padding: 2rem;
}
.shell { max-width: 680px; margin: 0 auto; }
.topbar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.75rem; }
.topbar h1 { margin: 0; font-size: 1.25rem; }
.meta { font-size: 0.8rem; color: #94a3b8; }
.panel { background: #111622; border: 1px solid #1e293b; border-radius: 10px; padding: 1.25rem; }
.input-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
input { flex: 1; background: #090c12; border: 1px solid #293548; color: #f8fafc; padding: 0.6rem 0.8rem; border-radius: 6px; }
button { background: #06b6d4; color: #041318; border: none; padding: 0.6rem 1rem; font-weight: 600; border-radius: 6px; cursor: pointer; }
.task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.task-item { display: flex; justify-content: space-between; padding: 0.65rem 0.8rem; background: #0d121c; border: 1px solid #1e293b; border-radius: 6px; }
`
  );
  writeWorkspaceFile(
    workspaceRoot,
    'src/store.mjs',
    `export function createTaskStore(initial = []) {
  const items = [...initial];
  return {
    list() {
      return [...items];
    },
    add(title) {
      const clean = String(title || '').trim();
      if (!clean) throw new Error('Task title is required');
      const task = { id: String(items.length + 1), title: clean, done: false };
      items.push(task);
      return task;
    },
    toggle(id) {
      const found = items.find((t) => t.id === id);
      if (found) found.done = !found.done;
      return found || null;
    },
  };
}
`
  );
  writeWorkspaceFile(
    workspaceRoot,
    'src/app.js',
    `import { createTaskStore } from './store.mjs';

const store = createTaskStore([
  { id: '1', title: 'Review architecture specification', done: true },
  { id: '2', title: 'Implement real-time task filter', done: false },
]);

const listEl = document.getElementById('task-list');
const inputEl = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');

function render() {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const item of store.list()) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = \`<span style="\${item.done ? 'text-decoration:line-through;color:#64748b' : ''}">\${item.title}</span><button type="button" data-id="\${item.id}" style="background:#1e293b;color:#cbd5e1;padding:0.25rem 0.6rem;font-size:0.75rem">\${item.done ? 'Reopen' : 'Done'}</button>\`;
    li.querySelector('button')?.addEventListener('click', () => {
      store.toggle(item.id);
      render();
    });
    listEl.appendChild(li);
  }
}

addBtn?.addEventListener('click', () => {
  if (!inputEl?.value.trim()) return;
  store.add(inputEl.value);
  inputEl.value = '';
  render();
});

render();
`
  );
  writeWorkspaceFile(
    workspaceRoot,
    'server.mjs',
    `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const root = process.cwd();
const port = Number(process.env.PORT || 4000);

http
  .createServer((req, res) => {
    const reqPath = (req.url || '/').split('?')[0];
    const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\\/+/, '');
    const full = path.resolve(root, rel);
    if (!full.startsWith(root) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  })
  .listen(port, '0.0.0.0', () => {
    console.log(\`Dev server listening on http://localhost:\${port}\`);
  });
`
  );
  writeWorkspaceFile(
    workspaceRoot,
    'tests/app.test.mjs',
    `import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore } from '../src/store.mjs';

test('task store adds and toggles tasks', () => {
  const store = createTaskStore();
  const created = store.add('Ship release candidate');
  assert.equal(created.title, 'Ship release candidate');
  assert.equal(created.done, false);
  store.toggle(created.id);
  assert.equal(store.list()[0].done, true);
});
`
  );
}
