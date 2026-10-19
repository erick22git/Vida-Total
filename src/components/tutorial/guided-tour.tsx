"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, Btn } from "@/components/agente/ui";
import { TOUR_STEPS, type TourStep } from "@/lib/tutorial/steps";
import { useTour } from "@/lib/store/tourStore";
import { createClient } from "@/lib/supabase/client";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const PAD = 8;
const BUBBLE_W = 340;

/**
 * Tutorial guiado: burbujas que señalan cada bloque de la pantalla, narradas por la mascota (la misma mascota 2D de la app: se
 * mueve hasta el bloque, lo señala con una flecha y habla). Se muestra solo a un usuario nuevo (`profiles.tutorial_seen = false`),
 * se marca como visto al terminar o saltarlo, y se puede volver a lanzar desde Configuración (panel de la mascota).
 */
export function GuidedTour({ userId, autoStart, steps = TOUR_STEPS }: { userId: string; autoStart: boolean; steps?: TourStep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { active, intro, index, start, begin, next, prev, stop } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 375, h: 700 });
  const step = active && !intro ? steps[index] : null;

  const markSeen = useCallback(async () => {
    try {
      localStorage.setItem(`vt_tutorial_seen_${userId}`, "1");
    } catch {
      /* sin almacenamiento local */
    }
    const { error } = await createClient().from("profiles").update({ tutorial_seen: true }).eq("id", userId);
    if (error) console.warn("tutorial: no se pudo guardar tutorial_seen (¿falta la migración 0018?):", error.message);
  }, [userId]);

  const finish = useCallback(() => {
    stop();
    void markSeen();
  }, [stop, markSeen]);

  // Arranque automático para un usuario nuevo (con una burbuja de bienvenida que pregunta antes de mover nada).
  useEffect(() => {
    if (!autoStart) return;
    let seen = false;
    try {
      seen = localStorage.getItem(`vt_tutorial_seen_${userId}`) === "1";
    } catch {
      /* sin almacenamiento local */
    }
    if (seen) return;
    const t = setTimeout(() => start(true), 900);
    return () => clearTimeout(t);
  }, [autoStart, userId, start]);

  // Ir a la ruta del paso.
  useEffect(() => {
    if (!step) return;
    const target = new URL(step.href, window.location.origin);
    if (target.pathname !== window.location.pathname) router.push(step.href);
  }, [step, router]);

  // Encontrar el bloque (la pantalla puede tardar en montar) y seguirlo mientras se mueve.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let tries = 0;
    const measure = () => {
      if (cancelled) return;
      setVp({ w: window.innerWidth, h: window.innerHeight });
      const onRoute = window.location.pathname === new URL(step.href, window.location.origin).pathname;
      const el = onRoute ? step.find() : null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect((prev) =>
            prev && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
              ? prev
              : { left: r.left, top: r.top, width: r.width, height: r.height },
          );
          return;
        }
      }
      tries += 1;
      if (tries > 16) setRect(null); // ~2.5 s sin encontrarlo: burbuja centrada, sin resaltar
    };
    const first = setTimeout(measure, 150);
    const id = setInterval(measure, 160);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [step, pathname]);

  // Se acabaron los pasos.
  useEffect(() => {
    if (active && !intro && index >= steps.length) finish();
  }, [active, intro, index, finish, steps.length]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active) return null;

  // ── Burbuja de bienvenida ─────────────────────────────────────────────────
  if (intro) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/75" role="dialog" aria-modal="true" aria-label="Tutorial">
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-[360px] rounded-[28px] p-5 flex flex-col items-center gap-3 text-center" style={{ background: "#1c1c1e", border: BORDER }}>
          <Mascot mood="happy" size={110} />
          <p className="text-[19px] font-extrabold">¿Te muestro cómo funciona?</p>
          <p className="text-sm text-white/60">Te guío por Calorías y Entrenamiento, señalando cada parte de la pantalla. Dura un minuto y puedes repetirlo cuando quieras desde Configuración.</p>
          <div className="flex gap-2 pt-1">
            <Btn onClick={finish}>Ahora no</Btn>
            <Btn variant="light" onClick={begin}>Sí, vamos</Btn>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!step) return null;

  const isLast = index === steps.length - 1;
  const w = Math.min(BUBBLE_W, vp.w - 24);
  const below = rect ? rect.top + rect.height / 2 < vp.h / 2 : false;
  const cx = rect ? rect.left + rect.width / 2 : vp.w / 2;
  const left = Math.max(12, Math.min(vp.w - w - 12, cx - w / 2));
  const GAP = 62; // espacio entre el bloque y la burbuja: ahí va la mascota con su flecha
  const bubbleStyle: React.CSSProperties = rect
    ? below
      ? { left, top: Math.min(vp.h - 200, rect.top + rect.height + PAD + GAP), width: w }
      : { left, bottom: Math.max(12, vp.h - rect.top + PAD + GAP), width: w }
    : { left: (vp.w - w) / 2, top: "50%", width: w, transform: "translateY(-50%)" };
  const mascotX = Math.max(8, Math.min(vp.w - 76, cx - 36));
  const mascotY = rect ? (below ? rect.top + rect.height + PAD + 4 : rect.top - PAD - 4 - 60) : 0;

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${step.title}`}>
      {/* bloquea la pantalla de abajo mientras dura el recorrido */}
      <div className="absolute inset-0" style={{ background: rect ? "transparent" : "rgba(0,0,0,0.72)" }} />
      {rect && (
        <motion.div
          className="absolute rounded-[20px] pointer-events-none"
          initial={false}
          animate={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2px rgba(255,255,255,0.55)" }}
        />
      )}

      {rect && (
        <motion.div
          className="absolute pointer-events-none flex items-center gap-1"
          initial={false}
          animate={{ left: mascotX, top: mascotY }}
          transition={{ type: "spring", damping: 20, stiffness: 160 }}
        >
          <Mascot mood="happy" size={72} />
          <motion.span animate={{ y: below ? [0, -5, 0] : [0, 5, 0] }} transition={{ duration: 0.9, repeat: Infinity }} className="text-white">
            {below ? <ArrowUp size={26} strokeWidth={3} /> : <ArrowDown size={26} strokeWidth={3} />}
          </motion.span>
        </motion.div>
      )}

      <motion.div
        key={step.id}
        className="absolute rounded-[26px] p-4 flex flex-col gap-2"
        style={{ ...bubbleStyle, background: "#1c1c1e", border: BORDER, boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}
        initial={{ opacity: 0, y: below ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {!rect && <Mascot mood="happy" size={84} />}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[16px] font-extrabold">{step.title}</p>
          <span className="text-[11px] text-white/40 tabular-nums">
            {index + 1}/{steps.length}
          </span>
        </div>
        <p className="text-[13.5px] leading-snug text-white/70">{step.text}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={finish} className="text-xs text-white/45 hover:text-white cursor-pointer">
            Saltar
          </button>
          <div className="flex gap-2">
            {index > 0 && <Btn onClick={prev}>Atrás</Btn>}
            <Btn variant="light" onClick={isLast ? finish : next}>
              {step.next ?? "Siguiente"}
            </Btn>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
