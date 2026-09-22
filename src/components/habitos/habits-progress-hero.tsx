"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgressCrystal, type CrystalState } from "@/components/animations/ProgressCrystal";
import { useAnimationEvent } from "@/lib/animations/use-animation-engine";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";

/**
 * El objeto único de progreso, en su tamaño "hero" — refleja el % de
 * hábitos de hoy la mayor parte del tiempo, y se interrumpe brevemente para
 * mostrar el estado "milestone" cuando el Animation Engine avisa que se
 * cruzó una racha de 7/21/66 días (sin que este componente sepa NADA de
 * cómo se calculó eso — solo escucha el evento). Jerarquía de intensidad:
 * esto es lo más grande que existe en la pantalla de Hábitos hoy, y por
 * eso solo reacciona a algo poco frecuente (milestone), no a cada tap.
 */
function pctToState(pct: number): CrystalState {
  if (pct <= 0) return "idle";
  if (pct < 0.34) return "progress-25";
  if (pct < 0.67) return "progress-50";
  if (pct < 1) return "progress-75";
  return "complete";
}

export function HabitsProgressHero({ completed, total }: { completed: number; total: number }) {
  const reduceMotion = useEffectiveReduceMotion();
  const [milestoneFlash, setMilestoneFlash] = useState<number | null>(null);

  useAnimationEvent((event) => {
    if (event.type === "streak.milestone" && event.meta?.milestone) {
      setMilestoneFlash(event.meta.milestone);
      setTimeout(() => setMilestoneFlash(null), reduceMotion ? 0 : 1800);
    }
  });

  const pct = total > 0 ? completed / total : 0;
  const state: CrystalState = milestoneFlash ? "milestone" : pctToState(pct);

  return (
    <div className="flex items-center gap-4">
      <ProgressCrystal state={state} reduceMotion={reduceMotion} size={88} />
      <div className="flex flex-col gap-0.5 min-h-11 justify-center">
        <AnimatePresence mode="wait">
          {milestoneFlash ? (
            <motion.div
              key="milestone"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            >
              <p className="text-lg font-semibold text-white">¡Racha de {milestoneFlash} días!</p>
              <p className="text-xs text-white/50">Seguís construyendo tu progreso.</p>
            </motion.div>
          ) : (
            <motion.div key="progress" initial={false} animate={{ opacity: 1 }}>
              <p className="text-lg font-semibold text-white">
                {completed}
                <span className="text-white/40 font-normal"> / {total} hábitos hoy</span>
              </p>
              <p className="text-xs text-white/50">
                {pct >= 1 && total > 0 ? "Día completo — muy bien." : "Tu progreso se va tallando con cada uno."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
