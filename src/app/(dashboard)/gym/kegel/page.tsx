"use client";

/**
 * Kegel — rediseño estilo Not Boring (Hábitos). Dos vistas que se cambian deslizando en vertical:
 *   0 = "El Plan Personal de Hoy" (5 sesiones en línea de tiempo + franja de los últimos 7 días)
 *   1 = año (conos dorados por cada día cumplido)
 * Tocar una sesión abre `/gym/kegel/sesion/[id]`; al terminar su tiempo vuelve acá y queda marcada.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChevronLeft, Clock, Dumbbell, Flower2 } from "lucide-react";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { format } from "date-fns";
import { WeekStrip } from "@/components/shared/week-strip";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { KEGEL_SESSIONS, formatDuration, type KegelSessionKind } from "@/lib/gym/kegel-plan";
import { fullyDoneDays, useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { useGymStore } from "@/lib/store/gymStore";

const VIEW_COUNT = 2;
const SWIPE_Y = 60;

const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

function SessionIcon({ kind }: { kind: KegelSessionKind }) {
  const props = { size: 22, strokeWidth: 2.4, fill: "#fff", color: "#fff" };
  if (kind === "pesa") return <Dumbbell {...props} />;
  if (kind === "loto") return <Flower2 {...props} fill="none" />;
  return <BookOpen {...props} />;
}

export default function KegelPage() {
  const router = useRouter();
  const completed = useKegelPlanStore((s) => s.completed);
  const streak = useGymStore((s) => s.kegelStreak);

  const [view, setView] = useState(0);
  const [dir, setDir] = useState(1);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  const todayISO = format(new Date(), "yyyy-MM-dd");
  const doneToday = completed[todayISO] ?? [];
  const doneDays = fullyDoneDays(completed);

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
      style={view === 0 ? { backgroundColor: "#000" } : { backgroundColor: "#0d0d0d", backgroundImage: NOISE }}
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
        <span className="w-10 h-10 -mr-2 flex items-center justify-center" aria-hidden>
          <SettingsGlyph />
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
                <div className="flex-1 min-h-0 overflow-hidden px-5 pt-2">
                  <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-5">El Plan Personal de Hoy</h2>
                  <ol className="relative">
                    <span
                      className="absolute left-[27px] top-[-14px] bottom-[26px] w-[2px]"
                      style={{ background: "rgba(255,255,255,0.35)" }}
                      aria-hidden
                    />
                    {KEGEL_SESSIONS.map((s) => {
                      const done = doneToday.includes(s.id);
                      return (
                        <li key={s.id} className="relative mb-6 last:mb-0">
                          <button
                            onClick={() => router.push(`/gym/kegel/sesion/${s.id}`)}
                            className="flex items-center gap-5 w-full text-left cursor-pointer active:opacity-70"
                          >
                            <span
                              className="relative w-[56px] h-[56px] rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: "#0a0a0a",
                                border: "2px solid rgba(255,255,255,0.4)",
                                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.12)",
                              }}
                            >
                              {done ? (
                                <span className="w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center">
                                  <Check size={22} strokeWidth={3.2} color="#000" />
                                </span>
                              ) : (
                                <SessionIcon kind={s.icon} />
                              )}
                            </span>
                            <span className="flex flex-col gap-1.5">
                              <span className="text-[24px] font-bold tracking-tight leading-none">{s.title}</span>
                              <span className="flex items-center gap-2 text-[17px] leading-none" style={{ color: "#aab4c8" }}>
                                <Clock size={19} fill="#fff" color="#000" strokeWidth={2.4} />
                                {formatDuration(s.durationSec)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px] shrink-0">
                  <WeekStrip doneKeys={doneDays} todayISO={todayISO} viewIndex={view} viewCount={VIEW_COUNT} />
                </div>
              </div>
            ) : (
              <CalorieYearView
                loggedDayKeys={doneDays}
                todayISO={todayISO}
                streakCurrent={streak}
                viewIndex={view}
                viewCount={VIEW_COUNT}
                allGold
                showStreak={false}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
