"use client";

/**
 * Rediseño Calorías: vista 2 de 3 en la home nueva (imagen 3 del pedido) — se llega deslizando
 * hacia abajo desde la franja de fecha. Todo va directo sobre el fondo oscuro, SIN tarjeta/contenedor
 * (así lo pidió el usuario): número + gráfico (`CalorieGaugeDisplay`) arriba, y las 4 categorías de
 * nutrientes (`NutrientCategoryTabs`) abajo — esa es la ÚNICA vez que se muestran los macros, para no
 * repetir la misma info dos veces.
 */
import { CalorieGaugeDisplay } from "@/components/gym/calorie-gauge-display";
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
    // Sin scroll propio (ni `overflow-y-auto` ni `touchAction: pan-y`): esta vista es una más del swipe
    // vertical de la home (comida ↔ contador ↔ racha). Si scrollea nativo, el navegador se queda con el
    // gesto de deslizar (dispara pointercancel en vez de pointerup) y las transiciones que ARRANCAN paradas
    // acá (bajar a la racha, subir a los platos) dejan de funcionar — solo entrar a esta vista seguía
    // andando, porque ese gesto arranca en la vista de al lado. La lista larga de "otros nutrientes" tiene
    // su propio scroll interno acotado (`NutrientCategoryTabs`), así que no se pierde nada.
    <div className="w-full h-full flex flex-col gap-6 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] overflow-hidden">

      <CalorieGaugeDisplay calorias={totals.calorias} />
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
