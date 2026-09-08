"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import {
  averageKcalInRange,
  computeLoggedDaysStreak,
  computePerfectDaysStreak,
  dayHasLoggedFood,
} from "@/lib/gym/streaks";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function RachasPage() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal) || 2000;
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

  const loggedStreak = useMemo(() => computeLoggedDaysStreak(loggedFoods), [loggedFoods]);
  const perfectStreak = useMemo(
    () => computePerfectDaysStreak(loggedFoods, calorieGoal),
    [loggedFoods, calorieGoal],
  );

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const result: { date: Date; inMonth: boolean; hasEntry: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      result.push(
        weekDays.map((date) => ({
          date,
          inMonth: isSameMonth(date, monthCursor),
          hasEntry: dayHasLoggedFood(loggedFoods, date),
        })),
      );
    }
    return result;
  }, [monthCursor, loggedFoods]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex-1 text-center pr-6">
          Mis Rachas
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StreakBlock
          label="Días Registrados"
          current={loggedStreak.current}
          best={loggedStreak.best}
          color="var(--gym)"
        />
        <StreakBlock
          label="Días Perfectos"
          current={perfectStreak.current}
          best={perfectStreak.best}
          color="#22c55e"
        />
      </div>

      <GlassCard padding="md" className="flex flex-col gap-4" style={{ background: "rgba(10,10,14,0.55)" }}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthCursor((m) => subMonths(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <span className="text-sm font-medium text-white capitalize">
            {format(monthCursor, "MMMM yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} className="text-white/70" />
          </button>
        </div>

        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr) auto" }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="text-[11px] text-center text-white/40 font-medium">
              {label}
            </span>
          ))}
          <span className="text-[11px] text-center text-white/40 font-medium px-1">Prom. kcal</span>

          {weeks.map((week, wi) => {
            const weekStart = week[0].date;
            const weekEnd = week[6].date;
            const avg = averageKcalInRange(loggedFoods, weekStart, weekEnd);
            return (
              <FragmentRow key={wi}>
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="flex flex-col items-center gap-1 py-1"
                  >
                    <span
                      className="text-xs tabular-nums"
                      style={{
                        color: day.inMonth
                          ? isToday(day.date)
                            ? "white"
                            : "rgba(255,255,255,0.75)"
                          : "rgba(255,255,255,0.25)",
                        fontWeight: isToday(day.date) ? 700 : 400,
                      }}
                    >
                      {format(day.date, "d")}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: day.hasEntry
                          ? "var(--gym)"
                          : "rgba(255,255,255,0.15)",
                        opacity: day.inMonth ? 1 : 0.35,
                      }}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-center px-1">
                  <span className="text-xs text-white/60 tabular-nums">
                    {avg === null ? "—" : avg.toLocaleString()}
                  </span>
                </div>
              </FragmentRow>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

/** Renders children directly as grid items (no extra wrapper) for a grid row. */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function StreakBlock({
  label,
  current,
  best,
  color,
}: {
  label: string;
  current: number;
  best: number;
  color: string;
}) {
  return (
    <GlassCard padding="md" className="flex flex-col items-center gap-2" style={{ background: "rgba(10,10,14,0.55)" }}>
      <Flame size={36} style={{ color }} fill={color} fillOpacity={0.25} />
      <p className="text-xs text-white/50 font-medium text-center">{label}</p>
      <p className="text-4xl font-extrabold text-white tabular-nums">{current}</p>
      <p className="text-[11px] text-white/40">racha actual</p>
      <div className="w-full h-px bg-white/10 my-1" />
      <p className="text-xs text-white/60">
        🏆 Mejor: <span className="font-semibold text-white">{best}</span>
      </p>
    </GlassCard>
  );
}
