"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";

export const REST_DURATION_PRESETS = [30, 40, 50, 60, 70, 80, 90, 120, 180];

/** Compact "40s / 50s / 1min ..." label used on rest buttons and inside the picker. */
export function formatRestDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}min${rest ? ` ${rest}s` : ""}`;
}

/**
 * Reusable bottom-sheet: scrollable list of rest-duration presets with the
 * current value highlighted, confirmed via a "Continuar" button. Shared by
 * the active-workout screen and the plan/routine day editor so both stay in
 * sync.
 */
export function RestDurationModal({
  open,
  onClose,
  value,
  onConfirm,
  presets = REST_DURATION_PRESETS,
}: {
  open: boolean;
  onClose: () => void;
  value: number;
  onConfirm: (seconds: number) => void;
  presets?: number[];
}) {
  const [selected, setSelected] = useState(value);
  // Re-seed the selection from `value` each time the sheet opens, without
  // fighting the user's in-progress tap (derived during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setSelected(value);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Tiempo de descanso">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-0.5">
          {presets.map((sec) => {
            const active = selected === sec;
            return (
              <button
                key={sec}
                onClick={() => setSelected(sec)}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium cursor-pointer transition-colors"
                style={{
                  background: active ? "var(--gym)22" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "var(--gym)" : "rgba(255,255,255,0.1)"}`,
                  color: active ? "white" : "rgba(255,255,255,0.7)",
                }}
              >
                {formatRestDuration(sec)}
                {active && <Check size={16} style={{ color: "var(--gym)" }} />}
              </button>
            );
          })}
        </div>
        <GlassButton
          accentColor="var(--gym-2)"
          onClick={() => {
            onConfirm(selected);
            onClose();
          }}
        >
          Continuar
        </GlassButton>
      </div>
    </GlassModal>
  );
}
