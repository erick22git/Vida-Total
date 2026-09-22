import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { format } from "date-fns";
import { processCompletionEvent, type ProgressResult } from "@/lib/progress";
import type {
  Habit,
  KanbanColumn,
  KanbanColumnId,
  NotionBlock,
  NotionPage,
  Subtask,
  Task,
  TimeBlock,
} from "@/lib/types/habits";
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertTask,
  syncUpdateTask,
  syncDeleteTask,
  syncInsertHabit,
  syncUpdateHabit,
  syncDeleteHabit,
  syncInsertTimeBlock,
  syncUpdateTimeBlock,
  syncDeleteTimeBlock,
  syncInsertNotionPage,
  syncUpdateNotionPage,
  syncDeleteNotionPage,
  syncUpsertKanbanColumn,
  syncUpsertKanbanColumns,
  hydrateHabitsStoreFromSupabase,
  type HabitsHydratedState,
} from "@/lib/sync/habits-sync";

/**
 * Id único usado tanto como key local como primary key de la fila remota
 * en Supabase (columnas `uuid` — ver
 * supabase/migrations/0002_module_data_sync.sql). Antes generaba un string
 * base36 corto que NO era un UUID válido; se cambió a `crypto.randomUUID()`
 * — mismo fix que gymStore.ts (ver `src/lib/sync/habits-sync.ts`). Los ids
 * semilla en DEFAULT_HABITS/DEFAULT_KANBAN/DEFAULT_PAGES de abajo (p.ej.
 * "h-agua") no pasan por esta función y quedan como están.
 */
function uid() {
  return crypto.randomUUID();
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

const DEFAULT_HABITS: Habit[] = [
  {
    id: "h-agua",
    name: "Beber agua",
    icon: "Droplets",
    color: "var(--habitos)",
    frequency: "diario",
    streak: 0,
    completedDates: [],
    categoryId: "agua",
    milestonesUnlocked: [],
  },
  {
    id: "h-lectura",
    name: "Leer 10 min",
    icon: "BookOpen",
    color: "var(--habitos)",
    frequency: "diario",
    streak: 0,
    completedDates: [],
    categoryId: "lectura",
    milestonesUnlocked: [],
  },
  {
    id: "h-meditar",
    name: "Meditar",
    icon: "Sparkles",
    color: "var(--habitos)",
    frequency: "diario",
    streak: 0,
    completedDates: [],
    categoryId: "meditacion",
    milestonesUnlocked: [],
  },
];

const DEFAULT_KANBAN: KanbanColumn[] = [
  { id: "por-hacer", title: "Por hacer", taskIds: [] },
  { id: "en-progreso", title: "En progreso", taskIds: [] },
  { id: "hecho", title: "Hecho", taskIds: [] },
];

const DEFAULT_PAGES: NotionPage[] = [
  {
    id: "p-bienvenida",
    title: "Bienvenida",
    icon: "Sparkles",
    blocks: [
      { id: uid(), type: "heading", content: "Bienvenido a tu workspace" },
      {
        id: uid(),
        type: "text",
        content: "Usa páginas para tomar notas, planear proyectos o llevar apuntes de estudio.",
      },
      {
        id: uid(),
        type: "checklist",
        content: "",
        items: [
          { id: uid(), text: "Crea tu primera página", done: false },
          { id: uid(), text: "Prueba el tablero Kanban", done: false },
        ],
      },
    ],
  },
];

interface HabitsState {
  // ---------- Tasks ----------
  tasks: Task[];
  addTask: (task: Partial<Task> & { title: string }) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleTaskCompleted: (id: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;

  // ---------- Habits ----------
  habits: Habit[];
  /** Devuelve el resultado del Progress Engine (racha + milestone recién
   * cruzado, si lo hay) cuando la acción es MARCAR como hecho — `null`
   * cuando la acción fue desmarcar (ahí no hay nada que animar). La UI usa
   * este valor para decidir qué emitir en el Animation Engine; el store
   * nunca decide animaciones. */
  toggleHabitToday: (id: string) => ProgressResult | null;
  addHabit: (habit: Partial<Habit> & { name: string }) => void;
  removeHabit: (id: string) => void;

  // ---------- Timeline / TimeBlocks ----------
  timeBlocks: TimeBlock[];
  addTimeBlock: (block: Omit<TimeBlock, "id">) => void;
  updateTimeBlock: (id: string, patch: Partial<TimeBlock>) => void;
  removeTimeBlock: (id: string) => void;

  // ---------- Workspace (Notion-like) ----------
  pages: NotionPage[];
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  addPage: (page: Partial<NotionPage> & { title: string }) => string;
  updatePage: (id: string, patch: Partial<NotionPage>) => void;
  removePage: (id: string) => void;
  addBlock: (pageId: string, block: Omit<NotionBlock, "id">) => void;
  updateBlock: (pageId: string, blockId: string, patch: Partial<NotionBlock>) => void;
  removeBlock: (pageId: string, blockId: string) => void;

  // ---------- Kanban ----------
  kanbanColumns: KanbanColumn[];
  moveTaskToColumn: (taskId: string, columnId: KanbanColumnId) => void;
  ensureTaskInKanban: (taskId: string) => void;

  // ---------- Remote sync (Supabase) — interno, no UI pública ----------
  /** Reemplaza slices del estado con lo traído de Supabase al loguearse.
   * Ver `hydrateHabitsStoreFromSupabase` (src/lib/sync/habits-sync.ts) y su
   * único llamador en `UserScopeScript`. No se persiste ni se expone como
   * API pública del store más allá de este uso interno. */
  _hydrateFromRemote: (patch: Partial<HabitsState>) => void;
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      // Tasks
      tasks: [],
      addTask: (task) => {
        const created: Task = {
          id: uid(),
          title: task.title,
          description: task.description,
          priority: task.priority ?? "media",
          dueDate: task.dueDate,
          timeSlot: task.timeSlot,
          isCompleted: false,
          subtasks: task.subtasks ?? [],
          tags: task.tags ?? [],
          color: task.color ?? "var(--habitos)",
          icon: task.icon ?? "CheckCircle2",
        };
        set((state) => ({ tasks: [...state.tasks, created] }));
        get().ensureTaskInKanban(created.id);
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertTask(created, uidUser);
        return created.id;
      },
      updateTask: (id, patch) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateTask(id, patch, uidUser);
      },
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          kanbanColumns: state.kanbanColumns.map((c) => ({
            ...c,
            taskIds: c.taskIds.filter((tid) => tid !== id),
          })),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncDeleteTask(id, uidUser);
          syncUpsertKanbanColumns(get().kanbanColumns, uidUser);
        }
      },
      toggleTaskCompleted: (id) => {
        let nextCompleted = false;
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            nextCompleted = !t.isCompleted;
            return { ...t, isCompleted: nextCompleted };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateTask(id, { isCompleted: nextCompleted }, uidUser);
      },
      addSubtask: (taskId, title) => {
        let nextSubtasks: Subtask[] | null = null;
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            nextSubtasks = [...t.subtasks, { id: uid(), title, done: false } as Subtask];
            return { ...t, subtasks: nextSubtasks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextSubtasks) syncUpdateTask(taskId, { subtasks: nextSubtasks }, uidUser);
      },
      toggleSubtask: (taskId, subtaskId) => {
        let nextSubtasks: Subtask[] | null = null;
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            nextSubtasks = t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, done: !s.done } : s,
            );
            return { ...t, subtasks: nextSubtasks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextSubtasks) syncUpdateTask(taskId, { subtasks: nextSubtasks }, uidUser);
      },
      removeSubtask: (taskId, subtaskId) => {
        let nextSubtasks: Subtask[] | null = null;
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            nextSubtasks = t.subtasks.filter((s) => s.id !== subtaskId);
            return { ...t, subtasks: nextSubtasks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextSubtasks) syncUpdateTask(taskId, { subtasks: nextSubtasks }, uidUser);
      },

      // Habits
      habits: DEFAULT_HABITS,
      toggleHabitToday: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return null;

        const today = todayISO();
        const already = habit.completedDates.includes(today);
        const completedDates = already
          ? habit.completedDates.filter((d) => d !== today)
          : [...habit.completedDates, today];
        // Progress Engine — única fuente de verdad para racha/milestone, ya
        // no se recalcula a mano acá (ver src/lib/progress/streak.ts para
        // el porqué del bug anterior: el streak quedaba pegado en vez de
        // reflejar que la racha se había roto).
        const evaluated = processCompletionEvent(
          { type: "habit.completed" },
          { completedDates, frequency: habit.frequency },
          habit.milestonesUnlocked,
        );
        const milestonesUnlocked = evaluated.milestoneReached
          ? [...habit.milestonesUnlocked, evaluated.milestoneReached]
          : habit.milestonesUnlocked;

        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, completedDates, streak: evaluated.streak, milestonesUnlocked } : h,
          ),
        }));

        const uidUser = getCurrentUserId();
        // milestonesUnlocked no viaja a Supabase todavía (sin columna, ver
        // rowToHabit) — se sincroniza solo lo que sí tiene dónde vivir.
        if (uidUser) syncUpdateHabit(id, { completedDates, streak: evaluated.streak }, uidUser);

        return already ? null : evaluated;
      },
      addHabit: (habit) => {
        const created: Habit = {
          id: uid(),
          name: habit.name,
          icon: habit.icon ?? "Star",
          color: habit.color ?? "var(--habitos)",
          frequency: habit.frequency ?? "diario",
          streak: 0,
          completedDates: [],
          categoryId: habit.categoryId,
          milestonesUnlocked: [],
        };
        set((state) => ({ habits: [...state.habits, created] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertHabit(created, uidUser);
      },
      removeHabit: (id) => {
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteHabit(id, uidUser);
      },

      // Timeline
      timeBlocks: [],
      addTimeBlock: (block) => {
        const created: TimeBlock = { ...block, id: uid() };
        set((state) => ({ timeBlocks: [...state.timeBlocks, created] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertTimeBlock(created, uidUser);
      },
      updateTimeBlock: (id, patch) => {
        set((state) => ({
          timeBlocks: state.timeBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateTimeBlock(id, patch, uidUser);
      },
      removeTimeBlock: (id) => {
        set((state) => ({ timeBlocks: state.timeBlocks.filter((b) => b.id !== id) }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteTimeBlock(id, uidUser);
      },

      // Workspace
      pages: DEFAULT_PAGES,
      activePageId: DEFAULT_PAGES[0]?.id ?? null,
      setActivePageId: (id) => set({ activePageId: id }),
      addPage: (page) => {
        const created: NotionPage = {
          id: uid(),
          title: page.title,
          icon: page.icon ?? "FileText",
          blocks: page.blocks ?? [],
        };
        set((state) => ({
          pages: [...state.pages, created],
          activePageId: created.id,
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertNotionPage(created, uidUser);
        return created.id;
      },
      updatePage: (id, patch) => {
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateNotionPage(id, patch, uidUser);
      },
      removePage: (id) => {
        set((state) => {
          const pages = state.pages.filter((p) => p.id !== id);
          return {
            pages,
            activePageId:
              state.activePageId === id ? pages[0]?.id ?? null : state.activePageId,
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteNotionPage(id, uidUser);
      },
      addBlock: (pageId, block) => {
        let nextBlocks: NotionBlock[] | null = null;
        set((state) => ({
          pages: state.pages.map((p) => {
            if (p.id !== pageId) return p;
            nextBlocks = [...p.blocks, { ...block, id: uid() }];
            return { ...p, blocks: nextBlocks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextBlocks) syncUpdateNotionPage(pageId, { blocks: nextBlocks }, uidUser);
      },
      updateBlock: (pageId, blockId, patch) => {
        let nextBlocks: NotionBlock[] | null = null;
        set((state) => ({
          pages: state.pages.map((p) => {
            if (p.id !== pageId) return p;
            nextBlocks = p.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
            return { ...p, blocks: nextBlocks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextBlocks) syncUpdateNotionPage(pageId, { blocks: nextBlocks }, uidUser);
      },
      removeBlock: (pageId, blockId) => {
        let nextBlocks: NotionBlock[] | null = null;
        set((state) => ({
          pages: state.pages.map((p) => {
            if (p.id !== pageId) return p;
            nextBlocks = p.blocks.filter((b) => b.id !== blockId);
            return { ...p, blocks: nextBlocks };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextBlocks) syncUpdateNotionPage(pageId, { blocks: nextBlocks }, uidUser);
      },

      // Kanban
      kanbanColumns: DEFAULT_KANBAN,
      moveTaskToColumn: (taskId, columnId) => {
        set((state) => ({
          kanbanColumns: state.kanbanColumns.map((c) => ({
            ...c,
            taskIds:
              c.id === columnId
                ? [...c.taskIds.filter((id) => id !== taskId), taskId]
                : c.taskIds.filter((id) => id !== taskId),
          })),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpsertKanbanColumns(get().kanbanColumns, uidUser);
      },
      ensureTaskInKanban: (taskId) => {
        const alreadyPlaced = get().kanbanColumns.some((c) => c.taskIds.includes(taskId));
        if (alreadyPlaced) return;
        let target: KanbanColumn | null = null;
        set((state) => ({
          kanbanColumns: state.kanbanColumns.map((c) => {
            if (c.id !== "por-hacer") return c;
            target = { ...c, taskIds: [...c.taskIds, taskId] };
            return target;
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && target) syncUpsertKanbanColumn(target, uidUser);
      },

      // Remote sync (Supabase)
      _hydrateFromRemote: (patch) => set(patch),
    }),
    {
      name: "vida-total-habits-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-habits-store")),
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — merge + backfill (ver gymStore.ts, misma lógica)
// ============================================================================

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce — nunca
 * borra datos locales. Ver la explicación completa en `mergeById` de
 * `gymStore.ts` (misma función, duplicada acá para no crear una
 * dependencia cruzada entre los dos stores por una función de 4 líneas).
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Mezcla las 3 columnas fijas de kanban_columns por `column_id` (no por
 * `id` genérico — esta tabla no tiene una columna `id`, ver
 * `syncUpsertKanbanColumn` en habits-sync.ts). Para cada columna: si hay
 * fila remota, se usa su `title` y se combinan los `taskIds` (remoto +
 * cualquier id local que el remoto no traiga todavía); si no hay fila
 * remota para esa columna, se conserva la columna local tal cual (se
 * subirá en el backfill).
 */
function mergeKanbanColumns(remote: KanbanColumn[], local: KanbanColumn[]): KanbanColumn[] {
  const remoteByColumnId = new Map(remote.map((c) => [c.id, c] as const));
  return local.map((localCol) => {
    const remoteCol = remoteByColumnId.get(localCol.id);
    if (!remoteCol) return localCol;
    const remoteTaskIds = new Set(remoteCol.taskIds);
    const localOnlyTaskIds = localCol.taskIds.filter((id) => !remoteTaskIds.has(id));
    return {
      id: remoteCol.id,
      title: remoteCol.title,
      taskIds: [...remoteCol.taskIds, ...localOnlyTaskIds],
    };
  });
}

/**
 * Trae las 5 tablas de Hábitos de Supabase para `userId`, las MEZCLA
 * (nunca reemplaza) con lo que ya hay en el store, y sube (backfill)
 * cualquier dato que solo existiera localmente. Mismo diseño que
 * `hydrateGymStore` en gymStore.ts — leer ese archivo para el razonamiento
 * completo. Pensado para llamarse UNA vez por sesión de login, apenas se
 * conoce el userId (ver `UserScopeScript`).
 */
export async function hydrateHabitsStore(userId: string): Promise<void> {
  const remote: HabitsHydratedState = await hydrateHabitsStoreFromSupabase(userId);
  const local = useHabitsStore.getState();

  const tasks = mergeById(remote.tasks, local.tasks);
  const rawHabits = mergeById(remote.habits, local.habits);
  // `categoryId`/`milestonesUnlocked` son local-only (la tabla `habits` de
  // Supabase no tiene esas columnas todavía) — `mergeById` toma la fila
  // remota tal cual para cualquier id que ya exista ahí, así que sin esto
  // se perderían apenas alguien inicia sesión en otro dispositivo. Se
  // preservan del local si el habit ya existía localmente.
  const localHabitById = new Map(local.habits.map((h) => [h.id, h] as const));
  const habits = {
    ...rawHabits,
    merged: rawHabits.merged.map((h) => {
      const prevLocal = localHabitById.get(h.id);
      return prevLocal ? { ...h, categoryId: prevLocal.categoryId, milestonesUnlocked: prevLocal.milestonesUnlocked } : h;
    }),
  };
  const timeBlocks = mergeById(remote.timeBlocks, local.timeBlocks);
  const notionPages = mergeById(remote.notionPages, local.pages);
  const kanbanColumns = mergeKanbanColumns(remote.kanbanColumns, local.kanbanColumns);

  // Cualquier tarea que haya quedado sin columna (p.ej. se creó en otro
  // dispositivo antes de que existiera esta capa de sync, o llegó por el
  // merge de arriba) se coloca en "por-hacer" — mismo criterio que
  // `ensureTaskInKanban` usa para tareas nuevas.
  const placedTaskIds = new Set(kanbanColumns.flatMap((c) => c.taskIds));
  const orphanTaskIds = tasks.merged.map((t) => t.id).filter((id) => !placedTaskIds.has(id));
  const kanbanColumnsWithOrphans =
    orphanTaskIds.length === 0
      ? kanbanColumns
      : kanbanColumns.map((c) =>
          c.id === "por-hacer" ? { ...c, taskIds: [...c.taskIds, ...orphanTaskIds] } : c,
        );

  const patch: Partial<HabitsState> = {
    tasks: tasks.merged,
    habits: habits.merged,
    timeBlocks: timeBlocks.merged,
    pages: notionPages.merged,
    kanbanColumns: kanbanColumnsWithOrphans,
  };
  useHabitsStore.getState()._hydrateFromRemote(patch);

  // Backfill: sube a Supabase lo que era solo local.
  for (const task of tasks.localOnly) syncInsertTask(task, userId);
  for (const habit of habits.localOnly) syncInsertHabit(habit, userId);
  for (const block of timeBlocks.localOnly) syncInsertTimeBlock(block, userId);
  for (const page of notionPages.localOnly) syncInsertNotionPage(page, userId);
  // kanban_columns es un singleton de 3 filas fijas por usuario — se
  // vuelve a upsertear siempre (barato, 3 filas) con el resultado ya
  // mezclado, así el backfill de columnas que todavía no existían en
  // remoto (o cuyos taskIds tenían ids solo-locales) queda cubierto sin
  // necesidad de trackear un "localOnly" aparte para esta tabla.
  syncUpsertKanbanColumns(kanbanColumnsWithOrphans, userId);
}

// ---------- Selectors / helpers ----------

export function useTodayTasks() {
  const tasks = useHabitsStore((s) => s.tasks);
  const today = todayISO();
  return tasks.filter((t) => t.dueDate === today);
}

export function useHabitsCompletedToday() {
  const habits = useHabitsStore((s) => s.habits);
  const today = todayISO();
  const completed = habits.filter((h) => h.completedDates.includes(today)).length;
  return { completed, total: habits.length };
}
