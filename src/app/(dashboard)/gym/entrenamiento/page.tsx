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
import { format } from "date-fns";
import { ChevronLeft, Flame, Pencil, Shield, SlidersHorizontal, User, CalendarRange, MoreVertical } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { TrainingConfigSheet } from "@/components/gym/training-config-sheet";
import { MuscleCurveChart } from "@/components/gym/muscle-curve-chart";
import { WeekStrip } from "@/components/shared/week-strip";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import { getMuscleDistribution } from "@/lib/gym-utils";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { MuscleGroup, RoutineExercise } from "@/lib/types";

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
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  // El plan semanal es por día de la semana (0 = lunes), así que tocar un día de la franja
  // muestra el plan que le corresponde a ese día de la semana.
  const selectedDay = (selectedDate.getDay() + 6) % 7;
  const trainedKeys = new Set(sessions.filter((s) => s.completado).map((s) => format(new Date(s.date), "yyyy-MM-dd")));

  const isToday = format(selectedDate, "yyyy-MM-dd") === todayISO;
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
    <div
      className="vt-theme-dark fixed inset-0 z-[45] flex flex-col select-none"
      style={{ background: "var(--t-bg)", color: "var(--t-fg)" }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),12px)] shrink-0 relative">
        <Link href="/gym" aria-label="Volver" className="w-9 h-9 flex items-center justify-center -ml-2">
          <ChevronLeft size={26} strokeWidth={2.4} />
        </Link>
        <div className="flex items-center gap-1 -mr-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Más opciones"
            className="w-9 h-9 flex items-center justify-center cursor-pointer"
          >
            <MoreVertical size={20} />
          </button>
          <button
            onClick={() => setConfigOpen(true)}
            aria-label="Configuración e historial"
            className="w-9 h-9 flex items-center justify-center cursor-pointer"
          >
            <SlidersHorizontal size={21} strokeWidth={2.4} />
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-4 top-[calc(100%-2px)] z-40 w-44 rounded-2xl py-1 shadow-2xl"
              style={{ background: "var(--t-menu)", border: "1px solid var(--t-line)", color: "var(--t-fg)" }}
            >
              {[
                { href: "/gym/entrenamiento/planificaciones", label: "Planes", icon: CalendarRange },
                { href: "/gym/entrenamiento/rango", label: "Rango", icon: Shield },
                { href: "/gym/entrenamiento/perfil", label: "Perfil", icon: User },
                { href: "/gym/entrenamiento/rachas", label: `Racha · ${streak}`, icon: Flame },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <Icon size={16} /> {label}
                </Link>
              ))}
            </div>
          </>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <div className="max-w-md mx-auto px-5 pb-4 pt-3 flex flex-col gap-4">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="relative w-full h-[150px] rounded-[24px] overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer disabled:cursor-default"
          style={{ background: "var(--t-card)", border: "1px solid var(--t-line)", color: "#fff" }}
          data-keep-colors
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
          <div className="relative z-10 flex flex-col items-center gap-1 px-4">
            <p className="text-sm opacity-90">{isToday ? "Hoy toca" : `${DAY_NAMES[selectedDay]} toca`}</p>
            <h2 className="text-[30px] leading-none font-extrabold tracking-tight">{dayPlan.grupoMuscular}</h2>
            {hint && (
              <p className="text-[9.5px] uppercase tracking-[0.14em] mt-1.5" style={{ ...MONO_FONT, color: staleSession ? "#f59e0b" : "rgba(255,255,255,0.6)" }}>
                {hint}
              </p>
            )}
          </div>
        </button>

        <section className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between rounded-full px-4 py-1.5" style={{ background: "var(--t-card)" }}>
            <span className="text-[12px] tracking-wide" style={MONO_FONT}>
              DISTRIBUCIÓN MUSCULAR
            </span>
            <span className="text-[9.5px]" style={{ ...MONO_FONT, color: "var(--t-fg-dim)" }}>
              SER/REPS
            </span>
          </div>
          {isRestDay ? (
            <p className="text-xs px-4 py-2" style={{ color: "var(--t-fg-dim)" }}>Día de descanso.</p>
          ) : !routine ? (
            <p className="text-xs px-4 py-2" style={{ color: "var(--t-fg-dim)" }}>Sin rutina asignada. Tocá EDITAR para armarla.</p>
          ) : (
            <div className="px-2 max-h-[120px] overflow-y-auto no-scrollbar">
              {routine.ejercicios.map((rex, i) => {
                const ex = allExercises.find((e) => e.id === rex.exerciseId);
                return (
                  <div
                    key={rex.exerciseId + i}
                    className="flex items-center justify-between gap-3 h-[30px]"
                    style={{ borderBottom: i < routine.ejercicios.length - 1 ? "1px solid var(--t-line)" : "none" }}
                  >
                    <span className="text-[11px] uppercase tracking-wide truncate" style={MONO_FONT}>
                      {ex?.nombre ?? "Ejercicio"}
                    </span>
                    <span className="text-[10.5px] shrink-0 tabular-nums" style={{ color: "var(--t-fg-dim)" }}>{repsLabel(rex)}</span>
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
            className="flex items-center gap-2 rounded-full px-6 py-2 text-[11px] tracking-wide"
            style={{ ...MONO_FONT, border: "1px solid var(--t-ring)", background: "var(--t-card)" }}
          >
            <Pencil size={13} /> EDITAR
          </Link>
        </div>
      </div>
      </div>

      <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px] shrink-0 max-w-md w-full mx-auto">
        <WeekStrip
          doneKeys={trainedKeys}
          todayISO={todayISO}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          viewIndex={0}
          viewCount={0}
        />
      </div>

      <TrainingConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} todayIndex={todayIndex} />
    </div>
  );
}
