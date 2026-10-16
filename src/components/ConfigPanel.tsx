import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { AlertTriangle, Braces, Code2, Info, Play, Plus, Trash2, X, Zap } from 'lucide-react';
import { CATEGORIES, defaultParams, getDef } from '../data/catalog';
import { useFlow } from '../store/store';
import type { FlowNode, ParamField } from '../types';
import { JsonView } from './JsonView';

const inputCls =
  'w-full rounded-lg border border-white/8 bg-black/25 px-2.5 py-2 text-[12px] text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/50 focus:bg-black/35';
const monoCls = `${inputCls} font-mono text-[11px]`;

function FieldShell({ field, children }: { field: ParamField; children: React.ReactNode }) {
  const expression = field.type === 'text' || field.type === 'textarea' || field.type === 'code' || field.type === 'number';
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-[11px] font-semibold text-white/65">{field.label}</label>
        {expression && (
          <span className="rounded border border-emerald-400/20 bg-emerald-400/8 px-1 py-px font-mono text-[8.5px] font-semibold text-emerald-300/80" title="{{ $json.champ }} — résolu à l’exécution">
            fx
          </span>
        )}
      </div>
      {children}
      {field.hint && <div className="mt-1.5 text-[10px] leading-snug text-white/32">{field.hint}</div>}
    </div>
  );
}

function ToggleField({ field, value, onChange }: { field: ParamField; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldShell field={field}>
      <button
        onClick={() => onChange(!value)}
        className={clsx('relative h-6 w-11 rounded-full transition-colors duration-200', value ? 'bg-violet-500/80' : 'bg-white/10')}
      >
        <motion.span
          animate={{ x: value ? 22 : 3 }}
          transition={{ type: 'spring', stiffness: 560, damping: 32 }}
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
        />
      </button>
    </FieldShell>
  );
}

function JsonField({ field, value, onChange }: { field: ParamField; value: string; onChange: (v: string) => void }) {
  const [invalid, setInvalid] = useState(false);
  return (
    <FieldShell field={field}>
      <div className="relative">
        <textarea
          value={value}
          spellCheck={false}
          rows={5}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            if (!v.trim()) return setInvalid(false);
            try { JSON.parse(v); setInvalid(false); } catch { setInvalid(true); }
          }}
          className={clsx(monoCls, 'resize-y', invalid && 'border-red-400/60 focus:border-red-400/70')}
          placeholder={field.placeholder ?? '{ }'}
        />
        <Braces size={12} className="pointer-events-none absolute right-2.5 top-2.5 text-white/20" />
      </div>
      {invalid && <div className="mt-1 flex items-center gap-1 text-[10px] text-red-300/90"><AlertTriangle size={10} /> JSON invalide</div>}
    </FieldShell>
  );
}

function CodeField({ field, value, onChange }: { field: ParamField; value: string; onChange: (v: string) => void }) {
  return (
    <FieldShell field={field}>
      <div className="relative overflow-hidden rounded-lg border border-white/8 bg-black/40 focus-within:border-violet-400/50">
        <div className="flex items-center gap-1.5 border-b border-white/6 bg-white/[0.03] px-2.5 py-1.5">
          <Code2 size={11} className="text-white/35" />
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white/35">JavaScript</span>
          <span className="ml-auto font-mono text-[9px] text-white/25">return items →</span>
        </div>
        <textarea
          value={value}
          spellCheck={false}
          rows={12}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const next = `${value.slice(0, start)}  ${value.slice(el.selectionEnd)}`;
              onChange(next);
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
            }
          }}
          className="w-full resize-y bg-transparent px-2.5 py-2 font-mono text-[11px] leading-relaxed text-emerald-100/90 outline-none"
        />
      </div>
    </FieldShell>
  );
}

function KeyValueField({ field, value, onChange }: { field: ParamField; value: { key: string; value: unknown }[]; onChange: (v: unknown[]) => void }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i: number, patch: Partial<{ key: string; value: unknown }>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <FieldShell field={field}>
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8, transition: { duration: 0.12 } }}
              className="group flex items-center gap-1.5"
            >
              <input value={String(row.key ?? '')} placeholder="champ" onChange={(e) => update(i, { key: e.target.value })} className={clsx(inputCls, 'w-[38%] font-mono text-[11px]')} />
              <input value={row.value === null || row.value === undefined ? '' : String(row.value)} placeholder="valeur" onChange={(e) => update(i, { value: e.target.value })} className={clsx(inputCls, 'flex-1 font-mono text-[11px]')} />
              <button
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="btn-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          onClick={() => onChange([...rows, { key: '', value: '' }])}
          className="btn-press mt-0.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 py-1.5 text-[11px] font-medium text-white/45 hover:border-violet-400/40 hover:bg-violet-500/8 hover:text-violet-200"
        >
          <Plus size={12} /> Ajouter un champ
        </button>
      </div>
    </FieldShell>
  );
}

function ParamControl({ node, field }: { node: FlowNode; field: ParamField }) {
  const updateParams = useFlow((s) => s.updateParams);
  const value = node.data.params?.[field.key];
  const set = (v: unknown) => updateParams(node.id, { [field.key]: v });

  switch (field.type) {
    case 'boolean':
      return <ToggleField field={field} value={Boolean(value)} onChange={set} />;
    case 'keyvalue':
      return <KeyValueField field={field} value={value as { key: string; value: unknown }[]} onChange={set} />;
    case 'json':
      return <JsonField field={field} value={String(value ?? '')} onChange={set} />;
    case 'code':
      return <CodeField field={field} value={String(value ?? '')} onChange={set} />;
    case 'select':
      return (
        <FieldShell field={field}>
          <select value={String(value ?? '')} onChange={(e) => set(e.target.value)} className={clsx(inputCls, 'cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272.4%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:10px] bg-[right_10px_center] bg-no-repeat pr-7')}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value} className="bg-ink-800 text-white">{o.label}</option>
            ))}
          </select>
        </FieldShell>
      );
    case 'number':
      return (
        <FieldShell field={field}>
          <input type="number" value={value === undefined || value === null ? '' : String(value)} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} placeholder={field.placeholder} />
        </FieldShell>
      );
    case 'textarea':
      return (
        <FieldShell field={field}>
          <textarea value={String(value ?? '')} rows={4} onChange={(e) => set(e.target.value)} className={clsx(inputCls, 'resize-y leading-relaxed')} placeholder={field.placeholder} />
        </FieldShell>
      );
    default:
      return (
        <FieldShell field={field}>
          <input value={String(value ?? '')} onChange={(e) => set(e.target.value)} className={inputCls} placeholder={field.placeholder} spellCheck={false} />
        </FieldShell>
      );
  }
}

function RunData({ nodeId, kind }: { nodeId: string; kind: 'input' | 'output' }) {
  const run = useFlow((s) => {
    for (let i = s.runs.length - 1; i >= 0; i--) if (s.runs[i].nodeId === nodeId) return s.runs[i];
    return null;
  });
  const [item, setItem] = useState(0);

  useEffect(() => setItem(-1), [nodeId, run]);

  if (!run) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Info size={16} className="text-white/25" />
        <div className="text-[11.5px] text-white/35">Aucune donnée — exécutez le flux pour inspecter les entrées et sorties.</div>
      </div>
    );
  }
  if (run.status === 'skipped') {
    return <div className="py-10 text-center text-[11.5px] text-white/35">Nœud ignoré lors de cette exécution.</div>;
  }
  if (kind === 'output' && run.status === 'error') {
    return (
      <div className="rounded-lg border border-red-400/25 bg-red-500/8 p-3 text-[11.5px] text-red-200/90">
        <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={12} /> Erreur</div>
        {run.error}
      </div>
    );
  }

  const items = kind === 'input' ? run.input : run.output;
  const shown = item === -1 ? items : [items[item]].filter(Boolean);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] text-white/40">
        <span className="tabular rounded-md bg-white/6 px-1.5 py-0.5 font-semibold text-white/60">{items.length} élément{items.length > 1 ? 's' : ''}</span>
        <span>· {run.durationMs} ms</span>
      </div>
      {items.length > 1 && (
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setItem(-1)}
            className={clsx('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors', item === -1 ? 'bg-violet-500/25 text-violet-100' : 'bg-white/5 text-white/45 hover:text-white/80')}
          >
            Tout
          </button>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setItem(i)}
              className={clsx('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium tabular transition-colors', item === i ? 'bg-violet-500/25 text-violet-100' : 'bg-white/5 text-white/45 hover:text-white/80')}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <JsonView value={shown.length === 1 ? shown[0] : shown} maxHeight={340} />
    </div>
  );
}

function Panel({ id }: { id: string }) {
  const node = useFlow((s) => s.nodes.find((n) => n.id === id));
  const updateNode = useFlow((s) => s.updateNode);
  const updateParams = useFlow((s) => s.updateParams);
  const removeNode = useFlow((s) => s.removeNode);
  const select = useFlow((s) => s.select);
  const executeTo = useFlow((s) => s.executeTo);
  const runState = useFlow((s) => s.runState);
  const [tab, setTab] = useState<'params' | 'input' | 'output'>('params');

  if (!node) return null;
  const def = getDef(node.data.defType);
  const cat = CATEGORIES[def.category];
  const isNote = def.category === 'note';
  const tabs = isNote
    ? [{ id: 'params' as const, label: 'Contenu' }]
    : [
        { id: 'params' as const, label: 'Paramètres' },
        { id: 'input' as const, label: 'Entrée' },
        { id: 'output' as const, label: 'Sortie' },
      ];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 348, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="glass z-30 flex h-full shrink-0 flex-col overflow-hidden border-l"
    >
      <div className="w-[348px]">
        <div className="flex items-start gap-3 border-b border-white/6 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: cat.soft, color: cat.color, boxShadow: `inset 0 0 0 1px ${cat.color}33` }}>
            <def.icon size={17} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={node.data.label}
              onChange={(e) => updateNode(id, { label: e.target.value })}
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13.5px] font-semibold text-white/92 outline-none transition-colors hover:border-white/10 focus:border-violet-400/45 focus:bg-black/25"
            />
            <div className="mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-white/35">
              <span>{def.label}</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span style={{ color: cat.color }}>{cat.label}</span>
              {def.category === 'trigger' && <Zap size={9} style={{ color: cat.color }} />}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isNote && (
              <button
                title="Exécuter le flux jusqu’à ce nœud"
                disabled={runState === 'running' || node.data.disabled}
                onClick={() => void executeTo(id)}
                className="btn-press flex h-6.5 w-6.5 items-center justify-center rounded-md text-white/35 hover:bg-violet-500/15 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play size={12.5} />
              </button>
            )}
            {!isNote && (
              <button
                title={node.data.disabled ? 'Activer le nœud' : 'Désactiver le nœud'}
                onClick={() => updateNode(id, { disabled: !node.data.disabled })}
                className={clsx('btn-press flex h-6.5 w-6.5 items-center justify-center rounded-md text-[10px] font-bold', node.data.disabled ? 'bg-white/6 text-white/35 hover:text-white/70' : 'bg-emerald-500/15 text-emerald-300')}
              >
                {node.data.disabled ? 'OFF' : 'ON'}
              </button>
            )}
            <button onClick={() => removeNode(id)} title="Supprimer le nœud" className="btn-press flex h-6.5 w-6.5 items-center justify-center rounded-md text-white/35 hover:bg-red-500/15 hover:text-red-300">
              <Trash2 size={13} />
            </button>
            <button onClick={() => select(null)} title="Fermer" className="btn-press flex h-6.5 w-6.5 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white">
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-white/6 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx('relative px-3 pb-2 pt-1 text-[12px] font-medium transition-colors', tab === t.id ? 'text-white' : 'text-white/40 hover:text-white/70')}
            >
              {t.label}
              {tab === t.id && <motion.span layoutId="cfg-tab" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />}
            </button>
          ))}
        </div>

        <div className="h-[calc(100vh-190px)] overflow-y-auto p-3.5">
          {tab === 'params' && (
            <div>
              {def.params.length === 0 && <div className="py-8 text-center text-[11.5px] text-white/35">Ce nœud n’a aucun paramètre.</div>}
              {def.params.map((f) => (
                <ParamControl key={f.key} node={node} field={f} />
              ))}

              {!isNote && (
                <div className="mt-5 border-t border-white/6 pt-3.5">
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/65">Notes</label>
                  <textarea
                    value={node.data.notes ?? ''}
                    rows={2}
                    onChange={(e) => updateNode(id, { notes: e.target.value })}
                    placeholder="Documentez ce nœud pour votre équipe…"
                    className={clsx(inputCls, 'resize-y')}
                  />
                </div>
              )}

              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => updateParams(id, defaultParams(node.data.defType))}
                  className="btn-press rounded-lg border border-white/8 px-2.5 py-1.5 text-[11px] font-medium text-white/45 hover:bg-white/6 hover:text-white/80"
                >
                  Réinitialiser
                </button>
                <span className="self-center font-mono text-[9.5px] text-white/22">{def.type}</span>
              </div>
            </div>
          )}
          {tab === 'input' && <RunData nodeId={id} kind="input" />}
          {tab === 'output' && <RunData nodeId={id} kind="output" />}
        </div>
      </div>
    </motion.aside>
  );
}

export function ConfigPanel() {
  const selectedId = useFlow((s) => s.selectedId);
  const lastId = useRef<string | null>(null);
  if (selectedId) lastId.current = selectedId;
  const id = selectedId ?? lastId.current;
  const open = useMemo(() => Boolean(selectedId), [selectedId]);

  return (
    <AnimatePresence>
      {open && id && <Panel key={id} id={id} />}
    </AnimatePresence>
  );
}
