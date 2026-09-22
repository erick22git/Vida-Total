"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CalendarDays, ListChecks, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { DateStrip } from "@/components/calendar/date-strip";
import { dayRange, isToday, toISO } from "@/lib/calendar/date-utils";
import { useHabitsStore } from "@/lib/store/habitsStore";
import { getHabitIcon } from "@/lib/habits-utils";
import { getCategory } from "@/lib/data/habit-categories";
import { isStepDoneOn, sortStepsByHora } from "@/lib/routine-utils";
import { HabitCheckButton } from "@/components/animations/HabitCheckButton";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";

/** Rango fijo (no se re-centra al tocar un día) para que la franja no
 * salte de lugar cada vez que elegís una fecha distinta. */
const DAYS = dayRange(new Date(), 15);

export default function CalendarioPage() {
  const habits = useHabitsStore((s) => s.habits);
  const routines = useHabitsStore((s) => s.routines);
  const toggleHabitToday = useHabitsStore((s) => s.toggleHabitToday);
  const toggleRoutineStep = useHabitsStore((s) => s.toggleRoutineStep);
  const reduceMotion = useEffectiveReduceMotion();
  const [selected, setSelected] = useState(new Date());
  const dateISO = toISO(selected);
  const selectedIsToday = isToday(selected);

  const hasActivity = useMemo(
    () => (d: Date) => {
      const iso = toISO(d);
      return (
        habits.some((h) => h.completedDates.includes(iso)) ||
        routines.some((r) => r.completedDates.includes(iso))
      );
    },
    [habits, routines],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays style={{ color: "var(--calendario)" }} /> Calendario
        </h1>
      </header>

      <DateStrip days={DAYS} selected={selected} onSelect={setSelected} hasActivity={hasActivity} />

      <p className="text-sm font-semibold text-white/80 capitalize">
        {selectedIsToday ? "Hoy" : format(selected, "EEEE d 'de' MMMM", { locale: es })}
      </p>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-white/45 uppercase tracking-wide">Hábitos</p>
        {habits.length === 0 && <p className="text-sm text-white/40">No tenés hábitos todavía.</p>}
        <div className="flex flex-col gap-2">
          {habits.map((h) => {
            const category = getCategory(h.categoryId);
            const Icon = getHabitIcon(h.icon);
            const accent = category?.color ?? "var(--habitos)";
            const done = h.completedDates.includes(dateISO);
            return (
              <GlassCard key={h.id} padding="sm" accentColor={accent} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: `${accent}22` }}>
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <p className="flex-1 text-sm text-white truncate">{h.name}</p>
                {selectedIsToday ? (
                  <HabitCheckButton habitId={h.id} done={done} accentColor={accent} reduceMotion={reduceMotion} onToggle={() => toggleHabitToday(h.id)} size={36} />
                ) : (
                  <ReadOnlyStatus done={done} />
                )}
              </GlassCard>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-white/45 uppercase tracking-wide">Rutinas</p>
        {routines.length === 0 && <p className="text-sm text-white/40">No tenés rutinas todavía.</p>}
        <div className="flex flex-col gap-2">
          {routines.map((r) => (
            <GlassCard key={r.id} padding="sm" accentColor="var(--rutinas)" className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ListChecks size={15} style={{ color: "var(--rutinas)" }} />
                <p className="text-sm font-semibold text-white">{r.nombre}</p>
              </div>
              <div className="flex flex-col gap-1.5 pl-1">
                {sortStepsByHora(r.items).map((step) => {
                  const done = isStepDoneOn(step, habits, dateISO);
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-white/40 tabular-nums w-10 shrink-0">{step.hora}</span>
                      <p className="flex-1 text-xs text-white/75 truncate">{step.label}</p>
                      {selectedIsToday ? (
                        <HabitCheckButton
                          habitId={step.id}
                          done={done}
                          accentColor="var(--rutinas)"
                          reduceMotion={reduceMotion}
                          onToggle={() => toggleRoutineStep(r.id, step.id).stepResult}
                          size={28}
                        />
                      ) : (
                        <ReadOnlyStatus done={done} small />
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReadOnlyStatus({ done, small }: { done: boolean; small?: boolean }) {
  const size = small ? 20 : 28;
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: done ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.05)" }}
    >
      {done ? <Check size={size * 0.55} className="text-cyan-300" /> : <X size={size * 0.45} className="text-white/20" />}
    </div>
  );
}
