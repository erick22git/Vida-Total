import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { differenceInCalendarDays, format } from "date-fns";
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

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  },
  {
    id: "h-lectura",
    name: "Leer 10 min",
    icon: "BookOpen",
    color: "var(--habitos)",
    frequency: "diario",
    streak: 0,
    completedDates: [],
  },
  {
    id: "h-meditar",
    name: "Meditar",
    icon: "Sparkles",
    color: "var(--habitos)",
    frequency: "diario",
    streak: 0,
    completedDates: [],
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
  toggleHabitToday: (id: string) => void;
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
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      // Tasks
      tasks: [],
      addTask: (task) => {
        const id = uid();
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              id,
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
            },
          ],
        }));
        get().ensureTaskInKanban(id);
        return id;
      },
      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          kanbanColumns: state.kanbanColumns.map((c) => ({
            ...c,
            taskIds: c.taskIds.filter((tid) => tid !== id),
          })),
        })),
      toggleTaskCompleted: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, isCompleted: !t.isCompleted } : t,
          ),
        })),
      addSubtask: (taskId, title) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: [...t.subtasks, { id: uid(), title, done: false } as Subtask],
                }
              : t,
          ),
        })),
      toggleSubtask: (taskId, subtaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, done: !s.done } : s,
                  ),
                }
              : t,
          ),
        })),
      removeSubtask: (taskId, subtaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
              : t,
          ),
        })),

      // Habits
      habits: DEFAULT_HABITS,
      toggleHabitToday: (id) =>
        set((state) => {
          const today = todayISO();
          return {
            habits: state.habits.map((h) => {
              if (h.id !== id) return h;
              const already = h.completedDates.includes(today);
              if (already) {
                return {
                  ...h,
                  completedDates: h.completedDates.filter((d) => d !== today),
                  streak: Math.max(0, h.streak - 1),
                };
              }
              const lastDate = h.completedDates[h.completedDates.length - 1];
              let streak = h.streak;
              if (lastDate) {
                const diff = differenceInCalendarDays(new Date(today), new Date(lastDate));
                streak = diff === 1 ? streak + 1 : 1;
              } else {
                streak = 1;
              }
              return {
                ...h,
                completedDates: [...h.completedDates, today],
                streak,
              };
            }),
          };
        }),
      addHabit: (habit) =>
        set((state) => ({
          habits: [
            ...state.habits,
            {
              id: uid(),
              name: habit.name,
              icon: habit.icon ?? "Star",
              color: habit.color ?? "var(--habitos)",
              frequency: habit.frequency ?? "diario",
              streak: 0,
              completedDates: [],
            },
          ],
        })),
      removeHabit: (id) =>
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) })),

      // Timeline
      timeBlocks: [],
      addTimeBlock: (block) =>
        set((state) => ({ timeBlocks: [...state.timeBlocks, { ...block, id: uid() }] })),
      updateTimeBlock: (id, patch) =>
        set((state) => ({
          timeBlocks: state.timeBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      removeTimeBlock: (id) =>
        set((state) => ({ timeBlocks: state.timeBlocks.filter((b) => b.id !== id) })),

      // Workspace
      pages: DEFAULT_PAGES,
      activePageId: DEFAULT_PAGES[0]?.id ?? null,
      setActivePageId: (id) => set({ activePageId: id }),
      addPage: (page) => {
        const id = uid();
        set((state) => ({
          pages: [
            ...state.pages,
            {
              id,
              title: page.title,
              icon: page.icon ?? "FileText",
              blocks: page.blocks ?? [],
            },
          ],
          activePageId: id,
        }));
        return id;
      },
      updatePage: (id, patch) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePage: (id) =>
        set((state) => {
          const pages = state.pages.filter((p) => p.id !== id);
          return {
            pages,
            activePageId:
              state.activePageId === id ? pages[0]?.id ?? null : state.activePageId,
          };
        }),
      addBlock: (pageId, block) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? { ...p, blocks: [...p.blocks, { ...block, id: uid() }] }
              : p,
          ),
        })),
      updateBlock: (pageId, blockId, patch) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? {
                  ...p,
                  blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
                }
              : p,
          ),
        })),
      removeBlock: (pageId, blockId) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) }
              : p,
          ),
        })),

      // Kanban
      kanbanColumns: DEFAULT_KANBAN,
      moveTaskToColumn: (taskId, columnId) =>
        set((state) => ({
          kanbanColumns: state.kanbanColumns.map((c) => ({
            ...c,
            taskIds:
              c.id === columnId
                ? [...c.taskIds.filter((id) => id !== taskId), taskId]
                : c.taskIds.filter((id) => id !== taskId),
          })),
        })),
      ensureTaskInKanban: (taskId) =>
        set((state) => {
          const alreadyPlaced = state.kanbanColumns.some((c) => c.taskIds.includes(taskId));
          if (alreadyPlaced) return state;
          return {
            kanbanColumns: state.kanbanColumns.map((c) =>
              c.id === "por-hacer" ? { ...c, taskIds: [...c.taskIds, taskId] } : c,
            ),
          };
        }),
    }),
    {
      name: "vida-total-habits-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-habits-store")),
    },
  ),
);

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
