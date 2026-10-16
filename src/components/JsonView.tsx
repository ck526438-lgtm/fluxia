import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import clsx from 'clsx';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(json: string) {
  return escapeHtml(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-300/90';
      if (match.startsWith('"')) cls = match.endsWith(':') ? 'text-sky-300/90' : 'text-emerald-300/90';
      else if (/^(true|false)$/.test(match)) cls = 'text-fuchsia-300/90';
      else if (match === 'null') cls = 'text-white/35';
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export function JsonView({ value, className, maxHeight = 260 }: { value: unknown; className?: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2) ?? 'null';
    } catch {
      return String(value);
    }
  }, [value]);
  const html = useMemo(() => highlight(json), [json]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* presse-papiers indisponible */ }
  };

  return (
    <div className={clsx('group relative overflow-hidden rounded-lg border border-white/6 bg-black/35', className)}>
      <button
        onClick={copy}
        title="Copier le JSON"
        className="btn-press absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/8 bg-ink-800/90 text-white/50 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
      >
        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      </button>
      <pre
        className="overflow-auto p-2.5 font-mono text-[10.5px] leading-[1.6] text-white/80"
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
