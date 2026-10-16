import type { LucideIcon } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

export type { Edge, Node };

export type NodeCategory = 'trigger' | 'action' | 'logic' | 'data' | 'ai' | 'note';

export interface CategoryMeta {
  label: string;
  hint: string;
  color: string;
  soft: string;
}

export type ParamType = 'text' | 'number' | 'textarea' | 'select' | 'boolean' | 'code' | 'json' | 'keyvalue';

export interface ParamField {
  key: string;
  label: string;
  type: ParamType;
  placeholder?: string;
  hint?: string;
  options?: { label: string; value: string }[];
  default?: unknown;
}

export interface NodeDef {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: LucideIcon;
  params: ParamField[];
  inputs: number;
  outputs: string[];
}

export interface FlowNodeData extends Record<string, unknown> {
  defType: string;
  label: string;
  params: Record<string, unknown>;
  disabled?: boolean;
  notes?: string;
}

export type FlowNode = Node<FlowNodeData>;

export type Item = Record<string, unknown>;

export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface RunRecord {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  input: Item[];
  output: Item[];
  error?: string;
  durationMs: number;
  startedAt: number;
}

export interface WorkflowFile {
  name: string;
  nodes: FlowNode[];
  edges: Edge[];
  version: 1;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  badges: string[];
  build: () => { nodes: FlowNode[]; edges: Edge[] };
}
