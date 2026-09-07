"use client";

import { Plus, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import type { LoggedFood, MealType } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";

const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snacks: "Snacks",
};

export function MealCard({
  meal,
  foods,
  onAdd,
}: {
  meal: MealType;
  foods: LoggedFood[];
  onAdd: () => void;
}) {
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const total = foods.reduce((sum, f) => sum + f.calorias, 0);

  return (
    <GlassCard padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</p>
          <p className="text-xs text-white/45">{total} kcal</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>
      {foods.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {foods.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between text-xs bg-white/[0.04] rounded-xl px-3 py-2"
            >
              <span className="text-white/80">{f.nombre}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-white/45">{f.calorias} kcal</span>
                <button
                  onClick={() => removeLoggedFood(f.id)}
                  className="text-white/30 hover:text-white/70 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/30">Sin alimentos registrados</p>
      )}
    </GlassCard>
  );
}
