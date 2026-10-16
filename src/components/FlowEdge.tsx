import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CATEGORIES, getDef } from '../data/catalog';
import { useFlow } from '../store/store';

function FlowEdgeInner({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
}: EdgeProps) {
  const active = useFlow((s) => s.activeEdges.includes(id));
  const done = useFlow((s) => Boolean(s.edgeDone[id]));
  const sourceType = useFlow((s) => s.nodes.find((n) => n.id === source)?.data.defType);
  const onEdgesChange = useFlow((s) => s.onEdgesChange);
  const setCommandOpen = useFlow((s) => s.setCommandOpen);
  const [hover, setHover] = useState(false);

  const cat = sourceType ? CATEGORIES[getDef(sourceType).category] : null;
  const color = cat?.color ?? '#a78bfa';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const stroke = active ? color : done ? 'rgba(52,211,153,0.55)' : hover ? 'rgba(196,181,253,0.75)' : 'rgba(148,163,184,0.3)';

  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <path d={edgePath} fill="none" strokeWidth={hover || active ? 18 : 12} stroke="transparent" style={{ pointerEvents: 'stroke' }} />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: active ? 2.4 : hover ? 2 : 1.6,
          filter: active ? `drop-shadow(0 0 6px ${color})` : undefined,
        }}
      />
      {active && (
        <>
          <path d={edgePath} className="edge-flow" style={{ stroke: color, color }} />
          {[0, 1, 2].map((i) => (
            <circle key={i} r={3} fill="#fff" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
              <animateMotion dur="0.85s" repeatCount="indefinite" path={edgePath} begin={`${i * 0.28}s`} />
            </circle>
          ))}
        </>
      )}
      <EdgeLabelRenderer>
        {(hover || active) && (
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          >
            <button
              title="Insérer un nœud ici"
              onClick={() => setCommandOpen(true, { insertEdge: id })}
              className="btn-press flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/12 bg-ink-800/95 text-white/70 shadow-lg hover:border-violet-400/60 hover:bg-violet-500/25 hover:text-white"
            >
              <Plus size={11} strokeWidth={2.6} />
            </button>
            <button
              title="Supprimer la connexion"
              onClick={() => onEdgesChange([{ id, type: 'remove' }])}
              className="btn-press flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/12 bg-ink-800/95 text-white/55 shadow-lg hover:border-red-400/60 hover:bg-red-500/25 hover:text-white"
            >
              <X size={10} strokeWidth={2.6} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </g>
  );
}

export const FlowEdge = memo(FlowEdgeInner);
