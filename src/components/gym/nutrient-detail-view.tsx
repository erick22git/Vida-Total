"use client";

/**
 * Rediseño Calorías: vista 2 de 3 en la home nueva (imagen 3 del pedido) — se llega deslizando
 * hacia abajo desde la franja de fecha. Arriba: el `CalorieArcCard` de siempre, sin tocar (número,
 * gráfico elegido, macros, Terminar Día). Abajo: las 4 categorías de nutrientes con sus íconos.
 */
import { CalorieArcCard } from "@/components/gym/calorie-arc-card";
import { NutrientCategoryTabs } from "@/components/gym/nutrient-category-tabs";
import { useGymStore } from "@/lib/store/gymStore";
import type { CalorieTotals } from "@/components/gym/calorie-arc-visual";
import type { TrackableNutrient } from "@/lib/types";

export function NutrientDetailView({
  totals,
  otherNutrientTotals,
}: {
  totals: CalorieTotals;
  otherNutrientTotals: Partial<Record<TrackableNutrient, number>>;
}) {
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);

  return (
    <div
      className="w-full h-full flex flex-col gap-4 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] overflow-y-auto"
      style={{ touchAction: "pan-y" }}
    >
      <CalorieArcCard totals={totals} />
      <NutrientCategoryTabs
        totals={totals}
        otherNutrientTotals={otherNutrientTotals}
        proteinGoal={proteinGoal}
        carbsGoal={carbsGoal}
        fatGoal={fatGoal}
        viewIndex={1}
        viewCount={3}
      />
    </div>
  );
}
