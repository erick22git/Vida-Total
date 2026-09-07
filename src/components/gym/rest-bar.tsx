"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, ChevronsRight } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";

export function RestBar() {
  const restEndsAt = useGymStore((s) => s.restEndsAt);
  const adjustRest = useGymStore((s) => s.adjustRest);
  const clearRest = useGymStore((s) => s.clearRest);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!restEndsAt) return;
    const tick = () => {
      const rem = Math.max(0, Math.round((restEndsAt - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) clearRest();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restEndsAt, clearRest]);

  if (!restEndsAt) return null;

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-surface rounded-3xl px-5 py-4 flex items-center gap-4"
      style={{ boxShadow: "0 0 32px #3b82f640" }}
    >
      <div
        className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0"
        style={{ background: "#3b82f622", color: "#93c5fd" }}
      >
        <Moon size={20} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] text-white/45 mb-0.5">Descanso</p>
        <p className="text-2xl font-bold tabular-nums text-white">
          {mm}:{ss}
        </p>
      </div>
      <button
        onClick={() => adjustRest(-15)}
        className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/70 bg-white/[0.07] border border-white/[0.12] cursor-pointer"
      >
        -15s
      </button>
      <button
        onClick={() => adjustRest(15)}
        className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/70 bg-white/[0.07] border border-white/[0.12] cursor-pointer"
      >
        +15s
      </button>
      <button
        onClick={clearRest}
        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 cursor-pointer"
        style={{ background: "var(--gym-2)", boxShadow: "0 0 14px var(--gym-2)66" }}
      >
        <ChevronsRight size={16} className="text-white" />
      </button>
    </motion.div>
  );
}
