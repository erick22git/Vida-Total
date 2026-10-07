"use client";

/**
 * Rediseño Calorías, etapa 4 (WIP, preview): buscador con el carrusel VERTICAL en vez de la lista plana
 * que ya existe en /gym/calorias/buscar (esa sigue intacta — MealCard/el flujo viejo la siguen usando).
 * Reutiliza la misma lógica de búsqueda/pestañas de esa pantalla, solo cambia cómo se muestran los
 * resultados. Tocar la tarjeta central entra al detalle rediseñado de la etapa 3.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassInput } from "@/components/glass/glass-input";
import { FoodSectionHeader } from "@/components/gym/food-section-header";
import { CaloriasSkeleton } from "@/components/gym/calorias-skeleton";
import { FoodSearchCarousel } from "@/components/gym/food-search-carousel";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import type { Food, MealType } from "@/lib/types";

type Tab = "base" | "favoritos" | "creados" | "verificados";
const TABS: { key: Tab; label: string }[] = [
  { key: "base", label: "Base de Datos" },
  { key: "favoritos", label: "Favoritos" },
  { key: "creados", label: "Creados" },
  { key: "verificados", label: "Verificados" },
];

export default function BuscarNuevoPage() {
  return (
    <Suspense fallback={<CaloriasSkeleton />}>
      <BuscarNuevoContent />
    </Suspense>
  );
}

function BuscarNuevoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetMeal = (searchParams.get("meal") as MealType | null) ?? "desayuno";
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("base");

  const customFoods = useGymStore((s) => s.customFoods);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);

  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);

  const results = useMemo(() => {
    let list = allFoods;
    if (tab === "favoritos") list = list.filter((f) => favoriteFoodIds.includes(f.id));
    if (tab === "creados") list = list.filter((f) => f.creadoPorUsuario);
    if (tab === "verificados") list = list.filter((f) => f.verificado);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nombre.toLowerCase().includes(q));
    return list.slice(0, 60);
  }, [allFoods, tab, favoriteFoodIds, query]);

  return (
    <div className="relative min-h-screen text-white">
      <div className="fixed inset-0" style={{ background: "var(--app-bg)" }} aria-hidden />
      <div className="relative z-10 flex flex-col gap-4 pb-24 px-4 pt-2 max-w-md mx-auto">
        <FoodSectionHeader current="buscar" />

        <GlassInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alimento…"
          className="w-full"
        />

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
              style={
                tab === t.key
                  ? { background: "rgba(255,255,255,0.85)", color: "black" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 w-full pt-6">
          <FoodSearchCarousel
            foods={results}
            onSelect={(food) => router.push(`/gym/calorias/alimento/${food.id}?meal=${targetMeal}`)}
          />
        </div>
      </div>
    </div>
  );
}
