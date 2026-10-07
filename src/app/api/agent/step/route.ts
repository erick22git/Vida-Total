import { NextResponse } from "next/server";
import { callLlm, parseArgs, type LlmMessage } from "@/lib/agent/llm";
import { sanitizeMessages, turnOrigin } from "@/lib/agent/messages";
import { decide } from "@/lib/agent/permissions";
import { sanitizeConfig } from "@/lib/agent/config";
import { buildSystemPrompt, WEEKDAYS_ES } from "@/lib/agent/prompt";
import { getTool } from "@/lib/agent/tools/registry";
import type { AutoTotalState, Decision } from "@/lib/agent/types";
import { createClient } from "@/lib/supabase/server";

// Un turno del agente en la APP: el servidor llama al modelo y devuelve su respuesta (texto y/o llamadas a herramientas)
// con la decisión de permisos de cada llamada calculada AQUÍ con la configuración guardada del usuario. La app aplica las
// herramientas con sus stores (el estado vive en el dispositivo) y vuelve a evaluar los permisos antes de ejecutar.
//
// Request:  { messages: [...], client: { now: ISO, tzOffsetMin, sessionId, recentWrites: number[], autoTotal?: AutoTotalState } }
// Response: { text, assistant, calls: [{ id, name, args, error?, decision }], origin }  |  { error }

export const maxDuration = 30;

// Freno por usuario (en memoria, por instancia): protege la clave del modelo de un bucle o abuso.
const hits = new Map<string, number[]>();
function tooMany(userId: string): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(userId, list);
  return list.length > 30;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(req: Request) {
  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (tooMany(userId)) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isObj(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const messages = sanitizeMessages(body.messages);
  if (!messages) return NextResponse.json({ error: "invalid_messages" }, { status: 400 });
  const client = isObj(body.client) ? body.client : {};

  // Configuración guardada del usuario (saneada; sin tabla = por defecto). El "Auto total" es del dispositivo: se acepta
  // solo la forma válida que manda la app y solo cuenta para el canal "app".
  let stored: unknown = null;
  try {
    const { data } = await supabase.from("agent_settings").select("config").eq("user_id", userId).maybeSingle();
    stored = data?.config ?? null;
  } catch {
    stored = null;
  }
  const config = sanitizeConfig(stored);
  const claimed = sanitizeConfig({ autoTotal: client.autoTotal }).autoTotal as AutoTotalState | null;
  config.autoTotal = claimed;

  const tzOffsetMin = typeof client.tzOffsetMin === "number" && Math.abs(client.tzOffsetMin) <= 14 * 60 ? client.tzOffsetMin : 0;
  const nowMs = typeof client.now === "string" && !Number.isNaN(Date.parse(client.now)) ? Date.parse(client.now) : Date.now();
  const local = new Date(nowMs - tzOffsetMin * 60_000); // tzOffsetMin = Date#getTimezoneOffset() (UTC - local)
  const iso = local.toISOString();
  const system: LlmMessage = {
    role: "system",
    content: buildSystemPrompt({ today: iso.slice(0, 10), time: iso.slice(11, 16), weekday: WEEKDAYS_ES[local.getUTCDay()], channel: "app" }),
  };

  const res = await callLlm([system, ...messages]);
  if (!res.ok) return NextResponse.json({ error: res.error, retryAfterSec: res.retryAfterSec }, { status: res.error === "rate_limit" ? 429 : 502 });

  const origin = turnOrigin(messages);
  const recentWrites = Array.isArray(client.recentWrites) ? client.recentWrites.filter((t): t is number => typeof t === "number").slice(0, 700) : [];
  const sessionId = typeof client.sessionId === "string" ? client.sessionId.slice(0, 64) : undefined;
  const rawCalls = res.message.tool_calls ?? [];
  const writes = rawCalls.filter((c) => getTool(c.function.name)?.kind !== "read").length;

  const calls = rawCalls.map((c) => {
    const parsed = parseArgs(c.function.arguments);
    if (!parsed.ok) {
      const decision: Decision = { action: "deny", reasons: ["Argumentos inválidos."] };
      return { id: c.id, name: c.function.name, args: {}, error: "Argumentos inválidos.", decision };
    }
    const decision = decide(c.function.name, parsed.args, { channel: "app", origin, config, now: Date.now(), recentWrites, sessionId, batchSize: writes });
    return { id: c.id, name: c.function.name, args: parsed.args, decision };
  });

  return NextResponse.json({ text: res.message.content ?? "", assistant: { role: "assistant", content: res.message.content, tool_calls: res.message.tool_calls }, calls, origin });
}
