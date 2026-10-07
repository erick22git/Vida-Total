/**
 * Tipos compartidos del agente (mascota + Telegram). Módulo PURO: sin React, sin stores, sin red. Lo importan por igual el
 * servidor (rutas /api/agent, /api/telegram) y el cliente (pantalla de permisos, chat), porque los permisos se evalúan en
 * los dos lados: la interfaz nunca es la única barrera.
 */

/** Por dónde llega la orden. Telegram es más estricto por defecto. */
export type Channel = "app" | "telegram";
export const CHANNELS: Channel[] = ["app", "telegram"];

/**
 * De dónde sale la orden:
 *  - "user": lo escribió/dictó el usuario en este turno.
 *  - "untrusted": surgió después de leer un archivo, una nota, un mensaje ajeno o cualquier dato que no escribió el
 *    usuario ahora. Esos contenidos son DATOS, nunca instrucciones.
 */
export type Origin = "user" | "untrusted";

/** Módulos sobre los que puede actuar el agente. */
export type AgentModule = "tareas" | "notas" | "agua" | "comidas" | "habitos" | "sistema";
export const AGENT_MODULES: AgentModule[] = ["tareas", "notas", "agua", "comidas", "habitos", "sistema"];
export const MODULE_LABEL: Record<AgentModule, string> = {
  tareas: "Tareas",
  notas: "Notas",
  agua: "Agua",
  comidas: "Comidas y calorías",
  habitos: "Hábitos",
  sistema: "Sistema",
};

/** read = solo consulta · write = crea/edita · destructive = borra · config = toca permisos/ajustes/vínculos. */
export type ToolKind = "read" | "write" | "destructive" | "config";

/** Nivel por herramienta. Por defecto "ask". */
export type ToolLevel = "ask" | "allow" | "block";

/**
 * Modos globales:
 *  - ask_always: solo se hace sin preguntar lo que marcaste "permitir siempre"; todo lo demás pregunta (incluye lecturas).
 *  - auto_safe: igual, pero las lecturas pasan solas.
 *  - auto_total: "saltar permisos". Solo en la app, con advertencia + duración; la lista "nunca automático" sigue vigente.
 * `auto_total` no se guarda como modo: es un estado aparte (`AutoTotalState`) que caduca.
 */
export type AgentMode = "ask_always" | "auto_safe";
export type EffectiveMode = AgentMode | "auto_total";

export type AutoTotalDuration = "session" | "hour" | "until_off";
export interface AutoTotalState {
  duration: AutoTotalDuration;
  startedAt: number;
  /** Id de la sesión de la pestaña/app que lo activó (solo para duration = "session"). */
  sessionId: string;
}

export interface QuietHours {
  enabled: boolean;
  /** "HH:mm" (hora local del usuario). */
  from: string;
  to: string;
}

export interface Limits {
  /** Agua máxima por acción (ml). */
  waterMaxMl: number;
  /** Calorías máximas por entrada de comida. */
  caloriesMaxPerEntry: number;
  /** Más de N elementos en una misma acción = por lotes = nunca automático. */
  maxBatch: number;
}

export interface ChannelPolicy {
  enabled: boolean;
  /** Solo lectura en este canal. */
  readOnly: boolean;
  /** Techo del modo en este canal (Telegram: nunca auto_total). */
  maxMode: AgentMode;
}

export interface NotificationPrefs {
  /** Interruptor general (apagado por defecto: nada se envía hasta que lo actives). */
  enabled: boolean;
  /** Avisos dentro de la app (cuando está abierta). */
  inApp: boolean;
  /** Avisos por Telegram (solo a quien ya vinculó el bot y escribió primero). */
  telegram: boolean;
  types: { tasks: boolean; routines: boolean; water: boolean; meals: boolean; summary: boolean };
  /** Horas "HH:mm" a las que se espera cada comida. */
  mealTimes: { desayuno: string; almuerzo: string; cena: string };
  /** Hora del resumen diario. */
  summaryTime: string;
  /** Mínimo de minutos entre avisos de agua. */
  waterEveryMin: number;
  /** Cuántos minutos antes de un paso de rutina se avisa. */
  routineLeadMin: number;
  /** Tope de avisos por día (todos los tipos). */
  maxPerDay: number;
}

export interface AgentConfig {
  version: 1;
  mode: AgentMode;
  autoTotal: AutoTotalState | null;
  /** Apagado total: el agente no hace nada (ni lee) en ningún canal. */
  killSwitch: boolean;
  /** Solo lectura en todos los canales. */
  readOnly: boolean;
  allowedModules: AgentModule[];
  limits: Limits;
  /** Tope de escrituras del agente (suma de canales). */
  writesPerHour: number;
  writesPerDay: number;
  quietHours: QuietHours;
  /** Zona horaria IANA del usuario (la fija la app). El servidor la usa para saber qué día y qué hora es para el usuario. */
  timezone: string;
  notifications: NotificationPrefs;
  channels: Record<Channel, ChannelPolicy>;
  /** Nivel por herramienta y canal. Lo que falte = "ask". */
  levels: Record<Channel, Record<string, ToolLevel>>;
}

export type Decision =
  | { action: "allow"; reasons: string[] }
  | { action: "ask"; reasons: string[]; canAlways: boolean }
  | { action: "deny"; reasons: string[] };

/** Respuesta del usuario a un permiso (como en Claude Code). */
export type PermissionAnswer = "allow_once" | "allow_always" | "deny";

/** Quién ejecuta la herramienta: la app (stores locales) o el servidor (Telegram / programador). */
export interface PermissionContext {
  channel: Channel;
  origin: Origin;
  config: AgentConfig;
  now: number;
  /** Marcas de tiempo (ms) de escrituras ya hechas por el agente, para los topes. */
  recentWrites: number[];
  /** Id de sesión actual (para comprobar `autoTotal.duration === "session"`). */
  sessionId?: string;
  /** Cuántas acciones en total trae la propuesta del agente en este turno (para "por lotes"). */
  batchSize?: number;
}
