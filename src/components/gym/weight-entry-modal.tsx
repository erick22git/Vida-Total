"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

export function WeightEntryModal({
  open,
  onClose,
  onSave,
  initialKg = 70,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (kg: number, date: string) => void;
  initialKg?: number;
}) {
  const [kg, setKg] = useState(initialKg);
  const [date, setDate] = useState(new Date());

  // Ruler: each tick = 0.1kg, generate a window around current value
  const ticks = Array.from({ length: 61 }, (_, i) => Math.round((kg - 3 + i * 0.1) * 10) / 10);

  function handleDrag(clientX: number, rect: DOMRect) {
    const relative = (clientX - rect.left) / rect.width; // 0..1
    const delta = (relative - 0.5) * 6; // +-3kg range visible
    setKg((k) => Math.max(30, Math.round((k + delta * 0.15) * 10) / 10));
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Registrar Peso">
      <div className="flex flex-col gap-6">
        <p className="text-center text-5xl font-extrabold text-white">
          {kg.toFixed(1)} <span className="text-lg text-white/40">kg</span>
        </p>

        <div
          className="relative h-16 overflow-hidden rounded-2xl bg-white/[0.04] border border-white/[0.1] cursor-ew-resize select-none"
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const move = (ev: MouseEvent) => handleDrag(ev.clientX, rect);
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        >
          <div className="absolute inset-0 flex items-end justify-center gap-2 pb-2">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ opacity: Math.round(t * 10) === Math.round(kg * 10) ? 1 : 0.3 }}
              >
                <div
                  className="w-[2px] rounded-full"
                  style={{
                    height: Math.round(t) === t ? 22 : 12,
                    background: Math.round(t * 10) === Math.round(kg * 10) ? "var(--gym-2)" : "white",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-full bg-[var(--gym-2)]" />
        </div>

        <div className="flex justify-center gap-2">
          <button
            onClick={() => setKg((k) => Math.round((k - 0.1) * 10) / 10)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 bg-white/[0.06] border border-white/[0.12] cursor-pointer"
          >
            -0.1
          </button>
          <button
            onClick={() => setKg((k) => Math.round((k + 0.1) * 10) / 10)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 bg-white/[0.06] border border-white/[0.12] cursor-pointer"
          >
            +0.1
          </button>
        </div>

        <button
          onClick={() => setDate((d) => subDays(d, 1))}
          className="text-center text-sm text-white/50 underline cursor-pointer"
        >
          Cambiar Fecha · {format(date, "d MMM yyyy", { locale: es })}
        </button>

        <GlassButton
          accentColor="var(--gym-2)"
          size="lg"
          onClick={() => {
            onSave(kg, date.toISOString());
            onClose();
          }}
        >
          Registrar Peso
        </GlassButton>
      </div>
    </GlassModal>
  );
}
