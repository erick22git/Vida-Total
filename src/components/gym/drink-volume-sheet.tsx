"use client";

import { useState } from "react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import type { DrinkOption } from "@/lib/data/drinks";
import { cn } from "@/lib/utils";

const PRESETS_ML = [30, 50, 100, 150, 200, 250, 300, 330, 400, 500, 600, 800, 1000];
const DEFAULT_ML = 250;

export function DrinkVolumeSheet({
  open,
  onClose,
  onAdded,
  drink,
}: {
  open: boolean;
  onClose: () => void;
  /** Se llama justo después de registrar la bebida (p. ej. para soltar el chorro del vaso). */
  onAdded?: () => void;
  drink: DrinkOption | null;
}) {
  const addWater = useGymStore((s) => s.addWater);
  const vessels = useGymStore((s) => s.waterVessels);
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
    onAdded?.();
    onClose();
  }

  return (
    <ExpandSheet open={open} onClose={onClose} title={drink.nombre}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-5xl leading-none">{drink.emoji}</span>
          <span className="text-3xl font-bold text-white mt-2">{ml} ml</span>
        </div>

        {vessels.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wide text-white/45">Mis vasos</span>
            <div className="flex flex-wrap gap-2">
              {vessels.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setCustomMode(false);
                    setSelected(v.ml);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm cursor-pointer border",
                    !customMode && selected === v.ml ? "border-white/70 bg-white/[0.14] text-white" : "border-white/[0.08] bg-white/[0.05] text-white/85",
                  )}
                >
                  {v.nombre} · {v.ml}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  ? "border-white/70 text-white bg-white/[0.14]"
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
                ? "border-white/70 text-white bg-white/[0.14]"
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

        {/* Fijo abajo: siempre visible aunque la lista de ml sea larga, y con alto contraste (blanco sólido). */}
        <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 bg-gradient-to-t from-black via-black/95 to-transparent">
          <button
            disabled={ml <= 0}
            onClick={handleAgregar}
            className="w-full min-h-[54px] rounded-2xl bg-white text-black text-base font-bold shadow-[0_6px_24px_rgba(255,255,255,0.25)] cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-35 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {ml > 0 ? `Añadir ${ml} ml` : "Elige una cantidad"}
          </button>
        </div>
      </div>
    </ExpandSheet>
  );
}
