"use client";

import { useEffect, useRef, useState } from "react";
import { useGymStore } from "@/lib/store/gymStore";
import { useHabitsStore } from "@/lib/store/habitsStore";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { flowTrace, useFlowDebugStore } from "@/lib/habits/flow-debug";
import { useHabitPromptStore } from "@/lib/habits/habit-prompts";
import { startGymGoalWatcher } from "@/lib/gym/goal-events";
import { startSourceDispatcher } from "@/lib/habits/source-dispatcher";
import { emitProgressEvent } from "@/lib/progress/event-bus";
import type { ProgressEventType } from "@/lib/progress/types";

/** Pausa antes de llevar al usuario al hábito: deja ver el feedback propio del módulo que cumplió el objetivo. */
const NAVIGATE_DELAY_MS = 1400;
/** Un aviso solo lleva al hábito mientras sea reciente (así recargar la página justo después también funciona). */
const NAVIGATE_WINDOW_MS = 2 * 60_000;

/**
 * Pegamento entre módulos, montado UNA vez en el layout del dashboard:
 *   Gym (vigila sus objetivos) → bus de progreso → Hábitos (deja una acción pendiente PERSISTIDA) → lleva al usuario al hábito.
 *
 * La navegación NO depende del evento (que es instantáneo): se decide a partir de la acción pendiente guardada.
 * Por eso sobrevive a cambiar de pantalla, desmontar componentes o recargar: al montar y cada vez que aparece un
 * aviso reciente sin atender, se navega al hábito una sola vez (`navigatedAt`). No contiene lógica de ningún módulo.
 */
export function HabitSourceBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const scheduled = new Set<string>();
    const timers = new Set<number>();

    const consider = () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const pending = useHabitPromptStore
        .getState()
        .prompts.filter((p) => p.date === today && !p.navigatedAt && Date.now() - p.createdAt < NAVIGATE_WINDOW_MS)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!pending) return;
      const key = `${pending.habitId}:${pending.createdAt}`;
      if (scheduled.has(key)) return;
      scheduled.add(key);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        const { markNavigated } = useHabitPromptStore.getState();
        markNavigated(pending.habitId, pending.createdAt);
        // Ya estás en la pantalla de hábitos: la propia pantalla reacciona al pendiente (enfoca el hábito y guía el check).
        if (pathRef.current.startsWith("/habitos/habito")) {
          flowTrace("ROUTE", true, "ya estás en la pantalla del hábito; no hace falta navegar");
          return;
        }
        const target = `/habitos/habito?id=${encodeURIComponent(pending.habitId)}`;
        flowTrace("ROUTE", true, `router.push(${target})`);
        flowTrace("TARGET", true, pending.habitId);
        router.push(target);
      }, NAVIGATE_DELAY_MS);
      timers.add(timer);
    };

    const stopGym = startGymGoalWatcher();
    const stopHabits = startSourceDispatcher(() => {});
    const stopPrompts = useHabitPromptStore.subscribe(consider);
    consider(); // avisos que ya estaban guardados (recarga, cambio de módulo)
    return () => {
      stopGym();
      stopHabits();
      stopPrompts();
      timers.forEach((t) => window.clearTimeout(t));
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
  const lines = useFlowDebugStore((s) => s.lines);
  const clear = useFlowDebugStore((s) => s.clear);
  useEffect(() => {
    // Solo desarrollo: acceso a los stores reales desde la consola (`__vt.gym.getState().addWater(500)`).
    (window as unknown as { __vt?: unknown }).__vt = { gym: useGymStore, habits: useHabitsStore, prompts: useHabitPromptStore };
  }, []);
  return (
    <div className="fixed left-2 bottom-24 z-[60] flex flex-col items-start gap-1 text-[10px]" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
      {open && (
        <div className="flex flex-col gap-1 rounded-lg p-1.5" style={{ background: "rgba(0,0,0,0.78)", color: "#fff" }}>
          <span className="opacity-60 px-1">simular evento · solo desarrollo</span>
          <div data-testid="flow-trace" className="max-w-[300px] px-1 py-0.5 leading-snug" style={{ background: "rgba(255,255,255,0.06)" }}>
            {lines.length === 0 ? (
              <span className="opacity-50">sin actividad</span>
            ) : (
              lines.slice(-8).map((l, i) => (
                <div key={i} style={{ color: l.ok ? "#7ee787" : "#ff7b72" }}>
                  {l.ok ? "✓" : "✗"} {l.step}
                  {l.detail ? ` · ${l.detail}` : ""}
                </div>
              ))
            )}
            {lines.length > 0 && (
              <button className="opacity-60 underline cursor-pointer" onClick={clear}>
                limpiar
              </button>
            )}
          </div>
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
