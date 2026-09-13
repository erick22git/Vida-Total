"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, MoreVertical, Heart, BadgeCheck } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassCard } from "@/components/glass/glass-card";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { FoodPhoto } from "@/components/gym/food-photo";
import { ManualEntryModal } from "@/components/gym/manual-entry-modal";
import { useGymStore, useRecentFoods } from "@/lib/store/gymStore";
import { BASE_FOODS } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import type { Food, MealType } from "@/lib/types";

type Tab = "base" | "favoritos" | "creados";

export default function BuscarAlimentosPage() {
  return (
    <Suspense fallback={null}>
      <BuscarAlimentosContent />
    </Suspense>
  );
}

function BuscarAlimentosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetMeal = searchParams.get("meal") as MealType | null;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("base");
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const customFoods = useGymStore((s) => s.customFoods);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);
  const toggleFavoriteFood = useGymStore((s) => s.toggleFavoriteFood);
  const recentFoods = useRecentFoods(8);
  const loggedFoods = useGymStore((s) => s.loggedFoods);

  const allFoods = useMemo<Food[]>(() => [...customFoods, ...BASE_FOODS], [customFoods]);

  const results = useMemo(() => {
    let list = allFoods;
    if (tab === "favoritos") list = list.filter((f) => favoriteFoodIds.includes(f.id));
    if (tab === "creados") list = list.filter((f) => f.creadoPorUsuario);

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nombre.toLowerCase().includes(q));
    return list.slice(0, 60);
  }, [allFoods, tab, favoriteFoodIds, query]);

  // "Comidas recientes": recurring combos of foods logged together in the same meal+minute.
  const recentCombos = useMemo(() => {
    const groups = new Map<string, { key: string; nombres: string[]; calorias: number; count: number }>();
    for (const f of loggedFoods) {
      const bucket = Math.floor(f.timestamp / 60000); // group by minute
      const key = `${f.meal}-${bucket}`;
      const existing = groups.get(key);
      if (existing) {
        existing.nombres.push(f.nombre);
        existing.calorias += f.calorias;
      } else {
        groups.set(key, { key, nombres: [f.nombre], calorias: f.calorias, count: 1 });
      }
    }
    return Array.from(groups.values())
      .filter((g) => g.nombres.length > 1)
      .slice(-6)
      .reverse();
  }, [loggedFoods]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <GlassInput
            icon={<Search size={16} />}
            placeholder="Buscar alimentos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
            aria-label="Más opciones"
          >
            <MoreVertical size={18} className="text-white" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-40 w-56 rounded-2xl glass-panel shadow-2xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/gym/calorias/crear-alimento");
                  }}
                >
                  Crear Alimento
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/gym/calorias/recetas/crear");
                  }}
                >
                  Crear Receta
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setManualOpen(true);
                  }}
                >
                  Ingreso Manual
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <CaloriasMethodNav />

      <div className="flex gap-2">
        {(
          [
            { key: "base", label: "Base de Datos" },
            { key: "favoritos", label: "Favoritos" },
            { key: "creados", label: "Creados" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-xl py-2 text-xs md:text-sm font-medium transition-colors cursor-pointer"
            style={
              tab === t.key
                ? { background: "var(--gym)", color: "white" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {!query && tab === "base" && recentFoods.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/70">Ingresado recientemente</h2>
          <div className="flex flex-col gap-2">
            {recentFoods.map((f) => {
              const food = allFoods.find((af) => af.id === f.foodId);
              return (
                <FoodRow
                  key={f.id}
                  food={
                    food ?? {
                      id: f.foodId,
                      nombre: f.nombre,
                      categoria: "Otros",
                      porcion: f.porcionNombre ?? "1 porción",
                      calorias: f.calorias,
                      proteina: f.proteina,
                      carbos: f.carbos,
                      grasas: f.grasas,
                    }
                  }
                  isFavorite={favoriteFoodIds.includes(f.foodId)}
                  onToggleFavorite={() => toggleFavoriteFood(f.foodId)}
                  onClick={() => router.push(`/gym/calorias/alimento/${f.foodId}?meal=${targetMeal ?? "desayuno"}`)}
                />
              );
            })}
          </div>
        </section>
      )}

      {!query && tab === "base" && recentCombos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/70">Comidas recientes</h2>
          <div className="flex flex-col gap-2">
            {recentCombos.map((combo) => (
              <GlassCard key={combo.key} padding="sm" className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-white">{combo.nombres.join(" + ")}</span>
                  <span className="text-xs text-white/45">{combo.nombres.length} alimentos</span>
                </div>
                <span className="text-sm font-semibold text-white/80 shrink-0">{Math.round(combo.calorias)} kcal</span>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        {query && <h2 className="text-sm font-semibold text-white/70">Resultados</h2>}
        <div className="flex flex-col gap-2">
          {results.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              isFavorite={favoriteFoodIds.includes(food.id)}
              onToggleFavorite={() => toggleFavoriteFood(food.id)}
              onClick={() => router.push(`/gym/calorias/alimento/${food.id}?meal=${targetMeal ?? "desayuno"}`)}
            />
          ))}
          {results.length === 0 && (
            <p className="text-sm text-white/40 text-center py-10">
              {tab === "favoritos"
                ? "Aún no tienes alimentos favoritos. Toca el corazón en cualquier alimento para agregarlo."
                : tab === "creados"
                  ? "Aún no has creado alimentos. Usa el menú ··· para crear uno."
                  : "No se encontraron alimentos."}
            </p>
          )}
        </div>
      </section>

      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

function FoodRow({
  food,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  food: Food;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] glass-specular-ring px-3 py-2.5 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={44} emoji={categoryEmoji(food.categoria)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-white truncate">{food.nombre}</span>
          {food.verificado && <BadgeCheck size={13} className="text-[var(--gym)] shrink-0" />}
        </div>
        <span className="text-xs text-white/45">
          {food.porcion} · {Math.round(food.calorias)} kcal
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="shrink-0 text-white/30 hover:text-red-400 transition-colors cursor-pointer p-1"
        aria-label="Favorito"
      >
        <Heart size={17} fill={isFavorite ? "#ff5c5c" : "none"} color={isFavorite ? "#ff5c5c" : "currentColor"} />
      </button>
    </div>
  );
}
