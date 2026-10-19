import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, KeyRound, Lock, Plus, Trash2, X } from 'lucide-react';
import { useFlow } from '../store/store';

const SUGGESTIONS: { name: string; hint: string }[] = [
  { name: 'brevo', hint: 'Clé API Brevo (xkeysib-…)' },
  { name: 'notion', hint: 'Jeton d’intégration Notion (ntn_…)' },
  { name: 'telegram', hint: 'Jeton du bot Telegram' },
  { name: 'openai', hint: 'Clé API OpenAI compatible' },
  { name: 'slack', hint: 'Webhook Slack ou jeton' },
];

export function CredentialsModal() {
  const open = useFlow((s) => s.credsOpen);
  const setOpen = useFlow((s) => s.setCredsOpen);
  const credentials = useFlow((s) => s.credentials);
  const setCredential = useFlow((s) => s.setCredential);
  const removeCredential = useFlow((s) => s.removeCredential);
  const pushToast = useFlow((s) => s.pushToast);
  const [newName, setNewName] = useState('');

  const close = () => setOpen(false);

  const addKey = (name: string) => {
    const key = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key || key in credentials) {
      setNewName('');
      return;
    }
    setCredential(key, '');
    setNewName('');
  };

  const copyUsage = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`{{ $creds.${name} }}`);
      pushToast('info', 'Expression copiée', `{{ $creds.${name} }}`);
    } catch {
      pushToast('error', 'Copie impossible', 'Le navigateur a refusé l’accès au presse-papiers');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[85] flex items-start justify-center bg-black/55 p-4 backdrop-blur-[3px]"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="glass mt-[8vh] flex max-h-[76vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-white/7 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <KeyRound size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-white/92">Identifiants</div>
                <div className="text-[10px] text-white/35">Clés stockées dans ce navigateur, réutilisables dans tous les champs.</div>
              </div>
              <button onClick={close} title="Fermer" className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white">
                <X size={13} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {Object.keys(credentials).length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11.5px] leading-relaxed text-white/40">
                  Aucun identifiant pour le moment.<br />
                  Ajoutez-en un puis utilisez-le dans n’importe quel champ avec
                  <span className="mx-1 rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10.5px] text-white/70">{'{{ $creds.nom }}'}</span>
                </div>
              )}

              <div className="space-y-2">
                {Object.entries(credentials).map(([name, value]) => (
                  <div key={name} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-violet-500/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-300">{name}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => void copyUsage(name)}
                          title="Copier l’expression à coller dans un champ"
                          className="btn-press flex h-6.5 items-center gap-1 rounded-lg border border-white/8 px-2 text-[10px] font-medium text-white/55 hover:bg-white/8 hover:text-white"
                        >
                          <Copy size={11} /> {'{{ $creds.' + name + ' }}'}
                        </button>
                        <button
                          onClick={() => removeCredential(name)}
                          title="Supprimer"
                          className="btn-press flex h-6.5 w-6.5 items-center justify-center rounded-lg text-white/35 hover:bg-red-500/15 hover:text-red-300"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => setCredential(name, e.target.value)}
                      rows={Math.min(4, Math.max(1, Math.ceil(value.length / 56)))}
                      spellCheck={false}
                      placeholder="Valeur de la clé…"
                      className="mt-2 w-full resize-none rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 font-mono text-[11px] text-white/80 outline-none transition-colors focus:border-violet-400/40"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKey(newName)}
                  placeholder="Nom (ex. brevo, notion, telegram…)"
                  spellCheck={false}
                  className="h-8 flex-1 rounded-lg border border-white/8 bg-black/25 px-2.5 font-mono text-[11.5px] text-white/85 outline-none transition-colors focus:border-violet-400/40"
                />
                <button
                  onClick={() => addKey(newName)}
                  className="btn-press flex h-8 items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/25"
                >
                  <Plus size={13} /> Ajouter
                </button>
              </div>

              {Object.keys(credentials).length === 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.filter((s) => !(s.name in credentials)).map((s) => (
                    <button
                      key={s.name}
                      onClick={() => addKey(s.name)}
                      title={s.hint}
                      className="btn-press rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] text-white/55 hover:border-violet-400/30 hover:text-white/85"
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-white/6 px-4 py-2.5 text-[10px] text-white/32">
              <Lock size={11} className="shrink-0" />
              Stockés uniquement dans le localStorage de ce navigateur — jamais envoyés à un serveur FormatPro3 (ils partent uniquement vers les services que vous appelez).
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
