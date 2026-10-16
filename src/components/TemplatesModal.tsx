import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { CATEGORIES, getDef } from '../data/catalog';
import { TEMPLATES } from '../data/templates';
import { useFlow } from '../store/store';

export function TemplatesModal() {
  const open = useFlow((s) => s.templatesOpen);
  const setOpen = useFlow((s) => s.setTemplatesOpen);
  const loadTemplate = useFlow((s) => s.loadTemplate);

  const previews = useMemo(
    () => TEMPLATES.map((t) => ({ template: t, defTypes: t.build().nodes.map((n) => n.data.defType) })),
    []
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[3px]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-h-[86vh] w-full max-w-[860px] overflow-y-auto rounded-2xl border shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/7 bg-ink-900/80 px-5 py-4 backdrop-blur-xl">
              <div>
                <h2 className="text-[15px] font-bold text-white/92">Modèles prêts à l’emploi</h2>
                <p className="mt-0.5 text-[11.5px] text-white/40">Chargez un flux complet, personnalisez-le, exécutez-le.</p>
              </div>
              <button onClick={() => setOpen(false)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white">
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4">
              {previews.map(({ template, defTypes }, i) => (
                <motion.button
                  key={template.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 380, damping: 30 }}
                  whileHover={{ y: -4 }}
                  onClick={() => loadTemplate(template)}
                  className="group flex flex-col rounded-xl border border-white/7 bg-white/[0.03] p-4 text-left transition-colors hover:border-violet-400/35 hover:bg-violet-500/[0.07]"
                >
                  <div className="flex items-center gap-1.5">
                    {defTypes.slice(0, 7).map((t, j) => {
                      const def = getDef(t);
                      const cat = CATEGORIES[def.category];
                      return (
                        <span
                          key={j}
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
                          style={{ background: cat.soft, color: cat.color, transitionDelay: `${j * 30}ms` }}
                        >
                          <def.icon size={13} strokeWidth={2.2} />
                        </span>
                      );
                    })}
                    {defTypes.length > 7 && <span className="text-[10px] text-white/35">+{defTypes.length - 7}</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-white/90">{template.name}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/42">{template.description}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    {template.badges.map((b) => (
                      <span key={b} className="rounded-full border border-white/8 bg-white/4 px-2 py-px text-[9px] font-semibold text-white/45">{b}</span>
                    ))}
                    <span className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-violet-300 opacity-0 transition-opacity group-hover:opacity-100">
                      Charger <ArrowRight size={11} />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
