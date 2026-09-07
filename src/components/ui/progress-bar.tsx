"use client";

import { motion } from "framer-motion";

export interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  label?: string;
  sublabel?: string;
  height?: number;
}

export function ProgressBar({
  value,
  max,
  color = "var(--gym)",
  label,
  sublabel,
  height = 10,
}: ProgressBarProps) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex items-center justify-between mb-1.5 text-xs md:text-sm">
          <span className="text-white/80 font-medium">{label}</span>
          <span className="text-white/50">{sublabel}</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-white/[0.07]"
        style={{ height }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}88` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
