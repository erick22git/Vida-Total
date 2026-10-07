/** Herramientas del agente: tareas y subtareas (hasta 2 niveles: tarea → subtarea). Solo metadatos y validación. */
import {
  asArgs,
  isDayKey,
  isErr,
  isHHmm,
  optString,
  optText,
  reqString,
  type Args,
  type ToolMeta,
  type Validation,
} from "./meta";

const PRIORITIES = ["alta", "media", "baja"] as const;
export const MAX_SUBTASKS_PER_CALL = 10;

function fail(error: string): Validation {
  return { ok: false, error };
}

/** Campos de fecha/recordatorio comunes a tareas y subtareas. */
function dateFields(a: Args): { dueDate?: string; reminder?: string } | { error: string } {
  const out: { dueDate?: string; reminder?: string } = {};
  if (a.dueDate !== undefined && a.dueDate !== null && a.dueDate !== "") {
    if (!isDayKey(a.dueDate)) return { error: '"dueDate" debe ser una fecha yyyy-MM-dd válida.' };
    out.dueDate = a.dueDate;
  }
  if (a.reminder !== undefined && a.reminder !== null && a.reminder !== "") {
    if (!isHHmm(a.reminder)) return { error: '"reminder" debe ser una hora HH:mm.' };
    if (!out.dueDate && !a.dueDate) return { error: "Un recordatorio necesita una fecha límite (dueDate)." };
    out.reminder = a.reminder;
  }
  return out;
}

const DATE_PROPS = {
  dueDate: { type: "string", description: "Fecha límite yyyy-MM-dd (hora local del usuario)." },
  reminder: { type: "string", description: "Hora del recordatorio HH:mm; requiere dueDate." },
} as const;

export const TASK_TOOLS: ToolMeta[] = [
  {
    name: "task_list",
    module: "tareas",
    label: "Ver tareas",
    description: "Lista las tareas del usuario (máx. 25) con sus subtareas. Úsala para conocer los ids antes de editar o completar.",
    kind: "read",
    exposed: true,
    taints: true,
    parameters: {
      type: "object",
      properties: {
        estado: { type: "string", enum: ["pendientes", "completadas", "todas"], description: "Por defecto: pendientes." },
        fecha: { type: "string", description: "Solo las que vencen ese día (yyyy-MM-dd)." },
      },
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const estado = a.estado ?? "pendientes";
      if (estado !== "pendientes" && estado !== "completadas" && estado !== "todas") return fail('"estado" inválido.');
      if (a.fecha !== undefined && !isDayKey(a.fecha)) return fail('"fecha" debe ser yyyy-MM-dd.');
      return { ok: true, args: { estado, ...(a.fecha ? { fecha: a.fecha } : {}) } };
    },
  },
  {
    name: "task_create",
    module: "tareas",
    label: "Crear tarea",
    description: "Crea una tarea, opcionalmente con fecha límite, recordatorio y subtareas (máx. 10).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: [...PRIORITIES] },
        ...DATE_PROPS,
        subtasks: { type: "array", items: { type: "string" }, description: "Títulos de subtareas." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    batchSize: (a) => 1 + (Array.isArray(a.subtasks) ? a.subtasks.length : 0),
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const title = reqString(a, "title", 140);
      if (isErr(title)) return fail(title.error);
      const description = optText(a, "description", 1000);
      if (isErr(description)) return fail(description.error);
      if (a.priority !== undefined && !PRIORITIES.includes(a.priority as (typeof PRIORITIES)[number])) return fail('"priority" inválida.');
      const d = dateFields(a);
      if ("error" in d) return fail(d.error);
      let subtasks: string[] = [];
      if (a.subtasks !== undefined) {
        if (!Array.isArray(a.subtasks) || a.subtasks.length > MAX_SUBTASKS_PER_CALL || a.subtasks.some((s) => typeof s !== "string" || !s.trim() || s.length > 140)) {
          return fail(`"subtasks" debe ser una lista de hasta ${MAX_SUBTASKS_PER_CALL} textos cortos.`);
        }
        subtasks = (a.subtasks as string[]).map((s) => s.trim());
      }
      return { ok: true, args: { title, ...(description ? { description } : {}), ...(a.priority ? { priority: a.priority } : {}), ...d, ...(subtasks.length ? { subtasks } : {}) } };
    },
  },
  {
    name: "task_update",
    module: "tareas",
    label: "Editar tarea",
    description: "Edita una tarea existente (título, descripción, prioridad, fecha límite, recordatorio). Usa dueDate/reminder = \"\" para quitarlos.",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: [...PRIORITIES] },
        ...DATE_PROPS,
      },
      required: ["id"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const id = reqString(a, "id", 80);
      if (isErr(id)) return fail(id.error);
      const out: Args = { id };
      if (a.title !== undefined) {
        const t = reqString(a, "title", 140);
        if (isErr(t)) return fail(t.error);
        out.title = t;
      }
      if (a.description !== undefined) {
        const t = optString(a, "description", 1000);
        if (isErr(t)) return fail(t.error);
        out.description = t ?? "";
      }
      if (a.priority !== undefined) {
        if (!PRIORITIES.includes(a.priority as (typeof PRIORITIES)[number])) return fail('"priority" inválida.');
        out.priority = a.priority;
      }
      if (a.dueDate !== undefined) {
        if (a.dueDate !== "" && !isDayKey(a.dueDate)) return fail('"dueDate" debe ser yyyy-MM-dd o "".');
        out.dueDate = a.dueDate;
      }
      if (a.reminder !== undefined) {
        if (a.reminder !== "" && !isHHmm(a.reminder)) return fail('"reminder" debe ser HH:mm o "".');
        out.reminder = a.reminder;
      }
      if (Object.keys(out).length === 1) return fail("No hay nada que cambiar.");
      return { ok: true, args: out };
    },
  },
  {
    name: "task_complete",
    module: "tareas",
    label: "Completar tarea",
    description: "Marca una tarea como completada (o la reabre con done=false).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, done: { type: "boolean", description: "Por defecto true." } },
      required: ["id"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const id = reqString(a, "id", 80);
      if (isErr(id)) return fail(id.error);
      if (a.done !== undefined && typeof a.done !== "boolean") return fail('"done" debe ser true/false.');
      return { ok: true, args: { id, done: a.done ?? true } };
    },
  },
  {
    name: "subtask_add",
    module: "tareas",
    label: "Agregar subtarea",
    description: "Agrega una subtarea a una tarea (las subtareas no tienen subtareas).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: { taskId: { type: "string" }, title: { type: "string" }, ...DATE_PROPS },
      required: ["taskId", "title"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const taskId = reqString(a, "taskId", 80);
      const title = reqString(a, "title", 140);
      if (isErr(taskId)) return fail(taskId.error);
      if (isErr(title)) return fail(title.error);
      const d = dateFields(a);
      if ("error" in d) return fail(d.error);
      return { ok: true, args: { taskId, title, ...d } };
    },
  },
  {
    name: "subtask_complete",
    module: "tareas",
    label: "Completar subtarea",
    description: "Marca una subtarea como hecha (o la reabre con done=false).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: { taskId: { type: "string" }, subtaskId: { type: "string" }, done: { type: "boolean" } },
      required: ["taskId", "subtaskId"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const taskId = reqString(a, "taskId", 80);
      const subtaskId = reqString(a, "subtaskId", 80);
      if (isErr(taskId)) return fail(taskId.error);
      if (isErr(subtaskId)) return fail(subtaskId.error);
      if (a.done !== undefined && typeof a.done !== "boolean") return fail('"done" debe ser true/false.');
      return { ok: true, args: { taskId, subtaskId, done: a.done ?? true } };
    },
  },
];
