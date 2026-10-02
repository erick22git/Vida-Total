"use client";

/**
 * Inicio de Entrenamiento — rediseño "Not Boring" con 3 vistas que se cambian deslizando en vertical
 * (los 3 puntos junto a la fecha las indican):
 *   0 = HOY: tarjeta del día, "Distribución muscular", gráfica y botón EDITAR (tocar la tarjeta inicia
 *       o continúa el entrenamiento; no hay botón de iniciar)
 *   1 = AÑO: igual que el año de Calorías, pero los DESCANSOS del plan cuentan para la racha y se
 *       dibujan en gris; un día que tocaba entrenar y no se entrenó queda sin ícono
 *   2 = Rango (/gym/entrenamiento/rango): al seguir deslizando hacia abajo se navega a esa pantalla,
 *       y desde ahí deslizar hacia arriba vuelve a la vista de año (?view=1)
 * Planes / Rango / Perfil / Racha, "Tu plan", plantillas e historial viven en el panel de
 * configuración (ícono de sliders).
 */
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { ChevronLeft, Dumbbell, Pencil } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { TrainingConfigSheet } from "@/components/gym/training-config-sheet";
import { MuscleCurveChart } from "@/components/gym/muscle-curve-chart";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { WeekStrip } from "@/components/shared/week-strip";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import { muscleParticipation } from "@/lib/gym/muscle-participation";
import { trainingStreakInfo } from "@/lib/gym/training-streak";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { MuscleGroup, RoutineExercise } from "@/lib/types";

const VIEW_COUNT = 3;
const SWIPE_Y = 60;
const RANGO_HREF = "/gym/entrenamiento/rango";

const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};

function repsLabel(rex: RoutineExercise): string {
  const reps = rex.sets.map((s) => s.reps).filter((r) => r > 0);
  const n = rex.sets.length;
  if (reps.length === 0) return `${n} ${n === 1 ? "serie" : "series"}`;
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return `${n} ${n === 1 ? "serie" : "series"} x ${min === max ? min : `${min}-${max}`} reps`;
}

export default function EntrenamientoPage() {
  return (
    <Suspense fallback={null}>
      <EntrenamientoContent />
    </Suspense>
  );
}

function EntrenamientoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [view, setView] = useState(searchParams.get("view") === "1" ? 1 : 0);
  const [dir, setDir] = useState(1);
  const start = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const wheelLock = useRef(false);

  const todayIndex = todayDayIndex();
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  // El plan semanal es por día de la semana (0 = lunes), así que tocar un día de la franja
  // muestra el plan que le corresponde a ese día de la semana.
  const selectedDay = (selectedDate.getDay() + 6) % 7;
  const trainedKeys = new Set(sessions.filter((s) => s.completado).map((s) => format(new Date(s.date), "yyyy-MM-dd")));
  const { restKeys, streak } = trainingStreakInfo(trainedKeys, weeklyPlan, todayISO);

  const isToday = format(selectedDate, "yyyy-MM-dd") === todayISO;
  const dayPlan = weeklyPlan[selectedDay];
  const isRestDay = dayPlan.grupoMuscular === "Descanso";
  const routine = dayPlan.routineId ? routines.find((r) => r.id === dayPlan.routineId) : undefined;
  const distribution = routine ? muscleParticipation(routine.ejercicios, allExercises) : [];
  const bgExercise = routine
    ? routine.ejercicios.map((rex) => allExercises.find((e) => e.id === rex.exerciseId)).find((e) => e?.imagen)
    : allExercises.find((e) => e.categoria === dayPlan.grupoMuscular && e.imagen);

  const editHref = activePlan
    ? `/gym/entrenamiento/planificaciones/${activePlan.id}?day=${selectedDay}`
    : routine
      ? `/gym/entrenamiento/rutinas/${routine.id}`
      : "/gym/entrenamiento/rutinas/nueva";

  // Vista 0 (hoy) y 1 (año) están en esta pantalla; seguir hacia abajo (vista 2) navega a Rango.
  function goView(next: number) {
    if (next < 0 || next === view) return;
    if (next >= VIEW_COUNT - 1) {
      router.push(RANGO_HREF);
      return;
    }
    setDir(next > view ? 1 : -1);
    setView(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") goView(view + 1);
      if (e.key === "ArrowUp") goView(view - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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

  return (
    <div className="vt-theme-dark app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <Link href="/gym" aria-label="Volver" className="w-10 h-10 -ml-2 flex items-center justify-center">
          <ChevronLeft size={26} strokeWidth={2.4} />
        </Link>
        <h1 className="text-[15px] uppercase tracking-[0.12em] truncate px-2" style={MONO_FONT}>
          {isRestDay ? "Descanso" : dayPlan.grupoMuscular}
        </h1>
        <button
          onClick={() => setConfigOpen(true)}
          aria-label="Configuración e historial"
          className="w-10 h-10 -mr-2 flex items-center justify-center cursor-pointer"
        >
          <SettingsGlyph />
        </button>
      </header>

      <main
        className="flex-1 min-h-0 relative touch-none"
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, ignore: !!(e.target as HTMLElement).closest("[data-no-swipe]") };
        }}
        onPointerUp={(e) => {
          const st = start.current;
          start.current = null;
          if (!st || st.ignore) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (Math.abs(dy) > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) goView(view + (dy < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (start.current = null)}
        onWheel={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
          if (wheelLock.current || Math.abs(e.deltaY) < 30) return;
          wheelLock.current = true;
          setTimeout(() => (wheelLock.current = false), 500);
          goView(view + (e.deltaY > 0 ? 1 : -1));
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={view}
            custom={dir}
            variants={slideY}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {view === 0 ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="max-w-md mx-auto px-5 flex flex-col gap-3">
                    {/* Foto del día: sin marco ni texto, con los lados difuminados hacia el fondo. Tocarla inicia
                        o continúa el entrenamiento de hoy. */}
                    <button
                      onClick={handleStart}
                      disabled={!canStart}
                      aria-label={isToday ? "Iniciar o continuar el entrenamiento de hoy" : undefined}
                      className="relative -mx-5 h-[clamp(140px,28dvh,250px)] flex items-center justify-center cursor-pointer disabled:cursor-default"
                      style={{
                        WebkitMaskImage: "radial-gradient(ellipse 72% 70% at 50% 50%, #000 42%, transparent 100%)",
                        maskImage: "radial-gradient(ellipse 72% 70% at 50% 50%, #000 42%, transparent 100%)",
                      }}
                    >
                      {bgExercise?.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bgExercise.imagen} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <Dumbbell size={56} strokeWidth={1.4} className="opacity-25" />
                      )}
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
                        <p className="text-xs px-4 py-2" style={{ color: "var(--t-fg-dim)" }}>
                          Día de descanso.
                        </p>
                      ) : !routine ? (
                        <p className="text-xs px-4 py-2" style={{ color: "var(--t-fg-dim)" }}>
                          Sin rutina asignada. Tocá EDITAR para armarla.
                        </p>
                      ) : (
                        <div data-no-swipe className="px-2 max-h-[90px] overflow-y-auto no-scrollbar touch-pan-y">
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
                                <span className="text-[10.5px] shrink-0 tabular-nums" style={{ color: "var(--t-fg-dim)" }}>
                                  {repsLabel(rex)}
                                </span>
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
                    viewCount={VIEW_COUNT}
                  />
                </div>
              </div>
            ) : (
              <CalorieYearView
                loggedDayKeys={trainedKeys}
                restDayKeys={restKeys}
                todayISO={todayISO}
                streakCurrent={streak}
                viewIndex={1}
                viewCount={VIEW_COUNT}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <TrainingConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} todayIndex={todayIndex} />
    </div>
  );
}
