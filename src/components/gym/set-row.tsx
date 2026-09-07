"use client";

import { Check, Minus, Plus } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import type { WorkoutSet } from "@/lib/types";

export function SetRow({
  index,
  set,
  onChange,
}: {
  index: number;
  set: WorkoutSet;
  onChange: (patch: Partial<WorkoutSet>) => void;
}) {
  return (
    <GlassCard
      padding="sm"
      interactive={false}
      accentColor={set.completado ? "#22c55e" : undefined}
      className="flex items-center gap-3"
    >
      <span className="w-6 text-center text-sm font-semibold text-white/50">{index + 1}</span>

      <Stepper
        label="kg"
        value={set.peso}
        step={2.5}
        onChange={(v) => onChange({ peso: v })}
      />
      <Stepper
        label="reps"
        value={set.reps}
        step={1}
        onChange={(v) => onChange({ reps: v })}
      />

      <button
        onClick={() => onChange({ completado: !set.completado })}
        className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors cursor-pointer"
        style={{
          background: set.completado ? "#22c55e" : "rgba(255,255,255,0.06)",
          border: `1px solid ${set.completado ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <Check size={16} className={set.completado ? "text-white" : "text-white/30"} />
      </button>
    </GlassCard>
  );
}

function Stepper({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] cursor-pointer"
        >
          <Minus size={12} className="text-white/70" />
        </button>
        <span className="w-10 text-center text-sm font-semibold text-white tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(value + step)}
          className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] cursor-pointer"
        >
          <Plus size={12} className="text-white/70" />
        </button>
      </div>
      <span className="text-[10px] text-white/35">{label}</span>
    </div>
  );
}
