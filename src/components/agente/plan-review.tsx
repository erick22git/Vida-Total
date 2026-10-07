"use client";

import { useState } from "react";
import { Ban, Check, ListChecks, Pencil, SkipForward } from "lucide-react";
import { PermissionPrompt } from "@/components/agente/permission-prompt";
import { approveAll, approveStep, editStep, isPlanFinished, nextToConfirm, setStepMode, skipStep, type Plan, type PlanStep } from "@/lib/agent/plan";
import { getAgentSessionId, useAgentStore } from "@/lib/store/agentStore";
import type { PermissionAnswer } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

function makeCtx() {
  return { channel: "app" as const, origin: "user" as const, config: useAgentStore.getState().config, now: Date.now(), recentWrites: [], sessionId: getAgentSessionId() };
}

/** Una línea legible de lo que hace el paso, a partir de sus argumentos. */
export function describeArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([k, v]) => v !== "" && v !== undefined && k !== "id" && k !== "taskId" && k !== "subtaskId")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

function EditForm({ step, onSave, onCancel }: { step: PlanStep; onSave: (args: Record<string, unknown>) => void; onCancel: () => void }) {
  const editable = Object.entries(step.args).filter(([, v]) => typeof v === "string" || typeof v === "number");
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(editable.map(([k, v]) => [k, String(v)])));
  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {editable.map(([k, orig]) => (
        <label key={k} className="text-[11px] text-white/50 flex flex-col gap-0.5">
          {k}
          <input
            value={vals[k]}
            onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))}
            className="rounded-lg bg-white/[0.08] px-2.5 py-2 text-sm text-white outline-none"
            inputMode={typeof orig === "number" ? "decimal" : "text"}
          />
        </label>
      ))}
      <div className="flex gap-1.5">
        <button
          className="rounded-lg bg-emerald-500/90 text-black text-xs font-medium px-3 py-2 cursor-pointer"
          onClick={() => onSave({ ...step.args, ...Object.fromEntries(editable.map(([k, orig]) => [k, typeof orig === "number" ? Number(vals[k]) : vals[k]])) })}
        >
          Guardar
        </button>
        <button className="rounded-lg bg-white/10 text-xs px-3 py-2 cursor-pointer" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

/**
 * Revisión del plan paso a paso: aprobar todo, ir paso a paso, editar o saltar pasos; cada tarjeta muestra el cambio exacto
 * (antes → después). Resuelve con el plan en el que cada paso quedó aprobado u omitido.
 */
export function PlanReview({ plan: initial, onDone }: { plan: Plan; onDone: (plan: Plan) => void }) {
  const [plan, setPlan] = useState<Plan>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const answer = useAgentStore((s) => s.answerPermission);

  const finish = (p: Plan) => {
    // Lo que quedó "pendiente" y permitido corre solo; lo que pedía permiso y no se aprobó se omite.
    onDone({ ...p, steps: p.steps.map((s) => (s.status === "pending" && s.decision.action === "allow" ? { ...s, status: "approved" as const } : s)) });
  };

  const respond = (step: PlanStep, a: PermissionAnswer) => {
    if (step.decision.action === "ask") answer(step.tool, "app", a, step.decision);
    const next = a === "deny" ? skipStep(plan, step.id) : approveStep(plan, step.id);
    setPlan(next);
    if (plan.mode === "step" && !nextToConfirm(next)) finish(next);
  };

  const toConfirm = plan.mode === "step" ? nextToConfirm(plan) : null;
  const askCount = plan.steps.filter((s) => s.decision.action === "ask" && s.status === "pending").length;

  return (
    <div className="rounded-2xl bg-white/[0.05] glass-specular-ring p-3.5 flex flex-col gap-3" role="group" aria-label="Plan del agente">
      <div className="flex items-center gap-2">
        <ListChecks size={16} className="text-emerald-300" />
        <p className="text-sm font-semibold">Plan ({plan.steps.length} {plan.steps.length === 1 ? "paso" : "pasos"})</p>
      </div>

      <ol className="flex flex-col gap-2">
        {plan.steps.map((s, i) => (
          <li key={s.id} className={cn("rounded-xl bg-white/[0.04] p-2.5", (s.status === "skipped" || s.status === "denied") && "opacity-55")}>
            <div className="flex items-start gap-2">
              <span className="text-xs text-white/40 w-4 shrink-0 mt-0.5">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{s.label}</p>
                <p className="text-xs text-white/60 break-words">{describeArgs(s.args) || "—"}</p>
                {(s.before !== undefined || s.after !== undefined) && (
                  <p className="text-[11px] text-white/55 break-words mt-0.5">
                    {s.before !== undefined && <span className="line-through decoration-white/30">{s.before || "(vacío)"}</span>}
                    {s.before !== undefined && s.after !== undefined && " → "}
                    {s.after !== undefined && <span className="text-emerald-300/90">{s.after}</span>}
                  </p>
                )}
                {s.decision.action === "deny" && <p className="text-[11px] text-red-300 mt-0.5">No permitido: {s.decision.reasons.join(" ")}</p>}
                {s.decision.action === "ask" && s.status === "pending" && <p className="text-[11px] text-amber-200/80 mt-0.5">Pide tu permiso: {s.decision.reasons.join(" · ")}</p>}
                {s.status === "approved" && <p className="text-[11px] text-emerald-300 mt-0.5 inline-flex items-center gap-1"><Check size={11} /> Aprobado</p>}
                {s.status === "skipped" && <p className="text-[11px] text-white/45 mt-0.5 inline-flex items-center gap-1"><Ban size={11} /> Omitido</p>}
                {editing === s.id && (
                  <EditForm
                    step={s}
                    onCancel={() => setEditing(null)}
                    onSave={(args) => {
                      setPlan((p) => editStep(p, s.id, args, makeCtx()));
                      setEditing(null);
                    }}
                  />
                )}
              </div>
              {s.status !== "denied" && s.status !== "skipped" && editing !== s.id && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button aria-label="Editar paso" className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center cursor-pointer" onClick={() => setEditing(s.id)}>
                    <Pencil size={14} />
                  </button>
                  <button aria-label="Saltar paso" className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center cursor-pointer" onClick={() => setPlan((p) => skipStep(p, s.id))}>
                    <SkipForward size={14} />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {plan.mode === "step" && toConfirm ? (
        toConfirm.decision.action === "ask" && (
          <PermissionPrompt
            label={toConfirm.label}
            detail={describeArgs(toConfirm.args)}
            before={toConfirm.before}
            after={toConfirm.after}
            decision={toConfirm.decision}
            onAnswer={(a) => respond(toConfirm, a)}
          />
        )
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            disabled={isPlanFinished(plan)}
            className="rounded-xl px-3 py-2.5 text-xs font-semibold bg-emerald-500/90 text-black cursor-pointer min-h-[40px] disabled:opacity-40"
            onClick={() => finish(approveAll(plan))}
          >
            Aprobar todo
          </button>
          {askCount > 0 && (
            <button className="rounded-xl px-3 py-2.5 text-xs bg-white/10 cursor-pointer min-h-[40px]" onClick={() => setPlan(setStepMode(plan))}>
              Paso a paso
            </button>
          )}
          <button className="rounded-xl px-3 py-2.5 text-xs bg-red-500/15 text-red-200 cursor-pointer min-h-[40px]" onClick={() => onDone({ ...plan, steps: plan.steps.map((s) => (s.status === "denied" ? s : { ...s, status: "skipped" as const })) })}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
