/**
 * Lógica de negocio PURA del agente sobre tareas y notas (sin stores, sin red). La usan:
 *  - el ejecutor de la app (`client.ts`), que aplica el resultado en los stores;
 *  - el servidor (lecturas para Telegram y el programador de avisos).
 * Separada de la UI a propósito: el agente y las pantallas llaman a las mismas reglas.
 */
import type { Subtask, Task, NotionBlock, NotionPage } from "@/lib/types/habits";
import type { Args } from "../tools/meta";

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// ───────────── Tareas ─────────────

export interface TaskView {
  id: string;
  title: string;
  done: boolean;
  priority: string;
  dueDate?: string;
  reminder?: string;
  subtasks: Array<{ id: string; title: string; done: boolean; dueDate?: string; reminder?: string }>;
}

export function taskView(t: Task): TaskView {
  return {
    id: t.id,
    title: t.title,
    done: t.isCompleted,
    priority: t.priority,
    ...(t.dueDate ? { dueDate: t.dueDate } : {}),
    ...(t.reminder ? { reminder: t.reminder } : {}),
    subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done, ...(s.dueDate ? { dueDate: s.dueDate } : {}), ...(s.reminder ? { reminder: s.reminder } : {}) })),
  };
}

export function listTasks(tasks: Task[], args: Args, limit = 25): TaskView[] {
  const estado = (args.estado as string | undefined) ?? "pendientes";
  const fecha = args.fecha as string | undefined;
  return tasks
    .filter((t) => (estado === "todas" ? true : estado === "completadas" ? t.isCompleted : !t.isCompleted))
    .filter((t) => (fecha ? t.dueDate === fecha : true))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, limit)
    .map(taskView);
}

/** Tarea nueva a partir de los argumentos validados de `task_create`. */
export function buildTask(args: Args, id = newId()): Task {
  const subtasks: Subtask[] = ((args.subtasks as string[] | undefined) ?? []).map((title) => ({ id: newId(), title, done: false }));
  return {
    id,
    title: args.title as string,
    description: args.description as string | undefined,
    priority: (args.priority as Task["priority"] | undefined) ?? "media",
    dueDate: args.dueDate as string | undefined,
    reminder: args.reminder as string | undefined,
    isCompleted: false,
    subtasks,
    tags: [],
    color: "var(--habitos)",
    icon: "CheckCircle2",
  };
}

/** Cambios de `task_update` como parche + el parche inverso (para deshacer). */
export function taskUpdatePatch(task: Task, args: Args): { patch: Partial<Task>; inverse: Partial<Task> } {
  const patch: Partial<Task> = {};
  const inverse: Partial<Task> = {};
  const set = <K extends keyof Task>(k: K, v: Task[K]) => {
    patch[k] = v;
    inverse[k] = task[k];
  };
  if (typeof args.title === "string") set("title", args.title);
  if (typeof args.description === "string") set("description", args.description || undefined);
  if (typeof args.priority === "string") set("priority", args.priority as Task["priority"]);
  if (typeof args.dueDate === "string") set("dueDate", args.dueDate || undefined);
  if (typeof args.reminder === "string") set("reminder", args.reminder || undefined);
  // Quitar la fecha límite quita el recordatorio (no tiene sentido sin fecha).
  if (patch.dueDate === undefined && "dueDate" in patch && task.reminder && !("reminder" in patch)) set("reminder", undefined);
  return { patch, inverse };
}

export function describeTaskChange(task: Task, patch: Partial<Task>): { before: string; after: string } {
  const keys = Object.keys(patch) as Array<keyof Task>;
  const fmt = (src: Partial<Task>) =>
    keys.map((k) => `${k === "dueDate" ? "vence" : k === "reminder" ? "aviso" : k === "title" ? "título" : k === "priority" ? "prioridad" : "descripción"}: ${String(src[k] ?? "—")}`).join(" · ");
  return { before: fmt(task), after: fmt({ ...task, ...patch }) };
}

export function addSubtaskTo(task: Task, args: Args, id = newId()): { subtasks: Subtask[]; added: Subtask } {
  const added: Subtask = { id, title: args.title as string, done: false, ...(args.dueDate ? { dueDate: args.dueDate as string } : {}), ...(args.reminder ? { reminder: args.reminder as string } : {}) };
  return { subtasks: [...task.subtasks, added], added };
}

// ───────────── Notas ─────────────

export interface NoteView {
  id: string;
  title: string;
  snippet: string;
}

export function noteText(p: NotionPage): string {
  return p.blocks
    .map((b) => (b.type === "checklist" ? (b.items ?? []).map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join("\n") : b.content))
    .filter(Boolean)
    .join("\n");
}

export function listNotes(pages: NotionPage[], args: Args, limit = 20): NoteView[] {
  const q = typeof args.buscar === "string" ? args.buscar.toLowerCase() : "";
  return pages
    .filter((p) => !q || p.title.toLowerCase().includes(q) || noteText(p).toLowerCase().includes(q))
    .slice(0, limit)
    .map((p) => ({ id: p.id, title: p.title, snippet: noteText(p).slice(0, 160) }));
}

export function buildNoteBlocks(text?: string, checklistItems?: string[]): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  if (text) blocks.push({ id: newId(), type: "text", content: text });
  if (checklistItems?.length) blocks.push({ id: newId(), type: "checklist", content: "", items: checklistItems.map((t) => ({ id: newId(), text: t, done: false })) });
  return blocks;
}

/** `note_update`: título nuevo y/o bloques agregados al final. Devuelve el parche y el inverso (para deshacer). */
export function noteUpdatePatch(page: NotionPage, args: Args): { patch: Partial<NotionPage>; inverse: Partial<NotionPage> } {
  const patch: Partial<NotionPage> = {};
  const inverse: Partial<NotionPage> = {};
  if (typeof args.title === "string") {
    patch.title = args.title;
    inverse.title = page.title;
  }
  const extra = buildNoteBlocks(args.appendText as string | undefined, args.appendChecklist as string[] | undefined);
  if (extra.length) {
    patch.blocks = [...page.blocks, ...extra];
    inverse.blocks = page.blocks;
  }
  return { patch, inverse };
}
