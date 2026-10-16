"use client";

/**
 * Ajustes de Agua — hasta ahora el ícono de configuración de la pantalla de Agua no abría nada. Acá
 * vive: 1) la meta diaria (editable a mano, o aceptando la sugerencia con base científica que combina
 * la AI de agua por sexo/edad con el entrenamiento de hoy — ver `water-goal.ts`), y 2) el acceso a
 * "Bebidas" para editar/ocultar las que ya existían enterradas dentro de "Añadir una bebida" (ahora
 * también accesibles desde acá directamente).
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Check, Droplets } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { useTargetProfile } from "@/lib/nutrition/use-targets";
import { suggestWaterGoal } from "@/lib/gym/water-goal";
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
  const [editingDrink, setEditingDrink] = useState<DrinkOption | null>(null);

  const exerciseMinutesToday = useMemo(() => {
    const key = todayKey();
    return sessions
      .filter((s) => s.completado && s.date.slice(0, 10) === key)
      .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60;
  }, [sessions]);

  const sugerencia = useMemo(
    () => suggestWaterGoal(perfilMetas.sexo, perfilMetas.edad, exerciseMinutesToday),
    [perfilMetas.sexo, perfilMetas.edad, exerciseMinutesToday],
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
                Base: AI de agua del Institute of Medicine (National Academies) según sexo/edad. Extra por ejercicio:
                estimado general (Mayo Clinic/ACSM, 120-230 ml cada 15-20 min) — no individualizado, no reemplaza
                pesarte antes/después de entrenar si querés precisión real.
              </p>
            </div>

            <button
              onClick={() => setDrinksOpen(true)}
              className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              style={{ background: "#0d0d0d" }}
            >
              Bebidas (editar, ocultar o ajustar hidratación)
            </button>
          </div>

          <DrinkSettingsModal open={drinksOpen} onClose={() => setDrinksOpen(false)} onEditDrink={setEditingDrink} />
          <DrinkEditModal open={!!editingDrink} onClose={() => setEditingDrink(null)} drink={editingDrink} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
