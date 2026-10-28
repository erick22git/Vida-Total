"use client";

/**
 * Ajustes de Agua — hasta ahora el ícono de configuración de la pantalla de Agua no abría nada. Acá
 * vive: 1) la meta diaria (editable a mano, o aceptando la sugerencia con base científica que combina
 * la AI de agua por sexo/edad con el entrenamiento de hoy — ver `water-goal.ts`), y 2) el acceso a
 * "Bebidas" para editar/ocultar las que ya existían enterradas dentro de "Añadir una bebida" (ahora
 * también accesibles desde acá directamente).
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Check, Droplets } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { useTargetProfile } from "@/lib/nutrition/use-targets";
import { suggestAdaptiveWaterGoal, type OrinaColor } from "@/lib/gym/water-goal";
import { WaterVesselsSheet } from "@/components/gym/water-vessels-sheet";
import { DrinkSettingsModal } from "@/components/gym/drink-settings-modal";
import { DrinkEditModal } from "@/components/gym/drink-edit-modal";
import type { DrinkOption } from "@/lib/data/drinks";
import { MONO_FONT } from "@/lib/ui/mono-font";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WaterSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const sessions = useGymStore((s) => s.sessions);
  const perfilMetas = useTargetProfile();

  const [goalInput, setGoalInput] = useState(String(waterGoalMl));
  const [drinksOpen, setDrinksOpen] = useState(false);
  const [vesselsOpen, setVesselsOpen] = useState(false);
  const [editingDrink, setEditingDrink] = useState<DrinkOption | null>(null);

  const exerciseMinutesToday = useMemo(() => {
    const key = todayKey();
    return sessions
      .filter((s) => s.completado && s.date.slice(0, 10) === key)
      .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60;
  }, [sessions]);

  const waterEntries = useGymStore((s) => s.waterEntries);
  const waterCheck = useGymStore((s) => s.waterCheck);
  const setWaterCheck = useGymStore((s) => s.setWaterCheck);
  const checkHoy = waterCheck && waterCheck.date === todayKey() ? waterCheck : null;

  // ml por día de los 7 días anteriores a hoy (días sin registro cuentan 0).
  const last7DaysMl = useMemo(() => {
    const out: number[] = [];
    for (let d = 1; d <= 7; d++) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      const key = format(day, "yyyy-MM-dd");
      out.push(waterEntries.filter((e) => format(new Date(e.timestamp), "yyyy-MM-dd") === key).reduce((a, e) => a + e.ml, 0));
    }
    return out;
  }, [waterEntries]);

  const sugerencia = useMemo(
    () =>
      suggestAdaptiveWaterGoal({
        sexo: perfilMetas.sexo,
        edad: perfilMetas.edad,
        exerciseMinutesToday,
        calor: !!checkHoy?.calor,
        orina: checkHoy?.orina,
        currentGoalMl: waterGoalMl,
        last7DaysMl,
      }),
    [perfilMetas.sexo, perfilMetas.edad, exerciseMinutesToday, checkHoy?.calor, checkHoy?.orina, waterGoalMl, last7DaysMl],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] text-white overflow-y-auto"
          style={{ background: "var(--app-bg)" }}
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
                Ajustes de Agua
              </h1>
            </header>

            <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: "#0d0d0d" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/85">Meta diaria</span>
                <span className="text-white/45 tabular-nums">{waterGoalMl} ml</span>
              </div>
              <div className="flex items-center gap-2">
                <GlassInput
                  type="number"
                  inputMode="numeric"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Meta diaria de ml"
                  className="flex-1"
                />
                <GlassButton
                  size="sm"
                  onClick={() => {
                    const v = parseInt(goalInput, 10);
                    if (v > 0) useGymStore.setState({ waterGoalMl: v });
                  }}
                >
                  Guardar
                </GlassButton>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl p-4" style={{ background: "#0d0d0d" }}>
              <span className="text-[10px] uppercase tracking-[0.1em] text-white/40 flex items-center gap-1.5" style={MONO_FONT}>
                <Droplets size={12} /> Sugerencia con base científica
              </span>
              <p className="text-xs text-white/70 leading-relaxed">{sugerencia.mensaje}</p>
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] text-white/50">¿Cómo está tu orina hoy?</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([["clara", "Clara"], ["amarilla", "Amarilla"], ["oscura", "Oscura"]] as [OrinaColor, string][]).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setWaterCheck({ orina: k })}
                      className={`rounded-lg py-2 text-xs cursor-pointer border ${checkHoy?.orina === k ? "border-white/70 bg-white/[0.14] text-white" : "border-white/10 bg-white/[0.04] text-white/70"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWaterCheck({ calor: !checkHoy?.calor })}
                  className={`rounded-lg py-2 text-xs cursor-pointer border ${checkHoy?.calor ? "border-white/70 bg-white/[0.14] text-white" : "border-white/10 bg-white/[0.04] text-white/70"}`}
                >
                  {checkHoy?.calor ? "Hoy hace calor (+500 ml)" : "Hoy hace calor / sudo mucho"}
                </button>
              </div>
              {sugerencia.genericoBase && (
                <p className="text-[11px] text-amber-200/70">
                  Completá tu sexo y edad en el perfil de Entrenamiento para que esta base deje de ser genérica.
                </p>
              )}
              <button
                onClick={() => {
                  useGymStore.setState({ waterGoalMl: sugerencia.totalMl });
                  setGoalInput(String(sugerencia.totalMl));
                }}
                disabled={sugerencia.totalMl === waterGoalMl}
                className="flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white text-black disabled:opacity-40 disabled:cursor-default"
              >
                <Check size={13} /> Usar {sugerencia.totalMl} ml como meta
              </button>
              <p className="text-[10px] text-white/35">
                Base: AI de agua del Institute of Medicine según sexo/edad. Ejercicio: Mayo Clinic/ACSM (120-230 ml cada
                15-20 min). Color de orina: marcador de hidratación de Armstrong. Son estimados generales: la meta sube
                de a 250 ml si aún no cumples la actual, con tope de 4500 ml. Con enfermedad renal o cardíaca, o si tu
                médico limita líquidos, sigue su indicación.
              </p>
            </div>

            <button
              onClick={() => setDrinksOpen(true)}
              className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              style={{ background: "#0d0d0d" }}
            >
              Bebidas (editar, ocultar o ajustar hidratación)
            </button>

            <button
              onClick={() => setVesselsOpen(true)}
              className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              style={{ background: "#0d0d0d" }}
            >
              Mis vasos (nombre, ml, foto o cámara)
            </button>
          </div>

          <WaterVesselsSheet open={vesselsOpen} onClose={() => setVesselsOpen(false)} />
          <DrinkSettingsModal open={drinksOpen} onClose={() => setDrinksOpen(false)} onEditDrink={setEditingDrink} />
          <DrinkEditModal open={!!editingDrink} onClose={() => setEditingDrink(null)} drink={editingDrink} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
