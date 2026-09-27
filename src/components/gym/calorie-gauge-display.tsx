"use client";

/**
 * Número + gráfico de calorías, SIN tarjeta/contenedor — directo sobre el fondo oscuro, como pidió
 * el usuario viendo la imagen de referencia. Reemplaza lo que antes hacía `CalorieArcCard` (ese
 * componente se borró: además de la tarjeta tenía menús de edición y los macros, que ahora viven en
 * otro lado — ver `calorie-settings-sheet.tsx` y `nutrient-category-tabs.tsx` — para no repetir la
 * misma info dos veces en la pantalla).
 */
import { ArcChart } from "@/components/gym/calorie-arc-visual";
import { CalorieGauge3D } from "@/components/gym/calorie-gauge-3d";
import { calorieState } from "@/lib/gym/calorie-state";
import { useCalorieChartPref } from "@/lib/gym/calorie-chart-pref";
import { useGymStore } from "@/lib/store/gymStore";

export function CalorieGaugeDisplay({ calorias }: { calorias: number }) {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const showRemaining = useGymStore((s) => s.showRemaining);
  const [chartKind] = useCalorieChartPref();

  const displayValue = showRemaining ? Math.max(0, Math.round(calorieGoal - calorias)) : Math.round(calorias);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-4xl font-bold text-white tabular-nums">{displayValue.toLocaleString()}</span>
        <span className="text-lg text-white/35 tabular-nums">/ {calorieGoal.toLocaleString()}</span>
      </div>
      {chartKind === "arc" ? (
        <ArcChart goal={calorieGoal} value={calorias} />
      ) : (
        <CalorieGauge3D kind={chartKind} state={calorieState(calorias, calorieGoal)} />
      )}
    </div>
  );
}
