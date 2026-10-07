/**
 * Descripción de una herramienta del agente (solo metadatos + validación). Sin stores ni red: la comparten el servidor
 * y el cliente. Lo que HACE cada herramienta vive aparte (`actions/`), así los permisos nunca dependen de la UI.
 */
import type { NeverAutoCode } from "../never-auto";
import type { AgentModule, Limits, ToolKind } from "../types";

export type Args = Record<string, unknown>;
export type Validation = { ok: true; args: Args } | { ok: false; error: string };

export interface ToolMeta {
  name: string;
  module: AgentModule;
  /** Nombre corto para la pantalla de permisos. */
  label: string;
  /** Descripción que ve el modelo. */
  description: string;
  kind: ToolKind;
  /** Si se ofrece al modelo. Las que no, solo existen para que la política las trate (y las pruebas). */
  exposed: boolean;
  /** Reglas "nunca automático" propias de la herramienta. */
  neverAuto?: NeverAutoCode[];
  /** JSON Schema de los parámetros (formato de herramientas de OpenAI/Groq). */
  parameters: Record<string, unknown>;
  validate: (raw: unknown) => Validation;
  /** Lo que devuelve contiene datos del usuario/ajenos (notas, tareas, mensajes): desde ahí el turno queda "no confiable". */
  taints?: boolean;
  /** Cuántos elementos toca esta llamada (para "por lotes"). Default 1. */
  batchSize?: (args: Args) => number;
  /** Devuelve un mensaje si la llamada supera un límite configurable (agua máx., calorías máx.). */
  limitCheck?: (args: Args, limits: Limits) => string | null;
}

// ───────────── Validadores ─────────────
const isObj = (v: unknown): v is Args => typeof v === "object" && v !== null && !Array.isArray(v);

export function asArgs(raw: unknown): Args | null {
  return isObj(raw) ? raw : null;
}

export function reqString(a: Args, key: string, max = 200): string | { error: string } {
  const v = a[key];
  if (typeof v !== "string" || v.trim() === "") return { error: `Falta "${key}".` };
  if (v.length > max) return { error: `"${key}" es demasiado largo (máx. ${max}).` };
  return v.trim();
}

export function optString(a: Args, key: string, max = 2000): string | undefined | { error: string } {
  const v = a[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return { error: `"${key}" debe ser texto.` };
  if (v.length > max) return { error: `"${key}" es demasiado largo (máx. ${max}).` };
  return v;
}

export function optNumber(a: Args, key: string, min: number, max: number): number | undefined | { error: string } {
  const v = a[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return { error: `"${key}" debe ser un número entre ${min} y ${max}.` };
  return v;
}

export function reqNumber(a: Args, key: string, min: number, max: number): number | { error: string } {
  const r = optNumber(a, key, min, max);
  if (r === undefined) return { error: `Falta "${key}".` };
  return r;
}

export const isErr = (v: unknown): v is { error: string } => typeof v === "object" && v !== null && "error" in v;

/** yyyy-MM-dd válida. */
export function isDayKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isHHmm(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Texto opcional ya recortado; "" cuenta como ausente. */
export function optText(a: Args, key: string, max = 2000): string | undefined | { error: string } {
  const r = optString(a, key, max);
  if (isErr(r)) return r;
  return r === undefined || r.trim() === "" ? undefined : r.trim();
}
