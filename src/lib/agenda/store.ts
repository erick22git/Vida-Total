import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "@/lib/store/scoped-storage";
import type { CopyPlan } from "./copy";
import { newAlert } from "./alerts";
import { MAX_PRESETS, normalizeHex } from "./colors";
import { DEFAULT_COLOR, DEFAULT_ICON, iconForTitle } from "./icons";
import type { ParsedItem } from "./ics";
import type { ReplanAction } from "./replan";
import { isRecurring, occurrencesOn } from "./recurrence";
import { DAY_MIN, nowMinutes, toISODate } from "./time";
import { NO_REPEAT, type AgendaCalendar, type AgendaSubtask, type AgendaTask, type AgendaTaskDraft, type SyncStatus } from "./types";

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
    alerts: [newAlert(0)],
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
  /** Colores propios del usuario (máx. 12). */
  colorPresets: string[];
  calendars: AgendaCalendar[];
  sync: SyncStatus;
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
  /** Paleta propia: agregar / reemplazar / quitar / restablecer. Devuelve false si el HEX no es válido o ya no caben. */
  addColorPreset: (hex: string) => boolean;
  updateColorPreset: (oldHex: string, newHex: string) => boolean;
  removeColorPreset: (hex: string) => void;
  resetColorPresets: () => void;
  /** Importación (archivo .ics): actualiza lo ya importado sin duplicar y quita lo que ya no está en el archivo. */
  importCalendar: (input: { name: string; kind: "events" | "reminders"; fileName: string; color: string; items: ParsedItem[] }) => { calendarId: string; added: number; updated: number; removed: number };
  setCalendarVisible: (id: string, visible: boolean) => void;
  removeCalendar: (id: string) => void;
  setSync: (s: SyncStatus) => void;
  /** Replan sobre UN día concreto (una ocurrencia): nunca toca al resto de la serie. */
  replanAction: (id: string, date: string, action: ReplanAction, target?: { date: string; startMin: number | null }) => void;
  /** Deshacer: vuelve a un estado anterior de las tareas. */
  restoreTasks: (tasks: AgendaTask[]) => void;
}

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set, get) => ({
      tasks: [],
      durationPresets: DEFAULT_DURATION_PRESETS,
      timeStep: 15,
      recentIcons: [],
      colorPresets: [],
      calendars: [],
      sync: { state: "idle" as const },
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
      addColorPreset: (hex) => {
        const h = normalizeHex(hex);
        if (!h) return false;
        const cur = get().colorPresets;
        if (cur.includes(h)) return true;
        if (cur.length >= MAX_PRESETS) return false;
        set({ colorPresets: [...cur, h] });
        return true;
      },
      updateColorPreset: (oldHex, newHex) => {
        const n = normalizeHex(newHex);
        if (!n) return false;
        set((s) => ({ colorPresets: s.colorPresets.map((c) => (c === oldHex ? n : c)).filter((c, i, a) => a.indexOf(c) === i) }));
        return true;
      },
      removeColorPreset: (hex) => set((s) => ({ colorPresets: s.colorPresets.filter((c) => c !== hex) })),
      resetColorPresets: () => set({ colorPresets: [] }),
      importCalendar: ({ name, kind, fileName, color, items }) => {
        const s = get();
        const existing = s.calendars.find((c) => c.kind === kind && c.fileName === fileName);
        const calendarId = existing?.id ?? uid();
        const source = kind === "events" ? ("calendar" as const) : ("reminder" as const);
        const seen = new Set(items.map((i) => i.uid));
        const now = Date.now();
        let added = 0;
        let updated = 0;
        const known = new Set(s.tasks.filter((t) => t.calendarId === calendarId && t.externalId).map((t) => t.externalId!));
        let tasks = s.tasks.map((t) => {
          if (t.calendarId !== calendarId || !t.externalId) return t;
          const it = items.find((i) => i.uid === t.externalId);
          if (!it) return t;
          updated++;
          return {
            ...t,
            title: it.title,
            date: it.date,
            startMin: it.startMin,
            durationMin: it.durationMin,
            allDay: it.allDay,
            repeat: it.repeat,
            notes: source === "calendar" ? it.notes : t.notes,
            done: source === "reminder" && it.done ? true : t.done,
          };
        });
        const fresh: AgendaTask[] = [];
        items.forEach((it, i) => {
          if (known.has(it.uid)) return;
          added++;
          fresh.push({
            id: uid(),
            title: it.title,
            icon: iconForTitle(it.title),
            color: existing?.color ?? color,
            date: it.date,
            startMin: it.startMin,
            durationMin: it.durationMin,
            allDay: it.allDay,
            done: it.done,
            notes: it.notes,
            subtasks: [],
            alerts: source === "reminder" && it.startMin !== null ? [newAlert(0)] : [],
            repeat: it.repeat,
            source,
            externalId: it.uid,
            calendarId,
            createdAt: now + i,
          });
        });
        const before = tasks.length;
        tasks = tasks.filter((t) => t.calendarId !== calendarId || !t.externalId || seen.has(t.externalId));
        const removed = before - tasks.length;
        const calendar: AgendaCalendar = { id: calendarId, name, kind, color: existing?.color ?? color, visible: existing?.visible ?? true, fileName, importedAt: now, count: items.length };
        set({ tasks: [...tasks, ...fresh], calendars: existing ? s.calendars.map((c) => (c.id === calendarId ? calendar : c)) : [...s.calendars, calendar] });
        return { calendarId, added, updated, removed };
      },
      setCalendarVisible: (id, visible) => set((s) => ({ calendars: s.calendars.map((c) => (c.id === id ? { ...c, visible } : c)) })),
      removeCalendar: (id) => set((s) => ({ calendars: s.calendars.filter((c) => c.id !== id), tasks: s.tasks.filter((t) => t.calendarId !== id) })),
      setSync: (sync) => set({ sync }),
      restoreTasks: (tasks) => set({ tasks }),
      replanAction: (id, date, action, target) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return s;
          const rec = isRecurring(t);
          const detached = (over: Partial<AgendaTask>): AgendaTask => ({ ...t, id: uid(), createdAt: Date.now(), repeat: NO_REPEAT, doneDates: undefined, skipDates: undefined, done: false, ...over });
          const skip = (list: AgendaTask[]) => list.map((x) => (x.id === id ? { ...x, skipDates: [...(x.skipDates ?? []), date] } : x));
          if (action === "complete") {
            if (!rec) return { tasks: s.tasks.map((x) => (x.id === id ? { ...x, done: true } : x)) };
            return { tasks: s.tasks.map((x) => (x.id === id && !x.doneDates?.includes(date) ? { ...x, doneDates: [...(x.doneDates ?? []), date] } : x)) };
          }
          if (action === "delete") return { tasks: rec ? skip(s.tasks) : s.tasks.filter((x) => x.id !== id) };
          if (action === "inbox") {
            const toInbox = { date: null, startMin: null, allDay: false };
            return { tasks: rec ? [...skip(s.tasks), detached(toInbox)] : s.tasks.map((x) => (x.id === id ? { ...x, ...toInbox } : x)) };
          }
          const to = { date: target?.date ?? date, startMin: target ? target.startMin : t.startMin };
          return { tasks: rec ? [...skip(s.tasks), detached(to)] : s.tasks.map((x) => (x.id === id ? { ...x, ...to } : x)) };
        }),
      pushRecentIcon: (key) => set((s) => ({ recentIcons: [key, ...s.recentIcons.filter((k) => k !== key)].slice(0, 8) })),
    }),
    {
      name: "vida-total-agenda",
      version: 1,
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-agenda")),
      // `sync` es solo un estado de pantalla: no se guarda.
      partialize: (s) => ({ tasks: s.tasks, durationPresets: s.durationPresets, timeStep: s.timeStep, recentIcons: s.recentIcons, colorPresets: s.colorPresets, calendars: s.calendars }),
    },
  ),
);

export const inboxTasks = (tasks: AgendaTask[]) => tasks.filter((t) => t.date === null);
