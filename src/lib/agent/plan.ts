/**
 * Plan paso a paso. Cuando una petición implica varias acciones (o alguna necesita permiso), el agente no las ejecuta de
 * golpe: arma un plan numerado y el usuario puede aprobar todo, ir paso a paso, editar o saltar pasos. PURO.
 */
import { decide } from "./permissions";
import type { Args } from "./tools/meta";
import { getTool } from "./tools/registry";
import type { Decision, PermissionContext } from "./types";

export type StepStatus = "pending" | "approved" | "skipped" | "denied" | "done" | "failed";

export interface PlanStep {
  id: string;
  tool: string;
  args: Args;
  label: string;
  decision: Decision;
  status: StepStatus;
  /** Cambio exacto, para la tarjeta: "antes → después". Lo rellena el ejecutor (lee el estado real). */
  before?: string;
  after?: string;
  error?: string;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  /** "all" = aprobar todo de una vez · "step" = ir confirmando paso a paso. */
  mode: "all" | "step";
}

export interface ProposedCall {
  id: string;
  tool: string;
  args: Args;
}

/** Evalúa cada llamada con el tamaño real del lote (para la regla "por lotes"). */
export function buildPlan(planId: string, calls: ProposedCall[], ctx: PermissionContext): Plan {
  const writes = calls.filter((c) => getTool(c.tool)?.kind !== "read").length;
  const steps = calls.map((c): PlanStep => {
    const decision = decide(c.tool, c.args, { ...ctx, batchSize: Math.max(ctx.batchSize ?? 1, writes) });
    return {
      id: c.id,
      tool: c.tool,
      args: c.args,
      label: getTool(c.tool)?.label ?? c.tool,
      decision,
      status: decision.action === "deny" ? "denied" : "pending",
    };
  });
  return { id: planId, steps, mode: "all" };
}

/** ¿Hay que mostrarle el plan al usuario? Sí si hay más de una escritura o si algún paso pide permiso. */
export function planNeedsReview(plan: Plan): boolean {
  const writes = plan.steps.filter((s) => getTool(s.tool)?.kind !== "read").length;
  return writes > 1 || plan.steps.some((s) => s.decision.action === "ask");
}

/** Pasos que se pueden ejecutar sin preguntar (permitidos y pendientes). */
export function autoRunnable(plan: Plan): PlanStep[] {
  return plan.steps.filter((s) => s.status === "pending" && s.decision.action === "allow");
}

const update = (plan: Plan, stepId: string, patch: Partial<PlanStep>): Plan => ({
  ...plan,
  steps: plan.steps.map((s) => (s.id === stepId && s.status !== "done" ? { ...s, ...patch } : s)),
});

export const skipStep = (plan: Plan, stepId: string) => update(plan, stepId, { status: "skipped" });

/** Aprueba un paso que pedía permiso (el que estaba en "denied" por política no se puede aprobar). */
export function approveStep(plan: Plan, stepId: string): Plan {
  const s = plan.steps.find((x) => x.id === stepId);
  if (!s || s.decision.action === "deny" || s.status === "done") return plan;
  return update(plan, stepId, { status: "approved" });
}

export function approveAll(plan: Plan): Plan {
  return {
    ...plan,
    mode: "all",
    steps: plan.steps.map((s) => (s.status === "pending" && s.decision.action !== "deny" ? { ...s, status: "approved" } : s)),
  };
}

export const setStepMode = (plan: Plan): Plan => ({ ...plan, mode: "step" });

/** Edita los argumentos de un paso y vuelve a evaluarlo (un cambio puede subir un límite o cambiar la decisión). */
export function editStep(plan: Plan, stepId: string, args: Args, ctx: PermissionContext): Plan {
  const s = plan.steps.find((x) => x.id === stepId);
  if (!s || s.status === "done") return plan;
  const writes = plan.steps.filter((x) => getTool(x.tool)?.kind !== "read").length;
  const decision = decide(s.tool, args, { ...ctx, batchSize: Math.max(ctx.batchSize ?? 1, writes) });
  return update(plan, stepId, { args, decision, status: decision.action === "deny" ? "denied" : "pending", before: undefined, after: undefined });
}

/** Siguiente paso a ejecutar: el primero aprobado, o el primer permitido pendiente. */
export function nextRunnable(plan: Plan): PlanStep | null {
  return plan.steps.find((s) => s.status === "approved") ?? plan.steps.find((s) => s.status === "pending" && s.decision.action === "allow") ?? null;
}

/** En modo "paso a paso": el primer paso pendiente que necesita decisión del usuario. */
export function nextToConfirm(plan: Plan): PlanStep | null {
  return plan.steps.find((s) => s.status === "pending" && s.decision.action === "ask") ?? null;
}

export const isPlanFinished = (plan: Plan) => plan.steps.every((s) => s.status !== "pending" && s.status !== "approved");
