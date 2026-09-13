"use client";

import { useState } from "react";
import { Pencil, MoreHorizontal, Check } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { ArcChart, MacroColumn, MACRO_COLORS } from "@/components/gym/calorie-arc-visual";

export function CalorieArcCard({
  totals,
}: {
  totals: { calorias: number; proteina: number; carbos: number; grasas: number };
}) {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const showRemaining = useGymStore((s) => s.showRemaining);
  const toggleShowRemaining = useGymStore((s) => s.toggleShowRemaining);
  const dayFinishedDate = useGymStore((s) => s.dayFinishedDate);
  const finishDay = useGymStore((s) => s.finishDay);
  const showFinishDayButton = useGymStore((s) => s.dashboardPrefs.showFinishDayButton);

  const [pencilOpen, setPencilOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [calorieInput, setCalorieInput] = useState(String(calorieGoal));
  const [proteinInput, setProteinInput] = useState(String(proteinGoal));
  const [carbsInput, setCarbsInput] = useState(String(carbsGoal));
  const [fatInput, setFatInput] = useState(String(fatGoal));

  const rangeLow = Math.round(calorieGoal * 0.9);
  const rangeHigh = Math.round(calorieGoal * 1.1);
  const isFinishedToday = dayFinishedDate === new Date().toDateString();
  const hasProgress = totals.calorias > 0;

  const displayValue = showRemaining ? Math.max(0, Math.round(calorieGoal - totals.calorias)) : Math.round(totals.calorias);

  return (
    <GlassCard padding="md" className="flex flex-col gap-4" style={{ background: "var(--glass-bg-dark)" }}>
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setPencilOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer transition-colors"
            aria-label="Editar"
          >
            <Pencil size={13} className="text-white/70" />
          </button>
          {pencilOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPencilOpen(false)} />
              <div className="glass-panel absolute left-0 top-9 z-40 w-52 rounded-2xl shadow-2xl overflow-hidden py-1">
                <button
                  onClick={() => {
                    toggleShowRemaining();
                    setPencilOpen(false);
                  }}
                  className="w-full flex items-center justify-between text-left px-3.5 py-2.5 text-xs text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  Ver restante
                  {showRemaining && <Check size={13} className="text-[var(--gym)]" />}
                </button>
                <button
                  onClick={() => {
                    setCalorieInput(String(calorieGoal));
                    setGoalModalOpen(true);
                    setPencilOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  Configuración de calorías
                </button>
                <button
                  onClick={() => {
                    setProteinInput(String(proteinGoal));
                    setCarbsInput(String(carbsGoal));
                    setFatInput(String(fatGoal));
                    setMacroModalOpen(true);
                    setPencilOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  Configurar macros
                </button>
              </div>
            </>
          )}
        </div>
        <span className="text-xs font-medium text-white/50 tracking-wide">kcal</span>
        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer transition-colors"
            aria-label="Más opciones"
          >
            <MoreHorizontal size={15} className="text-white/70" />
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="glass-panel absolute right-0 top-9 z-40 w-44 rounded-2xl shadow-2xl overflow-hidden py-1">
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-white/40 cursor-default"
                >
                  Historial (próximamente)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-4xl font-bold text-white tabular-nums">{displayValue.toLocaleString()}</span>
        <span className="text-lg text-white/35 tabular-nums">/ {calorieGoal.toLocaleString()}</span>
      </div>

      <ArcChart low={rangeLow} high={rangeHigh} />

      <div className="grid grid-cols-3 gap-3">
        <MacroColumn label="Proteínas" value={totals.proteina} goal={proteinGoal} color={MACRO_COLORS.proteina} />
        <MacroColumn label="Carbs" value={totals.carbos} goal={carbsGoal} color={MACRO_COLORS.carbos} />
        <MacroColumn label="Grasas" value={totals.grasas} goal={fatGoal} color={MACRO_COLORS.grasas} />
      </div>

      {showFinishDayButton && (
        <button
          onClick={() => hasProgress && finishDay()}
          disabled={!hasProgress}
          className="w-full rounded-full py-3 text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
          style={
            hasProgress
              ? {
                  background: isFinishedToday ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, var(--gym), color-mix(in srgb, var(--gym) 70%, black))",
                  color: isFinishedToday ? "rgba(255,255,255,0.6)" : "white",
                  boxShadow: isFinishedToday ? undefined : "0 4px 20px var(--gym)55",
                }
              : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
          }
        >
          {isFinishedToday ? "Día registrado" : "Terminar Día"}
        </button>
      )}

      <GlassModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} title="Configuración de calorías">
        <div className="flex flex-col gap-3">
          <GlassInput
            type="number"
            inputMode="numeric"
            value={calorieInput}
            onChange={(e) => setCalorieInput(e.target.value)}
            placeholder="Meta diaria de kcal"
          />
          <GlassButton
            className="w-full"
            onClick={() => {
              const v = parseInt(calorieInput, 10);
              if (v > 0) useGymStore.setState({ calorieGoal: v });
              setGoalModalOpen(false);
            }}
          >
            Guardar
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={macroModalOpen} onClose={() => setMacroModalOpen(false)} title="Configurar macros">
        <div className="flex flex-col gap-3">
          <LabeledInput label="Proteína (g)" value={proteinInput} onChange={setProteinInput} />
          <LabeledInput label="Carbohidratos (g)" value={carbsInput} onChange={setCarbsInput} />
          <LabeledInput label="Grasas (g)" value={fatInput} onChange={setFatInput} />
          <GlassButton
            className="w-full"
            onClick={() => {
              const p = parseInt(proteinInput, 10);
              const c = parseInt(carbsInput, 10);
              const f = parseInt(fatInput, 10);
              useGymStore.setState({
                ...(p > 0 ? { proteinGoal: p } : {}),
                ...(c > 0 ? { carbsGoal: c } : {}),
                ...(f > 0 ? { fatGoal: f } : {}),
              });
              setMacroModalOpen(false);
            }}
          >
            Guardar
          </GlassButton>
        </div>
      </GlassModal>
    </GlassCard>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-white/50">{label}</span>
      <GlassInput type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

