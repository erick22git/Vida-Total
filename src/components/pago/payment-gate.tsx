"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, LogOut, Paperclip, RefreshCw, X } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, Btn, DarkCard } from "@/components/agente/ui";
import { PaymentScene, type RenderBackend } from "@/lib/3d/payment-scene";
import { getQrMatrix, renderQrPng, renderQrSvg } from "@/lib/qr/qr";
import { submitReceipt } from "@/lib/admin/payments";
import { createClient } from "@/lib/supabase/client";
import { setCurrentUserId } from "@/lib/store/user-scope";
import type { PaymentSettings } from "@/lib/account/load-account";
import type { SubscriptionInfo } from "@/lib/subscription";
import { sortPlans, type SubscriptionPlan } from "@/lib/subscription-plans";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return format(new Date(`${iso}T00:00:00`), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

/** Texto del QR decorativo que da forma al piso cuando el admin todavía no cargó el QR real (NO se muestra como QR de pago). */
const PLACEHOLDER_PAYLOAD = "VIDA TOTAL - QR DE PAGO PENDIENTE DE CONFIGURAR";

/** Ubicación del QR plano dentro del escenario: la usa el overlay y la escena 3D (el morph termina exactamente ahí). */
const SLOT_STYLE: React.CSSProperties = { width: "min(76%, 300px)", aspectRatio: "1 / 1", left: "50%", top: "47%", transform: "translate(-50%, -50%)" };

/**
 * Pantalla de pago: reemplaza a los módulos cuando la cuenta todavía no pagó (cuenta nueva), venció o está bloqueada.
 * SIEMPRE es de pago: el usuario elige un plan (los configura el admin; cada uno trae su duración) y NUNCA ve una opción de
 * prueba gratuita — esa solo existe si el admin se la asigna a un usuario puntual, y entonces ni siquiera pasa por acá.
 *
 * Flujo: elige plan → ve el árbol 3D (se mueve) → lo toca → el piso se aplana hasta ser la matriz del QR → aparece el QR como SVG
 * PLANO encima (overlay HTML, jamás dentro de la escena; se puede descargar como imagen) → transfiere y sube su comprobante con
 * el plan elegido → un admin lo confirma A MANO (no hay confirmación automática: nada avisa cuando llega el dinero).
 */
export function PaymentGate({
  userId,
  subscription,
  payment,
  figureId,
  preview,
  onClosePreview,
}: {
  userId: string;
  subscription: SubscriptionInfo;
  payment: PaymentSettings;
  figureId?: string;
  /** Vista previa para el admin: no envía comprobantes y se cierra con un botón. */
  preview?: boolean;
  onClosePreview?: () => void;
}) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PaymentScene | null>(null);
  const [sceneState, setSceneState] = useState<"loading" | "ready" | "error">("loading");
  const [backend, setBackend] = useState<RenderBackend | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [svg, setSvg] = useState<{ payload: string; svg: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(subscription.status === "pendiente");
  const [error, setError] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const plans = useMemo(() => sortPlans(payment.plans.filter((p) => p.active)), [payment.plans]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planHint, setPlanHint] = useState(false);
  const plan: SubscriptionPlan | null = plans.find((p) => p.id === planId) ?? null;

  const payload = payment.qrPayload;
  const hasQr = !!payload;
  const pending = sent || subscription.status === "pendiente";
  const matrix = useMemo(() => getQrMatrix(payload ?? PLACEHOLDER_PAYLOAD), [payload]);
  const matrixRef = useRef(matrix);

  // El SVG se regenera SIEMPRE desde el texto guardado; nunca se usa la imagen original ni se vuelve a decodificar nada.
  useEffect(() => {
    if (!payload) return;
    let alive = true;
    renderQrSvg(payload).then((s) => alive && setSvg({ payload, svg: s }));
    return () => {
      alive = false;
    };
  }, [payload]);
  const qrSvg = svg && svg.payload === payload ? svg.svg : null;

  // El piso de la escena toma la forma de la matriz; si el QR cambia, se rearma.
  useEffect(() => {
    matrixRef.current = matrix;
    sceneRef.current?.setMatrix(matrix);
  }, [matrix]);

  const openQr = useRef<() => void>(() => {});
  useEffect(() => {
    openQr.current = () => {
      const scene = sceneRef.current;
      if (!hasQr || !scene) return;
      if (!plan) {
        // Sin plan elegido no se abre el QR: el monto depende del plan.
        setPlanHint(true);
        plansRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      scene
        .playSelectTransition(() => {
          const host = hostRef.current;
          const slot = slotRef.current;
          if (!host || !slot) return null;
          const hr = host.getBoundingClientRect();
          const sr = slot.getBoundingClientRect();
          return { cx: sr.left - hr.left + sr.width / 2, cy: sr.top - hr.top + sr.height / 2, size: sr.width };
        })
        .then(() => setQrOpen(true));
    };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new PaymentScene(host, {
      figureId,
      matrix: matrixRef.current,
      reduceMotion: reduce,
      onReady: (info) => {
        setBackend(info.backend);
        setSceneState("ready");
      },
      onSelect: () => openQr.current(),
      onError: () => setSceneState("error"),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [figureId]);

  function closeQr() {
    setQrOpen(false);
    void sceneRef.current?.reverseTransition();
  }

  async function downloadQr() {
    if (!payload) return;
    setDownloadMsg(null);
    const blob = await renderQrPng(payload);
    if (!blob) {
      setDownloadMsg("No se pudo generar la imagen del QR. Probá de nuevo.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-pago-vida-total.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function sendReceipt() {
    if (preview) return setError("Vista previa: acá no se envían comprobantes.");
    if (!plan) {
      setPlanHint(true);
      return setError("Elegí un plan antes de enviar el comprobante.");
    }
    setSending(true);
    setError(null);
    const res = await submitReceipt(createClient(), { userId, file, note, plan });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setFile(null);
      setNote("");
      router.refresh();
    } else {
      setError(
        /relation|does not exist|bucket|not found/i.test(res.error)
          ? "El envío de comprobantes todavía no está activado en esta cuenta (falta aplicar la migración 0018). Avisale al administrador."
          : `No se pudo enviar el comprobante: ${res.error}`,
      );
    }
  }

  async function signOut() {
    if (preview) return onClosePreview?.();
    await createClient().auth.signOut();
    setCurrentUserId(null);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga COMPLETA a propósito: descarta de la memoria los stores de la cuenta que sale
    window.location.href = "/login"; // recarga completa: sin datos de esta cuenta en memoria
  }

  const venc = formatDate(subscription.nextPayment);
  const title = pending ? "Pago en revisión" : subscription.status === "sin_plan" ? "Elegí tu plan" : "Tu suscripción venció";
  const subtitle = pending
    ? "El administrador está revisando tu comprobante."
    : subscription.status === "sin_plan"
      ? "Vida Total es una suscripción de pago: elegí un plan para empezar."
      : venc
        ? `Venció el ${venc}`
        : "Acceso suspendido por el administrador";
  const amountText = plan?.price_label || payment.amountLabel;

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center px-4 py-6 gap-5">
      <div className="w-full max-w-[460px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot mood={pending ? "thinking" : "alert"} size={64} />
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{title}</h1>
            <p className="text-xs text-white/55">{subtitle}</p>
          </div>
        </div>
        <button onClick={signOut} aria-label="Cerrar sesión" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white cursor-pointer">
          <LogOut size={14} /> {preview ? "Cerrar vista previa" : "Salir"}
        </button>
      </div>

      {/* Planes: siempre de pago, elegís uno */}
      {!pending && (
        <DarkCard className="w-full max-w-[460px] flex flex-col gap-2">
          <div ref={plansRef} className="flex items-center justify-between">
            <p className="text-[15px] font-extrabold">Elegí tu plan</p>
            {planHint && !plan && <span className="text-xs text-[#ff9a9d]">Elegí uno para ver el QR</span>}
          </div>
          <div role="radiogroup" aria-label="Planes de suscripción" className="flex flex-col gap-2">
            {plans.map((p) => {
              const active = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setPlanId(p.id);
                    setPlanHint(false);
                  }}
                  className="flex items-center justify-between rounded-[18px] px-4 min-h-[56px] text-left cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ background: active ? "#2b2b2e" : "transparent", border: active ? "1px solid rgba(255,255,255,0.55)" : BORDER }}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full grid place-items-center" style={{ border: "2px solid rgba(255,255,255,0.5)", background: active ? "#f4f4f5" : "transparent" }}>
                      {active && <Check size={12} className="text-black" strokeWidth={3.5} />}
                    </span>
                    <span>
                      <span className="block text-[15px] font-extrabold">{p.name}</span>
                      <span className="block text-xs text-white/45">{p.months === 1 ? "1 mes de acceso" : `${p.months} meses de acceso`}</span>
                    </span>
                  </span>
                  <span className="text-[15px] font-extrabold">{p.price_label || "—"}</span>
                </button>
              );
            })}
          </div>
        </DarkCard>
      )}

      {/* Escena 3D + overlay del QR */}
      <div
        className="relative w-full max-w-[460px] aspect-[4/5] shrink-0 rounded-[32px] overflow-hidden"
        style={{ background: "linear-gradient(180deg, #f8f8f8 0%, #e6e6e6 100%)", border: BORDER }}
      >
        <div ref={hostRef} className="absolute inset-0" data-testid="payment-scene" />
        {/* Recuadro invisible donde termina el morph y se coloca el QR plano. */}
        <div ref={slotRef} aria-hidden className="absolute pointer-events-none" style={SLOT_STYLE} />
        {sceneState === "loading" && <p className="absolute inset-0 grid place-items-center text-xs text-black/40">Cargando…</p>}
        {sceneState === "error" && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-black/55">No se pudo iniciar la vista 3D en este navegador. Usá el botón de abajo para ver el QR.</p>
        )}
        {sceneState === "ready" && !qrOpen && (
          <p className="absolute bottom-4 inset-x-0 text-center text-[13px] font-bold text-black/60 pointer-events-none">
            {hasQr ? "Tocá el árbol para ver el QR de pago" : "El administrador todavía no cargó el QR de pago"}
          </p>
        )}
        {backend && process.env.NODE_ENV !== "production" && <span className="absolute top-3 left-4 text-[10px] text-black/30">render: {backend}</span>}

        <AnimatePresence>
          {qrOpen && qrSvg && (
            <motion.div key="qr" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <button onClick={closeQr} aria-label="Cerrar QR" className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-black/10 hover:bg-black/20 text-black cursor-pointer z-10">
                <X size={18} />
              </button>
              <div className="absolute inset-x-0 top-[5%] px-6 text-center text-black">
                {plan && <p className="text-[13px] font-bold text-black/60">{plan.name}</p>}
                {amountText && <p className="text-xl font-extrabold leading-tight">{amountText}</p>}
              </div>
              {/* QR plano: SVG regenerado del texto, negro sobre blanco opaco. Sin luz, sombra, filtro ni transparencia. */}
              <div
                role="img"
                aria-label="Código QR de pago"
                data-testid="payment-qr"
                className="absolute overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                style={{ ...SLOT_STYLE, background: "#ffffff" }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="absolute inset-x-0 bottom-[3.5%] px-6 flex flex-col items-center gap-2">
                {payment.instructions && <p className="text-center text-xs text-black/65 max-w-[320px] whitespace-pre-line line-clamp-3">{payment.instructions}</p>}
                <button
                  onClick={downloadQr}
                  className="flex items-center gap-1.5 rounded-full px-4 min-h-[40px] text-[13px] font-extrabold cursor-pointer bg-black text-white active:scale-95 transition-transform"
                >
                  <Download size={15} /> Descargar QR
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasQr && !qrOpen && (
        <div className="w-full max-w-[460px] flex flex-col gap-2">
          <Btn variant="chip" onClick={() => openQr.current()} className="w-full">
            Ver el QR de pago
          </Btn>
          <button onClick={downloadQr} className="flex items-center justify-center gap-1.5 text-xs text-white/55 hover:text-white cursor-pointer min-h-[36px]">
            <Download size={14} /> Descargar imagen del QR
          </button>
        </div>
      )}
      {downloadMsg && <p className="text-xs text-[#ff9a9d] max-w-[460px]">{downloadMsg}</p>}

      {/* Comprobante */}
      <DarkCard className="w-full max-w-[460px] flex flex-col gap-3">
        {pending ? (
          <>
            <p className="text-[15px] font-extrabold">Comprobante enviado</p>
            <p className="text-sm text-white/60">El administrador lo revisa a mano. Cuando lo confirme se activa tu acceso; no hay confirmación automática del banco.</p>
            <Btn variant="light" onClick={() => router.refresh()} className="flex items-center justify-center gap-2">
              <RefreshCw size={15} /> Ya me confirmaron: actualizar
            </Btn>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold">¿Ya transferiste?</p>
            <p className="text-sm text-white/60">
              {plan ? `Plan elegido: ${plan.name}${plan.price_label ? ` (${plan.price_label})` : ""}. ` : "Elegí un plan arriba. "}
              Sube la captura del comprobante para que el administrador confirme tu pago. Se activa cuando él lo apruebe.
            </p>
            <label className="flex items-center gap-2 rounded-2xl px-3 min-h-[48px] cursor-pointer text-sm" style={{ background: "#2b2b2e", border: BORDER }}>
              <Paperclip size={16} className="text-white/50 shrink-0" />
              <span className="truncate">{file ? file.name : "Adjuntar comprobante (imagen o PDF)"}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional (nombre de quien transfirió, fecha…)"
              className="rounded-2xl px-3 min-h-[44px] text-sm outline-none placeholder:text-white/30"
              style={{ background: "#2b2b2e", border: BORDER }}
            />
            {error && <p className="text-xs text-[#ff9a9d]">{error}</p>}
            <Btn variant="light" disabled={sending || (!file && !note.trim())} onClick={sendReceipt}>
              {sending ? "Enviando…" : "Enviar comprobante"}
            </Btn>
          </>
        )}
      </DarkCard>
    </div>
  );
}
