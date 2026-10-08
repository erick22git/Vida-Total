/**
 * Barrera contra «repetir lo ya hecho»: si el usuario solo pregunta algo y el modelo propone una escritura idéntica a otra que
 * ya aparece en la conversación reciente, es una repetición por error (no una petición nueva). Función pura y con pruebas.
 */
import { getTool } from "./tools/registry";

export interface CallLike {
  function: { name: string; arguments: string };
}
export interface MsgLike {
  role: string;
  tool_calls?: CallLike[];
}

const QUESTION_START = /^(¿|cu[aá]nt|qu[eé](?=\s|$)|cu[aá]l|c[oó]mo|d[oó]nde|cu[aá]ndo|dime|dame|mu[eé]strame|p[aá]same|ens[eé][ñn]ame|tengo|hay\b|llevo|me faltan?)/i;

export function isQuestion(text: string): boolean {
  const t = text.trim();
  return t.includes("?") || QUESTION_START.test(t.replace(/^(ahora|y|entonces|oye|bueno)[\s,]+/i, ""));
}

function canonical(name: string, rawArgs: string): string {
  let args: unknown = {};
  try {
    args = rawArgs.trim() ? JSON.parse(rawArgs) : {};
  } catch {
    return `${name}|${rawArgs}`;
  }
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)])) : v;
  return `${name}|${JSON.stringify(sort(args))}`;
}

const isWrite = (name: string) => {
  const k = getTool(name)?.kind;
  return !!k && k !== "read";
};

/** Llamadas de escritura nuevas que repiten exactamente una ya hecha en `history`, cuando el mensaje actual es solo una pregunta. */
export function replayedWrites(calls: CallLike[], history: MsgLike[], userText: string): CallLike[] {
  if (!isQuestion(userText)) return [];
  const before = new Set<string>();
  for (const m of history) for (const c of m.tool_calls ?? []) if (isWrite(c.function.name)) before.add(canonical(c.function.name, c.function.arguments));
  return calls.filter((c) => isWrite(c.function.name) && before.has(canonical(c.function.name, c.function.arguments)));
}
