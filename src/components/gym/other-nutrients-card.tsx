"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { NutrientPickerModal } from "@/components/gym/nutrient-picker-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { NUTRIENT_LABELS } from "@/lib/types";
import type { TrackableNutrient } from "@/lib/types";

export function OtherNutrientsCard({ totals }: { totals: Record<string, number> }) {
  const trackedNutrients = useGymStore((s) => s.trackedNutrients);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <GlassCard padding="md" className="flex flex-col gap-3 h-full" style={{ background: "rgba(10,10,14,0.55)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Otros nutrientes</p>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer transition-colors"
          aria-label="Editar nutrientes"
        >
          <Pencil size={13} className="text-white/70" />
        </button>
      </div>

      {trackedNutrients.length === 0 ? (
        <p className="text-xs text-white/40 py-4 text-center">
          No estás siguiendo ningún nutriente adicional. Usa el lápiz para agregar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {trackedNutrients.map((key: TrackableNutrient) => {
            const meta = NUTRIENT_LABELS[key];
            const value = totals[key] ?? 0;
            const pct = meta.goal > 0 ? Math.min(100, (value / meta.goal) * 100) : 0;
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/70">{meta.label}</span>
                  <span className="text-white/45 tabular-nums">
                    {Math.round(value * 10) / 10} / {meta.goal}
                    {meta.unit}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gym)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NutrientPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </GlassCard>
  );
}
