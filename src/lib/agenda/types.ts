/**
 * Agenda (planificación visual del día). Datos PROPIOS y aislados: no tocan hábitos, Gym ni el sync de Supabase.
 * Están pensados para conectarse después (p.ej. una tabla `agenda_tasks`): todo es serializable y con id.
 */
export interface AgendaSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface AgendaTask {
  id: string;
  title: string;
  /** Clave del catálogo de iconos (`src/lib/agenda/icons.ts`). */
  icon: string;
  /** Color de acento (hex). Blanco = valor por defecto. */
  color: string;
  /** yyyy-MM-dd. `null` = sin fecha (bandeja de entrada). */
  date: string | null;
  /** Minutos desde 00:00. `null` = sin hora (día completo o bandeja). */
  startMin: number | null;
  durationMin: number;
  allDay: boolean;
  done: boolean;
  notes: string;
  subtasks: AgendaSubtask[];
  /** Solo se guarda la preferencia: los avisos en el teléfono todavía no están activos. */
  alert: boolean;
  createdAt: number;
}

export type AgendaTaskDraft = Omit<AgendaTask, "id" | "createdAt">;
