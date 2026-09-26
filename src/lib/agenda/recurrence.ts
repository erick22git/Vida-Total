import { format } from "date-fns";
import { es } from "date-fns/locale";
import { NO_REPEAT, type AgendaRepeat, type AgendaTask } from "./types";

const parse = (iso: string) => new Date(`${iso}T12:00:00`);
const weekdayOf = (iso: string) => parse(iso).getDay();
const SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const repeatOf = (t: Pick<AgendaTask, "repeat">): AgendaRepeat => t.repeat ?? NO_REPEAT;
export const isRecurring = (t: Pick<AgendaTask, "repeat">) => repeatOf(t).freq !== "none";

/** ¿La tarea (o su serie) aparece en ese día? Lógica pura, sin nada de interfaz. */
export function occursOn(task: AgendaTask, date: string): boolean {
  if (task.date === null) return false;
  const r = repeatOf(task);
  if (r.freq === "none") return task.date === date;
  if (date < task.date) return false;
  if (r.until && date > r.until) return false;
  if (task.skipDates?.includes(date)) return false;
  if (r.freq === "daily") return true;
  return (r.days.length ? r.days : [weekdayOf(task.date)]).includes(weekdayOf(date));
}

export const isDoneOn = (task: AgendaTask, date: string): boolean => (isRecurring(task) ? !!task.doneDates?.includes(date) : task.done);

/** Tareas visibles en un día: las que caen ese día y las ocurrencias de las que se repiten (con `date` y `done` de ESE día). */
export function occurrencesOn(tasks: AgendaTask[], date: string): AgendaTask[] {
  return tasks.filter((t) => occursOn(t, date)).map((t) => ({ ...t, date, done: isDoneOn(t, date) }));
}

/** "Todos los días", "Cada viernes", "lun, mié, vie" (+ " · hasta 3 oct"). Vacío si no se repite. */
export function repeatLabel(task: Pick<AgendaTask, "repeat" | "date">): string {
  const r = repeatOf(task);
  if (r.freq === "none") return "";
  const days = r.freq === "daily" ? [0, 1, 2, 3, 4, 5, 6] : r.days.length ? r.days : task.date ? [weekdayOf(task.date)] : [];
  const base =
    days.length === 7
      ? "Todos los días"
      : days.length === 1
        ? `Cada ${LONG[days[0]]}`
        : [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => SHORT[d]).join(", ");
  return r.until ? `${base} · hasta ${format(parse(r.until), "d MMM", { locale: es }).replace(".", "")}` : base;
}
