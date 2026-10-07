/**
 * "Qué toca avisar ahora": función PURA e independiente del programador (cron de Supabase, Vercel, n8n o lo que sea). Recibe
 * una foto del estado del usuario y devuelve los avisos que deben salir en este instante. No envía nada ni toca la base.
 *
 * Reglas para no hacer spam: interruptor general apagado por defecto, horario silencioso, un aviso por clave (nunca se
 * repite), «Posponer» como máximo 3 veces, mínimo entre avisos de agua, tope diario y como mucho 3 avisos por pasada.
 */
import { stepsForDate, isStepDoneOn } from "@/lib/routine-utils";
import type { Habit, HabitRoutine, Task } from "@/lib/types/habits";
import type { MealType } from "@/lib/types";
import { isQuietMinute } from "./config";
import type { AgentConfig } from "./types";
import { localParts } from "./tz";

export type NoticeKind = "task" | "subtask" | "routine" | "water" | "meal" | "summary";
export type NoticeButton = "done" | "snooze" | "water250" | "later";

export interface Notice {
  key: string;
  kind: NoticeKind;
  title: string;
  body: string;
  buttons: NoticeButton[];
  /** Para los botones: a qué tarea/subtarea se refiere. */
  taskId?: string;
  subtaskId?: string;
}

export interface SentInfo {
  at: number;
  /** Si el usuario pospuso: no volver a avisar antes de esto. */
  snoozeUntil?: number;
}

export interface NotifInput {
  nowMs: number;
  config: AgentConfig;
  tasks: Task[];
  routines: HabitRoutine[];
  habits: Habit[];
  waterTodayMl: number;
  waterGoalMl: number;
  kcalToday: number;
  kcalGoal: number;
  mealsLoggedToday: ReadonlySet<MealType>;
  /** Avisos ya enviados (clave → info). Debe incluir los de hoy como mínimo. */
  sent: ReadonlyMap<string, SentInfo>;
  /** Cuántos avisos ya salieron hoy (todos los tipos). */
  sentToday: number;
  /** Cuándo salió el último aviso de agua (ms), si hubo. */
  lastWaterAt?: number;
}

export const MAX_SNOOZES = 3;
export const SNOOZE_MIN = 10;
export const TASK_WINDOW_MIN = 120;
const MAX_PER_RUN = 3;
const WATER_FROM = 8 * 60;
const WATER_TO = 21 * 60;

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Clave a usar para `base`: la base la primera vez; luego `base#1…#3` solo si el aviso anterior se pospuso y ya pasó el
 * plazo. null = no toca (ya se envió y no hay pospuesto vencido, o se agotaron los pospuestos).
 */
export function variantKey(base: string, sent: ReadonlyMap<string, SentInfo>, nowMs: number): { key: string; isRepeat: boolean } | null {
  for (let n = 0; n <= MAX_SNOOZES; n++) {
    const key = n === 0 ? base : `${base}#${n}`;
    const info = sent.get(key);
    if (!info) {
      if (n === 0) return { key, isRepeat: false };
      const prev = sent.get(n === 1 ? base : `${base}#${n - 1}`);
      return prev?.snoozeUntil !== undefined && prev.snoozeUntil <= nowMs ? { key, isRepeat: true } : null;
    }
  }
  return null;
}

export function dueNotifications(i: NotifInput): Notice[] {
  const prefs = i.config.notifications;
  if (!prefs.enabled || i.config.killSwitch) return [];
  const lp = localParts(i.nowMs, i.config.timezone);
  if (isQuietMinute(i.config, lp.minutesOfDay)) return [];
  const today = lp.date;
  const now = lp.minutesOfDay;
  const out: Notice[] = [];

  // ── Tareas y subtareas con recordatorio (hoy) ──
  if (prefs.types.tasks) {
    for (const t of i.tasks) {
      if (t.isCompleted) continue;
      if (t.dueDate === today && t.reminder) {
        const at = minutesOf(t.reminder);
        const base = `task:${t.id}:${today}:${t.reminder}`;
        const v = variantKey(base, i.sent, i.nowMs);
        if (v && now >= at && (v.isRepeat || now < at + TASK_WINDOW_MIN)) {
          out.push({ key: v.key, kind: "task", title: v.isRepeat ? "Recordatorio (pospuesto)" : "Recordatorio de tarea", body: `${t.title}${t.reminder ? ` · ${t.reminder}` : ""}`, buttons: ["done", "snooze"], taskId: t.id });
        }
      }
      for (const s of t.subtasks) {
        if (s.done || s.dueDate !== today || !s.reminder) continue;
        const at = minutesOf(s.reminder);
        const base = `subtask:${t.id}:${s.id}:${today}:${s.reminder}`;
        const v = variantKey(base, i.sent, i.nowMs);
        if (v && now >= at && (v.isRepeat || now < at + TASK_WINDOW_MIN)) {
          out.push({ key: v.key, kind: "subtask", title: "Recordatorio de subtarea", body: `${s.title} (de «${t.title}»)`, buttons: ["done", "snooze"], taskId: t.id, subtaskId: s.id });
        }
      }
    }
  }

  // ── Rutina próxima ──
  if (prefs.types.routines) {
    const active = i.routines.filter((r) => !r.endsAt || r.endsAt >= today);
    for (const step of stepsForDate(active, today)) {
      if (isStepDoneOn(step, i.habits, today)) continue;
      const at = minutesOf(step.hora);
      if (now < at - prefs.routineLeadMin || now > at + 10) continue;
      const base = `routine:${step.id}:${today}`;
      const v = variantKey(base, i.sent, i.nowMs);
      if (!v) continue;
      out.push({ key: v.key, kind: "routine", title: `Rutina «${step.routineNombre}»`, body: `${step.label} a las ${step.hora}`, buttons: ["snooze", "later"] });
    }
  }

  // ── Agua: por debajo del ritmo esperado del día ──
  if (prefs.types.water && i.waterGoalMl > 0 && now >= WATER_FROM && now <= WATER_TO) {
    const expected = i.waterGoalMl * Math.min(1, Math.max(0, (now - WATER_FROM) / (WATER_TO - WATER_FROM)));
    const gapOk = i.lastWaterAt === undefined || i.nowMs - i.lastWaterAt >= prefs.waterEveryMin * 60_000;
    if (gapOk && i.waterTodayMl < expected * 0.75) {
      const key = `water:${today}:${Math.floor(now / prefs.waterEveryMin)}`;
      if (!i.sent.has(key)) out.push({ key, kind: "water", title: "Toca tomar agua 💧", body: `Llevas ${i.waterTodayMl} de ${i.waterGoalMl} ml.`, buttons: ["water250", "later"] });
    }
  }

  // ── Comidas sin registrar ──
  if (prefs.types.meals) {
    for (const meal of ["desayuno", "almuerzo", "cena"] as const) {
      const at = minutesOf(prefs.mealTimes[meal]);
      const key = `meal:${meal}:${today}`;
      if (now >= at && now < at + 120 && !i.mealsLoggedToday.has(meal) && !i.sent.has(key)) {
        out.push({ key, kind: "meal", title: `¿Ya tomaste ${meal}?`, body: `Todavía no hay nada registrado. Dime qué comiste y lo anoto.`, buttons: ["later"] });
      }
    }
  }

  // ── Resumen diario ──
  if (prefs.types.summary) {
    const at = minutesOf(prefs.summaryTime);
    const key = `summary:${today}`;
    if (now >= at && now < at + 120 && !i.sent.has(key)) {
      const pending = i.tasks.filter((t) => !t.isCompleted && t.dueDate === today).length;
      out.push({
        key,
        kind: "summary",
        title: "Resumen del día",
        body: `Calorías: ${Math.round(i.kcalToday)} / ${Math.round(i.kcalGoal)} kcal · Agua: ${i.waterTodayMl} / ${i.waterGoalMl} ml · Tareas de hoy sin hacer: ${pending}.`,
        buttons: [],
      });
    }
  }

  const order: Record<NoticeKind, number> = { task: 0, subtask: 1, routine: 2, meal: 3, water: 4, summary: 5 };
  const room = Math.max(0, prefs.maxPerDay - i.sentToday);
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, Math.min(room, MAX_PER_RUN));
}

export const buttonLabel: Record<NoticeButton, string> = {
  done: "✅ Hecho",
  snooze: `⏰ Posponer ${SNOOZE_MIN} min`,
  water250: "💧 +250 ml",
  later: "👍 Entendido",
};
