/** Herramientas de LECTURA de Entrenamiento y Agenda. Solo metadatos y validación (los lectores viven en `actions/`). */
import { asArgs, isDayKey, type ToolMeta, type Validation } from "./meta";

const fail = (error: string): Validation => ({ ok: false, error });

export const READER_TOOLS: ToolMeta[] = [
  {
    name: "training_today",
    module: "entrenamiento",
    label: "Ver el entrenamiento de hoy",
    description: "Plan de entrenamiento del día (grupo muscular y rutina con sus ejercicios) y si hoy es descanso. Por defecto hoy.",
    kind: "read",
    exposed: true,
    parameters: {
      type: "object",
      properties: { fecha: { type: "string", description: "yyyy-MM-dd; por defecto hoy." } },
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      if (a.fecha !== undefined && !isDayKey(a.fecha)) return fail('"fecha" debe ser yyyy-MM-dd.');
      return { ok: true, args: a.fecha ? { fecha: a.fecha } : {} };
    },
  },
  {
    name: "ranks_summary",
    module: "entrenamiento",
    label: "Ver mis rangos",
    description: "Rango general y por grupo muscular del usuario (solo disponible dentro de la app).",
    kind: "read",
    exposed: true,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    validate: (raw) => (asArgs(raw) ? { ok: true, args: {} } : fail("Argumentos inválidos.")),
  },
  {
    name: "agenda_today",
    module: "tareas",
    label: "Ver mi agenda",
    description: "Tareas con fecha, bloques de tiempo y pasos de rutina de un día (por defecto hoy). Solo lectura.",
    kind: "read",
    exposed: true,
    taints: true,
    parameters: {
      type: "object",
      properties: { fecha: { type: "string", description: "yyyy-MM-dd; por defecto hoy." } },
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      if (a.fecha !== undefined && !isDayKey(a.fecha)) return fail('"fecha" debe ser yyyy-MM-dd.');
      return { ok: true, args: a.fecha ? { fecha: a.fecha } : {} };
    },
  },
];
