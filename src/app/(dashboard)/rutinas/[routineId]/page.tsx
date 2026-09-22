"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, ListChecks, Trash2 } from "lucide-react";
import { useHabitsStore, todayISO } from "@/lib/store/habitsStore";
import { getHabitIcon } from "@/lib/habits-utils";
import { isStepDoneOn, sortStepsByHora } from "@/lib/routine-utils";
import { HabitCheckButton } from "@/components/animations/HabitCheckButton";
import { ProgressCrystal, type CrystalState } from "@/components/animations/ProgressCrystal";
import { animationEngine } from "@/lib/animations/animation-engine";
import { useAnimationEvent } from "@/lib/animations/use-animation-engine";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";

function pctToState(pct: number): CrystalState {
  if (pct <= 0) return "idle";
  if (pct < 0.34) return "progress-25";
  if (pct < 0.67) return "progress-50";
  if (pct < 1) return "progress-75";
  return "complete";
}

export default function RoutineDetailPage({ params }: { params: Promise<{ routineId: string }> }) {
  const { routineId } = use(params);
  const router = useRouter();
  const routines = useHabitsStore((s) => s.routines);
  const habits = useHabitsStore((s) => s.habits);
  const toggleRoutineStep = useHabitsStore((s) => s.toggleRoutineStep);
  const deleteRoutine = useHabitsStore((s) => s.deleteRoutine);
  const reduceMotion = useEffectiveReduceMotion();
  const [milestoneFlash, setMilestoneFlash] = useState<number | null>(null);

  useAnimationEvent((event) => {
    if (event.type === "streak.milestone" && event.entityId === routineId && event.meta?.milestone) {
      setMilestoneFlash(event.meta.milestone);
      setTimeout(() => setMilestoneFlash(null), reduceMotion ? 0 : 1800);
    }
  });

  const routine = routines.find((r) => r.id === routineId);
  const today = todayISO();

  if (!routine) {
    return (
      <div className="flex flex-col gap-4 items-center text-center py-16">
        <p className="text-white/60">Esta rutina no existe.</p>
        <button onClick={() => router.push("/rutinas")} className="text-sm underline text-white/70 cursor-pointer">
          Volver a Rutinas
        </button>
      </div>
    );
  }

  const steps = sortStepsByHora(routine.items);
  const doneCount = steps.filter((s) => isStepDoneOn(s, habits, today)).length;
  const pct = steps.length > 0 ? doneCount / steps.length : 0;
  const crystalState: CrystalState = milestoneFlash ? "milestone" : pctToState(pct);

  function handleToggleStep(stepId: string) {
    const { stepResult, routineResult } = toggleRoutineStep(routineId, stepId);
    if (routineResult) {
      // El check individual ya dispara su propio feedback (ver
      // HabitCheckButton) — acá solo se emite el evento de "rutina
      // completa", una ceremonia aparte y más grande.
      animationEngine.emit({
        type: "routine.completed",
        tier: "milestone",
        entityId: routineId,
        meta: { streak: routineResult.streak },
      });
      if (routineResult.milestoneReached) {
        setTimeout(() => {
          animationEngine.emit({
            type: "streak.milestone",
            tier: "milestone",
            entityId: routineId,
            meta: { streak: routineResult.streak, milestone: routineResult.milestoneReached ?? undefined },
          });
        }, 400);
      }
    }
    return stepResult;
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/rutinas")} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{routine.nombre}</h1>
        </div>
        <button
          onClick={() => {
            if (confirm(`¿Eliminar la rutina "${routine.nombre}"?`)) {
              deleteRoutine(routineId);
              router.push("/rutinas");
            }
          }}
          className="text-white/40 hover:text-red-400 cursor-pointer shrink-0"
        >
          <Trash2 size={18} />
        </button>
      </header>

      <div className="flex items-center gap-4">
        <ProgressCrystal state={crystalState} reduceMotion={reduceMotion} size={80} />
        <div>
          <p className="text-lg font-semibold text-white">
            {doneCount}
            <span className="text-white/40 font-normal"> / {steps.length} pasos hoy</span>
          </p>
          {routine.streak > 0 && <p className="text-xs text-white/50">Racha de {routine.streak} días</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step) => {
          const habit = step.habitId ? habits.find((h) => h.id === step.habitId) : undefined;
          const Icon = habit ? getHabitIcon(habit.icon) : ListChecks;
          const done = isStepDoneOn(step, habits, today);
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors"
              style={{ background: done ? "var(--rutinas)1a" : "rgba(255,255,255,0.04)", border: `1px solid ${done ? "var(--rutinas)55" : "rgba(255,255,255,0.08)"}` }}
            >
              <div className="flex flex-col items-center w-11 shrink-0">
                <Clock size={11} className="text-white/30" />
                <span className="text-xs font-semibold text-white/60 tabular-nums">{step.hora}</span>
              </div>
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                style={{ background: habit ? `${habit.color}22` : "rgba(255,255,255,0.06)" }}
              >
                <Icon size={16} style={{ color: habit?.color ?? "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{step.label}</p>
                {habit && <p className="text-[11px] text-white/40 truncate">vinculado a {habit.name}</p>}
              </div>
              <HabitCheckButton
                habitId={step.id}
                done={done}
                accentColor="var(--rutinas)"
                reduceMotion={reduceMotion}
                onToggle={() => handleToggleStep(step.id)}
                size={38}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
