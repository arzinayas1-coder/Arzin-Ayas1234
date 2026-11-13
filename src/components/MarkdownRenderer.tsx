import React, { useState } from 'react';
import { Check, Copy, FileCode } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onApplyCode?: (code: string) => void;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-[#18181F] border border-[#262630] font-mono text-[11px] text-[#40D9FF]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#F4F4F7]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      parts.push(
        <em key={key++} className="italic text-[#9999A5]">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function highlightCodeLine(line: string): React.ReactNode {
  const tokenRegex =
    /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:import|from|export|const|let|return|interface|type|async|await|if|else)\b)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = tokenRegex.exec(line)) !== null) {
    if (m.index > last) {
      nodes.push(line.slice(last, m.index));
    }
    const tok = m[0];
    if (tok.startsWith('//')) {
      nodes.push(
        <span key={idx++} className="text-[#666672] italic">
          {tok}
        </span>
      );
    } else if (tok.startsWith('"') || tok.startsWith("'")) {
      nodes.push(
        <span key={idx++} className="text-[#5CE1FF]">
          {tok}
        </span>
      );
    } else {
      nodes.push(
        <span key={idx++} className="text-[#A599FF]">
          {tok}
        </span>
      );
    }
    last = tokenRegex.lastIndex;
  }
  if (last < line.length) {
    nodes.push(line.slice(last));
  }
  return nodes.length > 0 ? nodes : line;
}

function CodeBlock({
  language,
  code,
  onApplyCode,
}: {
  language: string;
  code: string;
  onApplyCode?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const lines = code.split('\n');

  return (
    <div className="my-2.5 rounded-lg border border-[#262630] bg-[#09090B] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121217] border-b border-[#262630] text-[11px] text-[#9999A5]">
        <span className="font-mono">{language || 'code'}</span>
        <div className="flex items-center gap-1.5">
          {onApplyCode && (
            <button
              type="button"
              onClick={() => onApplyCode(code)}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#18181F] text-[#40D9FF] transition-colors"
              title="Insert into active editor"
            >
              <FileCode className="w-3 h-3" strokeWidth={1.75} />
              <span>Insert</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#18181F] text-[#F4F4F7]/85 transition-colors"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#36D399]" strokeWidth={2} />
            ) : (
              <Copy className="w-3 h-3" strokeWidth={1.75} />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12px] leading-5 font-mono text-[#F4F4F7]">
        <code>
          {lines.map((ln, idx) => (
            <div key={idx}>{highlightCodeLine(ln)}</div>
          ))}
        </code>
      </pre>
    </div>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onApplyCode }) => {
  const blocks: Array<
    | { type: 'code'; language: string; code: string }
    | { type: 'text'; text: string }
  > = [];

  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      blocks.push({ type: 'text', text: content.slice(lastIdx, match.index) });
    }
    blocks.push({ type: 'code', language: match[1] || 'text', code: match[2].replace(/\n$/, '') });
    lastIdx = fenceRegex.lastIndex;
  }

  if (lastIdx < content.length) {
    blocks.push({ type: 'text', text: content.slice(lastIdx) });
  }

  return (
    <div className="space-y-2 text-[12.5px] leading-relaxed text-[#F4F4F7]/90">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={idx}
              language={block.language}
              code={block.code}
              onApplyCode={onApplyCode}
            />
          );
        }
        const lines = block.text.split('\n');
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-[13px] font-semibold text-[#F4F4F7] pt-1">
                    {renderInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-semibold text-[#F4F4F7] pt-1.5">
                    {renderInline(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex gap-2 pl-1">
                    <span className="text-[#8B7CFF] select-none">•</span>
                    <span className="flex-1">{renderInline(trimmed.slice(2))}</span>
                  </div>
                );
              }
              const numMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex gap-2 pl-1">
                    <span className="text-[#9999A5] font-mono text-xs pt-0.5 tabular-nums">
                      {numMatch[1]}.
                    </span>
                    <span className="flex-1">{renderInline(numMatch[2])}</span>
                  </div>
                );
              }
              return <p key={lIdx}>{renderInline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};
