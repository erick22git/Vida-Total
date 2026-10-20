"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/client";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/admin/audit";
import { sortPlans, type SubscriptionPlan } from "@/lib/subscription-plans";

const inputCls = "w-full rounded-xl bg-white/[0.06] border border-white/10 px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/30";
const btnCls = "rounded-full px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors flex items-center gap-1.5";

/**
 * Planes de suscripción (tabla `subscription_plans`, migración 0021). Configurables: se agregan, editan, reordenan y
 * desactivan desde acá — no hay ninguna duración fija en el código. Un plan desactivado deja de verse en la pantalla de pago,
 * pero los comprobantes que ya lo eligieron conservan su copia (nombre y meses), así que nada se rompe al editarlo o borrarlo.
 */
export function PlansManager({ adminId, onChange }: { adminId: string; onChange?: (plans: SubscriptionPlan[]) => void }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", months: "", price_label: "" });

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("subscription_plans").select("id, name, months, price_label, sort_order, active");
    if (error) {
      setMissing(true);
      setLoading(false);
      return;
    }
    const sorted = sortPlans((data ?? []) as SubscriptionPlan[]);
    setPlans(sorted);
    onChange?.(sorted);
    setLoading(false);
  }, [onChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function edit(id: string, patch: Partial<SubscriptionPlan>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function save(plan: SubscriptionPlan) {
    if (!plan.name.trim() || !(plan.months >= 1 && plan.months <= 120)) return setMsg("El plan necesita un nombre y entre 1 y 120 meses.");
    setBusyId(plan.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("subscription_plans")
      .update({ name: plan.name.trim(), months: plan.months, price_label: plan.price_label.trim(), sort_order: plan.sort_order, active: plan.active })
      .eq("id", plan.id);
    setMsg(error ? `No se pudo guardar el plan: ${error.message}` : `Plan "${plan.name}" guardado.`);
    if (!error) await logAdminAction(supabase, { adminId, targetUserId: adminId, action: AUDIT_ACTIONS.MANAGED_PLAN, details: { plan: plan.name, months: plan.months, price: plan.price_label, active: plan.active } });
    setBusyId(null);
    if (!error) await load();
  }

  async function remove(plan: SubscriptionPlan) {
    setBusyId(plan.id);
    const supabase = createClient();
    const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
    setMsg(error ? `No se pudo borrar el plan: ${error.message}` : `Plan "${plan.name}" borrado.`);
    if (!error) await logAdminAction(supabase, { adminId, targetUserId: adminId, action: AUDIT_ACTIONS.MANAGED_PLAN, details: { plan: plan.name, deleted: true } });
    setBusyId(null);
    if (!error) await load();
  }

  async function add() {
    const months = Math.floor(Number(draft.months));
    if (!draft.name.trim() || !(months >= 1 && months <= 120)) return setMsg("Para agregar un plan escribí un nombre y los meses (1 a 120).");
    setBusyId("new");
    const supabase = createClient();
    const nextOrder = plans.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;
    const { error } = await supabase.from("subscription_plans").insert({ name: draft.name.trim(), months, price_label: draft.price_label.trim(), sort_order: nextOrder, active: true });
    setMsg(error ? `No se pudo agregar el plan: ${error.message}` : `Plan "${draft.name.trim()}" agregado.`);
    if (!error) {
      await logAdminAction(supabase, { adminId, targetUserId: adminId, action: AUDIT_ACTIONS.MANAGED_PLAN, details: { plan: draft.name.trim(), months, created: true } });
      setDraft({ name: "", months: "", price_label: "" });
      await load();
    }
    setBusyId(null);
  }

  if (loading) return null;
  if (missing) {
    return (
      <GlassCard padding="lg">
        <p className="text-sm text-white/70">
          Para configurar planes falta aplicar la migración <code className="text-white">0021_modulos_independientes_planes_usuarios.sql</code> en Supabase. Mientras tanto, los usuarios ven los planes de respaldo (1 mes, 3 meses, 6 meses, 1 año) sin precio.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg" className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Planes de suscripción</h2>
        <p className="text-xs text-white/45 mt-0.5">
          Lo que el usuario ve para elegir al pagar. Al confirmar su pago, el vencimiento se calcula con los meses del plan que eligió. La prueba gratuita no es un plan: solo existe si se la asignás a un usuario puntual.
        </p>
      </div>

      {plans.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 grid gap-2 sm:grid-cols-[1.4fr_90px_1fr_70px_auto] items-end">
          <label className="text-[11px] text-white/45 flex flex-col gap-1">
            Nombre
            <input className={inputCls} value={p.name} onChange={(e) => edit(p.id, { name: e.target.value })} />
          </label>
          <label className="text-[11px] text-white/45 flex flex-col gap-1">
            Meses
            <input className={inputCls} type="number" min={1} max={120} value={p.months} onChange={(e) => edit(p.id, { months: Number(e.target.value) })} />
          </label>
          <label className="text-[11px] text-white/45 flex flex-col gap-1">
            Precio (texto)
            <input className={inputCls} value={p.price_label} placeholder="Ej: Bs 80" onChange={(e) => edit(p.id, { price_label: e.target.value })} />
          </label>
          <label className="text-[11px] text-white/45 flex flex-col gap-1">
            Orden
            <input className={inputCls} type="number" value={p.sort_order} onChange={(e) => edit(p.id, { sort_order: Number(e.target.value) })} />
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-white/55 flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={p.active} onChange={(e) => edit(p.id, { active: e.target.checked })} /> Activo
            </label>
            <button disabled={busyId === p.id} onClick={() => save(p)} className={`${btnCls} bg-white text-black`}>
              <Save size={13} /> Guardar
            </button>
            <button disabled={busyId === p.id} onClick={() => remove(p)} aria-label={`Borrar el plan ${p.name}`} className={`${btnCls} bg-red-500/20 hover:bg-red-500/30 text-red-200`}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-dashed border-white/15 p-3 grid gap-2 sm:grid-cols-[1.4fr_90px_1fr_auto] items-end">
        <label className="text-[11px] text-white/45 flex flex-col gap-1">
          Nuevo plan
          <input className={inputCls} value={draft.name} placeholder="Ej: 2 años" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </label>
        <label className="text-[11px] text-white/45 flex flex-col gap-1">
          Meses
          <input className={inputCls} type="number" min={1} max={120} value={draft.months} onChange={(e) => setDraft((d) => ({ ...d, months: e.target.value }))} />
        </label>
        <label className="text-[11px] text-white/45 flex flex-col gap-1">
          Precio (texto)
          <input className={inputCls} value={draft.price_label} onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} />
        </label>
        <button disabled={busyId === "new"} onClick={add} className={`${btnCls} bg-white/[0.12] hover:bg-white/[0.2] text-white`}>
          <Plus size={13} /> Agregar
        </button>
      </div>

      {msg && <p role="status" className="text-xs text-white/65">{msg}</p>}
    </GlassCard>
  );
}
