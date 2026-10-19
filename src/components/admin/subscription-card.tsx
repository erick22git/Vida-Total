"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { createClient } from "@/lib/supabase/client";
import { approvePayment, rejectPayment, type PaymentRequestRow } from "@/lib/admin/payments";
import { getSubscription, nextAccessUntil, SUBSCRIPTION_LABEL } from "@/lib/subscription";
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
export function SubscriptionCard({ profile: initial, adminId, requests: initialRequests }: { profile: Profile; adminId: string; requests: PaymentRequestRow[] }) {
  const [profile, setProfile] = useState(initial);
  const [requests, setRequests] = useState(initialRequests);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pending = requests.find((r) => r.status === "pendiente") ?? null;
  const sub = getSubscription(profile, !!pending);
  const label = SUBSCRIPTION_LABEL[sub.status];

  async function confirm(request: PaymentRequestRow | null) {
    setBusy(true);
    const res = await approvePayment(createClient(), { adminId, request, userId: profile.id, email: profile.email, currentAccessUntil: profile.access_until });
    if (res.ok) {
      setProfile((p) => ({ ...p, access_until: res.accessUntil, is_blocked: false }));
      if (request) setRequests((rs) => rs.map((r) => (r.id === request.id ? { ...r, status: "aprobado" } : r)));
      setMsg(`Pago confirmado. Acceso hasta el ${fmt(res.accessUntil)}.`);
    } else setMsg(`No se pudo confirmar: ${res.error}`);
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
      {pending && <p className="text-xs text-amber-300">Tiene un comprobante esperando revisión ({format(new Date(pending.created_at), "d MMM HH:mm", { locale: es })}). Revísalo en Pagos.</p>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => confirm(pending)}
          className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-emerald-500/80 hover:bg-emerald-500 text-black flex items-center gap-1.5"
        >
          <CheckCircle2 size={15} /> Confirmar pago (+1 mes → {fmt(nextAccessUntil(profile.access_until))})
        </button>
        {pending && (
          <button disabled={busy} onClick={() => reject(pending)} className="rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 bg-red-500/20 hover:bg-red-500/30 text-red-200">
            Rechazar comprobante
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-xs text-white/60">{msg}</p>}
    </GlassCard>
  );
}
