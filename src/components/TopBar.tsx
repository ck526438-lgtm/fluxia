import { useRef } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import {
  Check, Command, Download, Gauge, KeyRound, LayoutTemplate, Loader2, Play, Redo2, Sparkles, Square, Undo2, Upload, Zap,
} from 'lucide-react';
import { useFlow } from '../store/store';

function LogoMark() {
  return (
    <motion.div
      initial={{ rotate: -12, scale: 0.8, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
      className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-[0_6px_20px_-6px_rgba(168,85,247,0.9)]"
    >
      <Zap size={16} className="text-white" strokeWidth={2.6} fill="rgba(255,255,255,0.35)" />
      <span className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/25" />
    </motion.div>
  );
}

function IconBtn({ title, onClick, children, disabled }: { title: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-white/55 hover:border-white/8 hover:bg-white/6 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SaveIndicator() {
  const lastSavedAt = useFlow((s) => s.lastSavedAt);
  if (!lastSavedAt) return null;
  const time = new Date(lastSavedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.span
      key={lastSavedAt}
      initial={{ opacity: 0, y: 3, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      title={`Sauvegarde locale à ${time}`}
      className="ml-1.5 hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1 text-[10.5px] font-medium text-emerald-300/85 xl:flex"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Enregistré
    </motion.span>
  );
}

export function TopBar() {
  const name = useFlow((s) => s.name);
  const setName = useFlow((s) => s.setName);
  const runState = useFlow((s) => s.runState);
  const speed = useFlow((s) => s.speed);
  const setSpeed = useFlow((s) => s.setSpeed);
  const execute = useFlow((s) => s.execute);
  const stop = useFlow((s) => s.stop);
  const undo = useFlow((s) => s.undo);
  const redo = useFlow((s) => s.redo);
  const canUndo = useFlow((s) => s.past.length > 0);
  const canRedo = useFlow((s) => s.future.length > 0);
  const tidyUp = useFlow((s) => s.tidyUp);
  const setTemplatesOpen = useFlow((s) => s.setTemplatesOpen);
  const setCredsOpen = useFlow((s) => s.setCredsOpen);
  const credentialCount = useFlow((s) => Object.keys(s.credentials).length);
  const setCommandOpen = useFlow((s) => s.setCommandOpen);
  const exportJson = useFlow((s) => s.exportJson);
  const importJson = useFlow((s) => s.importJson);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = runState === 'running';

  return (
    <header className="glass relative z-40 flex h-14 shrink-0 items-center gap-3 border-b px-3.5">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <div className="leading-none">
          <div className="text-[13.5px] font-extrabold tracking-tight text-white/95">Fluxia</div>
          <div className="mt-1 hidden text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/30 xl:block">Workflow automation</div>
        </div>
      </div>

      <div className="mx-1.5 hidden h-6 w-px bg-white/8 sm:block" />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        spellCheck={false}
        className="hidden w-[128px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-white/85 outline-none transition-colors hover:border-white/8 hover:bg-white/4 focus:border-violet-400/40 focus:bg-white/5 sm:block xl:w-[210px]"
      />
      <SaveIndicator />

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => void execute()}
            disabled={running}
            className={clsx(
              'btn-press run-glow flex h-9 items-center gap-2 rounded-xl bg-gradient-to-br px-4 text-[13px] font-semibold text-white',
              runState === 'error' ? 'from-rose-500 to-red-600' : 'from-violet-500 to-fuchsia-600',
              running && 'cursor-wait opacity-90'
            )}
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : runState === 'success' ? <Check size={15} strokeWidth={3} /> : <Play size={14} fill="currentColor" />}
            <span>{running ? 'Exécution…' : runState === 'success' ? 'Relancer' : 'Exécuter'}</span>
            {!running && <span className="kbd hidden border-white/25 bg-white/15 text-white/80 xl:inline">Ctrl ↵</span>}
          </motion.button>

          {running && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={stop}
              className="btn-press flex h-9 items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/15 px-3 text-[12.5px] font-semibold text-red-200 hover:bg-red-500/25"
            >
              <Square size={12} fill="currentColor" /> Arrêter
            </motion.button>
          )}

          <div className="ml-1 hidden items-center rounded-xl border border-white/8 bg-white/4 p-0.5 lg:flex">
            {(['normal', 'turbo'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={clsx(
                  'relative flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[11.5px] font-medium transition-colors',
                  speed === s ? 'text-white' : 'text-white/45 hover:text-white/75'
                )}
              >
                {speed === s && <motion.span layoutId="speed-pill" className="absolute inset-0 rounded-[9px] bg-white/10" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
                <Gauge size={12} className="relative" />
                <span className="relative">{s === 'normal' ? 'Normal' : 'Turbo'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <div className="hidden items-center gap-0.5 md:flex">
          <IconBtn title="Annuler (Ctrl+Z)" onClick={undo} disabled={!canUndo}><Undo2 size={15} /></IconBtn>
          <IconBtn title="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={!canRedo}><Redo2 size={15} /></IconBtn>
          <div className="mx-1.5 h-6 w-px bg-white/8" />
        </div>
        <IconBtn title="Aligner les nœuds" onClick={tidyUp}><Sparkles size={15} /></IconBtn>
        <button
          onClick={() => setTemplatesOpen(true)}
          className="btn-press ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 text-[12px] font-medium text-white/70 hover:bg-white/8 hover:text-white"
        >
          <LayoutTemplate size={14} /> <span className="hidden lg:inline">Modèles</span>
        </button>
        <button
          onClick={() => setCredsOpen(true)}
          title={`Identifiants — ${credentialCount} clé${credentialCount > 1 ? 's' : ''} enregistrée${credentialCount > 1 ? 's' : ''}`}
          className="btn-press ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 text-[12px] font-medium text-white/70 hover:bg-white/8 hover:text-white"
        >
          <KeyRound size={14} />
          <span className="hidden lg:inline">Identifiants</span>
          {credentialCount > 0 && (
            <span className="rounded-full bg-violet-500/25 px-1.5 text-[9.5px] font-bold text-violet-200">{credentialCount}</span>
          )}
        </button>
        <div className="mx-1.5 h-6 w-px bg-white/8" />
        <IconBtn title="Importer un flux (.json)" onClick={() => fileRef.current?.click()}><Upload size={15} /></IconBtn>
        <IconBtn title="Exporter le flux" onClick={exportJson}><Download size={15} /></IconBtn>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => setCommandOpen(true)}
          title="Palette de commandes"
          className="btn-press ml-1.5 flex h-8 items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-2.5 text-[12px] text-white/45 hover:bg-white/8 hover:text-white/80"
        >
          <Command size={13} /> <span className="kbd hidden lg:inline">Ctrl K</span>
        </button>
      </div>
    </header>
  );
}
