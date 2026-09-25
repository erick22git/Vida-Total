"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, Plus, SlidersHorizontal } from "lucide-react";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { animationEngine } from "@/lib/animations/animation-engine";
import { completeHabit, undoHabit } from "@/lib/habits/complete-habit";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { HoldCircle } from "@/components/habitos/hold-circle";
import { HabitWeekStrip } from "@/components/habitos/habit-week-strip";
import { NewHabitFlow } from "@/components/habitos/new-habit-flow";
import { useHabitFeedback } from "@/components/habitos/use-habit-feedback";
import { YearView } from "@/components/habitos/year-view";
import { FigureView } from "@/components/habitos/figure-view";
import { MilestoneCelebration } from "@/components/habitos/milestone-celebration";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

// Textura de grano sutil del fondo (referencia: fondo gris oscuro granulado).
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

/** Distancia/velocidad mínimas del swipe horizontal para cambiar de hábito. */
const SWIPE_OFFSET = 70;
const SWIPE_VELOCITY = 450;

// Cambio de hábito: el actual sale y el siguiente entra desde el lado
// contrario, con un poco de escala/opacidad para dar profundidad.
const slide = {
  enter: (dir: number) => ({ x: dir * 110, opacity: 0, scale: 0.9 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -110, opacity: 0, scale: 0.9 }),
};

// Cambio de vista (vertical): la nueva sube/baja desde el borde.
const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};
const VIEW_COUNT = 3; // 0 = check, 1 = año, 2 = figura
const SWIPE_Y = 60;

function HabitScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const habits = useHabitsStore((s) => s.habits);
  const addHabit = useHabitsStore((s) => s.addHabit);
  const reduceMotion = useEffectiveReduceMotion();
  const [createOpen, setCreateOpen] = useState(false);
  useHabitFeedback();

  const [index, setIndex] = useState(() => {
    const i = habits.findIndex((h) => h.id === params.get("id"));
    return i >= 0 ? i : 0;
  });
  const [direction, setDirection] = useState(1);
  const [view, setView] = useState(0);
  const [viewDir, setViewDir] = useState(1);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  const today = todayISO();
  const safeIndex = Math.min(index, Math.max(habits.length - 1, 0));
  const habit = habits[safeIndex];
  const done = habit ? habit.completedDates.includes(today) : false;

  // Mantiene la URL apuntando al hábito visible sin re-navegar.
  useEffect(() => {
    if (habit) window.history.replaceState(null, "", `/habitos/habito?id=${encodeURIComponent(habit.id)}`);
  }, [habit]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= habits.length || next === safeIndex) return;
      const dir = next > safeIndex ? 1 : -1;
      setDirection(dir);
      setIndex(next);
      animationEngine.emit({
        type: dir > 0 ? "habit.swipeNext" : "habit.swipePrevious",
        tier: "action",
        entityId: habits[next].id,
      });
    },
    [habits, safeIndex],
  );

  const goView = useCallback(
    (next: number) => {
      if (next < 0 || next >= VIEW_COUNT || next === view) return;
      setViewDir(next > view ? 1 : -1);
      setView(next);
      animationEngine.emit({ type: "habit.viewChange", tier: "action", entityId: habit?.id ?? "" });
    },
    [view, habit?.id],
  );

  // Swipe VERTICAL = otra vista del hábito (el horizontal es otro hábito;
  // ver el drag="x" más abajo). Deslizar el dedo hacia arriba avanza.
  function onStagePointerDown(e: React.PointerEvent) {
    gestureStart.current = { x: e.clientX, y: e.clientY };
  }
  function onStagePointerUp(e: React.PointerEvent) {
    const st = gestureStart.current;
    gestureStart.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dy) > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) goView(view + (dy < 0 ? 1 : -1));
  }
  function onStageWheel(e: React.WheelEvent) {
    if (wheelLock.current || Math.abs(e.deltaY) < 30) return;
    wheelLock.current = true;
    setTimeout(() => (wheelLock.current = false), 500);
    goView(view + (e.deltaY > 0 ? 1 : -1));
  }

  // Alternativa sin gestos: flechas del teclado.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(safeIndex + 1);
      if (e.key === "ArrowLeft") goTo(safeIndex - 1);
      if (e.key === "ArrowDown") goView(view + 1);
      if (e.key === "ArrowUp") goView(view - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, goView, safeIndex, view]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) goTo(safeIndex + 1);
    else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) goTo(safeIndex - 1);
  }

  return (
    // z-[45]: por encima del BottomNav (z-40) para que la pantalla sea
    // completa como en la referencia, pero por debajo de los modales (z-50).
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <div className="flex items-center px-5 pt-[max(env(safe-area-inset-top),10px)]">
        <button
          onClick={() => router.push("/habitos")}
          aria-label="Volver a Hábitos"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ background: "#0d0d0d", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
      </div>

      <header className="flex items-center justify-between px-5 h-12">
        <button
          onClick={() => setCreateOpen(true)}
          aria-label="Nuevo hábito"
          className="w-10 h-10 flex items-center justify-center cursor-pointer"
        >
          <Plus size={30} strokeWidth={2.6} />
        </button>
        <div className="flex-1 min-w-0 relative h-6">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.h1
              key={habit?.id ?? "none"}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`absolute inset-0 text-center text-[15px] uppercase tracking-[0.12em] truncate px-2 leading-6 ${done ? "line-through" : ""}`}
              style={MONO}
            >
              {habit?.name ?? "Sin hábitos"}
            </motion.h1>
          </AnimatePresence>
        </div>
        {/* El detalle del hábito (progreso, horario, configuración) se
            conecta en la Fase 12 — hasta entonces el botón queda inerte. */}
        <button aria-label="Detalle del hábito" className="w-10 h-10 flex items-center justify-center cursor-pointer">
          <SlidersHorizontal size={26} strokeWidth={2.4} />
        </button>
      </header>

      {/* Indicador del hábito actual — discreto, no es una tab bar. */}
      {habits.length > 1 && (
        <div className="h-5 shrink-0 flex items-center justify-center gap-1" style={MONO}>
          {habits.length > 8 ? (
            <span className="text-[11px] text-white/45 tabular-nums">
              {safeIndex + 1} / {habits.length}
            </span>
          ) : (
            habits.map((h, i) => (
              <button
                key={h.id}
                onClick={() => goTo(i)}
                aria-label={`Ir a ${h.name}`}
                className="w-4 h-4 flex items-center justify-center cursor-pointer"
              >
                <span
                  className="rounded-full transition-all"
                  style={{
                    width: i === safeIndex ? 7 : 5,
                    height: i === safeIndex ? 7 : 5,
                    background: i === safeIndex ? "#fff" : "rgba(255,255,255,0.3)",
                  }}
                />
              </button>
            ))
          )}
        </div>
      )}

      <main
        className="flex-1 min-h-0 relative touch-none"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        onPointerCancel={() => (gestureStart.current = null)}
        onWheel={onStageWheel}
      >
        {habit ? (
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={habit.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              // Swipe horizontal = otro hábito.
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={habits.length > 1 ? 0.55 : 0.12}
              dragSnapToOrigin
              onDragEnd={onDragEnd}
              className="absolute inset-0"
            >
              <AnimatePresence mode="popLayout" initial={false} custom={viewDir}>
                <motion.div
                  key={view}
                  custom={viewDir}
                  variants={slideY}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {view === 0 && (
                    <div className="w-full h-full flex flex-col">
                      <div className="flex-1 flex items-center justify-center px-6">
                        <HoldCircle
                          habitId={habit.id}
                          name={habit.name}
                          subtitle={habit.type === "cantidad" || habit.type === "tiempo" ? `${habit.goal ?? ""} ${habit.unit ?? ""}`.trim() : undefined}
                          done={done}
                          reduceMotion={reduceMotion}
                          onComplete={() => completeHabit(habit.id)}
                          onUndo={() => undoHabit(habit.id)}
                        />
                      </div>
                      <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px]">
                        <HabitWeekStrip completedDates={habit.completedDates} todayISO={today} viewIndex={0} viewCount={VIEW_COUNT} />
                      </div>
                    </div>
                  )}
                  {view === 1 && <YearView completedDates={habit.completedDates} todayISO={today} />}
                  {view === 2 && <FigureView habit={habit} />}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-6">
            <button onClick={() => setCreateOpen(true)} className="w-[68vw] max-w-[340px] cursor-pointer">
              <HabitOrb className="w-full">
                <span className="text-lg font-bold text-white/70">Crea tu primer hábito</span>
              </HabitOrb>
            </button>
          </div>
        )}

      </main>

      <MilestoneCelebration habitId={habit?.id} reduceMotion={reduceMotion} />

      <NewHabitFlow
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => {
          // El nuevo hábito se agrega al final: saltar directo a él.
          const previousCount = habits.length;
          addHabit(input);
          setDirection(1);
          setIndex(previousCount);
          setView(0);
        }}
      />
    </div>
  );
}

export default function HabitPage() {
  return (
    <Suspense fallback={null}>
      <HabitScreen />
    </Suspense>
  );
}
