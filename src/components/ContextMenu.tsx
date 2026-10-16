import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BoxSelect, ClipboardPaste, Copy, CopyPlus, Maximize2, Play, Plus, Power, PowerOff,
  Settings2, StickyNote as StickyIcon, Trash2, Unlink, type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { XYPosition } from '@xyflow/react';
import { getDef } from '../data/catalog';
import { useFlow } from '../store/store';

export interface ContextTarget {
  kind: 'node' | 'edge' | 'pane';
  id?: string;
  x: number;
  y: number;
  flowPos?: XYPosition;
}

interface MenuItem {
  label: string;
  icon: LucideIcon;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action: () => void;
}

export function ContextMenu({ target, onClose }: { target: ContextTarget; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: target.x, y: target.y });
  const runState = useFlow((s) => s.runState);
  const hasClipboard = useFlow((s) => s.hasClipboard);
  const node = useFlow((s) => (target.kind === 'node' ? s.nodes.find((n) => n.id === target.id) : undefined));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(10, Math.min(target.x, window.innerWidth - r.width - 10)),
      y: Math.max(10, Math.min(target.y, window.innerHeight - r.height - 10)),
    });
  }, [target]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  const st = useFlow.getState();
  const items: MenuItem[] = [];

  if (target.kind === 'node' && node) {
    const isNote = getDef(node.data.defType).category === 'note';
    const isDisabled = !!node.data.disabled;
    items.push({
      label: 'Ouvrir les paramètres',
      icon: Settings2,
      action: () => st.select(node.id),
    });
    if (!isNote) {
      items.push({
        label: 'Exécuter jusqu’ici',
        icon: Play,
        disabled: runState === 'running' || isDisabled,
        action: () => void st.executeTo(node.id),
      });
    }
    items.push(
      { label: 'Dupliquer', icon: CopyPlus, kbd: 'Ctrl D', action: () => st.duplicateSelection(node.id) },
      { label: 'Copier', icon: Copy, kbd: 'Ctrl C', action: () => st.copySelection(node.id) },
      {
        label: isDisabled ? 'Activer' : 'Désactiver',
        icon: isDisabled ? Power : PowerOff,
        kbd: 'D',
        action: () => st.updateNode(node.id, { disabled: !isDisabled }),
      },
      {
        label: 'Supprimer',
        icon: Trash2,
        kbd: 'Suppr',
        danger: true,
        separator: true,
        action: () => st.removeNode(node.id),
      }
    );
  } else if (target.kind === 'edge' && target.id) {
    items.push(
      { label: 'Insérer un nœud…', icon: Plus, action: () => st.setCommandOpen(true, { insertEdge: target.id }) },
      { label: 'Supprimer la connexion', icon: Unlink, kbd: 'Suppr', danger: true, separator: true, action: () => st.onEdgesChange([{ type: 'remove', id: target.id! }]) }
    );
  } else {
    const flowPos = target.flowPos ?? { x: 0, y: 0 };
    items.push(
      { label: 'Ajouter un nœud…', icon: Plus, kbd: 'Ctrl K', action: () => st.setCommandOpen(true, null) },
      { label: 'Ajouter une note', icon: StickyIcon, action: () => st.addNode('stickyNote', { x: flowPos.x - 130, y: flowPos.y - 90 }) },
      {
        label: 'Coller',
        icon: ClipboardPaste,
        kbd: 'Ctrl V',
        disabled: !hasClipboard,
        separator: true,
        action: () => st.pasteClipboard(),
      },
      { label: 'Tout sélectionner', icon: BoxSelect, kbd: 'Ctrl A', action: () => st.selectAll() },
      { label: 'Organiser automatiquement', icon: Maximize2, action: () => st.tidyUp() }
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, transformOrigin: 'top left', zIndex: 80 }}
      className="glass w-[228px] rounded-xl border border-white/10 p-1.5 shadow-2xl"
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.separator && <div className="mx-2 my-1 h-px bg-white/8" />}
          <button
            disabled={item.disabled}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12px] transition-colors ${
              item.disabled
                ? 'cursor-not-allowed text-white/25'
                : item.danger
                  ? 'text-rose-300/90 hover:bg-rose-500/12 hover:text-rose-200'
                  : 'text-white/78 hover:bg-white/8 hover:text-white'
            }`}
          >
            <item.icon size={13.5} className="shrink-0 opacity-80" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.kbd && <span className="kbd opacity-70">{item.kbd}</span>}
          </button>
        </div>
      ))}
    </motion.div>
  );
}
