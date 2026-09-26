import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "@/lib/store/scoped-storage";
import type { CopyPlan } from "./copy";
import { DEFAULT_COLOR, DEFAULT_ICON } from "./icons";
import { isRecurring, occurrencesOn } from "./recurrence";
import { DAY_MIN, nowMinutes, toISODate } from "./time";
import { NO_REPEAT, type AgendaSubtask, type AgendaTask, type AgendaTaskDraft } from "./types";

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
    repeat: NO_REPEAT,
  };
}

/** Primer hueco libre del día (de `step` en `step` min) a partir de ahora (hoy) o de las 9:00 (otros días). */
export function firstFreeStart(tasks: AgendaTask[], date: string, step: number, durationMin = 15, now: Date = new Date()): number {
  const timed = occurrencesOn(tasks, date).filter((t) => t.startMin !== null && !t.allDay);
  let m = date === toISODate(now) ? Math.ceil((nowMinutes(now) + 1) / step) * step : 9 * 60;
  for (let guard = 0; guard < DAY_MIN; guard += step) {
    const end = m + durationMin;
    if (end > DAY_MIN - 1) return Math.min(m, DAY_MIN - step);
    const clash = timed.find((t) => m < t.startMin! + t.durationMin && end > t.startMin!);
    if (!clash) return m;
    m = Math.ceil((clash.startMin! + clash.durationMin) / step) * step;
  }
  return m;
}

interface AgendaState {
  tasks: AgendaTask[];
  /** Duraciones rápidas editables (minutos). */
  durationPresets: number[];
  /** Paso de la rueda de hora (minutos). */
  timeStep: number;
  recentIcons: string[];
  /** ÚNICA puerta de creación de tareas: solo se llama al confirmar en el panel (o al copiar/duplicar de forma explícita). */
  addTask: (draft: AgendaTaskDraft) => string;
  updateTask: (id: string, patch: Partial<AgendaTask>) => void;
  /** Borra una tarea; si se repite y se da `onlyDate`, solo desaparece ese día. */
  deleteTask: (id: string, onlyDate?: string) => void;
  /** Marca/desmarca una tarea en un día concreto (en las que se repiten, solo ese día). */
  toggleDoneOn: (id: string, date: string) => void;
  /** Vacía un día: borra las tareas sueltas y oculta ese día en las que se repiten. */
  clearDay: (date: string) => void;
  /** Cambia de día las tareas indicadas (conserva su hora). */
  moveTasks: (ids: string[], date: string) => void;
  /** Ejecuta un plan de copia ya calculado con `planCopy`. Solo se llama al confirmar. */
  applyCopy: (plan: CopyPlan) => number;
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
      deleteTask: (id, onlyDate) =>
        set((s) => ({
          tasks:
            onlyDate === undefined
              ? s.tasks.filter((t) => t.id !== id)
              : s.tasks.map((t) => (t.id === id ? { ...t, skipDates: [...(t.skipDates ?? []), onlyDate] } : t)),
        })),
      toggleDoneOn: (id, date) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            if (!isRecurring(t)) return { ...t, done: !t.done };
            const has = t.doneDates?.includes(date);
            return { ...t, doneDates: has ? (t.doneDates ?? []).filter((d) => d !== date) : [...(t.doneDates ?? []), date] };
          }),
        })),
      clearDay: (date) =>
        set((s) => ({
          tasks: s.tasks
            .filter((t) => isRecurring(t) || t.date !== date)
            .map((t) => (isRecurring(t) && !(t.skipDates ?? []).includes(date) ? { ...t, skipDates: [...(t.skipDates ?? []), date] } : t)),
        })),
      moveTasks: (ids, date) => set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, date } : t)) })),
      applyCopy: (plan) => {
        const now = Date.now();
        set((s) => ({ tasks: [...s.tasks, ...plan.create.map((d, i) => ({ ...d, id: uid(), createdAt: now + i }))] }));
        return plan.create.length;
      },
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

export const inboxTasks = (tasks: AgendaTask[]) => tasks.filter((t) => t.date === null);
