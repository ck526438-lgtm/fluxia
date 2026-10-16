import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TopBar } from './components/TopBar';
import { NodePalette } from './components/NodePalette';
import { Canvas } from './components/Canvas';
import { ConfigPanel } from './components/ConfigPanel';
import { CommandPalette } from './components/CommandPalette';
import { CredentialsModal } from './components/CredentialsModal';
import { TemplatesModal } from './components/TemplatesModal';
import { Toasts } from './components/Toasts';
import { getDef } from './data/catalog';
import { saveWorkflow, useFlow } from './store/store';

export default function App() {
  const name = useFlow((s) => s.name);
  const nodes = useFlow((s) => s.nodes);
  const edges = useFlow((s) => s.edges);

  useEffect(() => {
    const t = setTimeout(() => {
      saveWorkflow(name, nodes, edges);
      useFlow.getState().markSaved();
    }, 700);
    return () => clearTimeout(t);
  }, [name, nodes, edges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useFlow.getState();
      const target = e.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.setCommandOpen(!s.commandOpen);
        return;
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        void s.execute();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveWorkflow(s.name, s.nodes, s.edges);
        s.markSaved();
        s.pushToast('success', 'Flux sauvegardé', 'Sauvegarde locale automatique');
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        s.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        s.copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        s.pasteClipboard();
        return;
      }
      if (e.key.toLowerCase() === 'd') {
        const node = s.nodes.find((n) => n.id === s.selectedId);
        if (node && getDef(node.data.defType).category !== 'note') {
          s.updateNode(node.id, { disabled: !node.data.disabled });
          s.pushToast('info', node.data.disabled ? 'Nœud activé' : 'Nœud désactivé', node.data.label);
        }
        return;
      }
      if (e.key === 'Escape') {
        s.setCommandOpen(false);
        s.setTemplatesOpen(false);
        s.setCredsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <TopBar />
        <div className="relative flex min-h-0 flex-1">
          <NodePalette />
          <Canvas />
          <ConfigPanel />
        </div>
      </div>
      <CommandPalette />
      <TemplatesModal />
      <CredentialsModal />
      <Toasts />
    </ReactFlowProvider>
  );
}
