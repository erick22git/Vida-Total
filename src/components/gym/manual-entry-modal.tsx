"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS, type MealType } from "@/lib/types";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snacks"];

export function ManualEntryModal({
  open,
  onClose,
  defaultMeal = "snacks",
}: {
  open: boolean;
  onClose: () => void;
  defaultMeal?: MealType;
}) {
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const [nombre, setNombre] = useState("");
  const [calorias, setCalorias] = useState("");
  const [proteina, setProteina] = useState("");
  const [carbos, setCarbos] = useState("");
  const [grasas, setGrasas] = useState("");
  const [meal, setMeal] = useState<MealType>(defaultMeal);

  function reset() {
    setNombre("");
    setCalorias("");
    setProteina("");
    setCarbos("");
    setGrasas("");
  }

  function handleSubmit() {
    const kcal = parseFloat(calorias);
    if (!kcal || kcal <= 0) return;
    addLoggedFood({
      foodId: `manual-${Date.now()}`,
      nombre: nombre.trim() || "Alimento manual",
      calorias: Math.round(kcal),
      proteina: parseFloat(proteina) || 0,
      carbos: parseFloat(carbos) || 0,
      grasas: parseFloat(grasas) || 0,
      meal,
    });
    reset();
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Ingreso Manual Rápido">
      <div className="flex flex-col gap-3">
        <GlassInput placeholder="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <GlassInput
          placeholder="Calorías*"
          type="number"
          inputMode="numeric"
          value={calorias}
          onChange={(e) => setCalorias(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <GlassInput
            placeholder="Proteína (g)"
            type="number"
            inputMode="decimal"
            value={proteina}
            onChange={(e) => setProteina(e.target.value)}
          />
          <GlassInput
            placeholder="Carbos (g)"
            type="number"
            inputMode="decimal"
            value={carbos}
            onChange={(e) => setCarbos(e.target.value)}
          />
          <GlassInput
            placeholder="Grasas (g)"
            type="number"
            inputMode="decimal"
            value={grasas}
            onChange={(e) => setGrasas(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Agregar a</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className="rounded-xl py-2 text-[11px] font-medium transition-colors cursor-pointer"
                style={
                  meal === m
                    ? { background: "var(--gym)", color: "white" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <GlassButton className="w-full mt-1" disabled={!calorias} onClick={handleSubmit}>
          Agregar a {MEAL_LABELS[meal]}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
