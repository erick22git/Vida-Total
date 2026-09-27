"use client";

/**
 * Panel de ajustes de Calorías, abierto con el ícono de "sliders" (arriba a la derecha, presente en
 * las 3 vistas de la home nueva). Ya NO incluye el `CalorieArcCard` completo — ese vive ahora en su
 * propia vista (`NutrientDetailView`, a la que se llega deslizando hacia abajo). Este panel es solo
 * el acceso rápido: a qué gráfico apunta el contador, y accesos a Progreso/Racha.
 */
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, TrendingUp, Flame as FlameIcon, Check } from "lucide-react";
import { CHART_OPTIONS } from "@/components/gym/calorie-arc-card";
import { GAUGES } from "@/lib/3d/gauge-registry";
import { useCalorieChartPref } from "@/lib/gym/calorie-chart-pref";
import { MONO_FONT } from "@/lib/ui/mono-font";

export function CalorieSettingsSheet({
  open,
  onClose,
  streakCurrent,
}: {
  open: boolean;
  onClose: () => void;
  streakCurrent: number;
}) {
  const router = useRouter();
  const [chartKind, setChartKind] = useCalorieChartPref();

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

            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/40 px-1 mb-1" style={MONO_FONT}>
                Gráfico del contador
              </p>
              {CHART_OPTIONS.map((o) => {
                const available = o.id === "arc" || GAUGES[o.id].available;
                return (
                  <button
                    key={o.id}
                    disabled={!available}
                    onClick={() => setChartKind(o.id)}
                    className="w-full flex items-center justify-between text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer disabled:cursor-default disabled:text-white/35 disabled:hover:bg-transparent"
                    role="menuitemradio"
                    aria-checked={chartKind === o.id}
                  >
                    {o.label}
                    {!available ? <span className="text-[10px]">próximamente</span> : chartKind === o.id && <Check size={14} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
