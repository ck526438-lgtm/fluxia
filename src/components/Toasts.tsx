import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useFlow } from '../store/store';

const STYLES = {
  success: { icon: Check, ring: 'border-emerald-400/30', chip: 'bg-emerald-500/15 text-emerald-300' },
  error: { icon: AlertTriangle, ring: 'border-red-400/30', chip: 'bg-red-500/15 text-red-300' },
  info: { icon: Info, ring: 'border-sky-400/25', chip: 'bg-sky-500/15 text-sky-300' },
} as const;

export function Toasts() {
  const toasts = useFlow((s) => s.toasts);
  const dismiss = useFlow((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[90] flex w-[330px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.94, transition: { duration: 0.16 } }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              className={`glass pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 shadow-2xl ${s.ring}`}
            >
              <span className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
                <Icon size={13} strokeWidth={2.6} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-white/90">{t.title}</div>
                {t.message && <div className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-white/50">{t.message}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="btn-press -mr-1 -mt-1 flex h-5 w-5 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/80">
                <X size={11} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
