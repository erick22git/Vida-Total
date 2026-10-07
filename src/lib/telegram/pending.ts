/**
 * Plan pendiente de confirmación en Telegram (se guarda en `agent_pending.payload`) y su máquina de estados. PURO: no toca
 * la red ni la base; el orquestador (`agent/server/telegram-agent.ts`) lo usa y persiste.
 */
import type { Args } from "@/lib/agent/tools/meta";
import type { Decision } from "@/lib/agent/types";
import { encodeCallback, type CallbackAction } from "./update";
import type { InlineButton } from "./api";

export type PStatus = "pending" | "approved" | "skipped" | "denied" | "done";

export interface PendingStep {
  id: string;
  tool: string;
  args: Args;
  label: string;
  decision: Decision;
  status: PStatus;
  before?: string;
  after?: string;
}

export interface PendingPlan {
  steps: PendingStep[];
  mode: "all" | "step";
  /** true = la orden salió de contenido no confiable (archivo, reenviado, nota leída). */
  untrusted: boolean;
  /** Agente que propuso el plan: al ejecutar se vuelve a exigir que la herramienta sea suya. */
  agent?: string;
}

export function describeArgs(args: Args): string {
  return Object.entries(args)
    .filter(([k, v]) => v !== "" && v !== undefined && !/(^|_)id$/i.test(k) && k !== "taskId" && k !== "subtaskId")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : String(v)}`)
    .join(" · ")
    .slice(0, 300);
}

export function renderStep(s: PendingStep, index: number): string {
  const head = `${index + 1}. ${s.label}${describeArgs(s.args) ? ` — ${describeArgs(s.args)}` : ""}`;
  const change = s.before !== undefined || s.after !== undefined ? `\n   ${s.before ?? "—"} → ${s.after ?? "—"}` : "";
  const state =
    s.status === "denied" ? `\n   ✗ No permitido: ${s.decision.reasons.join(" ")}` : s.status === "skipped" ? "\n   ⏭ Omitido" : s.status === "done" ? "\n   ✓ Hecho" : s.status === "approved" ? "\n   ✓ Aprobado" : "";
  return head + change + state;
}

export function renderPlan(plan: PendingPlan): string {
  const lines = plan.steps.map(renderStep);
  const warn = plan.untrusted ? "\n⚠️ Esto salió de contenido que no escribiste tú (archivo/mensaje reenviado/nota): confírmalo con cuidado." : "";
  return `Plan (${plan.steps.length} ${plan.steps.length === 1 ? "paso" : "pasos"}):\n${lines.join("\n")}${warn}`;
}

/** Primer paso que necesita una decisión del usuario. */
export function nextToConfirm(plan: PendingPlan): number {
  return plan.steps.findIndex((s) => s.status === "pending" && s.decision.action === "ask");
}

export function planButtons(id: string): InlineButton[][] {
  const b = (text: string, c: CallbackAction): InlineButton => ({ text, callback_data: encodeCallback(c) });
  return [[b("✅ Aprobar todo", { type: "plan", id, action: "all" }), b("👣 Paso a paso", { type: "plan", id, action: "step" })], [b("✖️ Cancelar", { type: "plan", id, action: "cancel" })]];
}

export function stepButtons(id: string, index: number, canAlways: boolean): InlineButton[][] {
  const b = (text: string, action: "ok" | "skip" | "always"): InlineButton => ({ text, callback_data: encodeCallback({ type: "step", id, index, action }) });
  return [[b("✅ Permitir", "ok"), b("✖️ Denegar", "skip")], ...(canAlways ? [[b("♾️ Siempre (esta herramienta)", "always")]] : [])];
}

export function renderStepPrompt(plan: PendingPlan, index: number): string {
  const s = plan.steps[index];
  const why = s.decision.action === "ask" ? s.decision.reasons.join(" · ") : "";
  return `¿Permitir esta acción?\n${renderStep(s, index)}${why ? `\n(${why})` : ""}${plan.untrusted ? "\n⚠️ Salió de contenido que no escribiste tú." : ""}`;
}

/** Aplica la respuesta a un paso. "always" solo se acepta si la decisión lo permite (si no, equivale a "ok"). */
export function answerStep(plan: PendingPlan, index: number, action: "ok" | "skip" | "always"): { plan: PendingPlan; alwaysTool: string | null } {
  const s = plan.steps[index];
  if (!s || s.status !== "pending" || s.decision.action === "deny") return { plan, alwaysTool: null };
  const steps = plan.steps.map((x, i) => (i === index ? { ...x, status: (action === "skip" ? "skipped" : "approved") as PStatus } : x));
  const alwaysTool = action === "always" && s.decision.action === "ask" && s.decision.canAlways ? s.tool : null;
  return { plan: { ...plan, mode: "step", steps }, alwaysTool };
}

export function approveAllPending(plan: PendingPlan): PendingPlan {
  return { ...plan, mode: "all", steps: plan.steps.map((s) => (s.status === "pending" && s.decision.action !== "deny" ? { ...s, status: "approved" as PStatus } : s)) };
}

/** Pasos a ejecutar ahora: aprobados, o permitidos que siguen pendientes (cuando el resto ya se decidió). */
export function runnableSteps(plan: PendingPlan): number[] {
  return plan.steps.flatMap((s, i) => (s.status === "approved" || (s.status === "pending" && s.decision.action === "allow") ? [i] : []));
}
