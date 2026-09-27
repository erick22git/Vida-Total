"use client";

/**
 * Rediseño Calorías, etapa 6: el selector de gráfico (Arco/Cápsula/Medidor/Batería), los macros y
 * "Terminar Día" — todo lo que hoy vive suelto en la pantalla principal vieja — se movieron acá,
 * detrás del ícono de ajustes de la home nueva. El componente en sí (`CalorieArcCard`,
 * `OtherNutrientsCard`) NO se tocó — se reutiliza tal cual, solo cambia dónde vive.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, TrendingUp, Flame as FlameIcon } from "lucide-react";
import { CalorieArcCard } from "@/components/gym/calorie-arc-card";
import { OtherNutrientsCard } from "@/components/gym/other-nutrients-card";
import { useGymStore } from "@/lib/store/gymStore";
import { MONO_FONT } from "@/lib/ui/mono-font";

export function CalorieSettingsSheet({
  open,
  onClose,
  totals,
  otherNutrientTotals,
  streakCurrent,
}: {
  open: boolean;
  onClose: () => void;
  totals: { calorias: number; proteina: number; carbos: number; grasas: number };
  otherNutrientTotals: Record<string, number>;
  streakCurrent: number;
}) {
  const router = useRouter();
  const showOtherNutrients = useGymStore((s) => s.dashboardPrefs.showOtherNutrients);
  const [page, setPage] = useState(0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] text-white overflow-y-auto"
          style={{ backgroundColor: "#1c1c1c" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col gap-5 px-4 pb-10 max-w-md mx-auto">
            <header className="flex items-center gap-3 pt-[max(env(safe-area-inset-top),16px)]">
              <button
                onClick={onClose}
                aria-label="Cerrar ajustes"
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                style={{ background: "#0d0d0d" }}
              >
                <ChevronLeft size={22} strokeWidth={2.6} />
              </button>
              <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
                Ajustes de Calorías
              </h1>
            </header>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  router.push("/gym/calorias/progreso");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] transition-colors rounded-2xl py-3"
              >
                <TrendingUp size={14} className="text-white/70" />
                <span className="text-xs font-semibold text-white/80">Progreso</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  router.push("/gym/calorias/rachas");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] transition-colors rounded-2xl py-3"
              >
                <FlameIcon size={14} style={{ color: "white" }} fill="white" fillOpacity={0.3} />
                <span className="text-xs font-semibold text-white/80 tabular-nums">Racha {streakCurrent}</span>
              </button>
            </div>

            {showOtherNutrients ? (
              <>
                <div
                  className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-1 px-1 no-scrollbar"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                    if (idx !== page) setPage(idx);
                  }}
                >
                  <div className="w-full shrink-0 snap-center">
                    <CalorieArcCard totals={totals} />
                  </div>
                  <div className="w-full shrink-0 snap-center">
                    <OtherNutrientsCard totals={otherNutrientTotals} />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1.5 -mt-2">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: page === i ? 16 : 6,
                        background: page === i ? "white" : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <CalorieArcCard totals={totals} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
