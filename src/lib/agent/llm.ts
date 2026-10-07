/**
 * Llamada al modelo (Groq, API compatible con OpenAI) con herramientas. SOLO SERVIDOR: usa GROQ_API_KEY, que nunca debe
 * llegar al navegador. Mismo proveedor que el escáner de comida (`/api/food/analyze`).
 *
 * Cada agente ve solo sus herramientas (`toolSchemas(agent)`). Cuenta las llamadas al proveedor y, ante un 429, degrada con
 * elegancia: espera si la pausa es corta, si no prueba un modelo más liviano una vez y, si tampoco, devuelve el tiempo de espera.
 */
import { AGENTS, CLASSIFIER_MODEL, DEFAULT_MODEL, DELEGATE_SCHEMA, type AgentId } from "./agents";
import { getTool } from "./tools/registry";

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** Qué pasó con el proveedor en esta llamada (para el contador). */
export interface LlmMeta {
  /** Peticiones HTTP hechas al proveedor (los reintentos cuentan). */
  calls: number;
  rateLimited: number;
  fallback: boolean;
}

export type LlmResult =
  | { ok: true; message: { content: string | null; tool_calls?: LlmToolCall[] }; meta: LlmMeta }
  | { ok: false; error: "no_api_key" | "rate_limit" | "timeout" | "bad_response" | "unknown"; retryAfterSec?: number; meta: LlmMeta };

export interface LlmOptions {
  agent?: AgentId;
  /** Fuerza el modelo (p. ej. el clasificador). */
  model?: string;
  /** Sin herramientas (clasificación). */
  noTools?: boolean;
  maxTokens?: number;
  /** Esfuerzo de razonamiento de los modelos gpt-oss (la clasificación usa "low"). */
  reasoning?: "low" | "medium" | "high";
}

const PLACEHOLDER_KEY = "TU_API_KEY_AQUI";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Modelo con herramientas disponible en Groq (revisado con GET /openai/v1/models; llama-3.3-70b ya no está). Se cambia con GROQ_AGENT_MODEL.
const TIMEOUT_MS = 25_000;
const MAX_WAIT_MS = 3000;

/** Herramientas que se le ofrecen a un agente: las suyas (que existan y estén expuestas) + `delegate` si puede delegar. */
export function toolSchemas(agent?: AgentId) {
  const def = agent ? AGENTS[agent] : null;
  const names = def ? def.tools : [];
  const list = names.flatMap((n) => {
    const t = getTool(n);
    return t && t.exposed ? [{ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }] : [];
  });
  return def?.canDelegate ? [...list, DELEGATE_SCHEMA] : list;
}

export const modelFor = (agent?: AgentId) => process.env.GROQ_AGENT_MODEL || (agent ? AGENTS[agent].model : undefined) || DEFAULT_MODEL;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(key: string, model: string, messages: LlmMessage[], opts: LlmOptions) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const tools = opts.noTools ? [] : toolSchemas(opts.agent);
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        temperature: 0.2,
        max_completion_tokens: opts.maxTokens ?? 900,
        ...(model.startsWith("openai/gpt-oss") && opts.reasoning ? { reasoning_effort: opts.reasoning } : {}),
      }),
      signal: ctrl.signal,
    });
    return { res, aborted: false as const };
  } catch (err) {
    return { res: null, aborted: err instanceof Error && err.name === "AbortError" };
  } finally {
    clearTimeout(timer);
  }
}

export async function callLlm(messages: LlmMessage[], opts: LlmOptions = {}): Promise<LlmResult> {
  const meta: LlmMeta = { calls: 0, rateLimited: 0, fallback: false };
  const key = process.env.GROQ_API_KEY;
  if (!key || key === PLACEHOLDER_KEY) return { ok: false, error: "no_api_key", meta };

  let model = opts.model ?? modelFor(opts.agent);
  let retryAfterSec: number | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    meta.calls++;
    const { res, aborted } = await once(key, model, messages, opts);
    if (!res) return { ok: false, error: aborted ? "timeout" : "unknown", meta };
    if (res.status === 429) {
      meta.rateLimited++;
      retryAfterSec = Number(res.headers.get("retry-after")) || undefined;
      // 1) pausa corta: esperar y reintentar el mismo modelo; 2) si no, un modelo más liviano (una sola vez); 3) avisar el tiempo.
      if (attempt === 0 && retryAfterSec !== undefined && retryAfterSec * 1000 <= MAX_WAIT_MS) {
        await sleep(retryAfterSec * 1000);
        continue;
      }
      if (!meta.fallback && model !== CLASSIFIER_MODEL) {
        meta.fallback = true;
        model = CLASSIFIER_MODEL;
        continue;
      }
      return { ok: false, error: "rate_limit", retryAfterSec, meta };
    }
    if (!res.ok) return { ok: false, error: "unknown", meta };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: LlmToolCall[] } }> };
    const msg = json.choices?.[0]?.message;
    if (!msg) return { ok: false, error: "bad_response", meta };
    return { ok: true, message: { content: msg.content ?? null, tool_calls: msg.tool_calls?.length ? msg.tool_calls : undefined }, meta };
  }
  return { ok: false, error: "rate_limit", retryAfterSec, meta };
}

/** Clasificación corta de una petición ambigua (modelo liviano, sin herramientas). Devuelve el texto o null. */
export async function classifyShort(prompt: string): Promise<{ text: string | null; meta: LlmMeta }> {
  const r = await callLlm([{ role: "user", content: prompt }], { model: CLASSIFIER_MODEL, noTools: true, maxTokens: 400, reasoning: "low" });
  return { text: r.ok ? r.message.content : null, meta: r.meta };
}

/** Parsea los argumentos de una llamada; texto vacío = {}. */
export function parseArgs(raw: string): { ok: true; args: Record<string, unknown> } | { ok: false } {
  if (!raw || !raw.trim()) return { ok: true, args: {} };
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? { ok: true, args: v as Record<string, unknown> } : { ok: false };
  } catch {
    return { ok: false };
  }
}
