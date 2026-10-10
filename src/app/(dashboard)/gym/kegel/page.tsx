"use client";

/**
 * Kegel — tres vistas deslizables en vertical:
 *   0 = botón grande de "hoy" (sesión siguiente, o el check fijo si ya están las 3) + franja 7 días
 *   1 = año (conos dorados por cada día cumplido)
 *   2 = progreso (racha, récord, nivel, cuadrícula semanas)
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { KegelSettingsSheet } from "@/components/gym/kegel-settings-sheet";
import { KegelProgressView } from "@/components/gym/kegel-progress-view";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { BigCheck } from "@/components/habitos/big-check";
import { localDayKey } from "@/lib/gym/kegel-dates";
import { WeekStrip } from "@/components/shared/week-strip";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { KEGEL_SESSION_IDS } from "@/lib/gym/kegel-plan";
import { fullyDoneDays, useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { useGymStore } from "@/lib/store/gymStore";
import { playEvent } from "@/lib/sound/sound-manager";
import { haptic } from "@/lib/haptics/haptic";

const VIEW_COUNT = 3;
const SWIPE_Y = 60;
/** Cuánto se queda el check "festejando" antes de revelar el siguiente número (o quedarse fijo). */
const CELEBRATE_MS = 1100;

const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

export default function KegelPage() {
  return (
    <Suspense fallback={null}>
      <KegelPageContent />
    </Suspense>
  );
}

function KegelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const completed = useKegelPlanStore((s) => s.completed);
  const streak = useGymStore((s) => s.kegelStreak);

  const [view, setView] = useState(0);
  const [dir, setDir] = useState(1);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  const todayISO = localDayKey();
  const doneToday = completed[todayISO] ?? [];
  const doneDays = fullyDoneDays(completed);

  // Próxima sesión a hacer hoy (0, 1 o 2) — si ya están las tres, no hay próxima.
  const nextIndex = KEGEL_SESSION_IDS.findIndex((id) => !doneToday.includes(id));
  const allDone = nextIndex === -1;

  // Volver de una sesión recién completada trae `?done=sesion-N`: festeja (check + sonido, igual que
  // al completar un hábito) y after un momento revela el botón ya con el siguiente número — o el
  // check fijo si esa era la tercera. `doneToday`/`nextIndex` de arriba YA reflejan el cambio (el
  // motor de la sesión llama a `markCompleted` antes de volver), así que no hace falta más estado.
  const justDoneId = searchParams.get("done");
  const [celebrating, setCelebrating] = useState(() => !!justDoneId);
  useEffect(() => {
    if (!justDoneId) return;
    void playEvent("task-complete");
    haptic("success");
    router.replace("/gym/kegel");
    const t = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goView(next: number) {
    if (next < 0 || next >= VIEW_COUNT || next === view) return;
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

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      style={view === 0 ? { background: "var(--app-bg)" } : { backgroundColor: "#0d0d0d", backgroundImage: NOISE }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.push("/gym")}
          aria-label="Volver a Gym"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        {view === 0 ? (
          <h1 className="text-[22px] font-bold tracking-tight">Kegel</h1>
        ) : (
          <h1 className="text-[20px] uppercase tracking-[0.12em]" style={MONO_FONT}>
            Kegel
          </h1>
        )}
        <span className="w-10 h-10 -mr-2 flex items-center justify-center">
          <KegelSettingsSheet />
        </span>
      </header>

      <main
        className="flex-1 min-h-0 relative touch-none"
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const st = start.current;
          start.current = null;
          if (!st) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (Math.abs(dy) > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) goView(view + (dy < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (start.current = null)}
        onWheel={(e) => {
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
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-5">
                  <button
                    onClick={() => {
                      if (celebrating || allDone) return;
                      router.push(`/gym/kegel/sesion/${KEGEL_SESSION_IDS[nextIndex]}`);
                    }}
                    disabled={allDone}
                    aria-label={allDone ? "Plan de hoy terminado" : `Empezar Sesión ${nextIndex + 1}`}
                    className="relative w-[58vw] max-w-[260px] cursor-pointer active:scale-95 transition-transform disabled:cursor-default"
                  >
                    <HabitOrb done={celebrating || allDone}>
                      {celebrating || allDone ? (
                        <BigCheck size={110} />
                      ) : (
                        <span className="text-[72px] font-extrabold leading-none tabular-nums">{nextIndex + 1}</span>
                      )}
                    </HabitOrb>
                  </button>
                  {!celebrating && (
                    <p className="text-[13px] uppercase tracking-[0.14em]" style={{ ...MONO_FONT, color: "#aab4c8" }}>
                      {allDone ? "Plan de hoy terminado" : `Sesión ${nextIndex + 1}`}
                    </p>
                  )}
                </div>

                <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px] shrink-0">
                  <WeekStrip doneKeys={doneDays} todayISO={todayISO} viewIndex={view} viewCount={VIEW_COUNT} />
                </div>
              </div>
            ) : view === 1 ? (
              <CalorieYearView
                loggedDayKeys={doneDays}
                todayISO={todayISO}
                streakCurrent={streak}
                viewIndex={view}
                viewCount={VIEW_COUNT}
                allGold
                showStreak={false}
              />
            ) : (
              <KegelProgressView viewIndex={view} viewCount={VIEW_COUNT} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
