import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Download, type LucideIcon, KeyRound, LayoutTemplate, Play, RotateCcw, Search, Sparkles, CornerDownLeft, StickyNote as StickyIcon } from 'lucide-react';
import { CATEGORIES, NODE_DEFS } from '../data/catalog';
import { useFlow } from '../store/store';

interface CmdItem {
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useFlow((s) => s.commandOpen);
  const mode = useFlow((s) => s.commandMode);
  const setCommandOpen = useFlow((s) => s.setCommandOpen);
  const addNode = useFlow((s) => s.addNode);
  const insertOnEdge = useFlow((s) => s.insertOnEdge);
  const execute = useFlow((s) => s.execute);
  const clearAll = useFlow((s) => s.clearAll);
  const tidyUp = useFlow((s) => s.tidyUp);
  const setTemplatesOpen = useFlow((s) => s.setTemplatesOpen);
  const setCredsOpen = useFlow((s) => s.setCredsOpen);
  const exportJson = useFlow((s) => s.exportJson);
  const rf = useReactFlow();

  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }, [open]);

  const items = useMemo<CmdItem[]>(() => {
    const { nodes, edges } = useFlow.getState();
    const q = query.trim().toLowerCase();
    const insertEdgeId = mode?.insertEdge;
    const insertPos = (() => {
      if (!insertEdgeId) return null;
      const edge = edges.find((e) => e.id === insertEdgeId);
      if (!edge) return null;
      const s = nodes.find((n) => n.id === edge.source);
      const t = nodes.find((n) => n.id === edge.target);
      if (!s || !t) return null;
      return { x: (s.position.x + t.position.x) / 2, y: (s.position.y + t.position.y) / 2 };
    })();

    const actions: CmdItem[] = insertEdgeId
      ? []
      : [
          { group: 'Commandes', label: 'Exécuter le flux', hint: 'Ctrl ↵', icon: Play, run: () => void execute() },
          { group: 'Commandes', label: 'Nouveau flux vierge', icon: RotateCcw, run: () => clearAll() },
          { group: 'Commandes', label: 'Aligner les nœuds', icon: Sparkles, run: () => tidyUp() },
          {
            group: 'Commandes', label: 'Ajouter une note', icon: StickyIcon,
            run: () => {
              const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
              addNode('stickyNote', { x: center.x - 136, y: center.y - 88 });
            },
          },
          { group: 'Commandes', label: 'Parcourir les modèles', icon: LayoutTemplate, run: () => setTemplatesOpen(true) },
          { group: 'Commandes', label: 'Gérer les identifiants', hint: 'Clés API réutilisables via {{ $creds.nom }}', icon: KeyRound, run: () => setCredsOpen(true) },
          { group: 'Commandes', label: 'Exporter le flux (JSON)', icon: Download, run: () => exportJson() },
        ];

    const nodeItems: CmdItem[] = NODE_DEFS.filter((d) => {
      if (insertEdgeId && d.category === 'note') return false;
      if (!q) return true;
      return d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.type.toLowerCase().includes(q);
    }).map((def) => ({
      group: 'Ajouter un nœud',
      label: def.label,
      hint: def.description,
      icon: def.icon,
      color: CATEGORIES[def.category].color,
      run: () => {
        if (insertEdgeId && insertPos) {
          insertOnEdge(def.type, insertEdgeId, { x: insertPos.x, y: insertPos.y });
        } else {
          const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addNode(def.type, { x: center.x - 124, y: center.y - 46 });
        }
      },
    }));

    const filterActions = actions.filter((a) => !q || a.label.toLowerCase().includes(q));
    return [...filterActions, ...nodeItems];
  }, [query, mode, addNode, insertOnEdge, execute, clearAll, tidyUp, setTemplatesOpen, setCredsOpen, exportJson, rf, open]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const close = () => setCommandOpen(false);
  const choose = (item: CmdItem) => {
    close();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[index]) choose(items[index]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  let lastGroup = '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 p-4 backdrop-blur-[3px]"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="glass mt-[10vh] w-full max-w-[580px] overflow-hidden rounded-2xl border shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-white/7 px-4">
              <Search size={15} className="shrink-0 text-white/35" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode?.insertEdge ? 'Insérer un nœud entre les deux…' : 'Rechercher un nœud ou une commande…'}
                className="h-12 flex-1 bg-transparent text-[13.5px] text-white/90 outline-none placeholder:text-white/30"
              />
              <span className="kbd">esc</span>
            </div>

            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
              {items.length === 0 && <div className="py-8 text-center text-[12px] text-white/35">Aucun résultat pour « {query} »</div>}
              {items.map((item, i) => {
                const showHeader = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={`${item.group}-${item.label}`}>
                    {showHeader && (
                      <div className="px-2.5 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/28">{item.group}</div>
                    )}
                    <button
                      data-idx={i}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => choose(item)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                        i === index ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: item.color ? `${item.color}1f` : 'rgba(255,255,255,0.06)',
                          color: item.color ?? 'rgba(233,233,242,0.7)',
                        }}
                      >
                        <item.icon size={14} strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-white/90">{item.label}</span>
                        {item.hint && <span className="block truncate text-[10.5px] text-white/35">{item.hint}</span>}
                      </span>
                      {i === index && <CornerDownLeft size={12} className="shrink-0 text-white/30" />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 border-t border-white/6 px-4 py-2 text-[10px] text-white/30">
              <span className="flex items-center gap-1"><span className="kbd">↑↓</span> naviguer</span>
              <span className="flex items-center gap-1"><span className="kbd">↵</span> choisir</span>
              <span className="flex items-center gap-1"><span className="kbd">esc</span> fermer</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
