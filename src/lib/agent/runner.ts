"use client";

/**
 * Bucle del agente EN LA APP. Un turno: el servidor llama al modelo (`/api/agent/step`) y devuelve texto y/o llamadas a
 * herramientas con su decisión de permisos; aquí se vuelve a evaluar con la configuración local (gana la más estricta),
 * se arma el plan, se le muestra al usuario si hace falta, se ejecuta con las acciones de los stores y el resultado vuelve
 * al modelo hasta que responde sin más herramientas.
 */
import { useAgentStore, getAgentSessionId } from "@/lib/store/agentStore";
import { writeTimestamps, type ActionRecord } from "./history";
import { buildPlan, planNeedsReview, type Plan, type PlanStep } from "./plan";
import { decide } from "./permissions";
import type { LlmMessage, LlmToolCall } from "./llm";
import { executeClient, previewClient, type ExecResult } from "./actions/client";
import { newId } from "./actions/pure";
import { TOOLS, getTool } from "./tools/registry";
import type { Decision, Origin } from "./types";
import { AGENTS, type AgentId } from "./agents";

export type ChatEntry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; agent?: AgentId }
  | { id: string; kind: "result"; ok: boolean; text: string }
  | { id: string; kind: "error"; text: string };

export interface RunOptions {
  /** "auto" = el servidor enruta; o un agente fijado por el usuario. */
  agent?: AgentId | "auto";
  /** Clave de la pantalla actual (ver `screenKey`), para el enrutamiento. */
  screen?: string;
  /** La orden viene de contenido no confiable (delegación tras leer datos). */
  untrusted?: boolean;
  /** Profundidad de delegación: 0 = turno del usuario; 1 = especialista delegado (no puede delegar). */
  depth?: number;
  /** Avisa qué agente quedó activo (para mostrar su traje). */
  onAgent?: (agent: AgentId) => void;
}

export interface RunnerUi {
  /** Muestra el plan y devuelve el plan con cada paso aprobado u omitido por el usuario. */
  review: (plan: Plan) => Promise<Plan>;
  push: (entry: ChatEntry) => void;
}

const MAX_ITERATIONS = 5;
const READ_TOOLS: ReadonlySet<string> = new Set(Object.values(TOOLS).filter((t) => t.kind === "read").map((t) => t.name));

const RANK = { allow: 0, ask: 1, deny: 2 } as const;
/** La decisión más estricta entre la del servidor y la local. */
export function stricter(a: Decision, b: Decision): Decision {
  return RANK[a.action] >= RANK[b.action] ? a : b;
}

interface StepResponse {
  agent: AgentId;
  routedBy?: string;
  text: string;
  assistant: { role: "assistant"; content: string | null; tool_calls?: LlmToolCall[] };
  calls: Array<{ id: string; name: string; args: Record<string, unknown>; error?: string; decision: Decision; delegate?: { agent: AgentId; request: string } }>;
  origin: Origin;
  error?: string;
  retryAfterSec?: number;
}

const ERRORS: Record<string, string> = {
  no_api_key: "Falta configurar la clave del modelo en el servidor (GROQ_API_KEY).",
  rate_limit: "El proveedor del modelo está al límite. Espera un momento y vuelve a intentar.",
  timeout: "El modelo tardó demasiado. Intenta de nuevo.",
  unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

function toolResultContent(r: ExecResult): string {
  const body = JSON.stringify({ ok: r.ok, summary: r.summary, ...(r.data !== undefined ? { data: r.data } : {}) });
  return body.length > 6000 ? body.slice(0, 6000) + "…(recortado)" : body;
}

export async function runAgentTurn(userText: string, prior: LlmMessage[], ui: RunnerUi, signal?: AbortSignal, opts: RunOptions = {}): Promise<LlmMessage[]> {
  let agent: AgentId | "auto" = opts.agent ?? "auto";
  const depth = opts.depth ?? 0;
  const store = useAgentStore;
  const messages: LlmMessage[] = [...prior, { role: "user", content: userText }];
  if (depth === 0) ui.push({ id: newId(), kind: "user", text: userText });

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const st = store.getState();
    let data: StepResponse;
    try {
      const res = await fetch("/api/agent/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          messages,
          agent,
          screen: opts.screen,
          untrusted: opts.untrusted === true,
          client: {
            now: new Date().toISOString(),
            tzOffsetMin: new Date().getTimezoneOffset(),
            sessionId: getAgentSessionId(),
            recentWrites: writeTimestamps(st.history, READ_TOOLS),
            autoTotal: st.config.autoTotal,
          },
        }),
      });
      data = (await res.json()) as StepResponse;
      if (!res.ok || data.error) {
        const wait = data.retryAfterSec ? ` (prueba en ~${data.retryAfterSec} s)` : "";
        ui.push({ id: newId(), kind: "error", text: (ERRORS[data.error ?? ""] ?? "No pude hablar con el asistente. Intenta de nuevo.") + (data.error === "rate_limit" ? wait : "") });
        return messages;
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") ui.push({ id: newId(), kind: "error", text: "Sin conexión con el asistente." });
      return messages;
    }

    agent = data.agent;
    opts.onAgent?.(data.agent);
    messages.push({ role: "assistant", content: data.assistant.content, tool_calls: data.assistant.tool_calls });
    if (data.text.trim()) ui.push({ id: newId(), kind: "assistant", text: data.text.trim(), agent: data.agent });
    if (data.calls.length === 0) return messages;

    // Delegación (solo General, profundidad máxima 1): el especialista corre su propio turno y su respuesta vuelve como resultado de la herramienta.
    const delegations = data.calls.filter((c) => c.name === "delegate");
    for (const d of delegations) {
      let content: string;
      if (depth >= 1 || !d.delegate || d.decision.action !== "allow") {
        content = JSON.stringify({ ok: false, summary: "Delegación no permitida." });
      } else {
        opts.onAgent?.(d.delegate.agent);
        const sub = await runAgentTurn(d.delegate.request, [], ui, signal, { agent: d.delegate.agent, screen: opts.screen, untrusted: data.origin === "untrusted" || opts.untrusted, depth: 1, onAgent: opts.onAgent });
        const last = [...sub].reverse().find((m) => m.role === "assistant" && m.content)?.content ?? "";
        content = JSON.stringify({ ok: true, agente: AGENTS[d.delegate.agent].name, respuesta: last.slice(0, 1500) });
        opts.onAgent?.("general");
      }
      messages.push({ role: "tool", tool_call_id: d.id, name: "delegate", content });
    }
    data.calls = data.calls.filter((c) => c.name !== "delegate");
    if (data.calls.length === 0) continue;

    // Plan con la política LOCAL (la configuración de este dispositivo manda) y la del servidor: gana la más estricta.
    const cur = store.getState();
    const base = buildPlan(newId(), data.calls.map((c) => ({ id: c.id, tool: c.name, args: c.args })), {
      channel: "app",
      origin: data.origin,
      config: cur.config,
      now: Date.now(),
      recentWrites: writeTimestamps(cur.history, READ_TOOLS),
      sessionId: getAgentSessionId(),
      agent: data.agent,
    });
    const serverBy = new Map(data.calls.map((c) => [c.id, c]));
    let plan: Plan = {
      ...base,
      steps: base.steps.map((s): PlanStep => {
        const server = serverBy.get(s.id);
        const decision = server ? stricter(s.decision, server.decision) : s.decision;
        return { ...s, decision, status: decision.action === "deny" ? "denied" : "pending" };
      }),
    };
    for (const s of plan.steps) {
      const p = previewClient(s.tool, s.args);
      if (p) { s.before = p.before; s.after = p.after; }
    }

    const reviewed = planNeedsReview(plan);
    if (reviewed) plan = await ui.review(plan);

    // Ejecutar en orden. Las herramientas de lectura devuelven datos al modelo; las demás, su resumen.
    for (const step of plan.steps) {
      const call: LlmToolCall | undefined = data.assistant.tool_calls?.find((c) => c.id === step.id);
      if (!call) continue;
      const toolName = call.function.name;
      let content: string;
      const runnable = step.status === "approved" || (!reviewed && step.status === "pending" && step.decision.action === "allow");
      if (step.status === "denied" || step.decision.action === "deny") {
        content = JSON.stringify({ ok: false, summary: `No permitido: ${step.decision.reasons.join(" ")}` });
        ui.push({ id: newId(), kind: "result", ok: false, text: `${step.label}: no permitido (${step.decision.reasons.join(" ")})` });
      } else if (!runnable) {
        content = JSON.stringify({ ok: false, summary: "El usuario no aprobó esta acción." });
        ui.push({ id: newId(), kind: "result", ok: false, text: `${step.label}: omitida` });
      } else {
        // Última barrera: un paso aprobado vuelve a pasar por la lista "nunca automático" y los topes antes de ejecutarse.
        const recheck = decide(toolName, step.args, {
          channel: "app",
          origin: data.origin,
          config: store.getState().config,
          now: Date.now(),
          recentWrites: writeTimestamps(store.getState().history, READ_TOOLS),
          sessionId: getAgentSessionId(),
          batchSize: plan.steps.filter((x) => getTool(x.tool)?.kind !== "read").length,
          agent: data.agent,
        });
        if (recheck.action === "deny") {
          content = JSON.stringify({ ok: false, summary: `No permitido: ${recheck.reasons.join(" ")}` });
          ui.push({ id: newId(), kind: "result", ok: false, text: `${step.label}: no permitido (${recheck.reasons.join(" ")})` });
        } else {
          const result = executeClient(toolName, step.args);
          content = toolResultContent(result);
          const kind = getTool(toolName)?.kind;
          if (kind !== "read" || !result.ok) {
            const rec: ActionRecord = { id: newId(), at: Date.now(), channel: "app", tool: toolName, args: step.args, summary: result.summary, ok: result.ok, undo: result.undo };
            store.getState().record(rec);
          }
          if (kind !== "read") ui.push({ id: newId(), kind: "result", ok: result.ok, text: result.summary });
        }
      }
      messages.push({ role: "tool", tool_call_id: step.id, name: toolName, content });
    }
  }
  ui.push({ id: newId(), kind: "error", text: "Me detuve para no dar vueltas. Dime qué sigue." });
  return messages;
}
