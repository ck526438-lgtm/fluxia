import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { StickyNote as StickyIcon } from 'lucide-react';
import { useFlow } from '../store/store';
import type { FlowNode } from '../types';

const COLORS: Record<string, { bg: string; border: string; ink: string }> = {
  jaune: { bg: 'rgba(250, 204, 21, 0.10)', border: 'rgba(250, 204, 21, 0.42)', ink: '#fde68a' },
  violet: { bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.42)', ink: '#ddd6fe' },
  bleu: { bg: 'rgba(96, 165, 250, 0.10)', border: 'rgba(96, 165, 250, 0.42)', ink: '#bfdbfe' },
  vert: { bg: 'rgba(52, 211, 153, 0.10)', border: 'rgba(52, 211, 153, 0.42)', ink: '#a7f3d0' },
};

function StickyNoteInner({ id, selected, data }: NodeProps<FlowNode>) {
  const updateParams = useFlow((s) => s.updateParams);
  const text = String(data.params?.text ?? '');
  const colorKey = String(data.params?.color ?? 'jaune');
  const c = COLORS[colorKey] ?? COLORS.jaune;

  return (
    <div
      className="h-full w-full rounded-xl transition-shadow"
      style={{
        background: `linear-gradient(160deg, ${c.bg}, rgba(10, 12, 20, 0.72))`,
        border: `1px solid ${selected ? c.border : 'rgba(148, 163, 184, 0.18)'}`,
        boxShadow: selected ? `0 0 0 3px ${c.bg}, 0 18px 40px rgba(0,0,0,0.45)` : '0 10px 26px rgba(0,0,0,0.32)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={110}
        lineStyle={{ border: 'none' }}
        handleStyle={{ width: 9, height: 9, borderRadius: 3, background: c.ink, border: 'none' }}
      />
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 select-none" style={{ color: c.ink }}>
        <StickyIcon size={13} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">Note</span>
      </div>
      <textarea
        className="nodrag nopan nowheel h-[calc(100%-30px)] w-full resize-none bg-transparent px-3 pb-2.5 text-[12.5px] leading-relaxed outline-none placeholder:text-slate-500"
        style={{ color: '#e2e8f0' }}
        value={text}
        placeholder="Écrivez votre note…"
        spellCheck={false}
        onChange={(e) => updateParams(id, { text: e.target.value })}
      />
    </div>
  );
}

export const StickyNote = memo(StickyNoteInner);
