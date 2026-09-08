"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { NUTRIENT_LABELS, NUTRIENT_SECTIONS, type TrackableNutrient } from "@/lib/types";

export function NutrientPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trackedNutrients = useGymStore((s) => s.trackedNutrients);
  const setTrackedNutrients = useGymStore((s) => s.setTrackedNutrients);
  const [selected, setSelected] = useState<TrackableNutrient[]>(trackedNutrients);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelected(trackedNutrients);
  }

  function toggle(key: TrackableNutrient) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Agregar nutrientes">
      <div className="flex flex-col gap-5">
        {NUTRIENT_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-1.5">
            <p className="text-[11px] uppercase tracking-wide text-white/40">{section.label}</p>
            <div className="flex flex-col gap-0.5">
              {section.keys.map((key) => {
                const meta = NUTRIENT_LABELS[key];
                const checked = selected.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className="flex items-center justify-between px-1 py-2 rounded-xl hover:bg-white/[0.05] cursor-pointer transition-colors"
                  >
                    <span className="text-sm text-white/85">{meta.label}</span>
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0"
                      style={{
                        background: checked ? "var(--gym)" : "transparent",
                        borderColor: checked ? "var(--gym)" : "rgba(255,255,255,0.25)",
                      }}
                    >
                      {checked && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <GlassButton
          className="w-full sticky bottom-0"
          onClick={() => {
            setTrackedNutrients(selected);
            onClose();
          }}
        >
          Guardar selección
        </GlassButton>
      </div>
    </GlassModal>
  );
}
