import { DAY_MIN } from "./time";
import type { AgendaAlert, AgendaTask } from "./types";

export const ALERT_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;
export const MAX_ALERTS = 5;
/** Las tareas de todo el día avisan a esta hora del día (menos el adelanto). */
export const ALL_DAY_ALERT_MIN = 8 * 60;
const MAX_OFFSET = 7 * DAY_MIN;

let seq = 0;
export const newAlert = (offsetMin: number): AgendaAlert => ({ id: `al-${Date.now().toString(36)}-${(seq++).toString(36)}`, offsetMin });

/** Alertas de una tarea. Las anteriores a este sistema (`alert: true/false`) se leen como "1 alerta a la hora" / "ninguna". */
export function alertsOf(t: Pick<AgendaTask, "alerts" | "alert">): AgendaAlert[] {
  if (t.alerts) return t.alerts;
  return t.alert === false ? [] : [{ id: "legacy", offsetMin: 0 }];
}

export function clampOffset(min: number): number {
  return Math.min(MAX_OFFSET, Math.max(0, Math.round(min)));
}

/** "A la hora", "10 min antes", "1 hora antes", "1 día antes", "1 h 30 min antes". */
export function alertLabel(offsetMin: number): string {
  if (offsetMin <= 0) return "A la hora";
  if (offsetMin % DAY_MIN === 0) {
    const d = offsetMin / DAY_MIN;
    return d === 1 ? "1 día antes" : `${d} días antes`;
  }
  if (offsetMin < 60) return `${offsetMin} min antes`;
  const h = Math.floor(offsetMin / 60);
  const m = offsetMin % 60;
  const base = m ? `${h} h ${m} min` : h === 1 ? "1 hora" : `${h} horas`;
  return `${base} antes`;
}

export function alertsSummary(alerts: AgendaAlert[]): string {
  if (alerts.length === 0) return "Sin alertas";
  if (alerts.length === 1) return alertLabel(alerts[0].offsetMin);
  return `${alerts.length} alertas`;
}

/** Instantes en que debería avisar cada alerta de la tarea en un día (base para la entrega futura). Ordenados. */
export function alertTimes(task: AgendaTask, date: string): Date[] {
  const base = task.allDay ? ALL_DAY_ALERT_MIN : task.startMin;
  if (base === null || base === undefined) return [];
  const day = new Date(`${date}T00:00:00`);
  return alertsOf(task)
    .map((a) => new Date(day.getTime() + (base - a.offsetMin) * 60_000))
    .sort((a, b) => a.getTime() - b.getTime());
}
