/** Saneamiento de mensajes que llegan de afuera (cuerpo de una petición) y cálculo del origen de la orden. PURO. */
import type { LlmMessage, LlmToolCall } from "./llm";
import { getTool } from "./tools/registry";
import type { Origin } from "./types";

export const MAX_MESSAGES = 40;
const MAX_CONTENT = 8000;
const MAX_TOOL_CALLS = 8;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanCalls(raw: unknown): LlmToolCall[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: LlmToolCall[] = [];
  for (const c of raw.slice(0, MAX_TOOL_CALLS)) {
    if (!isObj(c) || !isObj(c.function)) continue;
    const id = typeof c.id === "string" ? c.id.slice(0, 64) : "";
    const name = typeof c.function.name === "string" ? c.function.name.slice(0, 64) : "";
    const args = typeof c.function.arguments === "string" ? c.function.arguments.slice(0, MAX_CONTENT) : "{}";
    if (id && name) out.push({ id, type: "function", function: { name, arguments: args } });
  }
  return out.length ? out : undefined;
}

/** Valida y recorta el historial que manda el cliente. El mensaje "system" lo pone SIEMPRE el servidor (se descarta el del cliente). */
export function sanitizeMessages(raw: unknown): LlmMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const out: LlmMessage[] = [];
  for (const m of raw) {
    if (!isObj(m)) return null;
    const role = m.role;
    if (role !== "user" && role !== "assistant" && role !== "tool") continue;
    const content = typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT) : null;
    if (role === "user" && !content?.trim()) return null;
    if (role === "tool") {
      const id = typeof m.tool_call_id === "string" ? m.tool_call_id.slice(0, 64) : "";
      const name = typeof m.name === "string" ? m.name.slice(0, 64) : "";
      if (!id || !name) return null;
      out.push({ role, content: content ?? "", tool_call_id: id, name });
    } else if (role === "assistant") {
      out.push({ role, content, tool_calls: cleanCalls(m.tool_calls) });
    } else {
      out.push({ role, content });
    }
  }
  return out.length && out[out.length - 1].role !== "assistant" ? out : null;
}

/**
 * Origen de la orden que el modelo propone ahora: si desde el último mensaje del usuario se leyó contenido de datos
 * (resultado de una herramienta que "contamina": notas, tareas, mensajes) la orden es "no confiable". El servidor lo
 * calcula; nunca se fía de un valor que mande el cliente.
 */
export function turnOrigin(messages: LlmMessage[]): Origin {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") return "user";
    if (m.role === "tool" && m.name && getTool(m.name)?.taints) return "untrusted";
  }
  return "user";
}
