/**
 * Capa de sincronización Supabase para el store de Hábitos (Tareas,
 * Hábitos, Timeline, Workspace tipo Notion, Kanban). Ver
 * `supabase/migrations/0002_module_data_sync.sql` (sección HÁBITOS) para
 * el esquema y `src/lib/store/habitsStore.ts` para el store que consume
 * esto. Mismo patrón exacto que `src/lib/sync/gym-sync.ts` — leer ese
 * archivo primero si algo acá no queda claro.
 *
 * Diseño (idéntico a gym-sync.ts):
 *  - Todo es "fire and forget": estas funciones nunca se esperan (`await`)
 *    antes de aplicar el cambio local. Si Supabase falla, se hace
 *    `console.warn` y no se lanza ninguna excepción — localStorage sigue
 *    siendo la fuente de verdad de este dispositivo.
 *  - Usa el cliente de navegador (anon key + RLS), nunca la service role.
 *  - Nota sobre ids: `uid()` en habitsStore.ts generaba un string base36
 *    corto, no un UUID válido, pero las columnas `id` de `tasks`, `habits`,
 *    `time_blocks` y `notion_pages` son `uuid`. Se cambió `uid()` para
 *    generar `crypto.randomUUID()` (ver habitsStore.ts) — mismo fix que
 *    gymStore.ts. Los ids semilla de DEFAULT_HABITS/DEFAULT_KANBAN/
 *    DEFAULT_PAGES (p.ej. "h-agua", "por-hacer") NO pasan por `uid()` y no
 *    son UUIDs — eso está bien para `kanban_columns` (su primary key es
 *    `column_id`, un texto fijo, no un uuid), pero significa que los 3
 *    hábitos y la página "Bienvenida" por defecto de un usuario nuevo NUNCA
 *    se insertan en Supabase con ese id semilla salvo que el usuario los
 *    edite (lo cual los reescribe con los mismos ids no-uuid) — se dejan
 *    tal cual (solo locales) en vez de forzar una migración de ids que no
 *    pidió este cambio; no son datos que un usuario pueda perder, son el
 *    seed por defecto que cualquier cuenta nueva vuelve a tener.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  Habit,
  KanbanColumn,
  KanbanColumnId,
  NotionBlock,
  NotionPage,
  Task,
  TimeBlock,
} from "@/lib/types/habits";

// ============================================================================
// Helpers genéricos (idénticos a gym-sync.ts)
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[habits-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[habits-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[habits-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[habits-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

// ============================================================================
// tasks
// ============================================================================

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: Task["priority"];
  due_date: string | null;
  time_slot: number | null;
  is_completed: boolean;
  subtasks: Task["subtasks"];
  tags: string[];
  color: string | null;
  icon: string | null;
}

function taskToRow(t: Task, userId: string): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    description: t.description ?? null,
    priority: t.priority,
    due_date: t.dueDate ?? null,
    time_slot: t.timeSlot ?? null,
    is_completed: t.isCompleted,
    subtasks: t.subtasks,
    tags: t.tags,
    color: t.color ?? null,
    icon: t.icon ?? null,
  };
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    timeSlot: row.time_slot ?? undefined,
    isCompleted: row.is_completed,
    subtasks: row.subtasks ?? [],
    tags: row.tags ?? [],
    color: row.color ?? "var(--habitos)",
    icon: row.icon ?? "CheckCircle2",
  };
}

async function fetchTasks(userId: string): Promise<Task[]> {
  const rows = await safeFetchList<TaskRow>("tasks", () =>
    createClient().from("tasks").select("*").eq("user_id", userId),
  );
  return rows.map(rowToTask);
}

export function syncInsertTask(task: Task, userId: string): void {
  void safeWrite("insert tasks", () => createClient().from("tasks").insert(taskToRow(task, userId)));
}

export function syncUpdateTask(id: string, patch: Partial<Task>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.timeSlot !== undefined) row.time_slot = patch.timeSlot;
  if (patch.isCompleted !== undefined) row.is_completed = patch.isCompleted;
  if (patch.subtasks !== undefined) row.subtasks = patch.subtasks;
  if (patch.tags !== undefined) row.tags = patch.tags;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update tasks", () =>
    createClient().from("tasks").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteTask(id: string, userId: string): void {
  void safeWrite("delete tasks", () =>
    createClient().from("tasks").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// habits
// ============================================================================

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  frequency: Habit["frequency"];
  streak: number;
  completed_dates: string[];
}

function habitToRow(h: Habit, userId: string): HabitRow {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    icon: h.icon ?? null,
    color: h.color ?? null,
    frequency: h.frequency,
    streak: h.streak,
    completed_dates: h.completedDates,
  };
}

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? "Star",
    color: row.color ?? "var(--habitos)",
    frequency: row.frequency,
    streak: row.streak,
    completedDates: row.completed_dates ?? [],
  };
}

async function fetchHabits(userId: string): Promise<Habit[]> {
  const rows = await safeFetchList<HabitRow>("habits", () =>
    createClient().from("habits").select("*").eq("user_id", userId),
  );
  return rows.map(rowToHabit);
}

export function syncInsertHabit(habit: Habit, userId: string): void {
  void safeWrite("insert habits", () => createClient().from("habits").insert(habitToRow(habit, userId)));
}

export function syncUpdateHabit(id: string, patch: Partial<Habit>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.frequency !== undefined) row.frequency = patch.frequency;
  if (patch.streak !== undefined) row.streak = patch.streak;
  if (patch.completedDates !== undefined) row.completed_dates = patch.completedDates;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update habits", () =>
    createClient().from("habits").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteHabit(id: string, userId: string): void {
  void safeWrite("delete habits", () =>
    createClient().from("habits").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// time_blocks
// ============================================================================

export interface TimeBlockRow {
  id: string;
  user_id: string;
  task_id: string | null;
  start_hour: number;
  end_hour: number;
  color: string | null;
  icon: string | null;
  title: string;
}

function timeBlockToRow(b: TimeBlock, userId: string): TimeBlockRow {
  return {
    id: b.id,
    user_id: userId,
    task_id: b.taskId ?? null,
    start_hour: b.startHour,
    end_hour: b.endHour,
    color: b.color ?? null,
    icon: b.icon ?? null,
    title: b.title,
  };
}

function rowToTimeBlock(row: TimeBlockRow): TimeBlock {
  return {
    id: row.id,
    taskId: row.task_id ?? undefined,
    startHour: row.start_hour,
    endHour: row.end_hour,
    color: row.color ?? "var(--habitos)",
    icon: row.icon ?? "Clock",
    title: row.title,
  };
}

async function fetchTimeBlocks(userId: string): Promise<TimeBlock[]> {
  const rows = await safeFetchList<TimeBlockRow>("time_blocks", () =>
    createClient().from("time_blocks").select("*").eq("user_id", userId),
  );
  return rows.map(rowToTimeBlock);
}

export function syncInsertTimeBlock(block: TimeBlock, userId: string): void {
  void safeWrite("insert time_blocks", () =>
    createClient().from("time_blocks").insert(timeBlockToRow(block, userId)),
  );
}

export function syncUpdateTimeBlock(id: string, patch: Partial<TimeBlock>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.taskId !== undefined) row.task_id = patch.taskId;
  if (patch.startHour !== undefined) row.start_hour = patch.startHour;
  if (patch.endHour !== undefined) row.end_hour = patch.endHour;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.title !== undefined) row.title = patch.title;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update time_blocks", () =>
    createClient().from("time_blocks").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteTimeBlock(id: string, userId: string): void {
  void safeWrite("delete time_blocks", () =>
    createClient().from("time_blocks").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// notion_pages
// ============================================================================

export interface NotionPageRow {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  blocks: NotionBlock[];
}

function notionPageToRow(p: NotionPage, userId: string): NotionPageRow {
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    icon: p.icon ?? null,
    blocks: p.blocks,
  };
}

function rowToNotionPage(row: NotionPageRow): NotionPage {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon ?? "FileText",
    blocks: row.blocks ?? [],
  };
}

async function fetchNotionPages(userId: string): Promise<NotionPage[]> {
  const rows = await safeFetchList<NotionPageRow>("notion_pages", () =>
    createClient().from("notion_pages").select("*").eq("user_id", userId),
  );
  return rows.map(rowToNotionPage);
}

export function syncInsertNotionPage(page: NotionPage, userId: string): void {
  void safeWrite("insert notion_pages", () =>
    createClient().from("notion_pages").insert(notionPageToRow(page, userId)),
  );
}

export function syncUpdateNotionPage(id: string, patch: Partial<NotionPage>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.blocks !== undefined) {
    row.blocks = patch.blocks;
    row.updated_at = new Date().toISOString();
  }
  if (Object.keys(row).length === 0) return;
  void safeWrite("update notion_pages", () =>
    createClient().from("notion_pages").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteNotionPage(id: string, userId: string): void {
  void safeWrite("delete notion_pages", () =>
    createClient().from("notion_pages").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// kanban_columns (singleton de 3 filas fijas por usuario — primary key
// (user_id, column_id), NO tiene columna `id` propia)
// ============================================================================

export interface KanbanColumnRow {
  user_id: string;
  column_id: KanbanColumnId;
  title: string;
  task_ids: string[];
}

function kanbanColumnToRow(c: KanbanColumn, userId: string): KanbanColumnRow {
  return {
    user_id: userId,
    column_id: c.id,
    title: c.title,
    task_ids: c.taskIds,
  };
}

function rowToKanbanColumn(row: KanbanColumnRow): KanbanColumn {
  return {
    id: row.column_id,
    title: row.title,
    taskIds: row.task_ids ?? [],
  };
}

async function fetchKanbanColumns(userId: string): Promise<KanbanColumn[]> {
  const rows = await safeFetchList<KanbanColumnRow>("kanban_columns", () =>
    createClient().from("kanban_columns").select("*").eq("user_id", userId),
  );
  return rows.map(rowToKanbanColumn);
}

/** Upsert de UNA columna kanban por `(user_id, column_id)` — nunca un
 * `mergeById` genérico porque esta tabla no tiene columna `id`, tiene una
 * primary key compuesta con un `column_id` de 3 valores fijos. */
export function syncUpsertKanbanColumn(column: KanbanColumn, userId: string): void {
  void safeWrite("upsert kanban_columns", () =>
    createClient()
      .from("kanban_columns")
      .upsert(kanbanColumnToRow(column, userId), { onConflict: "user_id,column_id" }),
  );
}

export function syncUpsertKanbanColumns(columns: KanbanColumn[], userId: string): void {
  columns.forEach((c) => syncUpsertKanbanColumn(c, userId));
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface HabitsHydratedState {
  tasks: Task[];
  habits: Habit[];
  timeBlocks: TimeBlock[];
  notionPages: NotionPage[];
  kanbanColumns: KanbanColumn[];
}

/**
 * Trae las 5 tablas de Hábitos para `userId` y devuelve un objeto listo
 * para mezclar en el estado del store. No escribe nada — el store decide
 * cómo aplicar el patch (ver `hydrateHabitsStore` en habitsStore.ts).
 */
export async function hydrateHabitsStoreFromSupabase(userId: string): Promise<HabitsHydratedState> {
  const [tasks, habits, timeBlocks, notionPages, kanbanColumns] = await Promise.all([
    fetchTasks(userId),
    fetchHabits(userId),
    fetchTimeBlocks(userId),
    fetchNotionPages(userId),
    fetchKanbanColumns(userId),
  ]);

  return { tasks, habits, timeBlocks, notionPages, kanbanColumns };
}
