"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, FileText, QrCode, ShieldAlert, XCircle } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/client";
import { SETTING_KEYS } from "@/lib/account/load-account";
import { PlansManager } from "@/components/admin/plans-manager";
import { DEFAULT_PLANS, type SubscriptionPlan } from "@/lib/subscription-plans";
import { PaymentGate } from "@/components/pago/payment-gate";
import { approvePayment, rejectPayment, saveAppSetting, saveQrPayload, type PaymentRequestRow } from "@/lib/admin/payments";
import { decodeQrFromFile, renderQrSvg, verifyQrSvg } from "@/lib/qr/qr";
import { nextAccessUntil } from "@/lib/subscription";

interface RequestView extends PaymentRequestRow {
  email: string | null;
  full_name: string | null;
  access_until: string | null;
}

const inputCls = "w-full rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30";
const btnCls = "rounded-full px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 transition-colors";

function QrPreview({ svg }: { svg: string }) {
  return (
    <div
      role="img"
      aria-label="Vista previa del QR"
      className="w-[220px] aspect-square rounded-2xl overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
      style={{ background: "#ffffff" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Panel de pagos (solo admin; la ruta ya exige rol admin y las policies RLS de la migración 0018 son la barrera real).
 * 1) QR de pago: se sube la imagen del banco, se DECODIFICA a texto, se guarda el texto y siempre se muestra regenerado como SVG.
 * 2) Comprobantes: el pago se confirma A MANO acá; no hay webhook ni API bancaria.
 */
export function PaymentAdmin({ adminId }: { adminId: string }) {
  const [loading, setLoading] = useState(true);
  const [missingMigration, setMissingMigration] = useState(false);
  const [savedSvg, setSavedSvg] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [instructions, setInstructions] = useState("");
  const [decoded, setDecoded] = useState<string | null>(null);
  const [decodedSvg, setDecodedSvg] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestView[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [months, setMonths] = useState<Record<string, number>>({});
  const [savedPayload, setSavedPayload] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: settings, error } = await supabase.from("app_settings").select("key, value");
    if (error) {
      setMissingMigration(/relation|does not exist|schema cache/i.test(error.message));
      setLoading(false);
      return;
    }
    const get = (k: string) => settings?.find((r) => r.key === k)?.value ?? null;
    const payload = get(SETTING_KEYS.qrPayload);
    setAmount(get(SETTING_KEYS.amountLabel) ?? "");
    setInstructions(get(SETTING_KEYS.instructions) ?? "");
    setSavedPayload(payload);
    setSavedSvg(payload ? await renderQrSvg(payload) : null);

    const { data: reqs } = await supabase.from("payment_requests").select("*").eq("status", "pendiente").order("created_at", { ascending: true });
    const ids = Array.from(new Set((reqs ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, email, full_name, access_until").in("id", ids) : { data: [] };
    setRequests(
      (reqs ?? []).map((r) => {
        const p = profs?.find((x) => x.id === r.user_id);
        return { ...(r as PaymentRequestRow), email: p?.email ?? null, full_name: p?.full_name ?? null, access_until: p?.access_until ?? null };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Meses con los que se confirma un comprobante: el corregido por el admin, si no el del plan que eligió el usuario, si no 1. */
  function monthsFor(r: RequestView) {
    return months[r.id] ?? r.plan_months ?? 1;
  }
  /** Opciones del selector: los meses de los planes configurados (sin repetir) + el del plan elegido, por si ese plan ya se borró. */
  function monthOptions(r: RequestView) {
    const set = new Set<number>(plans.map((p) => p.months));
    if (r.plan_months) set.add(r.plan_months);
    if (set.size === 0) [1, 3, 6, 12].forEach((n) => set.add(n));
    return [...set].sort((a, b) => a - b);
  }

  async function onFile(file: File | null) {
    setDecoded(null);
    setDecodedSvg(null);
    setVerified(null);
    setDecodeError(null);
    setMsg(null);
    if (!file) return;
    setBusy(true);
    try {
      const text = await decodeQrFromFile(file);
      if (!text) {
        setDecodeError("No encontré un código QR legible en esa imagen. Prueba con una captura más nítida y recortada al QR.");
      } else {
        setDecoded(text);
        const svg = await renderQrSvg(text);
        setDecodedSvg(svg);
        setVerified(await verifyQrSvg(svg, text));
      }
    } catch (e) {
      setDecodeError(e instanceof Error ? e.message : "No se pudo leer la imagen.");
    }
    setBusy(false);
  }

  async function saveQr() {
    if (!decoded) return;
    setBusy(true);
    const { error } = await saveQrPayload(createClient(), adminId, decoded);
    setMsg(error ? `No se pudo guardar el QR: ${error.message}` : "QR guardado. Se guardó el texto del QR; los usuarios verán una versión regenerada.");
    setBusy(false);
    if (!error) {
      setDecoded(null);
      setDecodedSvg(null);
      await load();
    }
  }

  async function saveTexts() {
    setBusy(true);
    const supabase = createClient();
    const a = await saveAppSetting(supabase, adminId, SETTING_KEYS.amountLabel, amount.trim() || null);
    const b = await saveAppSetting(supabase, adminId, SETTING_KEYS.instructions, instructions.trim() || null);
    const err = a.error ?? b.error;
    setMsg(err ? `No se pudo guardar: ${err.message}` : "Monto e instrucciones guardados.");
    setBusy(false);
  }

  async function openReceipt(path: string) {
    const { data, error } = await createClient().storage.from("comprobantes").createSignedUrl(path, 300);
    if (error || !data) setMsg(`No se pudo abrir el comprobante: ${error?.message ?? "sin acceso"}`);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function approve(r: RequestView) {
    setBusy(true);
    const res = await approvePayment(createClient(), { adminId, request: r, userId: r.user_id, email: r.email, currentAccessUntil: r.access_until, months: monthsFor(r) });
    setMsg(res.ok ? `Pago de ${r.email ?? "usuario"} confirmado. Acceso hasta el ${res.accessUntil}.` : `No se pudo confirmar: ${res.error}`);
    setBusy(false);
    if (res.ok) await load();
  }

  async function reject(r: RequestView) {
    setBusy(true);
    const res = await rejectPayment(createClient(), { adminId, request: r, email: r.email });
    setMsg(res.ok ? "Comprobante rechazado. El usuario sigue bloqueado y puede volver a enviar uno." : `No se pudo rechazar: ${res.error}`);
    setBusy(false);
    if (res.ok) await load();
  }

  if (loading) return <p className="text-sm text-white/45">Cargando…</p>;
  if (missingMigration) {
    return (
      <GlassCard padding="lg" className="flex gap-3 items-start">
        <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-white/70">
          Falta aplicar la migración <code className="text-white">supabase/migrations/0018_suscripciones_onboarding.sql</code> en el SQL Editor de Supabase. Sin ella no hay dónde guardar el QR ni los comprobantes.
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassCard padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <QrCode size={18} className="text-white/70" />
          <h2 className="text-sm font-semibold text-white">QR de pago</h2>
        </div>
        <p className="text-xs text-white/45">
          Sube la imagen del QR de tu banco. Se lee una sola vez y se guarda su TEXTO; a los usuarios siempre se les muestra un QR limpio regenerado desde ese texto (nunca la
          foto). El pago no se confirma solo: lo confirmas tú acá abajo.
        </p>

        <div className="flex flex-wrap gap-6 items-start">
          {savedSvg ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wide text-white/40">QR actual (regenerado)</span>
              <QrPreview svg={savedSvg} />
            </div>
          ) : (
            <p className="text-sm text-white/50">Todavía no hay un QR cargado.</p>
          )}

          <div className="flex flex-col gap-3 min-w-[240px] flex-1">
            <label className={`${btnCls} bg-white/[0.1] hover:bg-white/[0.18] text-white w-fit`}>
              Subir imagen del QR
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
            {decodeError && <p className="text-xs text-red-300">{decodeError}</p>}
            {decoded && decodedSvg && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Texto leído del QR</span>
                <code className="text-[11px] text-white/70 break-all rounded-xl bg-black/30 p-2 max-h-28 overflow-auto">{decoded}</code>
                <QrPreview svg={decodedSvg} />
                <p className="text-xs" style={{ color: verified ? "#22c55e" : "#f59e0b" }}>
                  {verified ? "Comprobado: el QR regenerado se lee y devuelve el mismo texto." : "No pude comprobar el QR regenerado en este navegador; revísalo escaneándolo antes de guardar."}
                </p>
                <button disabled={busy} onClick={saveQr} className={`${btnCls} bg-white text-black w-fit`}>
                  Guardar este QR
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-white/50">
            Monto general (solo se muestra si el plan elegido no tiene precio)
            <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej: Bs 30 / mes" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-white/50 sm:col-span-2">
            Instrucciones
            <textarea className={`${inputCls} min-h-[72px]`} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ej: Escanea con la app de tu banco y sube la captura del comprobante." />
          </label>
        </div>
        <button disabled={busy} onClick={saveTexts} className={`${btnCls} bg-white/[0.1] hover:bg-white/[0.18] text-white w-fit`}>
          Guardar monto e instrucciones
        </button>
        <button onClick={() => setPreviewOpen(true)} className={`${btnCls} bg-white text-black w-fit`}>
          Ver la pantalla de pago como la ve el usuario
        </button>
      </GlassCard>

      <PlansManager adminId={adminId} onChange={setPlans} />

      <GlassCard padding="lg" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-white/70" />
          <h2 className="text-sm font-semibold text-white">Comprobantes pendientes ({requests.length})</h2>
        </div>
        {requests.length === 0 && <p className="text-sm text-white/45">No hay comprobantes esperando revisión.</p>}
        {requests.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.full_name || r.email || r.user_id}</p>
                <p className="text-xs text-white/45">
                  {r.email} · enviado {format(new Date(r.created_at), "d MMM HH:mm", { locale: es })}
                </p>
              </div>
              <p className="text-xs text-white/50">Si apruebas: acceso hasta {nextAccessUntil(r.access_until, new Date(), monthsFor(r))}</p>
            </div>
            {r.plan_name ? (
              <p className="text-xs text-white/70">
                Plan elegido: <b>{r.plan_name}</b>
                {r.plan_price_label ? ` · ${r.plan_price_label}` : ""} ({r.plan_months} {r.plan_months === 1 ? "mes" : "meses"})
              </p>
            ) : (
              <p className="text-xs text-amber-200/80">El usuario no eligió plan (comprobante anterior a los planes): elegí los meses abajo.</p>
            )}
            {r.note && <p className="text-xs text-white/60 italic">“{r.note}”</p>}
            <label className="flex items-center gap-2 text-xs text-white/50">
              Meses que pagó
              <select
                value={monthsFor(r)}
                onChange={(e) => setMonths((m) => ({ ...m, [r.id]: Number(e.target.value) }))}
                className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-1.5 text-sm text-white outline-none"
              >
                {monthOptions(r).map((n) => (
                  <option key={n} value={n} className="text-black">
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {r.receipt_path && (
                <button onClick={() => openReceipt(r.receipt_path!)} className={`${btnCls} bg-white/[0.08] hover:bg-white/[0.16] text-white`}>
                  Ver comprobante
                </button>
              )}
              <button disabled={busy} onClick={() => approve(r)} className={`${btnCls} bg-emerald-500/80 hover:bg-emerald-500 text-black flex items-center gap-1.5`}>
                <CheckCircle2 size={15} /> Confirmar pago (+{monthsFor(r)} {monthsFor(r) === 1 ? "mes" : "meses"})
              </button>
              <button disabled={busy} onClick={() => reject(r)} className={`${btnCls} bg-red-500/20 hover:bg-red-500/30 text-red-200 flex items-center gap-1.5`}>
                <XCircle size={15} /> Rechazar
              </button>
            </div>
          </div>
        ))}
      </GlassCard>

      {msg && <p role="status" className="text-sm text-white/70">{msg}</p>}

      {previewOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black">
          <PaymentGate
            preview
            onClosePreview={() => setPreviewOpen(false)}
            userId={adminId}
            subscription={{ status: "vencida", nextPayment: null, locked: true }}
            payment={{ qrPayload: savedPayload, amountLabel: amount.trim() || null, instructions: instructions.trim() || null, plans: plans.filter((p) => p.active).length > 0 ? plans.filter((p) => p.active) : DEFAULT_PLANS }}
          />
        </div>
      )}
    </div>
  );
}
