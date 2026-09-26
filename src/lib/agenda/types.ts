/**
 * Agenda (planificación visual del día). Datos PROPIOS y aislados: no tocan hábitos, Gym ni el sync de Supabase.
 * Están pensados para conectarse después (p.ej. una tabla `agenda_tasks`): todo es serializable y con id.
 */
export interface AgendaSubtask {
  id: string;
  title: string;
  done: boolean;
}

/** Repetición: `weekly` usa `days` (0 = domingo … 6 = sábado). `until` (yyyy-MM-dd) = último día en que aparece. */
export interface AgendaRepeat {
  freq: "none" | "daily" | "weekly";
  days: number[];
  until: string | null;
}

/** De dónde viene un elemento. No se mezclan internamente aunque en pantalla convivan en la misma línea de tiempo. */
export type AgendaSource = "local" | "calendar" | "reminder";

/** Una alerta: minutos ANTES del inicio (0 = a la hora). En tareas de todo el día se cuenta desde las 8:00. */
export interface AgendaAlert {
  id: string;
  offsetMin: number;
}

export const NO_REPEAT: AgendaRepeat = { freq: "none", days: [], until: null };

export interface AgendaTask {
  id: string;
  title: string;
  /** Clave del catálogo de iconos (`src/lib/agenda/icons.ts`). */
  icon: string;
  /** Color de acento (hex). Blanco = valor por defecto. */
  color: string;
  /** yyyy-MM-dd. `null` = sin fecha (bandeja de entrada). En las que se repiten es el primer día. */
  date: string | null;
  /** Minutos desde 00:00. `null` = sin hora (día completo o bandeja). */
  startMin: number | null;
  durationMin: number;
  allDay: boolean;
  /** Estado de una tarea que no se repite. En las que se repiten, ver `doneDates`. */
  done: boolean;
  notes: string;
  subtasks: AgendaSubtask[];
  /** Alertas configuradas (varias). La entrega real en el teléfono llega en otra fase; la configuración ya se guarda. */
  alerts?: AgendaAlert[];
  /** @deprecated Antes de las alertas múltiples (true = 1 alerta a la hora). Se lee solo si falta `alerts`. */
  alert?: boolean;
  /** Ausente = tarea de Vida Total (`local`). */
  source?: AgendaSource;
  /** Id del elemento en su calendario/lista de origen (para actualizar sin duplicar al volver a importar). */
  externalId?: string;
  /** Calendario o lista de la que vino. */
  calendarId?: string;
  /** Ausente en tareas anteriores a la repetición = no se repite. */
  repeat?: AgendaRepeat;
  /** Días (yyyy-MM-dd) en que se completó una tarea que se repite. */
  doneDates?: string[];
  /** Días en que una tarea que se repite NO aparece (se borró solo ese día). */
  skipDates?: string[];
  createdAt: number;
}

export type AgendaTaskDraft = Omit<AgendaTask, "id" | "createdAt">;

/** Un calendario o lista de recordatorios importados (hoy desde un archivo .ics). */
export interface AgendaCalendar {
  id: string;
  name: string;
  kind: "events" | "reminders";
  color: string;
  /** Si está apagado, sus elementos no se muestran (pero siguen guardados). */
  visible: boolean;
  fileName: string;
  importedAt: number;
  count: number;
}

export type SyncStatus = { state: "idle" | "syncing" | "error"; message?: string };
