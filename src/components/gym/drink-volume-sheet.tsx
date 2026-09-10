"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import type { DrinkOption } from "@/lib/data/drinks";
import { cn } from "@/lib/utils";

const PRESETS_ML = [30, 50, 100, 150, 200, 250, 300, 330, 400, 500, 600, 800, 1000];
const DEFAULT_ML = 250;

export function DrinkVolumeSheet({
  open,
  onClose,
  drink,
}: {
  open: boolean;
  onClose: () => void;
  drink: DrinkOption | null;
}) {
  const addWater = useGymStore((s) => s.addWater);
  // Sin useEffect: el padre (add-drink-modal) monta este componente con
  // `key={drink.id}` cada vez que se elige una bebida distinta, así que un
  // remount fresco ya deja estos valores en su default — no hace falta
  // resetearlos a mano.
  const [selected, setSelected] = useState(DEFAULT_ML);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  if (!drink) return null;

  const ml = customMode ? Math.max(0, Math.round(parseFloat(customValue) || 0)) : selected;

  function handleAgregar() {
    if (ml <= 0) return;
    addWater(ml, { id: drink!.id, nombre: drink!.nombre, emoji: drink!.emoji });
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title={drink.nombre}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-5xl leading-none">{drink.emoji}</span>
          <span className="text-3xl font-bold text-white mt-2">{ml} ml</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {PRESETS_ML.map((v) => (
            <button
              key={v}
              onClick={() => {
                setCustomMode(false);
                setSelected(v);
              }}
              className={cn(
                "rounded-2xl py-3 text-sm font-medium transition-colors cursor-pointer border",
                !customMode && selected === v
                  ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10"
                  : "border-white/[0.08] text-white bg-white/[0.05] hover:bg-white/[0.1]",
              )}
            >
              {v} ml
            </button>
          ))}
          <button
            onClick={() => setCustomMode(true)}
            className={cn(
              "rounded-2xl py-3 text-sm font-medium transition-colors cursor-pointer border col-span-3",
              customMode
                ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10"
                : "border-white/[0.08] text-white bg-white/[0.05] hover:bg-white/[0.1]",
            )}
          >
            Volumen personalizado
          </button>
        </div>

        {customMode && (
          <GlassInput
            type="number"
            inputMode="numeric"
            placeholder="ml"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            autoFocus
          />
        )}

        <GlassButton
          className="w-full"
          size="lg"
          accentColor="#3b82f6"
          disabled={ml <= 0}
          onClick={handleAgregar}
        >
          Añadir
        </GlassButton>
      </div>
    </GlassModal>
  );
}
