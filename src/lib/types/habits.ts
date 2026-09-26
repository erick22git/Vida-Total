export type TaskPriority = "alta" | "media" | "baja";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string; // ISO date string (yyyy-MM-dd)
  timeSlot?: number; // hour of day 0-23, used by the timeline view
  isCompleted: boolean;
  subtasks: Subtask[];
  tags: string[];
  color: string;
  icon: string; // lucide icon name, resolved via HABIT_ICON_MAP
}

export type HabitFrequency = "diario" | "semanal";

/** binario = sí/no · cantidad = 5/8 vasos · tiempo = 20/30 minutos. */
export type HabitType = "binario" | "cantidad" | "tiempo";

/** Biblioteca propia de categorías (ver `src/lib/data/habit-categories.ts`)
 * — íconos de lucide, no emojis. */
export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  streak: number;
  completedDates: string[]; // ISO date strings (yyyy-MM-dd)
  categoryId?: string;
  /** Fuente de progreso que puede confirmar el hábito (ver `src/lib/habits/progress-sources.ts`). `undefined` = la de su
   * categoría (hábitos anteriores); `null` = sin vínculo. Persistido en `habits.source_id` (migración 0005). */
  sourceId?: string | null;
  /** Tipo y objetivo del hábito. Local-only hasta la migración de Supabase
   * (Fase 13) — la tabla `habits` todavía no tiene estas columnas. */
  type?: HabitType;
  goal?: number; // p.ej. 8 (vasos) o 20 (minutos); ausente en binario
  unit?: string; // p.ej. "vasos", "min"
  /** Días de la semana (0 = domingo … 6 = sábado). Ausente = todos los días. */
  scheduledDays?: number[];
  /** Hora del recordatorio "HH:mm" (opcional). Solo se guarda: todavía no
   * hay sistema de notificaciones que la use. */
  reminder?: string;
  /** Propósito/"misión" del hábito (texto libre). Local-only. */
  /** Valor acumulado por día en hábitos de cantidad/tiempo (fecha ISO → valor). */
  values?: Record<string, number>;
  mission?: string;
  /** El usuario lo marcó como dominado. Local-only. */
  mastered?: boolean;
  /** Milestones de racha (7/21/66, ver `src/lib/progress/types.ts`) ya
   * mostrados — evita repetir la animación de un milestone ya visto.
   * Local-only por ahora (no sincroniza entre dispositivos todavía: la
   * tabla `habits` en Supabase no tiene columna para esto — ver
   * `src/lib/sync/habits-sync.ts`). */
  milestonesUnlocked: number[];
}

/**
 * Un paso de una rutina (ver `HabitRoutine`). Nombre distinto de `Routine`
 * a propósito — ese tipo ya existe en `@/lib/types/index.ts` para las
 * rutinas de ejercicios de Gym, dominio completamente separado.
 */
export interface RoutineStep {
  id: string;
  hora: string; // "06:35"
  label: string;
  /** Si está vinculado a un hábito, completar este paso completa ESE
   * hábito (misma `completedDates`) — nunca se duplica el dato acá. */
  habitId?: string;
  durationMin?: number;
  /** Solo se usa cuando `habitId` es `undefined` — un paso sin hábito
   * vinculado (p.ej. "despertar") lleva su propio registro de qué días se
   * cumplió, con la misma forma que `Habit.completedDates`. */
  completedDates: string[];
}

export interface HabitRoutine {
  id: string;
  nombre: string;
  items: RoutineStep[];
  createdAt: number;
  /** Días en que TODOS los pasos quedaron completos — alimenta su propia
   * racha vía el Progress Engine (evento `routine.completed`). */
  completedDates: string[];
  streak: number;
  milestonesUnlocked: number[];
}

export interface TimeBlock {
  id: string;
  taskId?: string;
  startHour: number;
  endHour: number;
  color: string;
  icon: string;
  title: string;
}

export type NotionBlockType = "text" | "checklist" | "heading";

export interface NotionChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NotionBlock {
  id: string;
  type: NotionBlockType;
  content: string; // for text/heading; unused (kept "") for checklist
  items?: NotionChecklistItem[]; // used when type === "checklist"
}

export interface NotionPage {
  id: string;
  title: string;
  icon: string;
  blocks: NotionBlock[];
}

export type KanbanColumnId = "por-hacer" | "en-progreso" | "hecho";

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  taskIds: string[];
}
