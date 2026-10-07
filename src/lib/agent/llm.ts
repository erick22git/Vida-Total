/**
 * Llamada al modelo (Groq, API compatible con OpenAI) con herramientas. SOLO SERVIDOR: usa GROQ_API_KEY, que nunca debe
 * llegar al navegador. Mismo proveedor que el escáner de comida (`/api/food/analyze`).
 */
import { exposedTools } from "./tools/registry";

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

export type LlmResult =
  | { ok: true; message: { content: string | null; tool_calls?: LlmToolCall[] } }
  | { ok: false; error: "no_api_key" | "rate_limit" | "timeout" | "bad_response" | "unknown"; retryAfterSec?: number };

const PLACEHOLDER_KEY = "TU_API_KEY_AQUI";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 25_000;

export function toolSchemas() {
  return exposedTools().map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export async function callLlm(messages: LlmMessage[]): Promise<LlmResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === PLACEHOLDER_KEY) return { ok: false, error: "no_api_key" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_AGENT_MODEL || DEFAULT_MODEL,
        messages,
        tools: toolSchemas(),
        tool_choice: "auto",
        temperature: 0.2,
        max_completion_tokens: 900,
      }),
      signal: ctrl.signal,
    });
    if (res.status === 429) return { ok: false, error: "rate_limit", retryAfterSec: Number(res.headers.get("retry-after")) || undefined };
    if (!res.ok) return { ok: false, error: "unknown" };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: LlmToolCall[] } }> };
    const msg = json.choices?.[0]?.message;
    if (!msg) return { ok: false, error: "bad_response" };
    return { ok: true, message: { content: msg.content ?? null, tool_calls: msg.tool_calls?.length ? msg.tool_calls : undefined } };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "timeout" : "unknown" };
  } finally {
    clearTimeout(timer);
  }
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
