import { useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, Search, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_ORDER, NODE_DEFS } from '../data/catalog';
import { useFlow } from '../store/store';
import type { NodeCategory } from '../types';

export function NodePalette() {
  const paletteOpen = useFlow((s) => s.paletteOpen);
  const setPaletteOpen = useFlow((s) => s.setPaletteOpen);
  const addNode = useFlow((s) => s.addNode);
  const rf = useReactFlow();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Partial<Record<NodeCategory, boolean>>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NODE_DEFS;
    return NODE_DEFS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(
    () => CATEGORY_ORDER.map((cat) => ({ cat, defs: filtered.filter((d) => d.category === cat) })).filter((g) => g.defs.length > 0),
    [filtered]
  );

  const addAtCenter = (type: string) => {
    const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    addNode(type, { x: center.x - 124, y: center.y - 46 + Math.random() * 40 });
  };

  return (
    <AnimatePresence initial={false}>
      {paletteOpen && (
        <motion.aside
          key="palette"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 272, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          className="glass z-30 flex h-full shrink-0 flex-col overflow-hidden border-r"
        >
          <div className="flex w-[272px] flex-col gap-2.5 p-3 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Nœuds</span>
                <span className="rounded-full bg-white/6 px-1.5 py-px text-[9.5px] font-semibold text-white/40">{NODE_DEFS.length}</span>
              </div>
              <button
                onClick={() => setPaletteOpen(false)}
                title="Réduire le panneau"
                className="btn-press flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/8 hover:text-white"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un nœud…"
                className="w-full rounded-lg border border-white/8 bg-white/4 py-2 pl-8 pr-7 text-[12px] text-white/85 outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/45 focus:bg-white/6"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/35 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {groups.map(({ cat, defs }) => {
              const meta = CATEGORIES[cat];
              const isCollapsed = collapsed[cat] && !query;
              return (
                <div key={cat} className="mb-1.5">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/4"
                  >
                    <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.18 }}>
                      <ChevronDown size={12} className="text-white/35" />
                    </motion.span>
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
                    <span className="text-[11.5px] font-semibold text-white/75">{meta.label}</span>
                    <span className="ml-auto text-[9.5px] font-medium text-white/25">{defs.length}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 0.8, 0.35, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-0.5 pt-0.5">
                          {defs.map((def) => (
                            <button
                              key={def.type}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/fluxia-node', def.type);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={() => addAtCenter(def.type)}
                              title={`${def.label} — ${def.description}`}
                              className="group flex w-full cursor-grab items-center gap-2.5 rounded-[10px] border border-transparent px-2 py-[7px] text-left transition-[transform,background,border-color] duration-200 hover:translate-x-1 hover:border-white/9 hover:bg-white/[0.055] active:cursor-grabbing"
                            >
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                                style={{ background: meta.soft, color: meta.color, boxShadow: `inset 0 0 0 1px ${meta.color}2e` }}
                              >
                                <def.icon size={14} strokeWidth={2.1} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-medium leading-tight text-white/85">
                                  {def.label}
                                </span>
                                <span className="mt-0.5 block truncate text-[9.5px] text-white/32">{def.description}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {groups.length === 0 && (
              <div className="px-2 py-8 text-center text-[11.5px] text-white/35">Aucun nœud ne correspond à « {query} »</div>
            )}
          </div>

          <div className="w-[272px] border-t border-white/6 px-3.5 py-2.5 text-[10px] leading-relaxed text-white/30">
            Glissez un nœud sur le canvas, ou cliquez pour l’ajouter au centre.
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
