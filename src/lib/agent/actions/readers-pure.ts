/** Lógica PURA de las lecturas de Entrenamiento y Agenda (la usan la app y el servidor). */
import exercisesData from "@/lib/data/exercises.json";
import { stepsForDate } from "@/lib/routine-utils";
import type { Routine, WeeklyPlanDay } from "@/lib/types";
import type { HabitRoutine, Task, TimeBlock } from "@/lib/types/habits";

const EX_NAME = new Map((exercisesData as Array<{ id: string; nombre: string }>).map((e) => [e.id, e.nombre]));
export const exerciseName = (id: string, custom?: Array<{ id: string; nombre: string }>) => EX_NAME.get(id) ?? custom?.find((c) => c.id === id)?.nombre ?? id;

const LETTER = ["D", "L", "M", "X", "J", "V", "S"] as const; // Date#getDay(): 0 = domingo

export function trainingToday(plan: WeeklyPlanDay[], routines: Routine[], weekday: number, nameOf: (id: string) => string = (id) => exerciseName(id)) {
  const day = plan.find((d) => d.day === LETTER[weekday]);
  if (!day) return { dia: LETTER[weekday], plan: "sin plan para hoy" };
  const rutina = day.routineId ? routines.find((r) => r.id === day.routineId) : undefined;
  return {
    dia: day.day,
    grupo: day.grupoMuscular,
    descanso: day.grupoMuscular === "Descanso",
    ...(rutina
      ? {
          rutina: {
            nombre: rutina.nombre,
            ejercicios: rutina.ejercicios.slice(0, 20).map((e) => ({ ejercicio: nameOf(e.exerciseId), series: e.sets.length })),
          },
        }
      : {}),
  };
}

export function agendaForDay(tasks: Task[], blocks: TimeBlock[], routines: HabitRoutine[], dateKey: string) {
  const steps = stepsForDate(routines.filter((r) => !r.endsAt || r.endsAt >= dateKey), dateKey);
  return {
    fecha: dateKey,
    tareas: tasks
      .filter((t) => t.dueDate === dateKey)
      .slice(0, 25)
      .map((t) => ({
        id: t.id,
        titulo: t.title,
        hecha: t.isCompleted,
        prioridad: t.priority,
        ...(t.reminder ? { aviso: t.reminder } : {}),
        subtareas: t.subtasks.slice(0, 15).map((s) => ({ titulo: s.title, hecha: s.done, ...(s.reminder ? { aviso: s.reminder } : {}) })),
      })),
    subtareasConFechaHoy: tasks
      .filter((t) => t.dueDate !== dateKey)
      .flatMap((t) => t.subtasks.filter((s) => s.dueDate === dateKey).map((s) => ({ tarea: t.title, titulo: s.title, hecha: s.done, ...(s.reminder ? { aviso: s.reminder } : {}) })))
      .slice(0, 15),
    vencidasPendientes: tasks
      .filter((t) => !t.isCompleted && !!t.dueDate && t.dueDate < dateKey)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 10)
      .map((t) => ({ titulo: t.title, venciaEl: t.dueDate, subtareasPendientes: t.subtasks.filter((s) => !s.done).length })),
    sinFechaPendientes: tasks.filter((t) => !t.isCompleted && !t.dueDate).slice(0, 8).map((t) => ({ titulo: t.title })),
    bloques: blocks.slice(0, 25).map((b) => ({ titulo: b.title, desde: `${String(b.startHour).padStart(2, "0")}:00`, hasta: `${String(b.endHour).padStart(2, "0")}:00` })),
    rutina: steps.slice(0, 30).map((s) => ({ hora: s.hora, paso: s.label, rutina: s.routineNombre })),
  };
}

export interface RankLine {
  grupo: string;
  rango: string | null;
  evaluados: number;
  total: number;
}

type AgendaData = ReturnType<typeof agendaForDay>;

/** Texto de respaldo (sin modelo) con las mismas secciones que pide el prompt, por si el modelo contesta algo vacío o cortado. */
export function renderAgendaText(a: AgendaData): string {
  const out: string[] = [];
  const box = (d: boolean) => (d ? "✅" : "⬜");
  if (a.tareas.length || a.subtareasConFechaHoy.length) {
    out.push("📋 TAREAS DE HOY");
    for (const t of a.tareas) {
      out.push(`${box(t.hecha)} ${t.titulo}${t.prioridad ? ` (${t.prioridad})` : ""}${t.aviso ? ` ⏰${t.aviso}` : ""}`);
      for (const s of t.subtareas) out.push(`   ↳ ${box(s.hecha)} ${s.titulo}`);
    }
    for (const s of a.subtareasConFechaHoy) out.push(`${box(s.hecha)} ${s.titulo} (de «${s.tarea}»)`);
  }
  if (a.vencidasPendientes.length) {
    out.push("", "⚠️ VENCIDAS");
    for (const v of a.vencidasPendientes) out.push(`⬜ ${v.titulo} (venció el ${v.venciaEl})${v.subtareasPendientes ? ` · ${v.subtareasPendientes} subtarea(s) pendiente(s)` : ""}`);
  }
  if (a.rutina.length) {
    out.push("", "🔁 RUTINA");
    for (const r of a.rutina) out.push(`${r.hora} – ${r.paso}`);
  }
  if (a.bloques.length) {
    out.push("", "🗓 BLOQUES");
    for (const b of a.bloques) out.push(`${b.desde}–${b.hasta} ${b.titulo}`);
  }
  if (a.sinFechaPendientes.length) {
    out.push("", "📝 SIN FECHA");
    for (const t of a.sinFechaPendientes) out.push(`⬜ ${t.titulo}`);
  }
  if (!out.length) return `No tienes nada agendado para ${a.fecha}.`;
  const subs = a.tareas.reduce((n, t) => n + t.subtareas.length, 0);
  out.push("", `${a.tareas.length} tarea(s), ${subs} subtarea(s), ${a.vencidasPendientes.length} vencida(s).`);
  return out.join("\n");
}
