"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Footprints, Check } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";

/**
 * Cronómetro (cuenta hacia arriba) que aparece al pasar automáticamente de
 * un ejercicio a otro — mide cuánto tardás en llegar a la siguiente
 * máquina. Se detiene al tocar "Aceptar", que registra el tiempo en
 * `transicionSegundos` del ejercicio al que llegaste.
 */
export function TransitionBar() {
  const transitionStartedAt = useGymStore((s) => s.transitionStartedAt);
  const acceptTransition = useGymStore((s) => s.acceptTransition);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!transitionStartedAt) return;
    const tick = () => setElapsed(Math.round((Date.now() - transitionStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [transitionStartedAt]);

  if (!transitionStartedAt) return null;

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-surface rounded-3xl px-5 py-4 flex items-center gap-4"
      style={{ boxShadow: "0 0 32px #f59e0b40" }}
    >
      <div
        className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0"
        style={{ background: "#f59e0b22", color: "#fbbf24" }}
      >
        <Footprints size={20} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] text-white/45 mb-0.5">Pasando a la siguiente máquina</p>
        <p className="text-2xl font-bold tabular-nums text-white">
          {mm}:{ss}
        </p>
      </div>
      <button
        onClick={acceptTransition}
        className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shrink-0 cursor-pointer"
        style={{ background: "var(--gym-2)", boxShadow: "0 0 14px var(--gym-2)66" }}
      >
        <Check size={14} /> Aceptar
      </button>
    </motion.div>
  );
}
