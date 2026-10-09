"use client";

/**
 * Buscador con el carrusel VERTICAL. La búsqueda usa el resolvedor de alimentos (alias, singular/plural, tildes,
 * errores de tipeo, última palabra incompleta) en vez de un `includes`. Tocar la tarjeta central entra al detalle.
 *
 * Teclado: la pantalla ocupa SOLO el viewport visible (`--vv-h`/`--vv-top` de `useKeyboardInset`), así el carrusel
 * queda siempre por encima del teclado en iPhone y Android; con el teclado abierto se compacta. Los inputs son de
 * 16 px o más (por debajo, iOS hace zoom al enfocar) y el zoom del usuario nunca se bloquea.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassInput } from "@/components/glass/glass-input";
import { FoodSectionHeader } from "@/components/gym/food-section-header";
import { CaloriasSkeleton } from "@/components/gym/calorias-skeleton";
import { FoodSearchCarousel } from "@/components/gym/food-search-carousel";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import { buildUsageMap, resolveFood } from "@/lib/nutrition/food-resolver";
import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";
import { notify } from "@/lib/notify/use-notify";
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

  // Volver de "Agregar" trae `?agregado=1`: muestra el aviso (Isla Dinámica) y limpia la URL, para
  // no repetirlo si se recarga o se vuelve a entrar con el botón atrás.
  useEffect(() => {
    if (searchParams.get("agregado") !== "1") return;
    const show = setTimeout(() => notify({ type: "agent-result", priority: "low", title: "Alimento agregado" }), 0);
    router.replace(`/gym/calorias/buscar-nuevo?meal=${targetMeal}`);
    return () => clearTimeout(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customFoods = useGymStore((s) => s.customFoods);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const { keyboardOpen } = useKeyboardInset();

  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);
  const usage = useMemo(() => buildUsageMap(loggedFoods), [loggedFoods]);

  const tabFoods = useMemo(() => {
    if (tab === "favoritos") return allFoods.filter((f) => favoriteFoodIds.includes(f.id));
    if (tab === "creados") return allFoods.filter((f) => f.creadoPorUsuario);
    if (tab === "verificados") return allFoods.filter((f) => f.verificado);
    return allFoods;
  }, [allFoods, tab, favoriteFoodIds]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return tabFoods.slice(0, 60);
    const r = resolveFood(q, tabFoods, [], { partialLast: true, foodsOnly: true, maxCandidates: 60, usage });
    const ranked = r.candidates.map((c) => c.food).filter((f): f is Food => !!f);
    if (ranked.length > 0) return ranked;
    // Sin coincidencia "inteligente" (p. ej. una sola letra): búsqueda simple por texto, como antes.
    const lower = q.toLowerCase();
    return tabFoods.filter((f) => f.nombre.toLowerCase().includes(lower)).slice(0, 60);
  }, [tabFoods, query, usage]);

  return (
    <div
      className="fixed inset-x-0 z-[45] text-white overflow-hidden"
      style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)", background: "var(--app-bg)" }}
    >
      <div className={`flex flex-col h-full max-w-md w-full mx-auto px-4 pb-[max(env(safe-area-inset-bottom),12px)] ${keyboardOpen ? "gap-2" : "gap-4"}`}>
        <FoodSectionHeader current="buscar" />

        <GlassInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Buscar alimento…"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full"
        />

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
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

        <div className="flex-1 min-h-0 w-full">
          <FoodSearchCarousel
            key={`${tab}|${query}`}
            foods={results}
            compact={keyboardOpen}
            onSelect={(food) => router.push(`/gym/calorias/alimento/${food.id}?meal=${targetMeal}`)}
          />
        </div>
      </div>
    </div>
  );
}
