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
  /** Solo se guarda la preferencia: los avisos en el teléfono todavía no están activos. */
  alert: boolean;
  /** Ausente en tareas anteriores a la repetición = no se repite. */
  repeat?: AgendaRepeat;
  /** Días (yyyy-MM-dd) en que se completó una tarea que se repite. */
  doneDates?: string[];
  /** Días en que una tarea que se repite NO aparece (se borró solo ese día). */
  skipDates?: string[];
  createdAt: number;
}

export type AgendaTaskDraft = Omit<AgendaTask, "id" | "createdAt">;
