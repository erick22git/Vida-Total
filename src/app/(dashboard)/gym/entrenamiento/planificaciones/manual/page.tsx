"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Moon, Dumbbell, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import { dominantMuscleGroup } from "@/lib/gym-utils";
import type { RoutineExercise, WeeklyPlanDay } from "@/lib/types";

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
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const allExercises = useAllExercises();

  const [dayDrafts, setDayDrafts] = useState<RoutineExercise[][]>(DAYS.map(() => []));
  const [editingDay, setEditingDay] = useState<number | null>(null);

  const daysActive = dayDrafts.filter((d) => d.length > 0).length;

  function clearDay(i: number) {
    setDayDrafts((d) => d.map((day, idx) => (idx === i ? [] : day)));
  }

  function handleCreate() {
    const dias: WeeklyPlanDay[] = DAYS.map((d, i) => {
      const draft = dayDrafts[i];
      if (draft.length === 0) return { day: d.key, grupoMuscular: "Descanso" as const };
      const routine = saveRoutine(`Mi Plan Personalizado - ${d.label}`, draft);
      const grupo = dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      return { day: d.key, grupoMuscular: grupo, routineId: routine.id };
    });
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

  if (editingDay !== null) {
    const label = DAYS[editingDay].label;
    const draft = dayDrafts[editingDay];
    return (
      <div className="flex flex-col gap-5 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditingDay(null)} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">Editar: {label}</h1>
          </div>
          <GlassButton size="sm" accentColor="var(--gym-2)" onClick={() => setEditingDay(null)}>
            Listo
          </GlassButton>
        </header>

        {draft.length === 0 ? (
          <>
            <p className="text-sm text-white/50 -mt-3">Selecciona los ejercicios para {label}.</p>
            <ExercisePicker
              multiple
              onConfirmSelection={(exs) =>
                setDayDrafts((d) =>
                  d.map((day, idx) =>
                    idx === editingDay
                      ? exs.map<RoutineExercise>((e) => ({
                          exerciseId: e.id,
                          sets: [
                            { peso: 0, reps: 10, tipo: "normal" },
                            { peso: 0, reps: 10, tipo: "normal" },
                            { peso: 0, reps: 10, tipo: "normal" },
                          ],
                        }))
                      : day,
                  ),
                )
              }
            />
          </>
        ) : (
          <ExerciseSessionBuilder
            draft={draft}
            onDraftChange={(next) => setDayDrafts((d) => d.map((day, idx) => (idx === editingDay ? next : day)))}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Crear Manualmente</h1>
      </header>
      <p className="text-sm text-white/50 -mt-3">Toca un día para agregarle ejercicios.</p>

      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((d, i) => {
          const draft = dayDrafts[i];
          const isRest = draft.length === 0;
          const grupo = isRest ? null : dominantMuscleGroup(draft, allExercises);
          return (
            <GlassCard
              key={d.key}
              padding="sm"
              accentColor={isRest ? undefined : "var(--gym)"}
              onClick={() => setEditingDay(i)}
              className="relative flex flex-col gap-2 h-28 justify-center items-center text-center cursor-pointer"
            >
              {!isRest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDay(i);
                  }}
                  className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-black/40 text-white/50 hover:text-white cursor-pointer"
                  title="Marcar como descanso"
                  aria-label="Marcar como descanso"
                >
                  <X size={12} />
                </button>
              )}
              <p className="text-xs font-semibold text-white/50">{d.label}</p>
              {isRest ? (
                <>
                  <Moon size={20} className="text-white/30" />
                  <p className="text-xs text-white/40">Día de descanso</p>
                </>
              ) : (
                <>
                  <Dumbbell size={20} className="text-[var(--gym)]" />
                  <p className="text-sm font-bold text-white">{grupo}</p>
                  <p className="text-[10px] text-white/40">{draft.length} ejercicios</p>
                </>
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
    </div>
  );
}
