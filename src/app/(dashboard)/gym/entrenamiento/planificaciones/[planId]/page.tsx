"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Moon, Dumbbell, MoreVertical, LayoutGrid, List, ListChecks } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import { dominantMuscleGroup } from "@/lib/gym-utils";
import type { RoutineExercise } from "@/lib/types";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const router = useRouter();
  const allExercises = useAllExercises();
  const plans = useGymStore((s) => s.plans);
  const routines = useGymStore((s) => s.routines);
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const updateRoutine = useGymStore((s) => s.updateRoutine);
  const updatePlanDay = useGymStore((s) => s.updatePlanDay);

  const plan = plans.find((p) => p.id === planId);

  const [view, setView] = useState<"list" | "grid">("list");
  const [menuDay, setMenuDay] = useState<number | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [draft, setDraft] = useState<RoutineExercise[]>([]);

  if (!plan) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-16">
        <p className="text-white/60">Planificación no encontrada.</p>
        <GlassButton accentColor="rgba(255,255,255,0.85)" className="!text-black" onClick={() => router.push("/gym/entrenamiento/planificaciones")}>
          Ir a Planificaciones
        </GlassButton>
      </div>
    );
  }

  function openDay(i: number) {
    setMenuDay(null);
    const day = plan!.dias[i];
    const routine = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
    setDraft(routine?.ejercicios ?? []);
    setEditingDay(i);
  }

  function markRest(i: number) {
    setMenuDay(null);
    updatePlanDay(plan!.id, i, { grupoMuscular: "Descanso", routineId: undefined });
  }

  function closeEditor() {
    if (editingDay === null) return;
    const day = plan!.dias[editingDay];
    const label = DAY_LABELS[editingDay];
    if (draft.length === 0) {
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: "Descanso", routineId: undefined });
    } else if (day.routineId) {
      updateRoutine(day.routineId, { ejercicios: draft });
      const grupo = dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: grupo });
    } else {
      const routine = saveRoutine(`${plan!.nombre} - ${label}`, draft);
      const grupo = dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: grupo, routineId: routine.id });
    }
    setEditingDay(null);
    setDraft([]);
  }

  if (editingDay !== null) {
    const label = DAY_LABELS[editingDay];
    return (
      <div className="flex flex-col gap-5 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={closeEditor} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">Editar: {label}</h1>
          </div>
          <GlassButton size="sm" accentColor="rgba(255,255,255,0.85)" className="!text-black" onClick={closeEditor}>
            Listo
          </GlassButton>
        </header>

        {draft.length === 0 ? (
          <>
            <p className="text-sm text-white/50 -mt-3">Selecciona los ejercicios para {label}.</p>
            <ExercisePicker
              multiple
              confirmButtonClassName="bottom-20 md:bottom-0 z-30"
              onConfirmSelection={(exs) =>
                setDraft(
                  exs.map<RoutineExercise>((e) => ({
                    exerciseId: e.id,
                    sets: [
                      { peso: 0, reps: 10, tipo: "normal" },
                      { peso: 0, reps: 10, tipo: "normal" },
                      { peso: 0, reps: 10, tipo: "normal" },
                    ],
                  })),
                )
              }
            />
          </>
        ) : (
          <ExerciseSessionBuilder draft={draft} onDraftChange={setDraft} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{plan.nombre}</h1>
        </div>
        <button
          onClick={() => setView((v) => (v === "list" ? "grid" : "list"))}
          className="text-white/50 hover:text-white p-1.5 cursor-pointer shrink-0"
          title={view === "list" ? "Ver como grilla" : "Ver como lista"}
          aria-label="Cambiar vista"
        >
          {view === "list" ? <LayoutGrid size={18} /> : <List size={18} />}
        </button>
      </header>

      {view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {plan.dias.map((day, i) => {
            const routine = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
            const isRest = day.grupoMuscular === "Descanso";
            return (
              <GlassCard
                key={day.day + i}
                padding="sm"
                onClick={() => openDay(i)}
                className="flex items-center gap-3 relative"
                style={{ background: "var(--glass-bg-dark)" }}
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                  style={{
                    background: isRest ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
                    color: isRest ? "rgba(255,255,255,0.35)" : "white",
                  }}
                >
                  {isRest ? <Moon size={18} /> : <Dumbbell size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{DAY_LABELS[i]}</p>
                  <p className="text-xs text-white/45 truncate">
                    {isRest ? "Descanso" : routine?.nombre ?? day.grupoMuscular}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuDay(menuDay === i ? null : i);
                  }}
                  className="text-white/40 hover:text-white shrink-0 p-1.5 cursor-pointer"
                  title="Más opciones"
                  aria-label="Más opciones"
                >
                  <MoreVertical size={16} />
                </button>
                {menuDay === i && (
                  <div
                    className="absolute top-12 right-2 z-20 w-52 rounded-2xl glass-surface p-1.5 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openDay(i)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85"
                    >
                      <ListChecks size={15} /> Editar ejercicios
                    </button>
                    <button
                      onClick={() => markRest(i)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85"
                    >
                      <Moon size={15} /> Marcar como descanso
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {plan.dias.map((day, i) => {
            const routine = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
            const isRest = day.grupoMuscular === "Descanso";
            return (
              <GlassCard
                key={day.day + i}
                padding="sm"
                accentColor={isRest ? undefined : "rgba(255,255,255,0.85)"}
                onClick={() => openDay(i)}
                className="flex flex-col gap-2 h-28 justify-center items-center text-center cursor-pointer"
                style={{ background: "var(--glass-bg-dark)" }}
              >
                <p className="text-xs font-semibold text-white/50">{DAY_LABELS[i]}</p>
                {isRest ? (
                  <>
                    <Moon size={20} className="text-white/30" />
                    <p className="text-xs text-white/40">Día de descanso</p>
                  </>
                ) : (
                  <>
                    <Dumbbell size={20} className="text-white" />
                    <p className="text-sm font-bold text-white truncate max-w-full px-1">{routine?.nombre ?? day.grupoMuscular}</p>
                  </>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
