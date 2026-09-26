"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { animationEngine } from "@/lib/animations/animation-engine";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

/** Tras cambiar la etapa se deja ver la construcción (el clip más largo dura ~1.8 s) y una pausa antes de celebrar. */
export const FINAL_BUILD_MS = 2300;
const UNLOCK_AFTER_MS = 1700;
const BANNER_END_MS = 4300;

export type CelebrationBanner = null | { title: string; sub: string };

/**
 * Celebración de "figura completada" REUTILIZABLE: la usan todas las colecciones (Hábitos, Gym y, más adelante,
 * Paz Mental, Finanzas, Outfit, Voz). No conoce ninguna figura: recibe los nombres.
 *
 * Secuencia: última parte construida → pausa → confeti/brillo (`celebrateKey`) + "LO LOGRASTE" + `scene.completed`
 * (sonido/háptico en `use-habit-feedback`) → "SIGUIENTE DESBLOQUEADA" + `scene.unlocked` → fin.
 */
export function useSceneCompletionCelebration(entityId: string) {
  const [banner, setBanner] = useState<CelebrationBanner>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    (figureId: string, figureName: string, nextId: string | null, nextName: string | null) => {
      clearTimers();
      timers.current.push(
        setTimeout(() => {
          setCelebrateKey((k) => k + 1);
          setBanner({ title: "LO LOGRASTE", sub: `${figureName} completado` });
          animationEngine.emit({ type: "scene.completed", tier: "epic", entityId, meta: { sceneId: figureId } });
        }, FINAL_BUILD_MS),
        setTimeout(() => {
          if (nextId && nextName) {
            setBanner({ title: "SIGUIENTE DESBLOQUEADA", sub: nextName });
            setJustUnlocked(nextId);
            animationEngine.emit({ type: "scene.unlocked", tier: "milestone", entityId, meta: { sceneId: nextId } });
          } else {
            setBanner({ title: "COLECCIÓN COMPLETA", sub: "Todas las figuras terminadas" });
          }
        }, FINAL_BUILD_MS + UNLOCK_AFTER_MS),
        setTimeout(() => {
          setBanner(null);
          setJustUnlocked(null);
        }, FINAL_BUILD_MS + BANNER_END_MS),
      );
    },
    [clearTimers, entityId],
  );

  return { banner, celebrateKey, justUnlocked, run };
}

/** Texto de la celebración (breve, no un modal). */
export function SceneCompletionCelebration({ banner, reduceMotion }: { banner: CelebrationBanner; reduceMotion: boolean }) {
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.title}
          className="absolute inset-x-0 top-[6%] flex flex-col items-center gap-1.5 pointer-events-none text-center px-4"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <span className="text-[21px] font-black tracking-[0.06em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] leading-tight">{banner.title}</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#f5b301]" style={MONO}>
            {banner.sub}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
