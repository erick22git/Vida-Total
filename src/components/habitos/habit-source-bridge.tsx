"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startGymGoalWatcher } from "@/lib/gym/goal-events";
import { startSourceDispatcher } from "@/lib/habits/source-dispatcher";
import { emitProgressEvent } from "@/lib/progress/event-bus";
import type { ProgressEventType } from "@/lib/progress/types";

/** Pausa antes de llevar al usuario al hábito: deja ver el feedback propio del módulo que cumplió el objetivo. */
const NAVIGATE_DELAY_MS = 1400;

/**
 * Pegamento entre módulos, montado UNA vez en el layout del dashboard:
 *   Gym (vigila sus objetivos) → bus de progreso → Hábitos (marca la acción pendiente) → lleva al usuario al hábito.
 * No contiene lógica de ningún módulo; solo conecta los dos extremos y navega.
 */
export function HabitSourceBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const stopGym = startGymGoalWatcher();
    const stopHabits = startSourceDispatcher((habitIds) => {
      // Ya estás en la pantalla de hábitos: la propia pantalla reacciona al pendiente (enfoca el hábito y guía el check).
      if (pathRef.current.startsWith("/habitos/habito")) return;
      window.setTimeout(() => router.push(`/habitos/habito?id=${encodeURIComponent(habitIds[0])}`), NAVIGATE_DELAY_MS);
    });
    return () => {
      stopGym();
      stopHabits();
    };
  }, [router]);

  return process.env.NODE_ENV !== "production" ? <ProgressEventSimulator /> : null;
}

const SIMULATED: { type: ProgressEventType; label: string }[] = [
  { type: "calories.goal_reached", label: "calorías" },
  { type: "water.goal_reached", label: "agua" },
  { type: "workout.completed", label: "entreno" },
];

/** Solo desarrollo: simula los eventos de Gym sin tener que cumplir el objetivo de verdad. No existe en producción. */
function ProgressEventSimulator() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed left-2 bottom-24 z-[60] flex flex-col items-start gap-1 text-[10px]" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
      {open && (
        <div className="flex flex-col gap-1 rounded-lg p-1.5" style={{ background: "rgba(0,0,0,0.78)", color: "#fff" }}>
          <span className="opacity-60 px-1">simular evento · solo desarrollo</span>
          {SIMULATED.map((s) => (
            <button
              key={s.type}
              data-sim={s.type}
              className="text-left rounded-md px-2 py-1 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.12)" }}
              onClick={() => emitProgressEvent(s.type, `sim:${s.type}`, { simulated: true })}
            >
              {s.type}
            </button>
          ))}
        </div>
      )}
      <button
        aria-label="Simular eventos de Gym (desarrollo)"
        className="h-6 rounded-full px-2 cursor-pointer"
        style={{ background: "rgba(0,0,0,0.6)", color: "#f5b301" }}
        onClick={() => setOpen((o) => !o)}
      >
        sim
      </button>
    </div>
  );
}
