"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Moon, Dumbbell, MoreVertical, LayoutGrid, List, ListChecks, Copy, ClipboardPaste } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import { dominantMuscleGroup } from "@/lib/gym-utils";
import { MUSCLE_GROUPS } from "@/lib/data/gym-meta";
import { cn } from "@/lib/utils";
import type { RoutineExercise, MuscleGroup, WeeklyPlanDay } from "@/lib/types";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Portapapeles de "copiar/pegar día": vive en sessionStorage para poder copiar un día de un plan
// y pegarlo en otro plan distinto sin perderlo al navegar.
const DAY_CLIPBOARD_KEY = "vt-day-clipboard";
interface DayClipboard {
  grupoMuscular: WeeklyPlanDay["grupoMuscular"];
  ejercicios: RoutineExercise[] | null;
}

function readDayClipboard(): DayClipboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DAY_CLIPBOARD_KEY);
    return raw ? (JSON.parse(raw) as DayClipboard) : null;
  } catch {
    return null;
  }
}

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const allExercises = useAllExercises();
  const plans = useGymStore((s) => s.plans);
  const routines = useGymStore((s) => s.routines);
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const updateRoutine = useGymStore((s) => s.updateRoutine);
  const updatePlanDay = useGymStore((s) => s.updatePlanDay);
  const setActivePlan = useGymStore((s) => s.setActivePlan);
  const applyPlanToWeek = useGymStore((s) => s.applyPlanToWeek);
  const [dayClipboard, setDayClipboard] = useState<DayClipboard | null>(readDayClipboard);
  const [toast, setToast] = useState<string | null>(null);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  const plan = plans.find((p) => p.id === planId);

  // El panel de Entrenamiento (acceso rápido por día) enlaza directo acá con
  // ?day=N en vez de mandar a la pantalla de rutina suelta — así hay un solo
  // lugar para editar el día de un plan, y `grupoMuscular` se recalcula bien
  // al cerrar (ver closeEditor), cosa que no pasaba editando por afuera.
  const dayParam = searchParams.get("day");
  const initialDay = dayParam !== null && plan?.dias[Number(dayParam)] ? Number(dayParam) : null;

  const [view, setView] = useState<"list" | "grid">("list");
  const [menuDay, setMenuDay] = useState<number | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(initialDay);
  // Grupo muscular manual para el día en edición (opcional) — null = seguir
  // infiriendo automáticamente de los ejercicios, como antes.
  const [dayMuscleOverride, setDayMuscleOverride] = useState<MuscleGroup | null>(null);
  const [draft, setDraft] = useState<RoutineExercise[]>(() => {
    if (initialDay === null || !plan) return [];
    const day = plan.dias[initialDay];
    const routine = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
    return routine?.ejercicios ?? [];
  });

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
    setDayMuscleOverride(null);
    setEditingDay(i);
  }

  function markRest(i: number) {
    setMenuDay(null);
    updatePlanDay(plan!.id, i, { grupoMuscular: "Descanso", routineId: undefined });
  }

  function copyDay(i: number) {
    setMenuDay(null);
    const day = plan!.dias[i];
    const routine = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
    const clip: DayClipboard = {
      grupoMuscular: day.grupoMuscular,
      ejercicios: routine ? (JSON.parse(JSON.stringify(routine.ejercicios)) as RoutineExercise[]) : null,
    };
    try {
      sessionStorage.setItem(DAY_CLIPBOARD_KEY, JSON.stringify(clip));
    } catch {
      /* sin sessionStorage: queda solo en memoria de esta pantalla */
    }
    setDayClipboard(clip);
    flashToast(`${DAY_LABELS[i]} copiado`);
  }

  function pasteDay(i: number) {
    setMenuDay(null);
    if (!dayClipboard) return;
    const { ejercicios, grupoMuscular } = dayClipboard;
    if (!ejercicios || ejercicios.length === 0 || grupoMuscular === "Descanso") {
      updatePlanDay(plan!.id, i, { grupoMuscular: "Descanso", routineId: undefined });
    } else {
      // Siempre se clona: la rutina pegada es independiente de la original, así que editar un día
      // nunca modifica el otro.
      const cloned = JSON.parse(JSON.stringify(ejercicios)) as RoutineExercise[];
      const targetRoutineId = plan!.dias[i].routineId;
      if (targetRoutineId && routines.some((r) => r.id === targetRoutineId)) {
        updateRoutine(targetRoutineId, { ejercicios: cloned });
        updatePlanDay(plan!.id, i, { grupoMuscular });
      } else {
        const routine = saveRoutine(`${plan!.nombre} - ${DAY_LABELS[i]}`, cloned);
        updatePlanDay(plan!.id, i, { grupoMuscular, routineId: routine.id });
      }
    }
    flashToast(`Pegado en ${DAY_LABELS[i]}`);
  }

  // Guarda el borrador del día en el momento en que cambia, no recién al tocar "Listo": antes, salir
  // del editor con el botón atrás del teléfono o la barra de abajo perdía todo lo armado. Un borrador
  // vacío NO se guarda acá (es el paso de elegir ejercicios); eso lo resuelve closeEditor.
  function persistDay(dayIndex: number, next: RoutineExercise[], muscleOverride: MuscleGroup | null) {
    if (next.length === 0) return;
    const state = useGymStore.getState();
    const currentPlan = state.plans.find((p) => p.id === planId);
    const day = currentPlan?.dias[dayIndex];
    if (!currentPlan || !day) return;
    const grupo = muscleOverride ?? dominantMuscleGroup(next, allExercises) ?? "Cardio";
    const existing = day.routineId ? state.routines.find((r) => r.id === day.routineId) : undefined;
    if (existing) {
      updateRoutine(existing.id, { ejercicios: next });
      updatePlanDay(currentPlan.id, dayIndex, { grupoMuscular: grupo });
    } else {
      const routine = saveRoutine(`${currentPlan.nombre} - ${DAY_LABELS[dayIndex]}`, next);
      updatePlanDay(currentPlan.id, dayIndex, { grupoMuscular: grupo, routineId: routine.id });
    }
  }

  function changeDraft(next: RoutineExercise[]) {
    setDraft(next);
    if (editingDay !== null) persistDay(editingDay, next, dayMuscleOverride);
  }

  function changeMuscleOverride(next: MuscleGroup | null) {
    setDayMuscleOverride(next);
    if (editingDay !== null) persistDay(editingDay, draft, next);
  }

  function closeEditor() {
    if (editingDay === null) return;
    const day = plan!.dias[editingDay];
    const label = DAY_LABELS[editingDay];
    if (draft.length === 0) {
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: "Descanso", routineId: undefined });
    } else if (day.routineId) {
      updateRoutine(day.routineId, { ejercicios: draft });
      const grupo = dayMuscleOverride ?? dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: grupo });
    } else {
      const routine = saveRoutine(`${plan!.nombre} - ${label}`, draft);
      const grupo = dayMuscleOverride ?? dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      updatePlanDay(plan!.id, editingDay, { grupoMuscular: grupo, routineId: routine.id });
    }
    setEditingDay(null);
    setDraft([]);
    // Limpia el ?day=N si se llegó acá desde el acceso rápido del panel de
    // Entrenamiento, para que "atrás"/recargar no reabra el mismo día.
    if (dayParam !== null) router.replace(`/gym/entrenamiento/planificaciones/${plan!.id}`);
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

        {draft.length > 0 && (
          <div className="flex flex-col gap-1.5 -mt-2">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Grupo muscular (opcional)</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => changeMuscleOverride(null)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
                  dayMuscleOverride === null
                    ? "bg-white/[0.85] border-white text-black"
                    : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
                )}
              >
                Automático ({dominantMuscleGroup(draft, allExercises) ?? "-"})
              </button>
              {MUSCLE_GROUPS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => changeMuscleOverride(m.value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
                    dayMuscleOverride === m.value
                      ? "bg-white/[0.85] border-white text-black"
                      : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.length === 0 ? (
          <>
            {dayClipboard?.ejercicios && dayClipboard.ejercicios.length > 0 && (
              <button
                onClick={() => {
                  const cloned = JSON.parse(JSON.stringify(dayClipboard.ejercicios)) as RoutineExercise[];
                  changeDraft(cloned);
                  flashToast(`Pegado en ${label}`);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] transition-colors py-3 text-sm font-semibold text-white cursor-pointer"
              >
                <ClipboardPaste size={16} /> Pegar rutina copiada
              </button>
            )}
            <p className="text-sm text-white/50 -mt-3">Selecciona los ejercicios para {label}.</p>
            <ExercisePicker
              multiple
              confirmButtonClassName="z-30"
              onConfirmSelection={(exs) =>
                changeDraft(
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
          <ExerciseSessionBuilder draft={draft} onDraftChange={changeDraft} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full px-4 py-2 text-xs font-medium text-white bg-black/80 border border-white/15">
          {toast}
        </div>
      )}
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{plan.nombre}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!plan.activo && (
            <GlassButton
              size="sm"
              accentColor="#22c55e"
              onClick={() => {
                setActivePlan(plan.id);
                applyPlanToWeek(plan.id);
              }}
            >
              Usar este plan
            </GlassButton>
          )}
          <button
            onClick={() => setView((v) => (v === "list" ? "grid" : "list"))}
            className="text-white/50 hover:text-white p-1.5 cursor-pointer shrink-0"
            title={view === "list" ? "Ver como grilla" : "Ver como lista"}
            aria-label="Cambiar vista"
          >
            {view === "list" ? <LayoutGrid size={18} /> : <List size={18} />}
          </button>
        </div>
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
                    copyDay(i);
                  }}
                  className="text-white/40 hover:text-white shrink-0 p-1.5 cursor-pointer"
                  title="Copiar día"
                  aria-label={`Copiar ${DAY_LABELS[i]}`}
                >
                  <Copy size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    pasteDay(i);
                  }}
                  disabled={!dayClipboard}
                  className="text-white/40 hover:text-white shrink-0 p-1.5 cursor-pointer disabled:opacity-25 disabled:cursor-default"
                  title="Pegar día"
                  aria-label={`Pegar en ${DAY_LABELS[i]}`}
                >
                  <ClipboardPaste size={15} />
                </button>
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
                      onClick={() => copyDay(i)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85"
                    >
                      <Copy size={15} /> Copiar día
                    </button>
                    <button
                      onClick={() => pasteDay(i)}
                      disabled={!dayClipboard}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85 disabled:opacity-30 disabled:cursor-default"
                    >
                      <ClipboardPaste size={15} /> Pegar día
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
