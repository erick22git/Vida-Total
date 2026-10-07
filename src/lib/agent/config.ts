/**
 * Configuración del agente: valores por defecto, saneamiento (el servidor NUNCA confía en lo que guarda el cliente: lo
 * recorta y lo rellena) y ayudantes puros (modo efectivo, "Auto total" con caducidad, horario silencioso, topes).
 */
import {
  DEFAULT_MAX_BATCH,
  HARD_MAX_BATCH,
  HARD_MAX_WRITES_PER_DAY,
  HARD_MAX_WRITES_PER_HOUR,
} from "./never-auto";
import {
  AGENT_MODULES,
  CHANNELS,
  type AgentConfig,
  type AgentMode,
  type AgentModule,
  type AutoTotalDuration,
  type AutoTotalState,
  type NotificationPrefs,
  type Channel,
  type EffectiveMode,
  type ToolLevel,
} from "./types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    enabled: false,
    inApp: true,
    telegram: true,
    types: { tasks: true, routines: true, water: false, meals: false, summary: false },
    mealTimes: { desayuno: "09:30", almuerzo: "14:30", cena: "21:00" },
    summaryTime: "21:30",
    waterEveryMin: 150,
    routineLeadMin: 10,
    maxPerDay: 10,
  };
}

export function defaultAgentConfig(): AgentConfig {
  return {
    version: 1,
    mode: "ask_always",
    autoTotal: null,
    killSwitch: false,
    readOnly: false,
    allowedModules: AGENT_MODULES.filter((m) => m !== "sistema"),
    limits: { waterMaxMl: 1500, caloriesMaxPerEntry: 1500, maxBatch: DEFAULT_MAX_BATCH },
    writesPerHour: 30,
    writesPerDay: 150,
    quietHours: { enabled: true, from: "22:30", to: "07:00" },
    timezone: "UTC",
    notifications: defaultNotificationPrefs(),
    channels: {
      app: { enabled: true, readOnly: false, maxMode: "auto_safe" },
      // Telegram, más estricto: todo pregunta salvo lo que permitas para ese canal.
      telegram: { enabled: false, readOnly: false, maxMode: "ask_always" },
    },
    levels: { app: {}, telegram: {} },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};
const isHHmm = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const isMode = (v: unknown): v is AgentMode => v === "ask_always" || v === "auto_safe";
const isLevel = (v: unknown): v is ToolLevel => v === "ask" || v === "allow" || v === "block";

/**
 * Sanea una configuración que viene de afuera (localStorage, Supabase, el cuerpo de una petición). Es un "merge seguro":
 * lo desconocido se ignora, lo que falta toma el valor por defecto y los números se recortan a sus topes duros.
 * El modo `auto_total` nunca sale de aquí para Telegram (`maxMode` es solo ask_always/auto_safe por tipo).
 */
function sanitizeNotifications(raw: unknown): NotificationPrefs {
  const d = defaultNotificationPrefs();
  if (!isObj(raw)) return d;
  const ty = isObj(raw.types) ? raw.types : {};
  const mt = isObj(raw.mealTimes) ? raw.mealTimes : {};
  return {
    enabled: bool(raw.enabled, d.enabled),
    inApp: bool(raw.inApp, d.inApp),
    telegram: bool(raw.telegram, d.telegram),
    types: {
      tasks: bool(ty.tasks, d.types.tasks),
      routines: bool(ty.routines, d.types.routines),
      water: bool(ty.water, d.types.water),
      meals: bool(ty.meals, d.types.meals),
      summary: bool(ty.summary, d.types.summary),
    },
    mealTimes: {
      desayuno: isHHmm(mt.desayuno) ? mt.desayuno : d.mealTimes.desayuno,
      almuerzo: isHHmm(mt.almuerzo) ? mt.almuerzo : d.mealTimes.almuerzo,
      cena: isHHmm(mt.cena) ? mt.cena : d.mealTimes.cena,
    },
    summaryTime: isHHmm(raw.summaryTime) ? raw.summaryTime : d.summaryTime,
    waterEveryMin: clampInt(raw.waterEveryMin, 60, 480, d.waterEveryMin),
    routineLeadMin: clampInt(raw.routineLeadMin, 0, 60, d.routineLeadMin),
    maxPerDay: clampInt(raw.maxPerDay, 1, 30, d.maxPerDay),
  };
}

export function sanitizeConfig(raw: unknown): AgentConfig {
  const d = defaultAgentConfig();
  if (!isObj(raw)) return d;

  const lim = isObj(raw.limits) ? raw.limits : {};
  const qh = isObj(raw.quietHours) ? raw.quietHours : {};
  const chs = isObj(raw.channels) ? raw.channels : {};
  const lvs = isObj(raw.levels) ? raw.levels : {};

  const channels = {} as AgentConfig["channels"];
  const levels = {} as AgentConfig["levels"];
  for (const c of CHANNELS) {
    const src = isObj(chs[c]) ? (chs[c] as Record<string, unknown>) : {};
    channels[c] = {
      enabled: bool(src.enabled, d.channels[c].enabled),
      readOnly: bool(src.readOnly, d.channels[c].readOnly),
      maxMode: isMode(src.maxMode) ? src.maxMode : d.channels[c].maxMode,
    };
    const l: Record<string, ToolLevel> = {};
    const srcLv = isObj(lvs[c]) ? (lvs[c] as Record<string, unknown>) : {};
    for (const [tool, lv] of Object.entries(srcLv)) if (isLevel(lv) && tool.length <= 64) l[tool] = lv;
    levels[c] = l;
  }

  let autoTotal: AutoTotalState | null = null;
  if (isObj(raw.autoTotal)) {
    const a = raw.autoTotal;
    const dur = a.duration;
    if ((dur === "session" || dur === "hour" || dur === "until_off") && typeof a.startedAt === "number" && typeof a.sessionId === "string") {
      autoTotal = { duration: dur as AutoTotalDuration, startedAt: a.startedAt, sessionId: a.sessionId.slice(0, 64) };
    }
  }

  const modulesRaw = Array.isArray(raw.allowedModules) ? raw.allowedModules : d.allowedModules;
  const allowedModules = AGENT_MODULES.filter((m) => (modulesRaw as unknown[]).includes(m));

  return {
    version: 1,
    mode: isMode(raw.mode) ? raw.mode : d.mode,
    autoTotal,
    killSwitch: bool(raw.killSwitch, false),
    readOnly: bool(raw.readOnly, false),
    allowedModules,
    limits: {
      waterMaxMl: clampInt(lim.waterMaxMl, 50, 5000, d.limits.waterMaxMl),
      caloriesMaxPerEntry: clampInt(lim.caloriesMaxPerEntry, 50, 5000, d.limits.caloriesMaxPerEntry),
      maxBatch: clampInt(lim.maxBatch, 1, HARD_MAX_BATCH, d.limits.maxBatch),
    },
    writesPerHour: clampInt(raw.writesPerHour, 1, HARD_MAX_WRITES_PER_HOUR, d.writesPerHour),
    writesPerDay: clampInt(raw.writesPerDay, 1, HARD_MAX_WRITES_PER_DAY, d.writesPerDay),
    quietHours: {
      enabled: bool(qh.enabled, d.quietHours.enabled),
      from: isHHmm(qh.from) ? qh.from : d.quietHours.from,
      to: isHHmm(qh.to) ? qh.to : d.quietHours.to,
    },
    timezone: isValidTimeZone(raw.timezone) ? raw.timezone : d.timezone,
    notifications: sanitizeNotifications(raw.notifications),
    channels,
    levels,
  };
}

// ───────────── Auto total ─────────────

/** ¿Sigue vigente el "Auto total"? Caduca solo (1 hora) o al cambiar de sesión; "hasta que lo apague" no caduca. */
export function isAutoTotalActive(cfg: AgentConfig, now: number, sessionId?: string): boolean {
  const a = cfg.autoTotal;
  if (!a) return false;
  if (a.duration === "until_off") return true;
  if (a.duration === "hour") return now >= a.startedAt && now - a.startedAt < HOUR_MS;
  return !!sessionId && a.sessionId === sessionId;
}

/** Milisegundos que le quedan (solo para "1 hora"); null si no caduca por tiempo. */
export function autoTotalRemainingMs(cfg: AgentConfig, now: number): number | null {
  const a = cfg.autoTotal;
  if (!a || a.duration !== "hour") return null;
  return Math.max(0, HOUR_MS - (now - a.startedAt));
}

/**
 * Modo efectivo en un canal. `auto_total` solo existe en la app, solo mientras esté vigente, y el techo del canal
 * (`maxMode`) limita al resto. Telegram nunca llega a auto_total.
 */
export function effectiveMode(cfg: AgentConfig, channel: Channel, now: number, sessionId?: string): EffectiveMode {
  if (channel === "app" && isAutoTotalActive(cfg, now, sessionId)) return "auto_total";
  const cap = cfg.channels[channel].maxMode;
  return cfg.mode === "auto_safe" && cap === "auto_safe" ? "auto_safe" : "ask_always";
}

export function levelFor(cfg: AgentConfig, channel: Channel, tool: string): ToolLevel {
  return cfg.levels[channel][tool] ?? "ask";
}

export function moduleAllowed(cfg: AgentConfig, module: AgentModule): boolean {
  return cfg.allowedModules.includes(module);
}

// ───────────── Horario silencioso y topes ─────────────

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** ¿`minutesFromMidnight` (hora local) cae en el horario silencioso? Soporta rangos que cruzan la medianoche (22:30–07:00). */
export function isQuietMinute(cfg: AgentConfig, minutesFromMidnight: number): boolean {
  const q = cfg.quietHours;
  if (!q.enabled) return false;
  const from = minutesOf(q.from);
  const to = minutesOf(q.to);
  if (from === to) return false;
  return from < to ? minutesFromMidnight >= from && minutesFromMidnight < to : minutesFromMidnight >= from || minutesFromMidnight < to;
}

export function isQuietTime(cfg: AgentConfig, date: Date): boolean {
  return isQuietMinute(cfg, date.getHours() * 60 + date.getMinutes());
}

/** Topes de escrituras. `recent` = marcas de tiempo (ms) de las escrituras ya hechas. */
export function writeLimitHit(cfg: AgentConfig, recent: number[], now: number): "hour" | "day" | null {
  const inHour = recent.filter((t) => now - t < HOUR_MS).length;
  if (inHour >= cfg.writesPerHour) return "hour";
  const inDay = recent.filter((t) => now - t < DAY_MS).length;
  if (inDay >= cfg.writesPerDay) return "day";
  return null;
}
