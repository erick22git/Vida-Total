"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { createClient } from "@/lib/supabase/client";
import { approvePayment, grantAccess, rejectPayment, requirePaymentAgain, type PaymentRequestRow } from "@/lib/admin/payments";
import type { SubscriptionPlan } from "@/lib/subscription-plans";
import { extendAccessUntil, getSubscription, nextAccessUntil, SUBSCRIPTION_LABEL } from "@/lib/subscription";
import type { Profile } from "@/lib/types/profile";

function fmt(iso: string | null) {
  if (!iso) return "Sin vencimiento";
  try {
    return format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

/**
 * Estado de suscripción de un usuario en su detalle de admin: activa / pendiente / vencida y fecha del próximo pago.
 * El pago se confirma A MANO desde acá (o desde /admin/pagos): no hay pasarela ni webhook.
 */
export function SubscriptionCard({ profile: initial, adminId, requests: initialRequests, plans = [] }: { profile: Profile; adminId: string; requests: PaymentRequestRow[]; plans?: SubscriptionPlan[] }) {
  const [profile, setProfile] = useState(initial);
  const [requests, setRequests] = useState(initialRequests);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState("7");
  const [grantUnit, setGrantUnit] = useState<"dias" | "meses">("dias");

  const pending = requests.find((r) => r.status === "pendiente") ?? null;
  // Meses al confirmar: los del plan que el usuario eligió al pagar; si confirmás sin comprobante, 1 mes salvo que cambies el selector.
  const [monthsOverride, setMonthsOverride] = useState<number | null>(null);
  const months = monthsOverride ?? pending?.plan_months ?? 1;
  const monthOptions = [...new Set<number>([...plans.map((p) => p.months), ...(pending?.plan_months ? [pending.plan_months] : [1])])].sort((a, b) => a - b);
  const sub = getSubscription(profile, !!pending);
  const label = SUBSCRIPTION_LABEL[sub.status];

  async function confirm(request: PaymentRequestRow | null) {
    setBusy(true);
    const res = await approvePayment(createClient(), { adminId, request, userId: profile.id, email: profile.email, currentAccessUntil: profile.access_until, months });
    if (res.ok) {
      setProfile((p) => ({ ...p, access_until: res.accessUntil, is_blocked: false, payment_required: false }));
      if (request) setRequests((rs) => rs.map((r) => (r.id === request.id ? { ...r, status: "aprobado" } : r)));
      setMsg(`Pago confirmado. Acceso hasta el ${fmt(res.accessUntil)}.`);
    } else setMsg(`No se pudo confirmar: ${res.error}`);
    setBusy(false);
  }

  async function grant() {
    const amount = Math.floor(Number(grantAmount));
    if (!Number.isFinite(amount) || amount < 1) return setMsg("Escribe un número de 1 en adelante.");
    setBusy(true);
    const res = await grantAccess(createClient(), { adminId, userId: profile.id, email: profile.email, currentAccessUntil: profile.access_until, amount, unit: grantUnit });
    if (res.ok) {
      setProfile((p) => ({ ...p, access_until: res.accessUntil, is_blocked: false, payment_required: false }));
      setMsg(`Acceso extendido hasta el ${fmt(res.accessUntil)}.`);
    } else setMsg(`No se pudo extender: ${res.error}`);
    setBusy(false);
  }

  async function requireAgain() {
    setBusy(true);
    const res = await requirePaymentAgain(createClient(), { adminId, userId: profile.id, email: profile.email });
    if (res.ok) {
      setProfile((p) => ({ ...p, payment_required: true, is_blocked: false }));
      setMsg("Listo: ahora ve la pantalla de pago hasta que confirmes otro pago o le des una prueba.");
    } else setMsg(`No se pudo: ${res.error}`);
    setBusy(false);
  }

  async function reject(request: PaymentRequestRow) {
    setBusy(true);
    const res = await rejectPayment(createClient(), { adminId, request, email: profile.email });
    if (res.ok) {
      setRequests((rs) => rs.map((r) => (r.id === request.id ? { ...r, status: "rechazado" } : r)));
      setMsg("Comprobante rechazado.");
    } else setMsg(`No se pudo rechazar: ${res.error}`);
    setBusy(false);
  }

  return (
    <GlassCard padding="lg" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white mb-1">Suscripción</h2>
          <p className="text-sm text-white/60">Próximo pago: {sub.nextPayment ? fmt(sub.nextPayment) : "sin vencimiento"}</p>
        </div>
        <GlassBadge color={label.color}>{label.label}</GlassBadge>
      </div>
      {pending && (
        <p className="text-xs text-amber-300">
          Tiene un comprobante esperando revisión ({format(new Date(pending.created_at), "d MMM HH:mm", { locale: es })}).
          {pending.plan_name ? ` Eligió el plan "${pending.plan_name}"${pending.plan_price_label ? ` (${pending.plan_price_label})` : ""}.` : " No eligió plan: usá el selector de meses."}
        </p>
      )}
      <label className="flex items-center gap-2 text-xs text-white/50">
        Meses que se suman al confirmar
        <select
          value={months}
          onChange={(e) => setMonthsOverride(Number(e.target.value))}
          className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-1.5 text-sm text-white outline-none"
        >
          {monthOptions.map((n) => (
            <option key={n} value={n} className="text-black">
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => confirm(pending)}
          className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-emerald-500/80 hover:bg-emerald-500 text-black flex items-center gap-1.5"
        >
          <CheckCircle2 size={15} /> Confirmar pago (+{months} {months === 1 ? "mes" : "meses"} → {fmt(nextAccessUntil(profile.access_until, new Date(), months))})
        </button>
        {profile.payment_required !== true && (
          <button disabled={busy} onClick={requireAgain} className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center gap-1.5">
            <RotateCcw size={14} /> Volver a exigir el pago
          </button>
        )}
        {pending && (
          <button disabled={busy} onClick={() => reject(pending)} className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-red-500/20 hover:bg-red-500/30 text-red-200">
            Rechazar comprobante
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Prueba gratuita / extender acceso
          <span className="flex gap-2">
            <input
              type="number"
              min={1}
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              className="w-20 rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-2 text-sm text-white outline-none"
            />
            <select
              value={grantUnit}
              onChange={(e) => setGrantUnit(e.target.value as "dias" | "meses")}
              className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="dias" className="text-black">días</option>
              <option value="meses" className="text-black">meses</option>
            </select>
          </span>
        </label>
        <button disabled={busy} onClick={grant} className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-white/[0.1] hover:bg-white/[0.18] text-white">
          Dar acceso hasta {fmt(extendAccessUntil(profile.access_until, Math.max(1, Math.floor(Number(grantAmount)) || 1), grantUnit))}
        </button>
      </div>
      {msg && <p role="status" className="text-xs text-white/60">{msg}</p>}
    </GlassCard>
  );
}
