"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Moon, Check } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { MUSCLE_GROUPS } from "@/lib/data/gym-meta";
import { useGymStore } from "@/lib/store/gymStore";
import type { WeeklyPlanDay } from "@/lib/types";

const DAYS = [
  { key: "L", label: "Lunes" },
  { key: "M", label: "Martes" },
  { key: "X", label: "Miércoles" },
  { key: "J", label: "Jueves" },
  { key: "V", label: "Viernes" },
  { key: "S", label: "Sábado" },
  { key: "D", label: "Domingo" },
];

export default function ManualPlanCreatorPage() {
  const router = useRouter();
  const createPlan = useGymStore((s) => s.createPlan);
  const setActivePlan = useGymStore((s) => s.setActivePlan);
  const applyPlanToWeek = useGymStore((s) => s.applyPlanToWeek);

  const [dias, setDias] = useState<WeeklyPlanDay[]>(DAYS.map((d) => ({ day: d.key, grupoMuscular: "Descanso" })));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const daysActive = dias.filter((d) => d.grupoMuscular !== "Descanso").length;

  function handleCreate() {
    const plan = createPlan({
      nombre: "Mi Plan Personalizado",
      contexto: `Gimnasio · ${daysActive} días/semana`,
      categoria: "En el Gym",
      dias,
      daysPerWeek: daysActive,
      minsPerSession: 60,
    });
    setActivePlan(plan.id);
    applyPlanToWeek(plan.id);
    router.push("/gym/entrenamiento/planificaciones");
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Crear Manualmente</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((d, i) => {
          const isRest = dias[i].grupoMuscular === "Descanso";
          return (
            <GlassCard
              key={d.key}
              padding="sm"
              accentColor={isRest ? undefined : "var(--gym)"}
              onClick={() => setEditingIndex(i)}
              className="flex flex-col gap-2 h-28 justify-center items-center text-center cursor-pointer"
            >
              <p className="text-xs font-semibold text-white/50">{d.label}</p>
              {isRest ? (
                <>
                  <Moon size={20} className="text-white/30" />
                  <p className="text-xs text-white/40">Día de descanso</p>
                </>
              ) : (
                <p className="text-sm font-bold text-white">{dias[i].grupoMuscular}</p>
              )}
            </GlassCard>
          );
        })}
      </div>

      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-5 md:px-8 md:ml-64">
        <GlassButton accentColor="var(--gym-2)" size="lg" className="w-full max-w-2xl mx-auto" onClick={handleCreate}>
          Crear Planificación
        </GlassButton>
      </div>

      <GlassModal open={editingIndex !== null} onClose={() => setEditingIndex(null)} title="Elegir grupo muscular">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => {
              if (editingIndex === null) return;
              setDias((d) => d.map((day, i) => (i === editingIndex ? { ...day, grupoMuscular: "Descanso" } : day)));
              setEditingIndex(null);
            }}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer hover:bg-white/10"
          >
            <Moon size={16} className="text-white/50" />
            <span className="flex-1 text-sm text-white/85">Día de descanso</span>
            {editingIndex !== null && dias[editingIndex].grupoMuscular === "Descanso" && (
              <Check size={16} className="text-white/60" />
            )}
          </button>
          <div className="h-px bg-white/10 my-1" />
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                if (editingIndex === null) return;
                setDias((d) => d.map((day, i) => (i === editingIndex ? { ...day, grupoMuscular: m.value } : day)));
                setEditingIndex(null);
              }}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer hover:bg-white/10"
            >
              <span className="flex-1 text-sm text-white/85">{m.label}</span>
              {editingIndex !== null && dias[editingIndex].grupoMuscular === m.value && (
                <Check size={16} className="text-[var(--gym)]" />
              )}
            </button>
          ))}
        </div>
      </GlassModal>
    </div>
  );
}
