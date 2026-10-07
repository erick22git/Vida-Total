"use client";

/**
 * Ejecutor del agente EN LA APP: aplica cada herramienta con las acciones normales de los stores (así también se
 * sincroniza con Supabase y se ve al instante). No decide permisos: eso ya lo hizo `decide()` antes de llegar aquí.
 */
import { useHabitsStore } from "@/lib/store/habitsStore";
import type { UndoSpec } from "../history";
import type { Args } from "../tools/meta";
import { addSubtaskTo, buildNoteBlocks, buildTask, describeTaskChange, listNotes, listTasks, noteUpdatePatch, taskUpdatePatch } from "./pure";
import { NUTRITION_EXECUTORS, NUTRITION_PREVIEWS } from "./nutrition-client";
import { READER_EXECUTORS } from "./readers-client";

export interface ExecResult {
  ok: boolean;
  /** Frase para el historial y para el usuario. */
  summary: string;
  /** Datos para el modelo (resultado de la herramienta). */
  data?: unknown;
  undo?: UndoSpec;
  before?: string;
  after?: string;
  error?: string;
}

const fail = (error: string): ExecResult => ({ ok: false, summary: error, error });

type Executor = (args: Args) => ExecResult;
type Previewer = (args: Args) => { before?: string; after?: string } | null;

const habits = () => useHabitsStore.getState();
const findTask = (id: unknown) => habits().tasks.find((t) => t.id === id);
const findNote = (id: unknown) => habits().pages.find((p) => p.id === id);

const EXECUTORS: Record<string, Executor> = {
  task_list: (a) => {
    const items = listTasks(habits().tasks, a);
    return { ok: true, summary: `${items.length} tarea(s)`, data: items };
  },
  task_create: (a) => {
    const t = buildTask(a);
    const id = habits().addTask(t);
    // addTask genera su propio id: lo usamos para deshacer.
    return { ok: true, summary: `Tarea creada: ${t.title}`, data: { id }, undo: { kind: "remove_task", id }, after: t.title };
  },
  task_update: (a) => {
    const t = findTask(a.id);
    if (!t) return fail("No encontré esa tarea.");
    const { patch, inverse } = taskUpdatePatch(t, a);
    habits().updateTask(t.id, patch);
    const d = describeTaskChange(t, patch);
    return { ok: true, summary: `Tarea editada: ${t.title}`, undo: { kind: "restore_task", id: t.id, patch: inverse as Record<string, unknown> }, ...d };
  },
  task_complete: (a) => {
    const t = findTask(a.id);
    if (!t) return fail("No encontré esa tarea.");
    const done = a.done !== false;
    if (t.isCompleted === done) return { ok: true, summary: `«${t.title}» ya estaba ${done ? "completada" : "pendiente"}` };
    habits().toggleTaskCompleted(t.id);
    return {
      ok: true,
      summary: `${done ? "Completada" : "Reabierta"}: ${t.title}`,
      undo: { kind: "restore_task", id: t.id, patch: { isCompleted: t.isCompleted } },
      before: t.isCompleted ? "completada" : "pendiente",
      after: done ? "completada" : "pendiente",
    };
  },
  subtask_add: (a) => {
    const t = findTask(a.taskId);
    if (!t) return fail("No encontré esa tarea.");
    if (t.subtasks.length >= 30) return fail("La tarea ya tiene demasiadas subtareas.");
    const { subtasks } = addSubtaskTo(t, a);
    habits().updateTask(t.id, { subtasks });
    return { ok: true, summary: `Subtarea agregada a «${t.title}»: ${a.title as string}`, undo: { kind: "restore_task", id: t.id, patch: { subtasks: t.subtasks } }, after: a.title as string };
  },
  subtask_complete: (a) => {
    const t = findTask(a.taskId);
    const s = t?.subtasks.find((x) => x.id === a.subtaskId);
    if (!t || !s) return fail("No encontré esa subtarea.");
    const done = a.done !== false;
    if (s.done === done) return { ok: true, summary: `«${s.title}» ya estaba ${done ? "hecha" : "pendiente"}` };
    habits().updateTask(t.id, { subtasks: t.subtasks.map((x) => (x.id === s.id ? { ...x, done } : x)) });
    return { ok: true, summary: `${done ? "Subtarea hecha" : "Subtarea reabierta"}: ${s.title}`, undo: { kind: "restore_task", id: t.id, patch: { subtasks: t.subtasks } }, before: s.done ? "hecha" : "pendiente", after: done ? "hecha" : "pendiente" };
  },
  note_list: (a) => {
    const items = listNotes(habits().pages, a);
    return { ok: true, summary: `${items.length} nota(s)`, data: items };
  },
  note_create: (a) => {
    const id = habits().addPage({ title: a.title as string, blocks: buildNoteBlocks(a.text as string | undefined, a.checklist as string[] | undefined) });
    return { ok: true, summary: `Nota creada: ${a.title as string}`, data: { id }, undo: { kind: "remove_note", id }, after: a.title as string };
  },
  note_update: (a) => {
    const p = findNote(a.id);
    if (!p) return fail("No encontré esa nota.");
    const { patch, inverse } = noteUpdatePatch(p, a);
    habits().updatePage(p.id, patch);
    return {
      ok: true,
      summary: `Nota editada: ${p.title}`,
      undo: { kind: "restore_note", id: p.id, patch: inverse as Record<string, unknown> },
      before: patch.title ? p.title : `${p.blocks.length} bloque(s)`,
      after: patch.title ?? `${(patch.blocks ?? p.blocks).length} bloque(s)`,
    };
  },
  ...NUTRITION_EXECUTORS,
  ...READER_EXECUTORS,
};

/** Vista previa "antes → después" para las tarjetas de permiso (lee el estado real, no cambia nada). */
const PREVIEWS: Record<string, Previewer> = {
  ...NUTRITION_PREVIEWS,
  task_update: (a) => {
    const t = findTask(a.id);
    return t ? describeTaskChange(t, taskUpdatePatch(t, a).patch) : null;
  },
  task_complete: (a) => {
    const t = findTask(a.id);
    return t ? { before: t.isCompleted ? "completada" : "pendiente", after: a.done !== false ? "completada" : "pendiente" } : null;
  },
  subtask_complete: (a) => {
    const s = findTask(a.taskId)?.subtasks.find((x) => x.id === a.subtaskId);
    return s ? { before: s.done ? "hecha" : "pendiente", after: a.done !== false ? "hecha" : "pendiente" } : null;
  },
  note_update: (a) => {
    const p = findNote(a.id);
    if (!p) return null;
    const { patch } = noteUpdatePatch(p, a);
    return { before: p.title, after: `${patch.title ?? p.title}${patch.blocks ? ` (+${patch.blocks.length - p.blocks.length} bloque/s)` : ""}` };
  },
};

export function executeClient(tool: string, args: Args): ExecResult {
  const ex = EXECUTORS[tool];
  if (!ex) return fail("Esa herramienta no está disponible en la app.");
  try {
    return ex(args);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falló la acción.");
  }
}

export function previewClient(tool: string, args: Args): { before?: string; after?: string } | null {
  try {
    return PREVIEWS[tool]?.(args) ?? null;
  } catch {
    return null;
  }
}
