import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, startOfYear, subMonths, subWeeks, subYears } from "date-fns";
import type { StreakInput } from "./types";
import { computeStreak } from "./streak";

/**
 * Estadísticas de un hábito derivadas SOLO de `completedDates` — sin estado
 * guardado que se desactualice. Puro (sin React/stores), igual que el resto
 * del Progress Engine.
 */
export interface HabitStats {
  total: number;
  firstDate: string | null;
  thisWeek: number;
  prevWeek: number;
  thisMonth: number;
  prevMonth: number;
  thisYear: number;
  prevYear: number;
  currentStreak: number;
  /** Primer día de la racha actual (`null` si no hay). */
  currentStreakSince: string | null;
  bestStreak: number;
  /** Último día de la mejor racha. */
  bestStreakEnd: string | null;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (s: string) => new Date(`${s}T12:00:00`);

function countBetween(dates: string[], from: Date, toExclusive: Date): number {
  const a = iso(from);
  const b = iso(toExclusive);
  return dates.filter((d) => d >= a && d < b).length;
}

/** Racha más larga (en días consecutivos, o semanas consecutivas si es semanal). */
function bestRun(dates: string[], frequency: StreakInput["frequency"]): { length: number; end: string | null } {
  if (dates.length === 0) return { length: 0, end: null };
  const keys =
    frequency === "semanal"
      ? [...new Set(dates.map((d) => iso(startOfWeek(parse(d), { weekStartsOn: 1 }))))].sort()
      : [...new Set(dates)].sort();
  const step = frequency === "semanal" ? 7 : 1;
  let best = 1;
  let bestEnd = keys[0];
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    run = differenceInCalendarDays(parse(keys[i]), parse(keys[i - 1])) === step ? run + 1 : 1;
    if (run > best) {
      best = run;
      bestEnd = keys[i];
    }
  }
  return { length: best, end: bestEnd };
}

export function computeHabitStats(input: StreakInput, today: Date = new Date()): HabitStats {
  const dates = [...new Set(input.completedDates)].sort();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);
  const tomorrow = addDays(today, 1);

  const currentStreak = computeStreak(input, today);
  let currentStreakSince: string | null = null;
  if (currentStreak > 0) {
    const set = new Set(dates);
    // Racha diaria: retrocede desde el último día cumplido hasta cortar.
    let cursor = set.has(iso(today)) ? today : addDays(today, -1);
    if (input.frequency === "semanal") {
      currentStreakSince = iso(subWeeks(weekStart, currentStreak - 1));
    } else {
      cursor = addDays(cursor, -(currentStreak - 1));
      currentStreakSince = iso(cursor);
    }
  }
  const best = bestRun(dates, input.frequency);

  return {
    total: dates.length,
    firstDate: dates[0] ?? null,
    thisWeek: countBetween(dates, weekStart, tomorrow),
    prevWeek: countBetween(dates, subWeeks(weekStart, 1), weekStart),
    thisMonth: countBetween(dates, monthStart, tomorrow),
    prevMonth: countBetween(dates, subMonths(monthStart, 1), monthStart),
    thisYear: countBetween(dates, yearStart, tomorrow),
    prevYear: countBetween(dates, subYears(yearStart, 1), yearStart),
    currentStreak,
    currentStreakSince,
    bestStreak: best.length,
    bestStreakEnd: best.end,
  };
}

/** Serie acumulada de repeticiones por día para los últimos `days` días
 * (incluye hoy) — alimenta la gráfica de área. */
export function cumulativeSeries(completedDates: string[], days: number, today: Date = new Date()): number[] {
  const start = addDays(today, -(days - 1));
  const startISO = iso(start);
  const set = new Set(completedDates);
  let acc = [...set].filter((d) => d < startISO).length;
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    if (set.has(iso(addDays(start, i)))) acc++;
    out.push(acc);
  }
  return out;
}
