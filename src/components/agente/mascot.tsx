"use client";

import { motion } from "framer-motion";

import type { Costume } from "@/lib/agent/agents";

export type MascotMood = "idle" | "thinking" | "happy" | "alert" | "off";

const BODY: Record<MascotMood, string> = {
  idle: "#e9ecd9",
  thinking: "#e9ecd9",
  happy: "#e9ecd9",
  alert: "#e5484d",
  off: "#4a4a4e",
};

/**
 * Mascota 2D (SVG, plana, sin vidrio): cuerpo de «mochi» con dos ojos y dos manitas. Se anima sola (flota y parpadea) y cambia
 * con el ánimo: pensando (ojos al lado, manitas inquietas), contenta (ojos curvos), alerta (roja: Auto total o error) y
 * apagada (gris). `size` es el ancho en px. Sin dependencias de imágenes: no pesa nada.
 */
export function Mascot({ mood = "idle", size = 120, still = false, costume = "none", accent = "#f4f4f5" }: { mood?: MascotMood; size?: number; still?: boolean; costume?: Costume; accent?: string }) {
  const body = BODY[mood];
  const look = mood === "thinking" ? 5 : 0;
  const eyes = mood === "off" ? "closed" : mood === "happy" ? "happy" : "open";
  const float = still || mood === "off" ? {} : { y: [0, -3, 0] };
  return (
    <motion.svg
      viewBox="0 0 120 84"
      width={size}
      height={(size * 84) / 120}
      role="img"
      aria-label={`Mascota: ${mood}`}
      animate={float}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* manitas */}
      <motion.circle cx="14" cy="64" r="8" fill={body} animate={mood === "thinking" ? { cy: [64, 60, 64] } : {}} transition={{ duration: 0.9, repeat: Infinity }} />
      <motion.ellipse cx="106" cy="30" rx="8" ry="6.5" transform="rotate(-28 106 30)" fill={body} animate={mood === "thinking" ? { cy: [30, 26, 30] } : mood === "happy" ? { cy: [30, 24, 30] } : {}} transition={{ duration: 0.9, repeat: Infinity }} />
      {/* cuerpo */}
      <rect x="22" y="12" width="76" height="62" rx="26" fill={body} />
      <rect x="22" y="12" width="76" height="62" rx="26" fill="url(#mascot-shade)" opacity="0.35" />
      {/* traje del agente activo */}
      {costume === "chef" && (
        <g fill="#fafafa" stroke="#d4d4d8" strokeWidth="0.8">
          <circle cx="50" cy="8" r="7" />
          <circle cx="60" cy="5" r="8" />
          <circle cx="70" cy="8" r="7" />
          <rect x="47" y="9" width="26" height="9" rx="3" />
        </g>
      )}
      {costume === "sport" && (
        <g>
          <rect x="22" y="22" width="76" height="8" fill={accent} />
          <rect x="91" y="19" width="12" height="5" rx="2.5" fill={accent} transform="rotate(-18 97 21)" />
          <rect x="91" y="26" width="12" height="5" rx="2.5" fill={accent} transform="rotate(14 97 28)" />
        </g>
      )}
      {costume === "glasses" && (
        <g fill="none" stroke={accent} strokeWidth="2.6">
          <circle cx="48" cy="42" r="9.5" />
          <circle cx="68" cy="42" r="9.5" />
          <path d="M57.5 41 L58.5 41" />
        </g>
      )}
      {costume === "bell" && (
        <g>
          <path d="M92 6 q0 -7 7 -7 q7 0 7 7 v5 h-14z" fill={accent} />
          <circle cx="99" cy="14" r="2.4" fill={accent} />
        </g>
      )}
      {/* ojos */}
      {eyes === "open" && (
        <g transform={`translate(${look} 0)`}>
          {[48, 68].map((x) => (
            <motion.ellipse key={x} cx={x} cy="42" rx="3.1" ry="5.4" fill="#0b0b0c" animate={still ? {} : { scaleY: [1, 1, 0.1, 1] }} style={{ transformOrigin: `${x}px 42px` }} transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.92, 0.96, 1] }} />
          ))}
        </g>
      )}
      {eyes === "happy" &&
        [48, 68].map((x) => <path key={x} d={`M${x - 5} 44 Q${x} 37 ${x + 5} 44`} stroke="#0b0b0c" strokeWidth="3.2" fill="none" strokeLinecap="round" />)}
      {eyes === "closed" && [48, 68].map((x) => <path key={x} d={`M${x - 5} 42 L${x + 5} 42`} stroke="#0b0b0c" strokeWidth="3" strokeLinecap="round" />)}
      <defs>
        <linearGradient id="mascot-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
