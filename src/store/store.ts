import { create, type StoreApi } from 'zustand';
import {
  addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type NodeChange, type XYPosition,
} from '@xyflow/react';
import dagre from 'dagre';
import { defaultParams, getDef } from '../data/catalog';
import { TEMPLATES } from '../data/templates';
import { executeWorkflow } from '../engine/engine';
import type { FlowNode, FlowNodeData, NodeStatus, RunRecord, Template, WorkflowFile } from '../types';

export const STORAGE_KEY = 'fluxia:workflow:v1';
export const CREDENTIALS_KEY = 'fluxia:credentials:v1';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface Snapshot {
  nodes: FlowNode[];
  edges: Edge[];
}

export type RunState = 'idle' | 'running' | 'success' | 'error';

export interface FlowState {
  name: string;
  nodes: FlowNode[];
  edges: Edge[];
  selectedId: string | null;
  runState: RunState;
  statuses: Record<string, NodeStatus>;
  edgeDone: Record<string, boolean>;
  activeEdges: string[];
  runs: RunRecord[];
  runStartedAt: number | null;
  lastDurationMs: number | null;
  speed: 'normal' | 'turbo';
  panelOpen: boolean;
  paletteOpen: boolean;
  commandOpen: boolean;
  commandMode: { insertEdge?: string } | null;
  templatesOpen: boolean;
  toasts: Toast[];
  past: Snapshot[];
  future: Snapshot[];
  lastSavedAt: number | null;
  hasClipboard: boolean;
  credentials: Record<string, string>;
  credsOpen: boolean;

  setName: (name: string) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  select: (id: string | null) => void;
  addNode: (defType: string, position: XYPosition, opts?: { select?: boolean }) => string;
  insertOnEdge: (defType: string, edgeId: string, position: XYPosition) => void;
  updateNode: (id: string, patch: Partial<FlowNodeData>) => void;
  updateParams: (id: string, params: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  duplicateSelection: (targetId?: string) => void;
  copySelection: (targetId?: string) => void;
  pasteClipboard: () => void;
  pushHistory: (key?: string) => void;
  undo: () => void;
  redo: () => void;
  tidyUp: () => void;
  clearAll: () => void;
  loadTemplate: (t: Template) => void;
  exportJson: () => void;
  importJson: (file: File) => Promise<void>;
  execute: () => Promise<void>;
  executeTo: (nodeId: string) => Promise<void>;
  stop: () => void;
  setSpeed: (s: 'normal' | 'turbo') => void;
  setPanelOpen: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean, mode?: { insertEdge?: string } | null) => void;
  setTemplatesOpen: (v: boolean) => void;
  pushToast: (type: Toast['type'], title: string, message?: string) => void;
  dismissToast: (id: number) => void;
  clearRuns: () => void;
  selectAll: () => void;
  markSaved: () => void;
  setCredential: (name: string, value: string) => void;
  removeCredential: (name: string) => void;
  setCredsOpen: (v: boolean) => void;
  fitSignal: number;
}

let toastSeq = 1;
let abortRef: AbortController | null = null;
let clipboard: { nodes: FlowNode[]; edges: Edge[] } | null = null;
let lastHistoryKey = '';
let lastHistoryAt = 0;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

function makeNode(defType: string, position: XYPosition, overrides?: { params?: Record<string, unknown>; label?: string }): FlowNode {
  const def = getDef(defType);
  const params = { ...defaultParams(defType), ...(overrides?.params ?? {}) };
  const isNote = def.category === 'note';
  return {
    id: uid('n'),
    type: isNote ? 'note' : 'flux',
    position,
    ...(isNote ? { style: { width: 272, height: 176 }, zIndex: 0 } : {}),
    data: { defType, label: overrides?.label ?? def.label, params },
  };
}

function makeEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): Edge {
  return {
    id: uid('e'),
    source,
    target,
    sourceHandle: sourceHandle ?? 'out-0',
    targetHandle: targetHandle ?? 'in-0',
    type: 'flux',
  };
}

function snapshot(s: FlowState): Snapshot {
  return { nodes: structuredClone(s.nodes), edges: structuredClone(s.edges) };
}

function initialWorkflow(): { name: string; nodes: FlowNode[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkflowFile;
      if (parsed?.nodes?.length) return { name: parsed.name ?? 'Mon flux', nodes: parsed.nodes, edges: parsed.edges ?? [] };
    }
  } catch { /* ignore */ }
  const t = TEMPLATES[0].build();
  return { name: TEMPLATES[0].name, nodes: t.nodes, edges: t.edges };
}

export function saveWorkflow(name: string, nodes: FlowNode[], edges: Edge[]) {
  try {
    const file: WorkflowFile = { name, nodes, edges, version: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch { /* quota */ }
}

const boot = initialWorkflow();

function loadCredentials(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
      }
    }
  } catch { /* ignore */ }
  return {};
}

function saveCredentials(credentials: Record<string, string>) {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch { /* quota */ }
}

const bootCreds = loadCredentials();

type SetFn = StoreApi<FlowState>['setState'];

async function runWorkflowOn(
  get: () => FlowState,
  set: SetFn,
  nodes: FlowNode[],
  edges: Edge[],
  opts?: { scoped?: boolean; label?: string },
) {
  const turbo = get().speed === 'turbo';
  abortRef = new AbortController();
  set({
    runState: 'running', statuses: {}, edgeDone: {}, activeEdges: [], runs: [],
    runStartedAt: Date.now(), lastDurationMs: null, panelOpen: true,
  });
  const startedAt = Date.now();
  try {
    await executeWorkflow({
      nodes,
      edges,
      creds: get().credentials,
      minNodeMs: turbo ? 0 : 420,
      flowMs: turbo ? 15 : 360,
      hooks: {
        shouldAbort: () => abortRef?.signal.aborted ?? false,
        onNodeStart: (id) => set((st) => ({ statuses: { ...st.statuses, [id]: 'running' } })),
        onNodeFinish: (rec) => set((st) => ({
          statuses: { ...st.statuses, [rec.nodeId]: rec.status === 'skipped' ? 'skipped' : rec.status },
          runs: [...st.runs, rec],
        })),
        onEdgeActive: (edgeId, active) => set((st) => ({
          activeEdges: active ? [...st.activeEdges, edgeId] : st.activeEdges.filter((e) => e !== edgeId),
        })),
        onEdgeDone: (edgeId) => set((st) => ({ edgeDone: { ...st.edgeDone, [edgeId]: true } })),
      },
    });
    if (abortRef?.signal.aborted) {
      set({ runState: 'idle' });
      get().pushToast('info', 'Exécution arrêtée', 'Le flux a été interrompu');
      return;
    }
    const duration = Date.now() - startedAt;
    set({ runState: 'success', lastDurationMs: duration });
    const count = get().runs.filter((r) => r.status === 'success').length;
    const summary = `${count} nœud${count > 1 ? 's' : ''} exécuté${count > 1 ? 's' : ''} en ${(duration / 1000).toFixed(1)} s`;
    if (opts?.scoped) {
      get().pushToast('success', 'Test réussi', `${opts.label ?? 'Étape'} — ${summary}`);
    } else {
      get().pushToast('success', 'Flux exécuté avec succès', summary);
    }
  } catch (err) {
    const failed = get().runs.find((r) => r.status === 'error');
    set({ runState: 'error', lastDurationMs: Date.now() - startedAt });
    get().pushToast('error', 'Échec de l’exécution', failed?.error ?? (err instanceof Error ? err.message : 'Erreur inconnue'));
  } finally {
    abortRef = null;
  }
}

export const useFlow = create<FlowState>((set, get) => ({
  name: boot.name,
  nodes: boot.nodes,
  edges: boot.edges,
  selectedId: null,
  runState: 'idle',
  statuses: {},
  edgeDone: {},
  activeEdges: [],
  runs: [],
  runStartedAt: null,
  lastDurationMs: null,
  speed: 'normal',
  panelOpen: false,
  paletteOpen: true,
  commandOpen: false,
  commandMode: null,
  templatesOpen: false,
  toasts: [],
  past: [],
  future: [],
  lastSavedAt: null,
  hasClipboard: false,
  credentials: bootCreds,
  credsOpen: false,
  fitSignal: 0,

  setName: (name) => set({ name }),

  onNodesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory();
    set((s) => {
      const nodes = applyNodeChanges(changes, s.nodes);
      const sel = nodes.find((n) => n.selected);
      return { nodes, selectedId: changes.some((c) => c.type === 'select') ? sel?.id ?? null : s.selectedId };
    });
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory();
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
  },

  onConnect: (conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    get().pushHistory();
    set((s) => ({ edges: addEdge({ ...conn, id: uid('e'), type: 'flux' }, s.edges) }));
  },

  select: (id) => set((s) => ({
    selectedId: id,
    nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })),
  })),

  addNode: (defType, position, opts) => {
    get().pushHistory();
    const node = makeNode(defType, position);
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), { ...node, selected: opts?.select !== false }],
      selectedId: opts?.select === false ? s.selectedId : node.id,
    }));
    return node.id;
  },

  insertOnEdge: (defType, edgeId, position) => {
    const s = get();
    const edge = s.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    s.pushHistory();
    const node = makeNode(defType, position);
    set((st) => ({
      nodes: [...st.nodes.map((n) => ({ ...n, selected: false })), { ...node, selected: true }],
      edges: [
        ...st.edges.filter((e) => e.id !== edgeId),
        makeEdge(edge.source, node.id, edge.sourceHandle ?? undefined, 'in-0'),
        makeEdge(node.id, edge.target, 'out-0', edge.targetHandle ?? undefined),
      ],
      selectedId: node.id,
    }));
  },

  updateNode: (id, patch) => {
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }));
  },

  updateParams: (id, params) => {
    get().pushHistory(`params:${id}`);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n)) }));
  },

  removeNode: (id) => {
    get().pushHistory();
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  copySelection: (targetId) => {
    const s = get();
    const sel = targetId
      ? s.nodes.filter((n) => n.id === targetId)
      : s.nodes.filter((n) => n.selected || n.id === s.selectedId);
    if (!sel.length) return;
    const ids = new Set(sel.map((n) => n.id));
    clipboard = {
      nodes: structuredClone(sel),
      edges: structuredClone(s.edges.filter((e) => ids.has(e.source) && ids.has(e.target))),
    };
    set({ hasClipboard: true });
    get().pushToast('info', 'Copié', `${sel.length} nœud${sel.length > 1 ? 's' : ''} dans le presse-papiers`);
  },

  pasteClipboard: () => {
    if (!clipboard?.nodes.length) return;
    get().pushHistory();
    const idMap = new Map<string, string>();
    const nodes = clipboard.nodes.map((n) => {
      const id = uid('n');
      idMap.set(n.id, id);
      return { ...structuredClone(n), id, selected: true, position: { x: n.position.x + 56, y: n.position.y + 56 } };
    });
    const edges = clipboard.edges.map((e) => ({
      ...structuredClone(e), id: uid('e'), source: idMap.get(e.source)!, target: idMap.get(e.target)!,
    }));
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...nodes],
      edges: [...s.edges, ...edges],
      selectedId: nodes[0]?.id ?? null,
    }));
  },

  duplicateSelection: (targetId) => {
    get().copySelection(targetId);
    get().pasteClipboard();
  },

  pushHistory: (key) => {
    const now = Date.now();
    if (key && key === lastHistoryKey && now - lastHistoryAt < 900) {
      lastHistoryAt = now;
      return;
    }
    lastHistoryKey = key ?? '';
    lastHistoryAt = now;
    set((s) => ({ past: [...s.past.slice(-59), snapshot(s)], future: [] }));
  },

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, snapshot(s)],
      nodes: prev.nodes,
      edges: prev.edges,
      selectedId: null,
    });
  },

  redo: () => {
    const s = get();
    const next = s.future[s.future.length - 1];
    if (!next) return;
    set({
      future: s.future.slice(0, -1),
      past: [...s.past, snapshot(s)],
      nodes: next.nodes,
      edges: next.edges,
      selectedId: null,
    });
  },

  tidyUp: () => {
    get().pushHistory();
    const { nodes, edges } = get();
    if (!nodes.length) return;
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 64, ranksep: 130, marginx: 60, marginy: 60 });
    for (const n of nodes) g.setNode(n.id, { width: 250, height: 96 });
    for (const e of edges) g.setEdge(e.source, e.target);
    dagre.layout(g);
    set({
      nodes: nodes.map((n) => {
        const p = g.node(n.id);
        return { ...n, position: { x: p.x - 125, y: p.y - 48 } };
      }),
    });
    get().pushToast('info', 'Disposition optimisée', 'Les nœuds ont été réorganisés');
  },

  clearAll: () => {
    get().pushHistory();
    set({ nodes: [], edges: [], selectedId: null, statuses: {}, runs: [], activeEdges: [], edgeDone: {}, runState: 'idle' });
  },

  loadTemplate: (t) => {
    get().pushHistory();
    const { nodes, edges } = t.build();
    set((s) => ({
      name: t.name, nodes, edges, selectedId: null,
      statuses: {}, runs: [], activeEdges: [], edgeDone: {}, runState: 'idle', templatesOpen: false,
      fitSignal: s.fitSignal + 1,
    }));
    get().pushToast('success', 'Modèle chargé', t.name);
  },

  exportJson: () => {
    const { name, nodes, edges } = get();
    const file: WorkflowFile = { name, nodes, edges, version: 1 };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'flux'}.formatpro3.json`;
    a.click();
    URL.revokeObjectURL(url);
    get().pushToast('success', 'Flux exporté', `${nodes.length} nœuds sauvegardés`);
  },

  importJson: async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as WorkflowFile;
      if (!Array.isArray(parsed.nodes)) throw new Error('Format invalide');
      get().pushHistory();
      set((s) => ({
        name: parsed.name ?? file.name.replace(/\.[^.]+$/, ''),
        nodes: parsed.nodes,
        edges: parsed.edges ?? [],
        selectedId: null, statuses: {}, runs: [], activeEdges: [], edgeDone: {}, runState: 'idle',
        fitSignal: s.fitSignal + 1,
      }));
      get().pushToast('success', 'Flux importé', `${parsed.nodes.length} nœuds chargés`);
    } catch (err) {
      get().pushToast('error', 'Import impossible', err instanceof Error ? err.message : 'Fichier illisible');
    }
  },

  execute: async () => {
    const s = get();
    if (s.runState === 'running') return;
    if (!s.nodes.length) {
      get().pushToast('info', 'Canvas vide', 'Ajoutez un déclencheur pour commencer');
      return;
    }
    await runWorkflowOn(get, set, s.nodes, s.edges);
  },

  executeTo: async (nodeId) => {
    const s = get();
    if (s.runState === 'running') return;
    const target = s.nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const incoming = new Map<string, string[]>();
    for (const e of s.edges) {
      const arr = incoming.get(e.target);
      if (arr) arr.push(e.source);
      else incoming.set(e.target, [e.source]);
    }
    const keep = new Set<string>([nodeId]);
    const stack = [nodeId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const src of incoming.get(cur) ?? []) {
        if (!keep.has(src)) {
          keep.add(src);
          stack.push(src);
        }
      }
    }
    const nodes = s.nodes.filter((n) => keep.has(n.id));
    const edges = s.edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    await runWorkflowOn(get, set, nodes, edges, { scoped: true, label: target.data.label });
  },

  stop: () => {
    abortRef?.abort();
  },

  setSpeed: (speed) => set({ speed }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setCommandOpen: (commandOpen, commandMode = null) => set({ commandOpen, commandMode }),
  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),

  pushToast: (type, title, message) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, type, title, message }] }));
    setTimeout(() => get().dismissToast(id), 4600);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearRuns: () => set({ runs: [], statuses: {}, edgeDone: {}, activeEdges: [], runState: 'idle', lastDurationMs: null }),

  selectAll: () => set((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: true })) })),

  markSaved: () => set({ lastSavedAt: Date.now() }),

  setCredential: (name, value) => {
    const key = name.trim();
    if (!key) return;
    set((s) => {
      const credentials = { ...s.credentials, [key]: value };
      saveCredentials(credentials);
      return { credentials };
    });
  },

  removeCredential: (name) => {
    set((s) => {
      if (!(name in s.credentials)) return s;
      const credentials = { ...s.credentials };
      delete credentials[name];
      saveCredentials(credentials);
      return { credentials };
    });
  },

  setCredsOpen: (credsOpen) => set({ credsOpen }),
}));
