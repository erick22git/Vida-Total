"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAnimationEvent } from "@/lib/animations/use-animation-engine";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const SHARDS = 14;
const SHOW_MS = 2000;

interface Celebration {
  id: number;
  big: string;
  label: string;
  epic: boolean;
}

/**
 * Animación de hito — el nivel MÁS alto de la jerarquía (las normales son
 * micro: press/hold/check, y media: cambio de hábito/vista). Aparece SOLO en
 * hitos de repeticiones (10…50), hábito dominado (60) y rachas 7/21/66. Se
 * suscribe al Animation Engine: nunca decide cuándo hay un hito (eso es del
 * Progress Engine); solo lo muestra.
 */
export function MilestoneCelebration({ habitId, reduceMotion }: { habitId: string | undefined; reduceMotion: boolean }) {
  const [item, setItem] = useState<Celebration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  function show(c: Omit<Celebration, "id">) {
    counter.current += 1;
    setItem({ ...c, id: counter.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setItem(null), SHOW_MS);
  }

  useAnimationEvent((e) => {
    if (e.entityId !== habitId) return;
    if (e.type === "habit.milestone") show({ big: String(e.meta?.count ?? ""), label: "Hito alcanzado", epic: false });
    else if (e.type === "habit.levelUp") show({ big: "60", label: "Hábito dominado", epic: true });
    else if (e.type === "streak.milestone") show({ big: String(e.meta?.milestone ?? e.meta?.streak ?? ""), label: "Días de racha", epic: false });
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(245,179,1,0.28), rgba(0,0,0,0.78) 70%)" }}
        >
          {!reduceMotion &&
            Array.from({ length: SHARDS }, (_, i) => {
              const angle = (i / SHARDS) * Math.PI * 2 + (i % 2) * 0.2;
              const dist = (item.epic ? 190 : 140) + (i % 3) * 30;
              return (
                <motion.svg
                  key={i}
                  viewBox="0 0 10 22"
                  width="12"
                  height="26"
                  className="absolute"
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    scale: 1,
                    opacity: 0,
                    rotate: (angle * 180) / Math.PI + 90,
                  }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                >
                  <polygon points="5,0 5,20 0,20" fill="#f5b301" />
                  <polygon points="5,0 10,20 5,20" fill="#b97f00" />
                </motion.svg>
              );
            })}
          <motion.span
            className="text-[96px] font-black leading-none text-white"
            initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
          >
            {item.big}
          </motion.span>
          <span className="mt-3 text-[13px] uppercase tracking-[0.2em] text-amber-300" style={MONO}>
            {item.label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
