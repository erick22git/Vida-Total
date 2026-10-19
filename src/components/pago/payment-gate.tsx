"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Paperclip, RefreshCw, X } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, Btn, DarkCard } from "@/components/agente/ui";
import { PaymentScene, type RenderBackend } from "@/lib/3d/payment-scene";
import { renderQrSvg } from "@/lib/qr/qr";
import { submitReceipt } from "@/lib/admin/payments";
import { createClient } from "@/lib/supabase/client";
import type { PaymentSettings } from "@/lib/account/load-account";
import type { SubscriptionInfo } from "@/lib/subscription";

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return format(new Date(`${iso}T00:00:00`), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

/**
 * Pantalla que reemplaza a los módulos cuando la suscripción está vencida o el pago está en revisión.
 *
 * Flujo: se ve el árbol 3D → el usuario lo toca → transición (acercamiento + fundido) → aparece el QR como SVG PLANO encima
 * (overlay HTML, jamás dentro de la escena 3D) → el usuario transfiere y sube su comprobante → un admin lo confirma A MANO.
 * No hay confirmación automática del pago: el QR es de una transferencia bancaria y nada avisa cuando el dinero llega.
 */
export function PaymentGate({
  userId,
  subscription,
  payment,
  figureId,
}: {
  userId: string;
  subscription: SubscriptionInfo;
  payment: PaymentSettings;
  figureId?: string;
}) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PaymentScene | null>(null);
  const [sceneState, setSceneState] = useState<"loading" | "ready" | "error">("loading");
  const [backend, setBackend] = useState<RenderBackend | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [svgState, setSvgState] = useState<{ payload: string; svg: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(subscription.status === "pendiente");
  const [error, setError] = useState<string | null>(null);

  const hasQr = !!payment.qrPayload;
  const pending = sent || subscription.status === "pendiente";

  // El SVG del QR se regenera desde el TEXTO guardado; nunca se usa la imagen original.
  useEffect(() => {
    const payload = payment.qrPayload;
    if (!payload) return;
    let alive = true;
    renderQrSvg(payload).then((svg) => alive && setSvgState({ payload, svg }));
    return () => {
      alive = false;
    };
  }, [payment.qrPayload]);
  const qrSvg = svgState && svgState.payload === payment.qrPayload ? svgState.svg : null;

  const openQr = useRef<() => void>(() => {});
  useEffect(() => {
    openQr.current = () => {
      const scene = sceneRef.current;
      if (!hasQr || !scene) return;
      scene.playSelectTransition().then(() => setQrOpen(true));
    };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new PaymentScene(host, {
      figureId,
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
    sceneRef.current?.reset();
  }

  async function sendReceipt() {
    setSending(true);
    setError(null);
    const res = await submitReceipt(createClient(), { userId, file, note });
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
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const venc = formatDate(subscription.nextPayment);

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center px-4 py-6 gap-5">
      <div className="w-full max-w-[460px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot mood={pending ? "thinking" : "alert"} size={64} />
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{pending ? "Pago en revisión" : "Tu suscripción venció"}</h1>
            <p className="text-xs text-white/50">
              {venc ? `${pending ? "Vencía" : "Venció"} el ${venc}` : "Acceso suspendido por el administrador"}
            </p>
          </div>
        </div>
        <button onClick={signOut} aria-label="Cerrar sesión" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white cursor-pointer">
          <LogOut size={14} /> Salir
        </button>
      </div>

      {/* Escena 3D + overlay del QR */}
      <div className="relative w-full max-w-[460px] aspect-[4/5] rounded-[32px] overflow-hidden" style={{ background: "radial-gradient(120% 90% at 50% 15%, #1d2a1c 0%, #0b0f0b 55%, #000 100%)", border: BORDER }}>
        <div ref={hostRef} className="absolute inset-0" data-testid="payment-scene" />
        {sceneState === "loading" && <p className="absolute inset-0 grid place-items-center text-xs text-white/40">Cargando…</p>}
        {sceneState === "error" && <p className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-white/50">No se pudo iniciar la vista 3D en este navegador. Usa el botón de abajo para ver el QR.</p>}
        {sceneState === "ready" && !qrOpen && (
          <p className="absolute bottom-4 inset-x-0 text-center text-[13px] font-bold text-white/70 pointer-events-none">
            {hasQr ? "Toca el árbol para ver el QR de pago" : "El administrador todavía no cargó el QR de pago"}
          </p>
        )}
        {backend && process.env.NODE_ENV !== "production" && <span className="absolute top-3 left-4 text-[10px] text-white/30">render: {backend}</span>}

        <AnimatePresence>
          {qrOpen && qrSvg && (
            <motion.div
              key="qr"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <button onClick={closeQr} aria-label="Cerrar QR" className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer">
                <X size={18} />
              </button>
              {payment.amountLabel && <p className="text-base font-extrabold">{payment.amountLabel}</p>}
              {/* QR plano: SVG regenerado del texto, negro sobre blanco opaco, sin efectos ni iluminación. */}
              <div
                role="img"
                aria-label="Código QR de pago"
                data-testid="payment-qr"
                className="w-[min(78vw,300px)] aspect-square rounded-2xl overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                style={{ background: "#ffffff" }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              {payment.instructions && <p className="text-center text-xs text-white/60 max-w-[300px] whitespace-pre-line">{payment.instructions}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasQr && !qrOpen && (
        <Btn variant="chip" onClick={() => openQr.current()} className="w-full max-w-[460px]">
          Ver el QR de pago
        </Btn>
      )}

      {/* Comprobante */}
      <DarkCard className="w-full max-w-[460px] flex flex-col gap-3">
        {pending ? (
          <>
            <p className="text-[15px] font-extrabold">Comprobante enviado</p>
            <p className="text-sm text-white/60">El administrador lo revisa a mano. Cuando lo confirme se reactiva tu acceso; no hay confirmación automática del banco.</p>
            <Btn variant="light" onClick={() => router.refresh()} className="flex items-center justify-center gap-2">
              <RefreshCw size={15} /> Ya me confirmaron: actualizar
            </Btn>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold">¿Ya transferiste?</p>
            <p className="text-sm text-white/60">Sube la captura del comprobante para que el administrador confirme tu pago. Se activa cuando él lo apruebe.</p>
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
