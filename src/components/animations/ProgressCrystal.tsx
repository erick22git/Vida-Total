"use client";

import { motion } from "framer-motion";

/**
 * Placeholder del objeto único de progreso ("el cristal que se talla") —
 * mismos 6 estados que va a exponer la versión final en Rive
 * (idle/progress-25/50/75/complete/milestone), para que el resto de la
 * arquitectura (Animation Engine, HabitCheckButton) ya quede terminada
 * ahora y el día que se reemplace este componente por un `<RiveObject/>`
 * sea un cambio de UNA sola línea en quien lo usa, sin tocar lógica.
 *
 * Metáfora: no es una gema genérica ni un logro de videojuego — cada
 * faceta se "talla" (se revela) a medida que pasa el tiempo/progreso, como
 * si el usuario mismo estuviera puliendo la pieza. Minimalista a propósito:
 * líneas finas, un solo tono cálido neutro, sin saturación ni relleno
 * sólido — el brillo aparece recién en "complete"/"milestone", nunca antes.
 */
export type CrystalState = "idle" | "progress-25" | "progress-50" | "progress-75" | "complete" | "milestone";

const FACET_COUNT_BY_STATE: Record<CrystalState, number> = {
  idle: 0,
  "progress-25": 2,
  "progress-50": 4,
  "progress-75": 6,
  complete: 6,
  milestone: 6,
};

// Hexágono exterior ("piedra en bruto") y hexágono interior ("mesa" tallada),
// mismos ángulos, distinto radio — 6 facetas uniendo cada par de vértices.
const OUTER: [number, number][] = [
  [81.2, 68], [50, 86], [18.8, 68], [18.8, 32], [50, 14], [81.2, 32],
];
const INNER: [number, number][] = [
  [62.1, 57], [50, 64], [37.9, 57], [37.9, 43], [50, 36], [62.1, 43],
];

function polygonPath(points: [number, number][]): string {
  return `M ${points.map((p) => p.join(",")).join(" L ")} Z`;
}

export function ProgressCrystal({
  state,
  reduceMotion = false,
  size = 72,
}: {
  state: CrystalState;
  reduceMotion?: boolean;
  size?: number;
}) {
  const litFacets = FACET_COUNT_BY_STATE[state];
  const isComplete = state === "complete" || state === "milestone";
  const isMilestone = state === "milestone";
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow trasero — solo en complete/milestone, muy suave. */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, #f3e5c3 0%, transparent 70%)" }}
        animate={{ opacity: isComplete ? (isMilestone ? 0.55 : 0.32) : 0, scale: isComplete ? 1.15 : 0.8 }}
        transition={transition}
      />
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative"
        animate={reduceMotion ? undefined : { rotate: isMilestone ? [0, -4, 0] : 0, scale: isMilestone ? [1, 1.08, 1] : 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
      >
        {/* Contorno exterior — siempre visible, tenue en idle. */}
        <motion.path
          d={polygonPath(OUTER)}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1.2}
          animate={{ opacity: state === "idle" ? 0.35 : 0.75 }}
          transition={transition}
        />
        {/* Mesa interior — aparece desde progress-50. */}
        <motion.path
          d={polygonPath(INNER)}
          fill={isComplete ? "#f3e5c3" : "none"}
          fillOpacity={isComplete ? (isMilestone ? 0.28 : 0.18) : 0}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
          animate={{ opacity: litFacets >= 4 ? 1 : 0 }}
          transition={transition}
        />
        {/* Facetas — se van "tallando" (revelando) una por una. */}
        {OUTER.map((outerPoint, i) => {
          const lit = i < litFacets;
          return (
            <motion.line
              key={i}
              x1={outerPoint[0]}
              y1={outerPoint[1]}
              x2={INNER[i][0]}
              y2={INNER[i][1]}
              stroke={isComplete ? "#e8d9b5" : "rgba(255,255,255,0.55)"}
              strokeWidth={1}
              pathLength={1}
              strokeDasharray={1}
              animate={{ strokeDashoffset: lit ? 0 : 1, opacity: lit ? 1 : 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.35, delay: reduceMotion ? 0 : i * 0.05, ease: "easeOut" }}
            />
          );
        })}
      </motion.svg>
    </div>
  );
}
