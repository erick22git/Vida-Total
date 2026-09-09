"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  HelpCircle,
  Dumbbell,
  Moon,
  Check,
} from "lucide-react";
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
import { GlassModal } from "@/components/glass/glass-modal";
import { useGymStore } from "@/lib/store/gymStore";
import {
  computeWorkoutStreak,
  countRestDaysUsedTotal,
  dayHasWorkout,
  isPlannedRestDay,
} from "@/lib/gym/training-streaks";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function EntrenamientoRachasPage() {
  const sessions = useGymStore((s) => s.sessions);
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [helpOpen, setHelpOpen] = useState(false);

  const streak = useMemo(() => computeWorkoutStreak(sessions), [sessions]);
  const restUsed = useMemo(
    () => countRestDaysUsedTotal(weeklyPlan, sessions),
    [weeklyPlan, sessions],
  );
  const isActiveToday = useMemo(() => dayHasWorkout(sessions, new Date()), [sessions]);

  const currentWeek = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => ({
      date,
      trained: dayHasWorkout(sessions, date),
      rest: isPlannedRestDay(weeklyPlan, date) && date <= new Date(),
    }));
  }, [sessions, weeklyPlan]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const result: {
      date: Date;
      inMonth: boolean;
      trained: boolean;
      rest: boolean;
    }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      result.push(
        weekDays.map((date) => ({
          date,
          inMonth: isSameMonth(date, monthCursor),
          trained: dayHasWorkout(sessions, date),
          rest: isPlannedRestDay(weeklyPlan, date) && date <= new Date(),
        })),
      );
    }
    return result;
  }, [monthCursor, sessions, weeklyPlan]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Racha de Entrenamiento</h1>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 cursor-pointer transition-colors"
          aria-label="Cómo funciona la racha"
        >
          <HelpCircle size={16} />
        </button>
      </header>

      <GlassCard accentColor="var(--gym)" glow className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-5xl font-extrabold text-white tabular-nums">{streak.current}</p>
          <p className="text-sm text-white/50">
            {streak.current === 1 ? "día de racha" : "días de racha"}
          </p>
        </div>
        <div
          className="flex items-center justify-center w-20 h-20 rounded-full shrink-0"
          style={{
            background: isActiveToday
              ? "radial-gradient(circle, var(--gym)33, transparent 70%)"
              : "transparent",
          }}
        >
          <Flame
            size={64}
            style={{ color: isActiveToday ? "var(--gym)" : "rgba(255,255,255,0.25)" }}
            fill={isActiveToday ? "var(--gym)" : "none"}
            fillOpacity={isActiveToday ? 0.25 : 0}
          />
        </div>
      </GlassCard>

      <div className="relative flex items-center justify-between px-1">
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-px bg-white/10" />
        {currentWeek.map(({ date, trained, rest }) => {
          const today = isToday(date);
          const hasActivity = trained || rest;
          return (
            <div key={date.toISOString()} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-sm"
                style={{
                  background: hasActivity
                    ? trained
                      ? "linear-gradient(135deg, var(--gym), var(--gym-2))"
                      : "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.05)",
                  border: today ? "2px solid white" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: trained ? "0 0 12px var(--gym-2)55" : undefined,
                }}
              >
                {trained ? (
                  <Dumbbell size={15} className="text-white" />
                ) : rest ? (
                  <Moon size={15} className="text-white/70" />
                ) : (
                  <span className="text-white/25">·</span>
                )}
              </div>
              <span className="text-[10px] text-white/35">{WEEKDAY_LABELS[(date.getDay() + 6) % 7]}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Moon} label="Descanso usado" value={restUsed} color="#93c5fd" />
        <StatCard icon={Flame} label="Mejor racha" value={streak.best} color="var(--gym)" />
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

        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="text-[11px] text-center text-white/40 font-medium">
              {label}
            </span>
          ))}

          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const today = isToday(day.date);
              return (
                <div key={`${wi}-${di}`} className="flex flex-col items-center gap-1 py-1">
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-full"
                    style={{
                      border: today ? "2px solid white" : "none",
                      opacity: day.inMonth ? 1 : 0.3,
                    }}
                  >
                    {today && day.trained ? (
                      <span
                        className="flex items-center justify-center w-full h-full rounded-full"
                        style={{ background: "white" }}
                      >
                        <Check size={13} style={{ color: "var(--gym)" }} strokeWidth={3} />
                      </span>
                    ) : day.trained ? (
                      <Dumbbell size={14} style={{ color: "var(--gym-2)" }} />
                    ) : day.rest ? (
                      <Moon size={14} className="text-white/50" />
                    ) : (
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: day.inMonth ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)" }}
                      >
                        {format(day.date, "d")}
                      </span>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </GlassCard>

      <GlassModal open={helpOpen} onClose={() => setHelpOpen(false)} title="¿Cómo funciona la racha?">
        <p className="text-sm text-white/70 leading-relaxed">
          Cada día que completes al menos un entrenamiento, tu racha aumenta en uno. Si pasas un día
          completo sin entrenar (y ese día no era de descanso planificado), la racha se reinicia. Los
          días de descanso de tu plan semanal se muestran con 🌙 y no cuentan como entrenamiento, pero
          sí quedan registrados en el calendario.
        </p>
      </GlassModal>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <GlassCard padding="md" className="flex flex-col items-center gap-2" style={{ background: "rgba(10,10,14,0.55)" }}>
      <Icon size={24} style={{ color }} />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-white/50 text-center">{label}</p>
    </GlassCard>
  );
}
