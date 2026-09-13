"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { FoodPhoto } from "@/components/gym/food-photo";
import { useGymStore } from "@/lib/store/gymStore";
import { BASE_FOODS, defaultPortions, scaleNutrition } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import type { Food, RecipeIngredient } from "@/lib/types";

export function RecipeIngredientPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ingredient: RecipeIngredient) => void;
}) {
  const customFoods = useGymStore((s) => s.customFoods);
  const [query, setQuery] = useState("");
  const allFoods = useMemo<Food[]>(() => [...customFoods, ...BASE_FOODS], [customFoods]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFoods.slice(0, 30);
    return allFoods.filter((f) => f.nombre.toLowerCase().includes(q)).slice(0, 40);
  }, [allFoods, query]);

  function handlePick(food: Food) {
    const portion = defaultPortions(food)[0];
    const nutrition = scaleNutrition(food, portion.gramos);
    onSelect({
      foodId: food.id,
      nombre: food.nombre,
      cantidad: 1,
      porcionNombre: portion.nombre,
      gramos: portion.gramos,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
    });
    setQuery("");
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Agregar ingrediente">
      <div className="flex flex-col gap-3">
        <GlassInput icon={<Search size={16} />} placeholder="Buscar alimento..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
          {results.map((food) => (
            <button
              key={food.id}
              onClick={() => handlePick(food)}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] glass-specular-ring px-3 py-2.5 text-left transition-colors cursor-pointer"
            >
              <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={36} emoji={categoryEmoji(food.categoria)} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">{food.nombre}</span>
                <span className="text-xs text-white/45">
                  {food.porcion} · {Math.round(food.calorias)} kcal
                </span>
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="text-sm text-white/40 text-center py-6">Sin resultados.</p>}
        </div>
      </div>
    </GlassModal>
  );
}
