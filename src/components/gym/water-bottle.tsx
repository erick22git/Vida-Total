"use client";

import { motion } from "framer-motion";

export interface WaterSegment {
  color: string;
  ml: number;
}

export function WaterBottle({ segments, max }: { segments: WaterSegment[]; max: number }) {
  const total = segments.reduce((sum, s) => sum + s.ml, 0);
  // Bottle interior spans roughly y=40 to y=370 in the 200x400 viewBox.
  const top = 40;
  const bottom = 370;
  const totalHeight = bottom - top;
  const pct = Math.max(0, Math.min(1, max > 0 ? total / max : 0));
  const fillTopY = bottom - pct * totalHeight;

  // Stack each drink's contribution bottom-to-top, each band's height
  // proportional to its share of `max` (so the stack top always lines up
  // with the overall fillTopY above).
  const bands = segments
    .filter((s) => s.ml > 0)
    .reduce<{ key: number; color: string; y1: number; y2: number }[]>((acc, s, i) => {
      const cursorY = acc.length > 0 ? acc[acc.length - 1].y1 : bottom;
      const h = max > 0 ? (s.ml / max) * totalHeight : 0;
      const y1 = Math.max(top, cursorY - h);
      acc.push({ key: i, color: s.color, y1, y2: cursorY });
      return acc;
    }, []);

  return (
    <div className="relative w-40 h-80 mx-auto">
      <svg viewBox="0 0 200 400" className="w-full h-full">
        <defs>
          <clipPath id="bottle-clip">
            <path d="M75,10 h50 v30 c0,10 15,15 15,40 v260 a20,20 0 0 1 -20,20 h-40 a20,20 0 0 1 -20,-20 v-260 c0,-25 15,-30 15,-40 z" />
          </clipPath>
        </defs>

        {/* bottle outline */}
        <path
          d="M75,10 h50 v30 c0,10 15,15 15,40 v260 a20,20 0 0 1 -20,20 h-40 a20,20 0 0 1 -20,-20 v-260 c0,-25 15,-30 15,-40 z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
        />

        {/* water fill, clipped to bottle shape — one band per drink type */}
        <g clipPath="url(#bottle-clip)">
          {bands.map((b) => (
            <motion.rect
              key={b.key}
              x="0"
              width="200"
              fill={b.color}
              initial={{ y: bottom, height: 0 }}
              animate={{ y: b.y1, height: Math.max(0, b.y2 - b.y1) }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          ))}
          {/* animated wave on top of the fill */}
          <motion.g
            initial={{ y: bottom }}
            animate={{ y: fillTopY - 6 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <g style={{ animation: "wave 2.4s linear infinite" }}>
              <path
                d="M0,6 C 25,0 50,12 100,6 C150,0 175,12 200,6 L200,20 L0,20 Z"
                fill="rgba(255,255,255,0.35)"
              />
              <path
                d="M200,6 C 225,0 250,12 300,6 C350,0 375,12 400,6 L400,20 L200,20 Z"
                fill="rgba(255,255,255,0.35)"
              />
            </g>
          </motion.g>
        </g>

        {/* cap */}
        <rect x="82" y="0" width="36" height="16" rx="4" fill="rgba(255,255,255,0.3)" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-white drop-shadow">
          {(total / 1000).toFixed(2)}L
        </span>
        <span className="text-xs text-white/60">de {(max / 1000).toFixed(1)}L</span>
      </div>
    </div>
  );
}
