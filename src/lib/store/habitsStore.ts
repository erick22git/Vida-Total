import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { format } from "date-fns";
import { processCompletionEvent, computeStreak, type ProgressResult } from "@/lib/progress";
import type {
  Habit,
  HabitRoutine,
  KanbanColumn,
  KanbanColumnId,
  NotionBlock,
  NotionPage,
  RoutineStep,
  Subtask,
  Task,
  TimeBlock,
} from "@/lib/types/habits";
import { isStepDoneOn } from "@/lib/routine-utils";
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
  syncUpsertHabitValue,
  syncDeleteHabitValue,
  syncUpsertRoutine,
  syncDeleteRoutine,
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
  /** Suma progreso HOY en un hábito de cantidad/tiempo (p.ej. +1 vaso). Si
   * con esto se alcanza la meta, el hábito queda completado hoy (pasa por el
   * Progress Engine igual que `toggleHabitToday`). */
  addHabitProgress: (id: string, amount: number) => HabitProgressOutcome | null;
  /** Devuelve el id del hábito creado. */
  addHabit: (habit: Partial<Habit> & { name: string }) => string;
  removeHabit: (id: string) => void;
  /** Edita campos del hábito (nombre, días, hora, meta, misión…). */
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  /** Marca/desmarca una fecha concreta (edición de historial). No dispara
   * hitos: es una corrección, no un logro. */
  toggleHabitOnDate: (id: string, dateISO: string) => void;

  // ---------- Routines (Hábitos + Rutinas, Fase 5) ----------
  routines: HabitRoutine[];
  addRoutine: (nombre: string, items: Array<Omit<RoutineStep, "id" | "completedDates">>) => HabitRoutine;
  updateRoutineItems: (id: string, items: Array<Omit<RoutineStep, "completedDates"> & { completedDates?: string[] }>) => void;
  deleteRoutine: (id: string) => void;
  /** Marca/desmarca un paso para HOY. Si el paso está vinculado a un
   * hábito, delega en `toggleHabitToday` (misma fuente de verdad, sin
   * duplicar dato) y además evalúa si con esto la rutina completa quedó
   * hecha o dejó de estarlo. Devuelve el resultado del paso y, si
   * corresponde, el de la rutina completa — la UI decide con esto qué
   * animación disparar (nunca lo decide el store). */
  toggleRoutineStep: (
    routineId: string,
    stepId: string,
  ) => { stepResult: ProgressResult | null; routineResult: ProgressResult | null };

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

export interface HabitProgressOutcome {
  value: number;
  goal: number;
  /** true si con este paso se alcanzó la meta y el hábito quedó hecho hoy. */
  completedNow: boolean;
  /** Resultado del Progress Engine — solo cuando `completedNow`. */
  result: ProgressResult | null;
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

        // Hábitos de cantidad/tiempo: marcar/desmarcar el día completo fija
        // (o borra) su valor del día, para que el historial no se contradiga.
        const quantified = habit.type === "cantidad" || habit.type === "tiempo";
        let values = habit.values;
        if (quantified) {
          values = { ...(habit.values ?? {}) };
          if (already) delete values[today];
          else values[today] = habit.goal ?? 1;
        }

        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, completedDates, streak: evaluated.streak, milestonesUnlocked, values } : h,
          ),
        }));

        const uidUser = getCurrentUserId();
        if (uidUser && quantified) {
          if (already) syncDeleteHabitValue(id, today, uidUser);
          else syncUpsertHabitValue(id, today, values?.[today] ?? 1, true, uidUser);
        }
        // milestonesUnlocked no viaja a Supabase todavía (sin columna, ver
        // rowToHabit) — se sincroniza solo lo que sí tiene dónde vivir.
        if (uidUser) syncUpdateHabit(id, { completedDates, streak: evaluated.streak, milestonesUnlocked }, uidUser);

        return already ? null : evaluated;
      },
      addHabitProgress: (id, amount) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return null;
        const goal = habit.goal ?? 1;
        const today = todayISO();
        const value = (habit.values?.[today] ?? 0) + amount;
        const wasDone = habit.completedDates.includes(today);
        const completedNow = value >= goal && !wasDone;

        let completedDates = habit.completedDates;
        let streak = habit.streak;
        let milestonesUnlocked = habit.milestonesUnlocked;
        let result: ProgressResult | null = null;
        if (completedNow) {
          completedDates = [...habit.completedDates, today];
          result = processCompletionEvent(
            { type: "habit.completed" },
            { completedDates, frequency: habit.frequency },
            habit.milestonesUnlocked,
          );
          streak = result.streak;
          if (result.milestoneReached) milestonesUnlocked = [...habit.milestonesUnlocked, result.milestoneReached];
        }
        const values = { ...(habit.values ?? {}), [today]: value };

        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, values, completedDates, streak, milestonesUnlocked } : h)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncUpsertHabitValue(id, today, value, value >= goal, uidUser);
          if (completedNow) syncUpdateHabit(id, { completedDates, streak, milestonesUnlocked }, uidUser);
        }
        return { value, goal, completedNow, result };
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
          sourceId: habit.sourceId,
          type: habit.type,
          goal: habit.goal,
          unit: habit.unit,
          scheduledDays: habit.scheduledDays,
          reminder: habit.reminder,
          milestonesUnlocked: [],
        };
        set((state) => ({ habits: [...state.habits, created] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertHabit(created, uidUser);
        return created.id;
      },
      updateHabit: (id, patch) => {
        set((state) => ({ habits: state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
        const uidUser = getCurrentUserId();
        // Solo name/icon/color/frequency viajan a Supabase hoy; el resto es
        // local hasta la migración (ver syncUpdateHabit).
        if (uidUser) syncUpdateHabit(id, patch, uidUser);
      },
      toggleHabitOnDate: (id, dateISO) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return;
        const completedDates = habit.completedDates.includes(dateISO)
          ? habit.completedDates.filter((d) => d !== dateISO)
          : [...habit.completedDates, dateISO];
        const streak = computeStreak({ completedDates, frequency: habit.frequency });
        const marking = completedDates.includes(dateISO);
        const quantified = habit.type === "cantidad" || habit.type === "tiempo";
        let values = habit.values;
        if (quantified) {
          values = { ...(habit.values ?? {}) };
          if (marking) values[dateISO] = habit.goal ?? 1;
          else delete values[dateISO];
        }
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, completedDates, streak, values } : h)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncUpdateHabit(id, { completedDates, streak }, uidUser);
          if (quantified) {
            if (marking) syncUpsertHabitValue(id, dateISO, values?.[dateISO] ?? 1, true, uidUser);
            else syncDeleteHabitValue(id, dateISO, uidUser);
          }
        }
      },
      removeHabit: (id) => {
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteHabit(id, uidUser);
      },

      // Routines (local-only por ahora — sin tabla en Supabase todavía,
      // igual que categorías/milestones de hábitos, ver habits.ts).
      routines: [],
      addRoutine: (nombre, items) => {
        const created: HabitRoutine = {
          id: uid(),
          nombre,
          items: items.map((it) => ({ ...it, id: uid(), completedDates: [] })),
          createdAt: Date.now(),
          completedDates: [],
          streak: 0,
          milestonesUnlocked: [],
        };
        set((state) => ({ routines: [...state.routines, created] }));
        return created;
      },
      updateRoutineItems: (id, items) => {
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id ? { ...r, items: items.map((it) => ({ ...it, completedDates: it.completedDates ?? [] })) } : r,
          ),
        }));
      },
      deleteRoutine: (id) => {
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) }));
      },
      toggleRoutineStep: (routineId, stepId) => {
        const state = get();
        const routine = state.routines.find((r) => r.id === routineId);
        const step = routine?.items.find((s) => s.id === stepId);
        if (!routine || !step) return { stepResult: null, routineResult: null };

        const today = todayISO();
        let stepResult: ProgressResult | null = null;

        if (step.habitId) {
          // Vinculado a un hábito: se delega TODO en toggleHabitToday, así
          // el dato vive en un solo lugar (Habit.completedDates) y la
          // racha/milestone del hábito se calcula igual que si lo hubieras
          // marcado desde la pantalla de Hábitos.
          stepResult = get().toggleHabitToday(step.habitId);
        } else {
          const already = step.completedDates.includes(today);
          const nextDates = already ? step.completedDates.filter((d) => d !== today) : [...step.completedDates, today];
          set((s) => ({
            routines: s.routines.map((r) =>
              r.id === routineId
                ? { ...r, items: r.items.map((it) => (it.id === stepId ? { ...it, completedDates: nextDates } : it)) }
                : r,
            ),
          }));
          if (!already) {
            // Un paso sin hábito vinculado no tiene su propio "milestone" —
            // eso es cosa de la rutina completa (ver más abajo) o de un
            // hábito real. Acá solo interesa su racha para mostrarla.
            stepResult = { streak: computeStreak({ completedDates: nextDates, frequency: "diario" }), milestoneReached: null };
          }
        }

        // Evalúa si con este cambio la rutina completa quedó hecha hoy (o
        // dejó de estarlo, si se desmarcó un paso que la completaba).
        const freshState = get();
        const freshRoutine = freshState.routines.find((r) => r.id === routineId)!;
        const allDoneToday = freshRoutine.items.every((s) => isStepDoneOn(s, freshState.habits, today));
        const wasCompletedToday = freshRoutine.completedDates.includes(today);
        let routineResult: ProgressResult | null = null;

        if (allDoneToday && !wasCompletedToday) {
          const completedDates = [...freshRoutine.completedDates, today];
          const evaluated = processCompletionEvent(
            { type: "routine.completed" },
            { completedDates, frequency: "diario" },
            freshRoutine.milestonesUnlocked,
          );
          const milestonesUnlocked = evaluated.milestoneReached
            ? [...freshRoutine.milestonesUnlocked, evaluated.milestoneReached]
            : freshRoutine.milestonesUnlocked;
          set((s) => ({
            routines: s.routines.map((r) =>
              r.id === routineId ? { ...r, completedDates, streak: evaluated.streak, milestonesUnlocked } : r,
            ),
          }));
          routineResult = evaluated;
        } else if (!allDoneToday && wasCompletedToday) {
          const completedDates = freshRoutine.completedDates.filter((d) => d !== today);
          const streak = computeStreak({ completedDates, frequency: "diario" });
          set((s) => ({
            routines: s.routines.map((r) => (r.id === routineId ? { ...r, completedDates, streak } : r)),
          }));
        }

        return { stepResult, routineResult };
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
  // Desde la migración 0004 los campos extendidos SÍ viajan a Supabase. Para
  // filas anteriores a esa migración (o cuando el remoto trae null) se
  // conserva el valor local; los hitos vistos se unen; y el valor por día
  // (habit_completions) se mezcla con el local (el remoto gana por fecha).
  const localHabitById = new Map(local.habits.map((h) => [h.id, h] as const));
  const habits = {
    ...rawHabits,
    merged: rawHabits.merged.map((h) => {
      const prevLocal = localHabitById.get(h.id);
      const remoteValues = remote.habitValues[h.id];
      if (!prevLocal) return { ...h, values: remoteValues };
      return {
        ...h,
        categoryId: h.categoryId ?? prevLocal.categoryId,
        sourceId: h.sourceId !== undefined ? h.sourceId : prevLocal.sourceId,
        type: h.type && h.type !== "binario" ? h.type : (prevLocal.type ?? h.type),
        goal: h.goal ?? prevLocal.goal,
        unit: h.unit ?? prevLocal.unit,
        scheduledDays: h.scheduledDays ?? prevLocal.scheduledDays,
        reminder: h.reminder ?? prevLocal.reminder,
        mission: h.mission ?? prevLocal.mission,
        mastered: h.mastered || prevLocal.mastered,
        milestonesUnlocked: [...new Set([...h.milestonesUnlocked, ...prevLocal.milestonesUnlocked])],
        values: { ...(prevLocal.values ?? {}), ...(remoteValues ?? {}) },
      };
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

  const routines = mergeById(remote.routines, local.routines);

  const patch: Partial<HabitsState> = {
    routines: routines.merged,
    tasks: tasks.merged,
    habits: habits.merged,
    timeBlocks: timeBlocks.merged,
    pages: notionPages.merged,
    kanbanColumns: kanbanColumnsWithOrphans,
  };
  suppressRoutineSync = true;
  useHabitsStore.getState()._hydrateFromRemote(patch);
  suppressRoutineSync = false;

  // Backfill: sube a Supabase lo que era solo local.
  for (const task of tasks.localOnly) syncInsertTask(task, userId);
  for (const habit of habits.localOnly) syncInsertHabit(habit, userId);
  for (const routine of routines.localOnly) syncUpsertRoutine(routine, userId);
  // Valores por día que solo existían en este dispositivo (creados antes de la
  // migración): se suben a habit_completions.
  for (const h of habits.merged) {
    const remoteDays = remote.habitValues[h.id] ?? {};
    for (const [date, value] of Object.entries(h.values ?? {})) {
      if (remoteDays[date] === undefined) syncUpsertHabitValue(h.id, date, value, value >= (h.goal ?? 1), userId);
    }
  }
  for (const block of timeBlocks.localOnly) syncInsertTimeBlock(block, userId);
  for (const page of notionPages.localOnly) syncInsertNotionPage(page, userId);
  // kanban_columns es un singleton de 3 filas fijas por usuario — se
  // vuelve a upsertear siempre (barato, 3 filas) con el resultado ya
  // mezclado, así el backfill de columnas que todavía no existían en
  // remoto (o cuyos taskIds tenían ids solo-locales) queda cubierto sin
  // necesidad de trackear un "localOnly" aparte para esta tabla.
  syncUpsertKanbanColumns(kanbanColumnsWithOrphans, userId);
}

// ---------- Sync de rutinas ----------
// Las rutinas se modifican desde varias acciones (agregar, editar pasos,
// tildar un paso…): en vez de repetir la llamada de sync en cada una, se
// observa el slice `routines` y se sube lo que cambió. `suppressRoutineSync`
// evita re-subir lo que acaba de bajar en la hidratación.
let suppressRoutineSync = false;
useHabitsStore.subscribe((state, prev) => {
  if (suppressRoutineSync || state.routines === prev.routines) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  const prevById = new Map(prev.routines.map((r) => [r.id, r] as const));
  for (const r of state.routines) {
    if (prevById.get(r.id) !== r) syncUpsertRoutine(r, userId);
  }
  const nowIds = new Set(state.routines.map((r) => r.id));
  for (const r of prev.routines) {
    if (!nowIds.has(r.id)) syncDeleteRoutine(r.id, userId);
  }
});

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
