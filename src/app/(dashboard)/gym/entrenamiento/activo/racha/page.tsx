"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Check } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { useGymStore } from "@/lib/store/gymStore";

const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

export default function StreakPage() {
  const router = useRouter();
  const streak = useGymStore((s) => s.streak);
  const [helpOpen, setHelpOpen] = useState(false);

  const todayIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  return (
    <div className="flex flex-col items-center gap-8 pt-8 pb-10 text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
      >
        <div
          className="flex items-center justify-center w-28 h-28 rounded-full"
          style={{ background: "radial-gradient(circle, #f9731633, transparent 70%)" }}
        >
          <Flame size={72} style={{ color: "#f97316", filter: "drop-shadow(0 0 24px #f9731688)" }} fill="#f97316" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-6xl font-extrabold tracking-tight"
      >
        {streak}
      </motion.p>
      <p className="text-sm text-white/50 -mt-6">días de racha</p>

      <div className="flex gap-2.5">
        {DAY_LABELS.map((label, i) => {
          const isDone = i <= todayIndex && streak > 0 && i >= todayIndex - (streak - 1);
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold"
                style={{
                  background: isDone ? "linear-gradient(135deg, var(--gym), var(--gym-2))" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${isDone ? "transparent" : "rgba(255,255,255,0.15)"}`,
                  boxShadow: isDone ? "0 0 14px var(--gym-2)66" : undefined,
                }}
              >
                {isDone ? <Check size={14} className="text-white" /> : <span className="text-white/40">{label[0]}</span>}
              </div>
              <span className="text-[10px] text-white/35">{label}</span>
            </div>
          );
        })}
      </div>

      <p className="text-base text-white/75 max-w-xs">Un día más completado. ¡Nos vemos mañana!</p>

      <button onClick={() => setHelpOpen(true)} className="text-xs text-white/40 underline cursor-pointer">
        ¿Cómo funciona la racha?
      </button>

      <GlassButton
        accentColor="var(--gym-2)"
        size="lg"
        className="w-full max-w-xs mt-4"
        onClick={() => router.push("/gym/entrenamiento")}
      >
        Continuar
      </GlassButton>

      <GlassModal open={helpOpen} onClose={() => setHelpOpen(false)} title="¿Cómo funciona la racha?">
        <p className="text-sm text-white/70 leading-relaxed">
          Cada día que completes al menos un entrenamiento, tu racha aumenta en uno. Si pasas un día completo sin
          entrenar, la racha se reinicia. ¡Entrena seguido para mantenerla viva!
        </p>
      </GlassModal>
    </div>
  );
}
