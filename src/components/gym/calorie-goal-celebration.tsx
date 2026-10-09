"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { progressEvents } from "@/lib/progress/event-bus";
import { celebrationDue } from "@/lib/gym/calorie-state";
import { playEvent } from "@/lib/sound/sound-manager";

const KEY = "vt-kcal-celebrated";
const SHOW_MS = 3200;
const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#f97316", "#ec4899", "#ffffff"];

function readLast(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Confeti en canvas (sin dependencias): ~150 piezas con gravedad y giro durante ~3 s. */
function launchConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: 150 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const a = (fromLeft ? -1 : 1) * (0.5 + Math.random() * 0.7) - Math.PI / 2;
    const sp = 9 + Math.random() * 9;
    return {
      x: fromLeft ? w * 0.08 : w * 0.92,
      y: h * 0.62,
      vx: Math.cos(a) * -sp * (fromLeft ? -1 : 1) * 0.6 + (fromLeft ? 1 : -1) * Math.random() * 6,
      vy: -Math.abs(Math.sin(a)) * sp - Math.random() * 6,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });
  let raf = 0;
  const t0 = performance.now();
  const loop = (now: number) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.8) : 1;
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (t < SHOW_MS / 1000) raf = requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

/**
 * Celebración de meta de calorías: escucha el evento `calories.goal_reached` (Gym lo emite UNA vez cuando el día cruza la meta
 * hacia arriba) y muestra confeti + felicitación, una sola vez por día (el día ya celebrado queda en localStorage).
 * No calcula nada de calorías: solo reacciona al evento.
 */
export function CalorieGoalCelebration() {
  const [info, setInfo] = useState<{ value: number; goal: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return progressEvents.subscribe((e) => {
      if (e.type !== "calories.goal_reached") return;
      const today = format(new Date(), "yyyy-MM-dd");
      if (!celebrationDue(today, readLast())) return;
      try {
        localStorage.setItem(KEY, today);
      } catch {
        /* sin almacenamiento: puede repetirse en otra sesión, no dentro de esta pantalla */
      }
      setInfo({ value: Number(e.meta?.value ?? 0), goal: Number(e.meta?.goal ?? 0) });
      void playEvent("goal-reached");
    });
  }, []);

  useEffect(() => {
    if (!info) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const stop = !reduce && canvasRef.current ? launchConfetti(canvasRef.current) : () => {};
    const timer = window.setTimeout(() => setInfo(null), SHOW_MS + 300);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [info]);

  if (!info) return null;
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none" data-testid="calorie-goal-celebration" role="status" aria-live="polite">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-x-0 top-[22%] flex justify-center px-6">
        <div className="rounded-3xl bg-black/70 backdrop-blur px-6 py-4 text-center border border-white/15 shadow-2xl">
          <p className="text-2xl font-bold text-white">¡Meta de calorías lograda! 🎉</p>
          {info.goal > 0 && (
            <p className="text-sm text-white/70 mt-1">
              {Math.round(info.value).toLocaleString()} de {info.goal.toLocaleString()} kcal. ¡Buen trabajo hoy!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
