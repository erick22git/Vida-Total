"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { FoodPhoto } from "@/components/gym/food-photo";
import { FoodEntrySheet } from "@/components/gym/food-entry-sheet";
import { mergeFoods } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MEAL_LABELS, type Food, type MealType } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";

export function FoodSearchModal({
  open,
  onClose,
  meal,
}: {
  open: boolean;
  onClose: () => void;
  meal: MealType;
}) {
  const [query, setQuery] = useState("");
  const [pickedFood, setPickedFood] = useState<Food | null>(null);
  const customFoods = useGymStore((s) => s.customFoods);

  const foods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods.slice(0, 25);
    return foods.filter((f) => f.nombre.toLowerCase().includes(q)).slice(0, 40);
  }, [foods, query]);

  return (
    <>
      <GlassModal open={open && !pickedFood} onClose={onClose} title={`Agregar a ${MEAL_LABELS[meal]}`}>
        <div className="flex flex-col gap-4">
          <GlassInput
            icon={<Search size={16} />}
            placeholder="Buscar alimento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {results.map((food) => (
              <button
                key={food.id}
                onClick={() => setPickedFood(food)}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] glass-specular-ring px-4 py-3 text-left transition-colors cursor-pointer"
              >
                <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={36} emoji={categoryEmoji(food.categoria)} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium text-white truncate">{food.nombre}</span>
                  <span className="text-xs text-white/45">
                    {food.porcion} · {food.calorias} kcal · P{food.proteina}g C{food.carbos}g G{food.grasas}g
                  </span>
                </div>
                <ChevronRight size={15} className="text-white/30 shrink-0" />
              </button>
            ))}
            {results.length === 0 && (
              <p className="text-sm text-white/40 text-center py-6">
                No se encontraron alimentos.
              </p>
            )}
          </div>
        </div>
      </GlassModal>

      <FoodEntrySheet
        open={open && !!pickedFood}
        onClose={() => {
          setPickedFood(null);
          onClose();
        }}
        food={pickedFood}
        meal={meal}
      />
    </>
  );
}
