import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

let configured = false;

export function ensureMonacoConfigured() {
  if (configured) return;
  configured = true;

  (self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') return new jsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };

  loader.config({ monaco });

  monaco.editor.defineTheme('forge-obsidian', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '666672', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'A599FF' },
      { token: 'keyword.control', foreground: '8B7CFF' },
      { token: 'string', foreground: '5CE1FF' },
      { token: 'number', foreground: 'FBBF24' },
      { token: 'type.identifier', foreground: '36D399' },
      { token: 'entity.name.function', foreground: 'E2E2EC' },
      { token: 'identifier', foreground: 'F4F4F7' },
      { token: 'delimiter', foreground: '7E7E8B' },
      { token: 'tag', foreground: '8B7CFF' },
      { token: 'attribute.name', foreground: '9999A5' },
      { token: 'attribute.value', foreground: '5CE1FF' },
    ],
    colors: {
      'editor.background': '#101014',
      'editor.foreground': '#F4F4F7',
      'editorLineNumber.foreground': '#4A4A56',
      'editorLineNumber.activeForeground': '#F4F4F7',
      'editor.lineHighlightBackground': '#16161D',
      'editor.lineHighlightBorder': '#1E1E28',
      'editor.selectionBackground': '#8B7CFF33',
      'editor.inactiveSelectionBackground': '#8B7CFF18',
      'editor.selectionHighlightBackground': '#40D9FF1A',
      'editorCursor.foreground': '#40D9FF',
      'editorIndentGuide.background': '#1D1D25',
      'editorIndentGuide.activeBackground': '#343444',
      'editorBracketMatch.background': '#40D9FF18',
      'editorBracketMatch.border': '#40D9FF66',
      'editorGutter.foldingControlForeground': '#9999A5',
      'editorWidget.background': '#121217',
      'editorWidget.border': '#262630',
      'minimap.background': '#0E0E12',
      'minimapSlider.background': '#26263066',
      'minimapSlider.hoverBackground': '#36364688',
      'scrollbarSlider.background': '#26263066',
      'scrollbarSlider.hoverBackground': '#383848AA',
      'diffEditor.insertedTextBackground': '#36D39922',
      'diffEditor.removedTextBackground': '#FB718522',
      'diffEditor.insertedLineBackground': '#36D39912',
      'diffEditor.removedLineBackground': '#FB718512',
      'diffEditorGutter.insertedLineBackground': '#36D39925',
      'diffEditorGutter.removedLineBackground': '#FB718525',
    },
  });

  monaco.editor.defineTheme('forge-midnight', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '666672', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'A78BFA' },
      { token: 'string', foreground: '67E8F9' },
      { token: 'number', foreground: 'FBBF24' },
      { token: 'type.identifier', foreground: '36D399' },
    ],
    colors: {
      'editor.background': '#0B0D12',
      'editor.foreground': '#F4F4F7',
      'editorLineNumber.foreground': '#475063',
      'editorLineNumber.activeForeground': '#F4F4F7',
      'editor.lineHighlightBackground': '#131620',
      'editor.selectionBackground': '#40D9FF28',
      'editorCursor.foreground': '#8B7CFF',
      'editorIndentGuide.background': '#1C202E',
      'editorIndentGuide.activeBackground': '#333A52',
      'editorWidget.background': '#121217',
      'editorWidget.border': '#262630',
      'diffEditor.insertedTextBackground': '#36D39922',
      'diffEditor.removedTextBackground': '#FB718522',
      'diffEditor.insertedLineBackground': '#36D39912',
      'diffEditor.removedLineBackground': '#FB718512',
    },
  });
}

export function detectMonacoLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    case 'html':
    case 'htm':
      return 'html';
    case 'py':
      return 'python';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'svg':
      return 'xml';
    default:
      return 'plaintext';
  }
}
