"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { format } from "date-fns";

const MIN_KG = 20;
const MAX_KG = 400;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Registrar peso: número grande editable (se puede escribir o ajustar con -/+), y fecha con selector nativo. El
 * regla de arrastre anterior solo funcionaba con mouse (no en el teléfono). */
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
  const [text, setText] = useState(initialKg.toFixed(1));
  const [day, setDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const today = format(new Date(), "yyyy-MM-dd");

  const kg = parseFloat(text.replace(",", "."));
  const valid = Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
  const bump = (d: number) => setText(round1(Math.min(MAX_KG, Math.max(MIN_KG, (valid ? kg : initialKg) + d))).toFixed(1));

  return (
    <ExpandSheet open={open} onClose={onClose} title="Registrar peso">
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => bump(-0.1)} aria-label="Menos 0,1 kg" className="w-11 h-11 rounded-full bg-white/[0.08] flex items-center justify-center cursor-pointer active:scale-95">
            <Minus size={18} />
          </button>
          <label className="flex items-baseline gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              aria-label="Peso en kilogramos"
              className="w-32 bg-transparent text-center text-5xl font-extrabold text-white outline-none tabular-nums"
            />
            <span className="text-lg text-white/40">kg</span>
          </label>
          <button onClick={() => bump(0.1)} aria-label="Más 0,1 kg" className="w-11 h-11 rounded-full bg-white/[0.08] flex items-center justify-center cursor-pointer active:scale-95">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex justify-center gap-2">
          {[-1, 1].map((d) => (
            <button key={d} onClick={() => bump(d)} className="rounded-full px-4 py-1.5 text-sm text-white/70 bg-white/[0.06] cursor-pointer">
              {d > 0 ? "+1" : "-1"} kg
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3">
          <span className="text-sm text-white/70">Fecha</span>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="bg-transparent text-base text-white outline-none [color-scheme:dark]"
          />
        </label>

        {!valid && <p className="text-xs text-white/50 text-center">Escribe un peso entre {MIN_KG} y {MAX_KG} kg.</p>}

        <button
          disabled={!valid}
          onClick={() => {
            // Mediodía local: evita que la zona horaria corra la fecha elegida al día anterior/siguiente.
            const [y, m, d] = day.split("-").map(Number);
            onSave(round1(kg), new Date(y, m - 1, d, 12, 0, 0).toISOString());
            onClose();
          }}
          className="w-full min-h-[52px] rounded-2xl bg-white text-black text-base font-bold cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-35"
        >
          Guardar peso
        </button>
      </div>
    </ExpandSheet>
  );
}
