import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { AlertTriangle, Check, Loader2, Zap } from 'lucide-react';
import { CATEGORIES, getDef } from '../data/catalog';
import { useFlow } from '../store/store';
import type { FlowNode as TFlowNode } from '../types';

function FlowNodeInner({ id, data, selected }: NodeProps<TFlowNode>) {
  const def = getDef(data.defType);
  const cat = CATEGORIES[def.category];
  const status = useFlow((s) => s.statuses[id] ?? 'idle');
  const isSelected = useFlow((s) => s.selectedId === id) || Boolean(selected);
  const itemCount = useFlow((s) => {
    for (let i = s.runs.length - 1; i >= 0; i--) {
      const r = s.runs[i];
      if (r.nodeId === id) return r.status === 'success' ? r.output.length : undefined;
    }
    return undefined;
  });

  const outCount = def.outputs.length;
  const handleTop = (i: number, total: number) => `${((i + 1) / (total + 1)) * 100}%`;

  return (
    <div
      className={clsx(
        'flux-node w-[248px]',
        isSelected && 'is-selected',
        status === 'running' && 'is-running',
        status === 'success' && 'is-success',
        status === 'error' && 'is-error',
        status === 'skipped' && 'is-skipped',
        data.disabled && 'is-disabled'
      )}
      style={{ ['--cat' as string]: cat.color }}
    >
      {def.inputs > 0 &&
        Array.from({ length: def.inputs }).map((_, i) => (
          <Handle
            key={`in-${i}`}
            id={`in-${i}`}
            type="target"
            position={Position.Left}
            style={{ top: handleTop(i, def.inputs), ['--cat' as string]: cat.color }}
          />
        ))}

      {def.outputs.map((label, i) => (
        <div key={`out-${i}`}>
          <Handle
            id={`out-${i}`}
            type="source"
            position={Position.Right}
            style={{ top: handleTop(i, outCount), ['--cat' as string]: cat.color }}
          />
          {outCount > 1 && (
            <span
              className="absolute -translate-y-1/2 text-[9.5px] font-semibold tracking-wide"
              style={{ right: 10, top: handleTop(i, outCount), color: cat.color, opacity: 0.85 }}
            >
              {label}
            </span>
          )}
        </div>
      ))}

      <motion.div
        initial={{ scale: 0.86, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
        className="node-body px-3.5 py-3"
      >
        <div className="flex items-start gap-3">
          <div
            className="node-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: cat.soft, color: cat.color, boxShadow: `inset 0 0 0 1px ${cat.color}33` }}
          >
            <def.icon size={17} strokeWidth={2.1} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className={clsx('truncate text-[12.5px] font-semibold leading-tight text-white/92', data.disabled && 'line-through opacity-60')}>
              {data.label}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-medium text-white/35">
              <span className="truncate">{def.label}</span>
              {def.category === 'trigger' && (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[8.5px] font-bold tracking-wider" style={{ background: cat.soft, color: cat.color }}>
                  <Zap size={8} /> DÉCLENCHEUR
                </span>
              )}
            </div>
          </div>

          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            {status === 'running' && <Loader2 size={15} className="animate-spin" style={{ color: cat.color }} />}
            {status === 'success' && (
              <span className="pop-in flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500/15">
                <Check size={11} strokeWidth={3.2} className="text-emerald-400" />
              </span>
            )}
            {status === 'error' && <AlertTriangle size={14} className="text-red-400" />}
          </div>
        </div>

        {(itemCount !== undefined || status === 'error') && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-center gap-2 border-t border-white/5 pt-1.5"
          >
            {itemCount !== undefined && (
              <span className="tabular rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] font-medium text-white/55">
                {itemCount} élément{itemCount > 1 ? 's' : ''}
              </span>
            )}
            {status === 'error' && <span className="text-[9.5px] font-semibold text-red-400/90">Échec du nœud</span>}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);
