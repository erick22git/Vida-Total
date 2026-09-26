import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "@/lib/store/scoped-storage";
import { DEFAULT_COLOR, DEFAULT_ICON } from "./icons";
import type { AgendaSubtask, AgendaTask, AgendaTaskDraft } from "./types";

const uid = () => `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_DURATION_PRESETS = [1, 15, 30, 45, 60, 120];

export function emptyDraft(date: string | null, startMin: number | null): AgendaTaskDraft {
  return {
    title: "",
    icon: DEFAULT_ICON,
    color: DEFAULT_COLOR,
    date,
    startMin,
    durationMin: 15,
    allDay: false,
    done: false,
    notes: "",
    subtasks: [],
    alert: true,
  };
}

interface AgendaState {
  tasks: AgendaTask[];
  /** Duraciones rápidas editables (minutos). */
  durationPresets: number[];
  /** Paso de la rueda de hora (minutos). */
  timeStep: number;
  recentIcons: string[];
  addTask: (draft: AgendaTaskDraft) => string;
  updateTask: (id: string, patch: Partial<AgendaTask>) => void;
  deleteTask: (id: string) => void;
  toggleDone: (id: string) => void;
  addSubtask: (id: string, title: string) => void;
  toggleSubtask: (id: string, subtaskId: string) => void;
  removeSubtask: (id: string, subtaskId: string) => void;
  setDurationPresets: (presets: number[]) => void;
  setTimeStep: (step: number) => void;
  pushRecentIcon: (key: string) => void;
}

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set) => ({
      tasks: [],
      durationPresets: DEFAULT_DURATION_PRESETS,
      timeStep: 15,
      recentIcons: [],
      addTask: (draft) => {
        const id = uid();
        set((s) => ({ tasks: [...s.tasks, { ...draft, id, createdAt: Date.now() }] }));
        return id;
      },
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      toggleDone: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      addSubtask: (id, title) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, subtasks: [...t.subtasks, { id: uid(), title, done: false } as AgendaSubtask] } : t)),
        })),
      toggleSubtask: (id, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, subtasks: t.subtasks.map((x) => (x.id === subtaskId ? { ...x, done: !x.done } : x)) } : t)),
        })),
      removeSubtask: (id, subtaskId) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, subtasks: t.subtasks.filter((x) => x.id !== subtaskId) } : t)) })),
      setDurationPresets: (presets) => set({ durationPresets: [...new Set(presets)].sort((a, b) => a - b) }),
      setTimeStep: (step) => set({ timeStep: step }),
      pushRecentIcon: (key) => set((s) => ({ recentIcons: [key, ...s.recentIcons.filter((k) => k !== key)].slice(0, 8) })),
    }),
    {
      name: "vida-total-agenda",
      version: 1,
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-agenda")),
    },
  ),
);

/** Tareas de un día (yyyy-MM-dd), con hora primero y sin hora (día completo) al final. */
export function tasksOnDate(tasks: AgendaTask[], date: string): AgendaTask[] {
  return tasks.filter((t) => t.date === date);
}

export const inboxTasks = (tasks: AgendaTask[]) => tasks.filter((t) => t.date === null);
