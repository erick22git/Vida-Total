"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder } from "framer-motion";
import { Plus, MoreHorizontal, GripVertical, CheckCircle2, Circle } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { FoodPhoto } from "@/components/gym/food-photo";
import { MealActionsMenu } from "@/components/gym/meal-actions-menu";
import type { Food, LoggedFood, MealType } from "@/lib/types";
import { MEAL_LABELS } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";
import { activeLoggedFoods, mergeFoods } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { cn } from "@/lib/utils";

export function MealCard({
  meal,
  foods,
  onAdd,
  date,
  disableAdd,
}: {
  meal: MealType;
  foods: LoggedFood[];
  onAdd: () => void;
  /** Día que se está mostrando (default: hoy) — se pasa a copiar/pegar/repetir/
   * vaciar/escalar/plantilla para que operen sobre ese día, no siempre "hoy". */
  date?: Date;
  /** Cuando el día mostrado no es hoy, agregar comida nueva a mano no está
   * soportado todavía (el flujo de búsqueda de alimentos siempre registra
   * con la fecha/hora actual) — se deshabilita el botón "+" y se avisa. */
  disableAdd?: boolean;
}) {
  const router = useRouter();
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const reorderMealFoods = useGymStore((s) => s.reorderMealFoods);
  const customFoods = useGymStore((s) => s.customFoods);

  const [menuOpen, setMenuOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [items, setItems] = useState(foods);
  const [disabledToast, setDisabledToast] = useState<string | null>(null);

  // Keep local reorder-list in sync when the underlying store data changes
  // (new item added/removed/edited) without fighting the user's in-progress drag.
  const key = foods.map((f) => `${f.id}:${f.calorias}:${f.gramos}:${f.cookedState}:${f.cantidad}:${f.activo}`).join(",");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setItems(foods);
  }

  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);

  const total = activeLoggedFoods(foods).reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  function flashDisabledToast(msg: string) {
    setDisabledToast(msg);
    setTimeout(() => setDisabledToast(null), 1800);
  }

  function foodFor(entry: LoggedFood): Food {
    const match = allFoods.find((f) => f.id === entry.foodId);
    if (match) return match;
    return {
      id: entry.foodId,
      nombre: entry.nombre,
      categoria: "Otros",
      porcion: entry.porcionNombre ?? "1 porción",
      calorias: entry.calorias,
      proteina: entry.proteina,
      carbos: entry.carbos,
      grasas: entry.grasas,
      photoUrl: entry.photoUrl,
    };
  }

  return (
    <GlassCard
      padding="md"
      className={cn("flex flex-col gap-3 relative", menuOpen ? "z-50" : "z-0")}
      style={{ background: "var(--glass-bg-dark)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</p>
          <p className="text-[11px] text-white/45 truncate">
            {Math.round(total.calorias)} kcal · {Math.round(total.proteina)}g P · {Math.round(total.carbos)}g C ·{" "}
            {Math.round(total.grasas)}g G
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
              aria-label="Más opciones"
            >
              <MoreHorizontal size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <MealActionsMenu meal={meal} date={date} foods={foods} open={menuOpen} onOpenChange={setMenuOpen} />

      {disabledToast && <p className="text-[11px] text-white/80 text-center">{disabledToast}</p>}

      {items.length > 0 && (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(next) => {
            setItems(next);
            reorderMealFoods(
              meal,
              next.map((i) => i.id),
              date,
            );
          }}
          className="flex flex-col gap-1.5"
        >
          {items.map((f) => (
            <Reorder.Item
              key={f.id}
              value={f}
              dragListener={movingId === f.id}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-2.5 py-2 border transition-colors",
                movingId === f.id ? "border-white/70 bg-white/[0.08]" : "border-transparent",
              )}
            >
              <button
                onClick={() => setMovingId((v) => (v === f.id ? null : f.id))}
                aria-label="Reordenar"
                className={cn(
                  "flex items-center justify-center w-6 h-6 shrink-0 rounded-lg cursor-grab active:cursor-grabbing",
                  movingId === f.id ? "text-white" : "text-white/25 hover:text-white/50",
                )}
              >
                <GripVertical size={14} />
              </button>
              <button
                onClick={() => router.push(`/gym/calorias/alimento/${f.foodId}?meal=${meal}&entryId=${f.id}`)}
                className={cn(
                  "flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer transition-opacity",
                  f.activo === false && "opacity-40",
                )}
              >
                <FoodPhoto
                  photoUrl={f.photoUrl}
                  alt={f.nombre}
                  size={34}
                  emoji={categoryEmoji(foodFor(f).categoria)}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium text-white truncate", f.activo === false && "line-through")}>
                    {f.nombre}
                  </p>
                  <p className="text-[10px] text-white/40 capitalize">{f.cookedState ?? "crudo"}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs text-white/70">{f.gramos ? `${Math.round(f.gramos)} g` : f.porcionNombre}</span>
                  <span className="text-[10px] text-white/40">{Math.round(f.calorias)} kcal</span>
                </div>
              </button>
              <button
                onClick={() => updateLoggedFood(f.id, { activo: f.activo === false })}
                aria-label={f.activo === false ? "Contar este alimento" : "No contar este alimento"}
                title={f.activo === false ? "Contar este alimento" : "No contar este alimento"}
                className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full cursor-pointer transition-colors"
                style={{ color: f.activo === false ? "rgba(255,255,255,0.25)" : "white" }}
              >
                {f.activo === false ? <Circle size={20} /> : <CheckCircle2 size={20} />}
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <button
        onClick={() => {
          if (disableAdd) {
            flashDisabledToast("Para un día pasado, usá Pegar o Repetir comida");
            return;
          }
          onAdd();
        }}
        aria-label={`Agregar a ${MEAL_LABELS[meal]}`}
        className={cn(
          "flex items-center justify-center w-full h-11 rounded-2xl glass-specular-ring transition-colors",
          disableAdd
            ? "bg-white/[0.02] cursor-not-allowed"
            : "bg-white/[0.04] hover:bg-white/[0.09] cursor-pointer",
        )}
      >
        <Plus size={18} className={disableAdd ? "text-white/25" : "text-white/60"} />
      </button>
    </GlassCard>
  );
}
