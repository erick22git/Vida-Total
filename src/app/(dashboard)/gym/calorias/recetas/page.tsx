"use client";

/**
 * Rediseño Calorías: Recetas, al estilo oscuro "Not Boring" del resto del módulo (antes era la
 * interfaz vieja de tarjetas de vidrio). Misma lógica de siempre (filtros, favoritos, crear con IA) —
 * esto solo cambia cómo se ve.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Plus, Heart, Clock, Users, X } from "lucide-react";
import { FoodSectionHeader, FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { VerifiedBadge } from "@/components/gym/verified-badge";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS, type MealType } from "@/lib/types";
import { generateAiRecipe } from "@/lib/ai-recipe";
import { mergeFoods } from "@/lib/food-utils";
import { MONO_FONT } from "@/lib/ui/mono-font";

type FilterChip = "mejor" | MealType | "favoritos";

export default function RecetasPage() {
  const router = useRouter();
  const recipes = useGymStore((s) => s.recipes);
  const addRecipe = useGymStore((s) => s.addRecipe);
  const toggleFavoriteRecipe = useGymStore((s) => s.toggleFavoriteRecipe);
  const customFoods = useGymStore((s) => s.customFoods);

  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiIngredients, setAiIngredients] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const chips: { key: FilterChip; label: string }[] = [
    { key: "mejor", label: "Mejor Opción" },
    { key: "desayuno", label: "Desayuno" },
    { key: "almuerzo", label: "Almuerzo" },
    { key: "cena", label: "Cena" },
    { key: "snack1", label: "Snacks" },
    { key: "favoritos", label: "Favoritos" },
  ];

  function toggleChip(chip: FilterChip) {
    setActiveFilters((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]));
  }

  const filtered = useMemo(() => {
    let list = recipes;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.nombre.toLowerCase().includes(q));
    if (activeFilters.includes("favoritos")) list = list.filter((r) => r.favorito);
    const mealFilters = activeFilters.filter((f): f is MealType => f !== "mejor" && f !== "favoritos");
    if (mealFilters.length > 0) list = list.filter((r) => r.tipos.some((t) => mealFilters.includes(t)));
    if (activeFilters.includes("mejor")) {
      list = [...list].sort((a, b) => b.totales.proteina / b.totales.calorias - a.totales.proteina / a.totales.calorias);
    }
    return list;
  }, [recipes, query, activeFilters]);

  function handleGenerateAi() {
    if (!aiIngredients.trim()) return;
    setAiGenerating(true);
    setTimeout(() => {
      const draft = generateAiRecipe(aiIngredients, mergeFoods(customFoods));
      const created = addRecipe(draft);
      setAiGenerating(false);
      setAiOpen(false);
      setAiIngredients("");
      router.push(`/gym/calorias/recetas/crear?recipeId=${created.id}`);
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto text-white select-none" style={FOOD_SECTION_BG}>
      <div className="max-w-md mx-auto px-4 flex flex-col gap-4 pb-10">
        <FoodSectionHeader current="recetas" />

        <div className="flex items-center gap-2 border-b border-white/15 focus-within:border-white/40 transition-colors px-1 py-2">
          <Search size={15} className="text-white/35 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar recetas"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => toggleChip(chip.key)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
              style={
                activeFilters.includes(chip.key)
                  ? { background: "#fff", color: "#000" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold cursor-pointer"
            style={{ background: "#a855f7", color: "white" }}
          >
            <Sparkles size={15} /> Crear con IA
          </button>
          <button
            onClick={() => router.push("/gym/calorias/recetas/crear")}
            className="flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold cursor-pointer border border-white/20 text-white"
          >
            <Plus size={15} /> Crear manualmente
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => router.push(`/gym/calorias/recetas/crear?recipeId=${recipe.id}`)}
              className="flex gap-3 rounded-3xl p-3 text-left cursor-pointer"
              style={{ background: "#0d0d0d" }}
            >
              <div className="w-16 h-16 rounded-2xl shrink-0 bg-white/[0.06] flex items-center justify-center text-2xl overflow-hidden">
                {recipe.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipe.foto} alt={recipe.nombre} className="w-full h-full object-cover" />
                ) : (
                  "🍽️"
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-sm font-semibold text-white">
                    <span className="truncate">{recipe.nombre}</span>
                    <VerifiedBadge item={recipe} size={14} />
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteRecipe(recipe.id);
                    }}
                    className="shrink-0 cursor-pointer text-white/30 hover:text-red-400"
                  >
                    <Heart size={15} fill={recipe.favorito ? "#ff5c5c" : "none"} color={recipe.favorito ? "#ff5c5c" : "currentColor"} />
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/45">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {recipe.porciones} porc.
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {recipe.tiempoPrepMin} min
                  </span>
                  <span>{Math.round(recipe.totales.calorias / recipe.porciones)} kcal/porc.</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {recipe.tipos.map((t) => (
                    <span key={t} className="text-[10px] rounded-full px-2 py-0.5 bg-white/[0.06] text-white/50">
                      {MEAL_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-white/35 text-center py-10">
              {recipes.length === 0 ? "Aún no tenés recetas. Creá la primera con IA o manualmente." : "Sin resultados para estos filtros."}
            </p>
          )}
        </div>
      </div>

      {aiOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setAiOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-3" style={{ background: "#141414" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] uppercase tracking-[0.1em]" style={MONO_FONT}>
                Crear receta con IA
              </h2>
              <button onClick={() => setAiOpen(false)} className="w-8 h-8 flex items-center justify-center cursor-pointer text-white/50">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-white/50">Escribí los ingredientes que tenés disponibles y generamos una receta con macros estimados.</p>
            <textarea
              value={aiIngredients}
              onChange={(e) => setAiIngredients(e.target.value)}
              placeholder="Ej: pollo, arroz, brócoli, aceite de oliva"
              rows={4}
              className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none resize-none"
            />
            <button
              onClick={handleGenerateAi}
              disabled={!aiIngredients.trim() || aiGenerating}
              className="w-full rounded-full py-3 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
            >
              {aiGenerating ? "Generando..." : "Generar receta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
