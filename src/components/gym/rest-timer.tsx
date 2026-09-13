"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";

const PRESETS = [60, 90, 120];

export function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function setPreset(seconds: number) {
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(false);
  }

  function reset() {
    setRemaining(duration);
    setRunning(false);
  }

  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = duration > 0 ? remaining / duration : 0;
  const offset = circumference * (1 - pct);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--gym)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.4, ease: "linear" }}
            style={{ filter: "drop-shadow(0 0 10px var(--gym))" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-white">
            {mm}:{ss}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        {PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => setPreset(s)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
            style={{
              background: duration === s ? "var(--gym)" : "rgba(255,255,255,0.06)",
              color: duration === s ? "white" : "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {s}s
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setRunning((r) => !r)}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white cursor-pointer"
          style={{
            background: "linear-gradient(135deg, var(--gym), var(--gym-2))",
            boxShadow: "0 4px 20px var(--gym)55",
          }}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? "Pausar" : "Iniciar"}
        </button>
        <button
          onClick={reset}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/[0.06] glass-specular-ring cursor-pointer"
        >
          <RotateCcw size={16} className="text-white/70" />
        </button>
      </div>
    </div>
  );
}
