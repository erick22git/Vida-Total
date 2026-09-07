"use client";

import { motion } from "framer-motion";

export function WaterBottle({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  // Bottle interior spans roughly y=40 to y=370 in the 200x400 viewBox.
  const top = 40;
  const bottom = 370;
  const fillY = bottom - pct * (bottom - top);

  return (
    <div className="relative w-40 h-80 mx-auto">
      <svg viewBox="0 0 200 400" className="w-full h-full">
        <defs>
          <clipPath id="bottle-clip">
            <path d="M75,10 h50 v30 c0,10 15,15 15,40 v260 a20,20 0 0 1 -20,20 h-40 a20,20 0 0 1 -20,-20 v-260 c0,-25 15,-30 15,-40 z" />
          </clipPath>
          <linearGradient id="water-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* bottle outline */}
        <path
          d="M75,10 h50 v30 c0,10 15,15 15,40 v260 a20,20 0 0 1 -20,20 h-40 a20,20 0 0 1 -20,-20 v-260 c0,-25 15,-30 15,-40 z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
        />

        {/* water fill, clipped to bottle shape */}
        <g clipPath="url(#bottle-clip)">
          <motion.rect
            x="0"
            width="200"
            height="400"
            fill="url(#water-gradient)"
            initial={{ y: bottom }}
            animate={{ y: fillY }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          {/* animated wave on top of the fill */}
          <motion.g
            initial={{ y: bottom }}
            animate={{ y: fillY - 6 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <g style={{ animation: "wave 2.4s linear infinite" }}>
              <path
                d="M0,6 C 25,0 50,12 100,6 C150,0 175,12 200,6 L200,20 L0,20 Z"
                fill="#93c5fd"
                opacity="0.6"
              />
              <path
                d="M200,6 C 225,0 250,12 300,6 C350,0 375,12 400,6 L400,20 L200,20 Z"
                fill="#93c5fd"
                opacity="0.6"
              />
            </g>
          </motion.g>
        </g>

        {/* cap */}
        <rect x="82" y="0" width="36" height="16" rx="4" fill="rgba(255,255,255,0.3)" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-white drop-shadow">
          {(value / 1000).toFixed(2)}L
        </span>
        <span className="text-xs text-white/60">de {(max / 1000).toFixed(1)}L</span>
      </div>
    </div>
  );
}
