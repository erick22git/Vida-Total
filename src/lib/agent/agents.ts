/**
 * CONFIGURACIÓN DE AGENTES — un solo archivo. Un agente = nombre, traje, instrucciones, herramientas permitidas, permisos por
 * defecto y modelo. Mínimo privilegio: cada especialista ve SOLO sus herramientas (el motor de permisos lo hace cumplir con
 * `PermissionContext.agent`). Un agente no puede ampliar sus permisos: los niveles y la lista «nunca automático» son del usuario
 * y del código, no de esta configuración. Módulo PURO (sin red).
 */
import type { ToolLevel } from "./types";

export type AgentId = "general" | "nutricion" | "entrenamiento" | "organizacion" | "recordatorios";
export type Costume = "none" | "chef" | "sport" | "glasses" | "bell";

export interface AgentDef {
  id: AgentId;
  name: string;
  /** Etiqueta corta para la insignia del panel. */
  label: string;
  costume: Costume;
  /** Color de acento (traje y chip). */
  accent: string;
  /** Se agrega al prompt base. */
  instructions: string;
  /** Herramientas que PUEDE llamar (nada más). */
  tools: readonly string[];
  /** Puede delegar en un especialista (profundidad máxima 1: los especialistas no delegan). */
  canDelegate: boolean;
  /** Niveles por defecto para esta agente. Solo pueden ser más estrictos o iguales que el global («ask»): se ignoran si intentan ampliar. */
  defaultLevels: Readonly<Record<string, ToolLevel>>;
  /** Modelo (se puede cambiar con GROQ_AGENT_MODEL). `undefined` = el predeterminado. */
  model?: string;
  /** false = no tiene chat: lo ejecuta el programador (función pura). */
  chat: boolean;
  /** Pantallas (primer segmento de la ruta) donde este agente es el activo por defecto. */
  screens: readonly string[];
  /** Palabras clave (sin tildes, minúsculas) para el enrutamiento barato. */
  keywords: readonly string[];
  /** Comandos de Telegram. */
  commands: readonly string[];
}

/** Modelo por defecto de los agentes (Groq, con herramientas). Se cambia con GROQ_AGENT_MODEL. */
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Modelo corto y barato para clasificar peticiones ambiguas y como respaldo ante un 429. */
export const CLASSIFIER_MODEL = "openai/gpt-oss-20b";

export const AGENTS: Record<AgentId, AgentDef> = {
  general: {
    id: "general",
    name: "General",
    label: "General",
    costume: "none",
    accent: "#f4f4f5",
    instructions:
      "Eres el agente GENERAL. Respondes consultas simples con tus herramientas de lectura. Cuando la petición es registrar o cambiar algo, o es de un área concreta (comidas/agua, tareas/notas, entrenamiento), la delegas con la herramienta `delegate` al especialista correcto, en vez de intentar hacerlo tú. Si no está claro qué quiere el usuario, pregunta.",
    tools: ["task_list", "note_list", "day_totals", "agenda_today", "training_today"],
    canDelegate: true,
    defaultLevels: {},
    chat: true,
    screens: [],
    keywords: [],
    commands: [],
  },
  nutricion: {
    id: "nutricion",
    name: "Nutrición",
    label: "Nutrición",
    costume: "chef",
    accent: "#34c759",
    instructions:
      "Eres el especialista en NUTRICIÓN: registras comida y agua y consultas totales del día. Si un alimento es ambiguo o no existe, no lo registres y pregunta cuál es; nunca crees alimentos. Usa la hora para inferir la comida si no la dicen.",
    tools: ["water_add", "food_log", "day_totals"],
    canDelegate: false,
    defaultLevels: {},
    chat: true,
    screens: ["gym:calorias"],
    keywords: ["agua", "ml", "vaso", "botella", "tome", "bebi", "comi", "comida", "desayun", "almuerz", "cena", "cene", "snack", "merienda", "caloria", "kcal", "proteina", "carbo", "macros", "alimento", "receta"],
    commands: ["comida", "nutricion", "agua"],
  },
  entrenamiento: {
    id: "entrenamiento",
    name: "Entrenamiento",
    label: "Entreno",
    costume: "sport",
    accent: "#ff9f0a",
    instructions:
      "Eres el especialista en ENTRENAMIENTO. Por ahora SOLO LECTURA: cuentas el plan del día, la rutina y los rangos del usuario. Si te piden cambiar un plan o registrar una serie, explica que eso se hace en la pantalla de Entrenamiento.",
    tools: ["training_today", "ranks_summary"],
    canDelegate: false,
    defaultLevels: {},
    chat: true,
    screens: ["gym:entrenamiento", "gym:kegel"],
    keywords: ["entren", "ejercicio", "rango", "rangos", "gym", "gimnasio", "musculo", "serie", "repeticion", "kegel", "pecho", "espalda", "pierna", "biceps", "triceps", "hombro"],
    commands: ["entreno", "entrenamiento", "gym"],
  },
  organizacion: {
    id: "organizacion",
    name: "Organización",
    label: "Organiza",
    costume: "glasses",
    accent: "#0a84ff",
    instructions:
      "Eres el especialista en ORGANIZACIÓN: tareas, subtareas y notas (crear, editar, completar); rutinas y calendario solo en lectura. Antes de editar o completar algo, consulta para conocer el id exacto. Los hábitos no se marcan desde aquí.",
    tools: ["task_list", "task_create", "task_update", "task_complete", "subtask_add", "subtask_complete", "note_list", "note_create", "note_update", "agenda_today"],
    canDelegate: false,
    defaultLevels: {},
    chat: true,
    screens: ["habitos"],
    keywords: ["tarea", "tareas", "subtarea", "nota", "notas", "pendiente", "pendientes", "agenda", "horario", "apunta", "anota", "recuerdame", "recordatorio", "rutina", "calendario", "lista", "checklist"],
    commands: ["tareas", "tarea", "notas", "nota", "organiza"],
  },
  recordatorios: {
    id: "recordatorios",
    name: "Recordatorios",
    label: "Avisos",
    costume: "bell",
    accent: "#a78bfa",
    instructions: "Sin chat: el programador decide qué avisar con la función pura `dueNotifications` (src/lib/agent/notifications.ts). No usa modelo ni herramientas.",
    tools: [],
    canDelegate: false,
    defaultLevels: {},
    chat: false,
    screens: [],
    keywords: [],
    commands: [],
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];
export const CHAT_AGENTS = AGENT_IDS.filter((id) => AGENTS[id].chat);
export const SPECIALISTS = CHAT_AGENTS.filter((id) => id !== "general");

export const isAgentId = (v: unknown): v is AgentId => typeof v === "string" && Object.prototype.hasOwnProperty.call(AGENTS, v);

/** ¿Puede este agente llamar esta herramienta? (mínimo privilegio) */
export function agentAllowsTool(agent: string | undefined, tool: string): boolean {
  if (!agent) return true;
  if (!isAgentId(agent)) return false;
  return AGENTS[agent].tools.includes(tool);
}

/** Esquema de la herramienta `delegate` (solo la ve quien puede delegar). No pasa por el registro: es enrutamiento, no acceso a datos. */
export const DELEGATE_SCHEMA = {
  type: "function" as const,
  function: {
    name: "delegate",
    description: "Pasa la petición a un agente especialista y devuelve su respuesta. Úsala cuando la petición sea de su área.",
    parameters: {
      type: "object",
      properties: {
        agent: { type: "string", enum: ["nutricion", "entrenamiento", "organizacion"] },
        request: { type: "string", description: "La petición del usuario, completa y autocontenida (con fechas ya resueltas)." },
      },
      required: ["agent", "request"],
      additionalProperties: false,
    },
  },
};
