import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Eraser, MinusCircle, Terminal, X } from 'lucide-react';
import { CATEGORIES, getDef } from '../data/catalog';
import { useFlow } from '../store/store';
import { JsonView } from './JsonView';

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <Check size={11} strokeWidth={3.2} className="text-emerald-400" />;
  if (status === 'error') return <AlertTriangle size={11} className="text-red-400" />;
  return <MinusCircle size={11} className="text-white/35" />;
}

export function ExecutionPanel() {
  const open = useFlow((s) => s.panelOpen);
  const runs = useFlow((s) => s.runs);
  const nodes = useFlow((s) => (s.panelOpen ? s.nodes : null));
  const runState = useFlow((s) => s.runState);
  const lastDurationMs = useFlow((s) => s.lastDurationMs);
  const setPanelOpen = useFlow((s) => s.setPanelOpen);
  const clearRuns = useFlow((s) => s.clearRuns);
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeCount = nodes?.filter((n) => !n.data.disabled && getDef(n.data.defType).category !== 'note').length ?? 0;
  const progress = runState === 'success' ? 1 : activeCount ? Math.min(1, runs.length / activeCount) : 0;
  const ordered = useMemo(() => [...runs].reverse(), [runs]);

  const pill =
    runState === 'running'
      ? { label: 'Exécution en cours', cls: 'border-violet-400/35 bg-violet-500/15 text-violet-200', dot: 'bg-violet-400' }
      : runState === 'success'
        ? { label: `Succès · ${((lastDurationMs ?? 0) / 1000).toFixed(1)} s`, cls: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300', dot: 'bg-emerald-400' }
        : runState === 'error'
          ? { label: 'Échec', cls: 'border-red-400/35 bg-red-500/12 text-red-300', dot: 'bg-red-400' }
          : { label: 'Prêt', cls: 'border-white/10 bg-white/5 text-white/50', dot: 'bg-white/35' };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 36 }}
          className="glass absolute inset-x-0 bottom-0 z-30 overflow-hidden border-t shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)]"
        >
          <div className="relative">
            {runState === 'running' && (
              <motion.div
                className="absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400"
                animate={{ scaleX: progress }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            )}
            <div className="flex h-11 items-center gap-3 px-4">
              <Terminal size={14} className="text-white/40" />
              <span className="text-[12px] font-semibold text-white/75">Exécutions</span>
              <span className={clsx('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', pill.cls)}>
                <span className={clsx('h-1.5 w-1.5 rounded-full', pill.dot, runState === 'running' && 'animate-pulse')} />
                {pill.label}
              </span>
              <span className="text-[10.5px] text-white/30">
                {runs.filter((r) => r.status === 'success').length} réussis
                {runs.some((r) => r.status === 'skipped') && ` · ${runs.filter((r) => r.status === 'skipped').length} ignorés`}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={clearRuns} title="Effacer l’historique" className="btn-press flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-white/45 hover:bg-white/8 hover:text-white/85">
                  <Eraser size={12} /> Effacer
                </button>
                <button onClick={() => setPanelOpen(false)} title="Réduire" className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white">
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => setPanelOpen(false)} title="Fermer" className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white">
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="max-h-[240px] overflow-y-auto border-t border-white/5 px-2 pb-2">
              {ordered.length === 0 && (
                <div className="py-8 text-center text-[11.5px] text-white/35">Aucune exécution pour le moment. Lancez le flux avec <span className="kbd">Ctrl ↵</span>.</div>
              )}
              {ordered.map((run, idx) => {
                const node = nodes?.find((n) => n.id === run.nodeId);
                const def = node ? getDef(node.data.defType) : null;
                const cat = def ? CATEGORIES[def.category] : null;
                const isOpen = expanded === `${run.nodeId}-${idx}`;
                return (
                  <motion.div
                    key={`${run.nodeId}-${idx}`}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 overflow-hidden rounded-lg border border-transparent hover:border-white/6 hover:bg-white/[0.03]"
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : `${run.nodeId}-${idx}`)}
                      disabled={run.status === 'skipped'}
                      className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left disabled:cursor-default"
                    >
                      <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md', run.status === 'success' ? 'bg-emerald-500/12' : run.status === 'error' ? 'bg-red-500/12' : 'bg-white/5')}>
                        <StatusIcon status={run.status} />
                      </span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: cat?.color ?? '#64748b', boxShadow: run.status === 'skipped' ? undefined : `0 0 7px ${cat?.color ?? '#64748b'}` }}
                      />
                      <span className={clsx('truncate text-[12px] font-medium', run.status === 'skipped' ? 'text-white/35' : 'text-white/85')}>
                        {node?.data.label ?? def?.label ?? 'Nœud supprimé'}
                      </span>
                      {run.status === 'skipped' && <span className="shrink-0 text-[10px] text-white/25">ignoré</span>}
                      {typeof run.error === 'string' && <span className="truncate text-[10.5px] text-red-300/80">{run.error}</span>}
                      <span className="ml-auto flex shrink-0 items-center gap-2.5 text-[10px] text-white/35">
                        {run.status !== 'skipped' && (
                          <span className="tabular">{run.input.length} → {run.output.length} élém.</span>
                        )}
                        <span className="tabular w-[52px] text-right">{run.durationMs} ms</span>
                        {run.status !== 'skipped' && <ChevronDown size={12} className={clsx('transition-transform duration-200', isOpen && 'rotate-180')} />}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.3, 0.8, 0.35, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5">
                            <div>
                              <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-white/30">Entrée</div>
                              <JsonView value={run.input} maxHeight={150} />
                            </div>
                            <div>
                              <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-white/30">Sortie</div>
                              {run.status === 'error' ? (
                                <div className="rounded-lg border border-red-400/25 bg-red-500/8 p-2.5 text-[11px] text-red-200/90">{run.error}</div>
                              ) : (
                                <JsonView value={run.output} maxHeight={150} />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
