"use client";

/**
 * Inicio de Entrenamiento — rediseño "Not Boring" (fondo negro): franja de la semana con los días
 * entrenados, tarjeta de HOY con foto, lista de ejercicios con series x reps, gráfica de
 * distribución muscular y botón EDITAR. No hay botón de "Iniciar entrenamiento": el entrenamiento
 * arranca tocando la tarjeta de hoy. Planes / Rango / Perfil / Rachas viven en el menú "⋮", y
 * "Tu plan", las plantillas y el historial se mudaron al panel de configuración (sliders).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays, isSameDay, startOfWeek } from "date-fns";
import { Check, ChevronLeft, Flame, Moon, Pencil, Shield, SlidersHorizontal, User, CalendarRange, MoreVertical } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { TrainingConfigSheet } from "@/components/gym/training-config-sheet";
import { MuscleCurveChart } from "@/components/gym/muscle-curve-chart";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import { getMuscleDistribution } from "@/lib/gym-utils";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { MuscleGroup, RoutineExercise } from "@/lib/types";

const DAY_SHORT = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function repsLabel(rex: RoutineExercise): string {
  const reps = rex.sets.map((s) => s.reps).filter((r) => r > 0);
  const n = rex.sets.length;
  if (reps.length === 0) return `${n} ${n === 1 ? "serie" : "series"}`;
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return `${n} ${n === 1 ? "serie" : "series"} x ${min === max ? min : `${min}-${max}`} reps`;
}

export default function EntrenamientoPage() {
  const router = useRouter();
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const sessions = useGymStore((s) => s.sessions);
  const routines = useGymStore((s) => s.routines);
  const activeSession = useGymStore((s) => s.activeSession);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const plans = useGymStore((s) => s.plans);
  const activePlanId = useGymStore((s) => s.activePlanId);
  const activePlan = activePlanId ? plans.find((p) => p.id === activePlanId) : undefined;
  const onboardingCompleted = useGymStore((s) => s.onboardingCompleted);
  const startWorkout = useGymStore((s) => s.startWorkout);
  const startWorkoutFromRoutine = useGymStore((s) => s.startWorkoutFromRoutine);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);
  const streak = useGymStore((s) => s.streak);
  const allExercises = useAllExercises();

  // Alguien totalmente nuevo (sin plan, sin rutinas propias, nunca entrenó)
  // pasa primero por el formulario inicial en vez de ver el panel vacío.
  const isTotallyNew = !onboardingCompleted && plans.length === 0 && routines.length === 0 && sessions.length === 0;
  useEffect(() => {
    if (isTotallyNew) router.replace("/gym/entrenamiento/onboarding");
  }, [isTotallyNew, router]);

  // `activeSession` no expiraba nunca: un entrenamiento sin terminar de OTRO día seguía ofreciendo
  // "continuar" con ejercicios viejos en vez del plan de hoy.
  const sessionIsFromToday = !sessionStartedAt || new Date(sessionStartedAt).toDateString() === new Date().toDateString();
  const staleSession = !!activeSession && !sessionIsFromToday;

  const [configOpen, setConfigOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const todayIndex = todayDayIndex();
  const [selectedDay, setSelectedDay] = useState(todayIndex);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const trainedDays = weeklyPlan.map((_, i) => {
    const date = addDays(weekStart, i);
    return sessions.some((s) => s.completado && isSameDay(new Date(s.date), date));
  });

  const isToday = selectedDay === todayIndex;
  const dayPlan = weeklyPlan[selectedDay];
  const isRestDay = dayPlan.grupoMuscular === "Descanso";
  const routine = dayPlan.routineId ? routines.find((r) => r.id === dayPlan.routineId) : undefined;
  const distribution = routine ? getMuscleDistribution(routine.ejercicios, allExercises) : [];
  const bgExercise = routine
    ? routine.ejercicios.map((rex) => allExercises.find((e) => e.id === rex.exerciseId)).find((e) => e?.imagen)
    : allExercises.find((e) => e.categoria === dayPlan.grupoMuscular && e.imagen);

  const editHref = activePlan
    ? `/gym/entrenamiento/planificaciones/${activePlan.id}?day=${selectedDay}`
    : routine
      ? `/gym/entrenamiento/rutinas/${routine.id}`
      : "/gym/entrenamiento/rutinas/nueva";

  function startTodaysPlan() {
    const todayPlan = weeklyPlan[todayIndex];
    const todaysRoutine = todayPlan.routineId ? routines.find((r) => r.id === todayPlan.routineId) : undefined;
    if (todaysRoutine) {
      startWorkoutFromRoutine(todaysRoutine);
    } else {
      const grupo = todayPlan.grupoMuscular as MuscleGroup;
      const pool = allExercises.filter((e) => e.categoria === grupo).slice(0, 5);
      const ids = pool.length > 0 ? pool.map((e) => e.id) : [allExercises[0].id];
      startWorkout(grupo, ids);
    }
  }

  function handleStart() {
    if (!isToday || isRestDay) return;
    if (staleSession) {
      const seguir = confirm(
        "Tienes un entrenamiento sin terminar de otro día. Aceptar = continuar ese entrenamiento. Cancelar = descartarlo y empezar el plan de hoy.",
      );
      if (seguir) {
        router.push("/gym/entrenamiento/activo");
        return;
      }
      cancelWorkout();
      startTodaysPlan();
      router.push("/gym/entrenamiento/activo");
      return;
    }
    if (!activeSession) startTodaysPlan();
    router.push("/gym/entrenamiento/activo");
  }

  // El useEffect de arriba ya redirige — esto solo evita un parpadeo del panel vacío.
  if (isTotallyNew) return null;

  const canStart = isToday && !isRestDay;
  const hint = !canStart
    ? null
    : activeSession && !staleSession
      ? "Toca para continuar"
      : staleSession
        ? "Entrenamiento sin terminar de otro día"
        : "Toca para iniciar";

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-black text-white select-none">
      <div className="max-w-md mx-auto px-5 pb-12 flex flex-col gap-7">
        <header className="flex items-center justify-between pt-[max(env(safe-area-inset-top),16px)]">
          <Link href="/gym" aria-label="Volver" className="w-10 h-10 flex items-center justify-center -ml-2">
            <ChevronLeft size={30} strokeWidth={2.4} />
          </Link>
          <button
            onClick={() => setConfigOpen(true)}
            aria-label="Configuración e historial"
            className="w-10 h-10 flex items-center justify-center -mr-2 cursor-pointer"
          >
            <SlidersHorizontal size={24} strokeWidth={2.4} />
          </button>
        </header>

        <div className="flex items-start justify-between gap-1 -mt-2 relative">
          {weeklyPlan.map((d, i) => {
            const rest = d.grupoMuscular === "Descanso";
            const done = trainedDays[i];
            const selected = i === selectedDay;
            return (
              <button key={d.day + i} onClick={() => setSelectedDay(i)} className="flex flex-col items-center gap-2 cursor-pointer">
                <span
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: done ? "#fff" : rest ? "rgba(255,255,255,0.3)" : "transparent",
                    border: done || rest ? "none" : "1.5px solid rgba(255,255,255,0.28)",
                    color: done ? "#000" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {done ? <Check size={22} strokeWidth={3} /> : rest ? <Moon size={17} /> : null}
                </span>
                <span
                  className="text-[13px] tracking-wide pb-0.5"
                  style={{
                    ...MONO_FONT,
                    color: i === todayIndex || selected ? "#fff" : "rgba(255,255,255,0.7)",
                    borderBottom: selected ? "2px solid #fff" : "2px solid transparent",
                  }}
                >
                  {i === todayIndex ? "HOY" : DAY_SHORT[i]}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Más opciones"
            className="w-7 h-11 flex items-center justify-center cursor-pointer shrink-0"
          >
            <MoreVertical size={22} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-40 w-48 rounded-2xl py-1.5 shadow-2xl" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}>
                {[
                  { href: "/gym/entrenamiento/planificaciones", label: "Planes", icon: CalendarRange },
                  { href: "/gym/entrenamiento/rango", label: "Rango", icon: Shield },
                  { href: "/gym/entrenamiento/perfil", label: "Perfil", icon: User },
                  { href: "/gym/entrenamiento/rachas", label: `Racha · ${streak}`, icon: Flame },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 text-sm text-white/85">
                    <Icon size={16} /> {label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="relative w-full h-[250px] rounded-[28px] overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer disabled:cursor-default"
          style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {bgExercise?.imagen && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bgExercise.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.78) 100%)" }}
              />
            </>
          )}
          <div className="relative z-10 flex flex-col items-center gap-2 px-4">
            <p className="text-xl text-white/90">{isToday ? "Hoy toca" : `${DAY_NAMES[selectedDay]} toca`}</p>
            <h2 className="text-[44px] leading-none font-extrabold tracking-tight">{dayPlan.grupoMuscular}</h2>
            {hint && (
              <p className="text-[11px] uppercase tracking-[0.14em] mt-2" style={{ ...MONO_FONT, color: staleSession ? "#f59e0b" : "rgba(255,255,255,0.55)" }}>
                {hint}
              </p>
            )}
          </div>
        </button>

        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between rounded-full px-5 py-3.5" style={{ background: "#0d0d0d" }}>
            <span className="text-[17px] tracking-wide" style={MONO_FONT}>
              DISTRIBUCIÓN MUSCULAR
            </span>
            <span className="text-sm text-white/65" style={MONO_FONT}>
              SER/REPS
            </span>
          </div>
          {isRestDay ? (
            <p className="text-sm text-white/40 px-5 py-4">Día de descanso.</p>
          ) : !routine ? (
            <p className="text-sm text-white/40 px-5 py-4">Sin rutina asignada. Tocá EDITAR para armarla.</p>
          ) : (
            <div className="px-3">
              {routine.ejercicios.map((rex, i) => {
                const ex = allExercises.find((e) => e.id === rex.exerciseId);
                return (
                  <div
                    key={rex.exerciseId + i}
                    className="flex items-center justify-between gap-3 py-3.5"
                    style={{ borderBottom: i < routine.ejercicios.length - 1 ? "1px solid rgba(255,255,255,0.14)" : "none" }}
                  >
                    <span className="text-[16px] uppercase tracking-wide truncate" style={MONO_FONT}>
                      {ex?.nombre ?? "Ejercicio"}
                    </span>
                    <span className="text-[15px] text-white/90 shrink-0 tabular-nums">{repsLabel(rex)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {distribution.length > 0 && <MuscleCurveChart data={distribution} />}

        <div className="flex justify-center">
          <Link
            href={editHref}
            className="flex items-center gap-3 rounded-full px-10 py-3.5 text-[15px] tracking-wide"
            style={{ ...MONO_FONT, border: "1px solid rgba(255,255,255,0.35)", background: "#0a0a0a" }}
          >
            <Pencil size={18} /> EDITAR
          </Link>
        </div>
      </div>

      <TrainingConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} todayIndex={todayIndex} />
    </div>
  );
}
