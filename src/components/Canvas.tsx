import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useReactFlow, useViewport,
  type Node,
} from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Clock, MousePointerClick, PanelLeft, Webhook, ZoomIn } from 'lucide-react';
import { CATEGORIES, getDef } from '../data/catalog';
import { useFlow } from '../store/store';
import { FlowNode } from './FlowNode';
import { FlowEdge } from './FlowEdge';
import { StickyNote } from './StickyNote';
import { ContextMenu, type ContextTarget } from './ContextMenu';
import { ExecutionPanel } from './ExecutionPanel';
import logoWordmark from '../assets/logo-formatpro3.png';

const nodeTypes = { flux: FlowNode, note: StickyNote };
const edgeTypes = { flux: FlowEdge };

const minimapColor = (n: Node) => {
  const t = (n.data as { defType?: string }).defType;
  return t ? CATEGORIES[getDef(t).category].color : '#a78bfa';
};

function EmptyState() {
  const addNode = useFlow((s) => s.addNode);
  const setTemplatesOpen = useFlow((s) => s.setTemplatesOpen);
  const quick = [
    { type: 'manualTrigger', label: 'Déclencheur manuel', icon: MousePointerClick, hint: 'Lancement à la demande' },
    { type: 'webhookTrigger', label: 'Webhook', icon: Webhook, hint: 'Appel HTTP entrant' },
    { type: 'scheduleTrigger', label: 'Planificateur', icon: Clock, hint: 'Toutes les heures, jours…' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
    >
      <div className="glass pointer-events-auto w-[460px] rounded-2xl border p-6 text-center shadow-2xl">
        <img
          src={logoWordmark}
          alt="FormatPro3"
          className="mx-auto h-11 w-auto object-contain drop-shadow-[0_6px_22px_rgba(56,120,255,0.35)]"
        />
        <h2 className="mt-3 text-[16px] font-bold text-white/92">Créez votre premier flux</h2>
        <p className="mx-auto mt-1.5 max-w-[340px] text-[12px] leading-relaxed text-white/45">
          Tout flux démarre par un déclencheur. Choisissez-en un, puis enchaînez les actions sur le canvas.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {quick.map((q) => (
            <motion.button
              key={q.type}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => addNode(q.type, { x: 120 + quick.indexOf(q) * 20, y: 80 + quick.indexOf(q) * 20 })}
              className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.035] px-2 py-3 hover:border-violet-400/40 hover:bg-violet-500/10"
            >
              <q.icon size={17} className="text-violet-300" />
              <span className="text-[11px] font-medium text-white/80">{q.label}</span>
              <span className="text-[9px] text-white/35">{q.hint}</span>
            </motion.button>
          ))}
        </div>
        <button
          onClick={() => setTemplatesOpen(true)}
          className="btn-press mt-3 w-full rounded-xl border border-white/8 bg-white/4 py-2.5 text-[12px] font-medium text-white/70 hover:bg-white/8 hover:text-white"
        >
          … ou partez d’un modèle prêt à l’emploi
        </button>
      </div>
    </motion.div>
  );
}

function ZoomPill() {
  const { zoom } = useViewport();
  return (
    <span className="flex items-center gap-1 tabular">
      <ZoomIn size={11} />
      {Math.round(zoom * 100)} %
    </span>
  );
}

export function Canvas() {
  const nodes = useFlow((s) => s.nodes);
  const edges = useFlow((s) => s.edges);
  const orderedNodes = useMemo(
    () => [...nodes].sort((a, b) => Number(b.type === 'note') - Number(a.type === 'note')),
    [nodes]
  );
  const onNodesChange = useFlow((s) => s.onNodesChange);
  const onEdgesChange = useFlow((s) => s.onEdgesChange);
  const onConnect = useFlow((s) => s.onConnect);
  const select = useFlow((s) => s.select);
  const addNode = useFlow((s) => s.addNode);
  const pushHistory = useFlow((s) => s.pushHistory);
  const paletteOpen = useFlow((s) => s.paletteOpen);
  const setPaletteOpen = useFlow((s) => s.setPaletteOpen);
  const panelOpen = useFlow((s) => s.panelOpen);
  const setPanelOpen = useFlow((s) => s.setPanelOpen);
  const runsCount = useFlow((s) => s.runs.length);
  const rf = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<ContextTarget | null>(null);
  const fitSignal = useFlow((s) => s.fitSignal);

  useEffect(() => {
    if (!fitSignal) return;
    const t = setTimeout(() => void rf.fitView({ padding: 0.24, maxZoom: 1.05, duration: 520 }), 80);
    return () => clearTimeout(t);
  }, [fitSignal, rf]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragging(true);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const type = e.dataTransfer.getData('application/fluxia-node');
      if (!type) return;
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, { x: pos.x - 124, y: pos.y - 46 });
    },
    [addNode, rf]
  );

  const bottomOffset = panelOpen ? 306 : 16;

  return (
    <div className="canvas-shell relative min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => setDragging(false)}>
      <ReactFlow
        nodes={orderedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.24, maxZoom: 1.05 }}
        minZoom={0.18}
        maxZoom={2.2}
        deleteKeyCode={['Delete']}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control']}
        onNodeDragStart={() => pushHistory()}
        onPaneClick={() => select(null)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          setMenu({ kind: 'node', id: node.id, x: e.clientX, y: e.clientY });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          setMenu({ kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY });
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setMenu({ kind: 'pane', x: e.clientX, y: e.clientY, flowPos });
        }}
        connectionLineStyle={{ stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '5 5' }}
        connectionRadius={34}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="rgba(255,255,255,0.075)" />
        <Controls
          position="bottom-left"
          showInteractive={false}
          style={{ bottom: bottomOffset, transition: 'bottom 0.32s cubic-bezier(0.3,0.8,0.3,1)', left: 16 }}
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={minimapColor}
          nodeStrokeWidth={3}
          maskColor="rgba(6,6,11,0.68)"
          style={{ bottom: bottomOffset, transition: 'bottom 0.32s cubic-bezier(0.3,0.8,0.3,1)', right: 16, width: 168, height: 108 }}
        />
      </ReactFlow>

      <AnimatePresence>{nodes.length === 0 && <EmptyState key="empty" />}</AnimatePresence>

      <AnimatePresence>
        {!paletteOpen && (
          <motion.button
            key="open-palette"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={() => setPaletteOpen(true)}
            title="Afficher les nœuds"
            className="glass btn-press absolute left-3 top-3 z-20 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium text-white/70 hover:text-white"
          >
            <PanelLeft size={14} /> Nœuds
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!panelOpen && runsCount > 0 && (
          <motion.button
            key="open-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => setPanelOpen(true)}
            className="glass btn-press absolute bottom-3 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 text-[11.5px] font-medium text-white/75 hover:text-white"
          >
            <ChevronRight size={13} className="-rotate-90" />
            Exécutions <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular">{runsCount}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nodes.length > 0 && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass pointer-events-none absolute right-3 top-3 z-20 flex h-8 items-center gap-2.5 rounded-lg border border-white/8 px-3 text-[11px] text-white/50"
          >
            <span className="tabular">{nodes.filter((n) => n.data.defType !== 'stickyNote').length} nœuds</span>
            <span className="h-3 w-px bg-white/10" />
            <span className="tabular">{edges.length} lien{edges.length > 1 ? 's' : ''}</span>
            <span className="h-3 w-px bg-white/10" />
            <ZoomPill />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[10px] text-white/28 lg:flex">
        <span className="flex items-center gap-1"><span className="kbd">Ctrl K</span> palette</span>
        <span className="flex items-center gap-1"><span className="kbd">Ctrl ↵</span> exécuter</span>
        <span className="flex items-center gap-1"><span className="kbd">Maj</span> + glisser : sélection</span>
        <span className="flex items-center gap-1">clic droit : menu</span>
      </div>

      <ExecutionPanel />

      {menu && <ContextMenu target={menu} onClose={() => setMenu(null)} />}

      <AnimatePresence>
        {dragging && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-20 rounded-2xl border-2 border-dashed border-violet-400/45 bg-violet-500/6 backdrop-blur-[1px]"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-ink-900/90 px-4 py-2 text-[12.5px] font-medium text-violet-200 shadow-xl">
              Déposez pour ajouter le nœud
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
