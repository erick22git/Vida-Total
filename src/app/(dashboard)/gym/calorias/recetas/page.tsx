"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Sparkles, Plus, Heart, Clock, Users } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS, type MealType } from "@/lib/types";
import { generateAiRecipe } from "@/lib/ai-recipe";

type FilterChip = "mejor" | MealType | "favoritos";

export default function RecetasPage() {
  const router = useRouter();
  const recipes = useGymStore((s) => s.recipes);
  const addRecipe = useGymStore((s) => s.addRecipe);
  const toggleFavoriteRecipe = useGymStore((s) => s.toggleFavoriteRecipe);

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
      const draft = generateAiRecipe(aiIngredients);
      const created = addRecipe(draft);
      setAiGenerating(false);
      setAiOpen(false);
      setAiIngredients("");
      router.push(`/gym/calorias/recetas/crear?recipeId=${created.id}`);
    }, 700);
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex-1">Recetas</h1>
      </header>

      <CaloriasMethodNav />

      <GlassInput icon={<Search size={16} />} placeholder="Buscar recetas" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => toggleChip(chip.key)}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
            style={
              activeFilters.includes(chip.key)
                ? { background: "var(--gym)", color: "white" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassButton
          className="flex items-center justify-center gap-1.5"
          onClick={() => setAiOpen(true)}
          accentColor="#a855f7"
        >
          <Sparkles size={15} /> Crear con IA
        </GlassButton>
        <GlassButton variant="outline" className="flex items-center justify-center gap-1.5" onClick={() => router.push("/gym/calorias/recetas/crear")}>
          <Plus size={15} /> Crear manualmente
        </GlassButton>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((recipe) => (
          <GlassCard key={recipe.id} padding="md" className="flex gap-3">
            <div
              className="w-16 h-16 rounded-2xl shrink-0 bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-2xl overflow-hidden"
            >
              {recipe.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={recipe.foto} alt={recipe.nombre} className="w-full h-full object-cover" />
              ) : (
                "🍽️"
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-white truncate">{recipe.nombre}</span>
                <button onClick={() => toggleFavoriteRecipe(recipe.id)} className="shrink-0 cursor-pointer text-white/30 hover:text-red-400">
                  <Heart size={15} fill={recipe.favorito ? "#ff5c5c" : "none"} color={recipe.favorito ? "#ff5c5c" : "currentColor"} />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/45">
                <span className="flex items-center gap-1"><Users size={11} /> {recipe.porciones} porc.</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {recipe.tiempoPrepMin} min</span>
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
          </GlassCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-white/40 text-center py-10">
            {recipes.length === 0 ? "Aún no tienes recetas. Crea la primera con IA o manualmente." : "Sin resultados para estos filtros."}
          </p>
        )}
      </div>

      <GlassModal open={aiOpen} onClose={() => setAiOpen(false)} title="Crear receta con IA">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-white/50">
            Escribe los ingredientes que tienes disponibles y generaremos una receta con macros estimados.
          </p>
          <textarea
            value={aiIngredients}
            onChange={(e) => setAiIngredients(e.target.value)}
            placeholder="Ej: pollo, arroz, brócoli, aceite de oliva"
            rows={4}
            className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] backdrop-blur-md px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30 resize-none"
          />
          <GlassButton className="w-full" disabled={!aiIngredients.trim() || aiGenerating} onClick={handleGenerateAi}>
            {aiGenerating ? "Generando..." : "Generar receta"}
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
