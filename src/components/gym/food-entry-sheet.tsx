"use client";

import { useMemo, useState } from "react";
import { Heart, Trash2, ChevronDown, Flame } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { FoodPhoto } from "@/components/gym/food-photo";
import { QuantityKeypad } from "@/components/gym/quantity-keypad";
import { useGymStore } from "@/lib/store/gymStore";
import { defaultPortions, parsePorcionGramos, scaleNutrition } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MEAL_LABELS, type CookedState, type Food, type FoodPortion, type LoggedFood, type MealType } from "@/lib/types";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];
const GRAMS_PER_OZ = 28.3495;
/** Rough water-loss factor applied when a food is marked "cocido" (cooked): the
 * same displayed weight of a cooked food packs more nutrients per gram than raw,
 * so we scale the effective grams used for the nutrition lookup up by ~1/0.7. */
const COOKED_FACTOR = 0.7;

type PortionMode = "porcion" | "gramos" | "onzas";

export function FoodEntrySheet({
  open,
  onClose,
  food,
  meal,
  existingEntry,
}: {
  open: boolean;
  onClose: () => void;
  food: Food | null;
  meal: MealType;
  existingEntry?: LoggedFood | null;
}) {
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);
  const toggleFavoriteFood = useGymStore((s) => s.toggleFavoriteFood);
  const customPortionsByFood = useGymStore((s) => s.customPortionsByFood);
  const addCustomPortion = useGymStore((s) => s.addCustomPortion);

  const isEditing = !!existingEntry;

  const portions = useMemo<FoodPortion[]>(() => {
    if (!food) return [];
    const base = defaultPortions(food);
    const custom = customPortionsByFood[food.id] ?? [];
    return [...base, ...custom];
  }, [food, customPortionsByFood]);

  const [portionMode, setPortionMode] = useState<PortionMode>("porcion");
  const [selectedPortionIdx, setSelectedPortionIdx] = useState(0);
  const [cantidad, setCantidad] = useState(existingEntry?.cantidad ?? 1);
  const [gramosDirect, setGramosDirect] = useState(existingEntry?.gramos ?? (food ? parsePorcionGramos(food) : 100));
  const [onzasDirect, setOnzasDirect] = useState(gramosDirect / GRAMS_PER_OZ);
  const [cookedState, setCookedState] = useState<CookedState>(existingEntry?.cookedState ?? "crudo");
  const [selectedMeal, setSelectedMeal] = useState<MealType>(existingEntry?.meal ?? meal);
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [portionMenuOpen, setPortionMenuOpen] = useState(false);
  const [createPortionOpen, setCreatePortionOpen] = useState(false);
  const [newPortionName, setNewPortionName] = useState("");
  const [newPortionGrams, setNewPortionGrams] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!food) return null;

  const isFavorite = favoriteFoodIds.includes(food.id);
  const selectedPortion = portions[selectedPortionIdx] ?? portions[0];

  const rawGramos =
    portionMode === "gramos" ? gramosDirect : portionMode === "onzas" ? onzasDirect * GRAMS_PER_OZ : cantidad * (selectedPortion?.gramos ?? 100);

  const effectiveGramos = cookedState === "cocido" ? rawGramos / COOKED_FACTOR : rawGramos;
  const nutrition = scaleNutrition(food, effectiveGramos);

  function handleConfirm() {
    if (!food) return;
    const payload = {
      foodId: food.id,
      nombre: food.nombre,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
      meal: selectedMeal,
      cantidad: portionMode === "porcion" ? cantidad : undefined,
      porcionNombre: portionMode === "porcion" ? selectedPortion?.nombre : portionMode === "gramos" ? "Gramos" : "Onzas",
      gramos: Math.round(rawGramos * 10) / 10,
      photoUrl: food.photoUrl,
      cookedState,
    };
    if (isEditing && existingEntry) {
      updateLoggedFood(existingEntry.id, payload);
    } else {
      addLoggedFood(payload);
    }
    onClose();
  }

  function handleDelete() {
    if (existingEntry) removeLoggedFood(existingEntry.id);
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title={isEditing ? "Editar alimento" : "Agregar alimento"}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={56} emoji={categoryEmoji(food.categoria)} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{food.nombre}</p>
              <p className="text-xs text-white/45 flex items-center gap-1">
                <Flame size={11} /> {Math.round(nutrition.calorias)} kcal · P{Math.round(nutrition.proteina)}g C
                {Math.round(nutrition.carbos)}g G{Math.round(nutrition.grasas)}g
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleFavoriteFood(food.id)}
              aria-label="Favorito"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
            >
              <Heart size={16} fill={isFavorite ? "#ff5c5c" : "none"} color={isFavorite ? "#ff5c5c" : "white"} />
            </button>
            {isEditing && (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Eliminar"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 size={15} className="text-red-400" />
              </button>
            )}
          </div>
        </div>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2.5">
            <span className="text-xs text-red-200">¿Eliminar este alimento de la comida?</span>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={handleDelete}
                className="rounded-lg px-2.5 py-1 text-xs font-medium bg-red-500 text-white cursor-pointer"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium bg-white/10 text-white cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Cocido / Crudo toggle */}
        <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1 self-start">
          {(["crudo", "cocido"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCookedState(c)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer capitalize"
              style={cookedState === c ? { background: "var(--gym)", color: "white" } : { color: "rgba(255,255,255,0.55)" }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Quantity + Portion controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setPortionMode("porcion");
              setKeypadOpen(true);
            }}
            className="rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-2.5 text-left cursor-pointer"
          >
            <span className="text-[10px] text-white/40 block">Cantidad</span>
            <span className="text-sm text-white font-medium">
              {portionMode === "gramos" ? `${gramosDirect} g` : portionMode === "onzas" ? `${onzasDirect} oz` : cantidad}
            </span>
          </button>
          <div className="relative">
            <button
              onClick={() => setPortionMenuOpen((v) => !v)}
              className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-2.5 text-left cursor-pointer flex items-center justify-between"
            >
              <span className="min-w-0">
                <span className="text-[10px] text-white/40 block">Porción</span>
                <span className="text-sm text-white font-medium truncate block">
                  {portionMode === "gramos" ? "Gramos" : portionMode === "onzas" ? "Onzas" : selectedPortion?.nombre}
                </span>
              </span>
              <ChevronDown size={14} className="text-white/40 shrink-0" />
            </button>
            {portionMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPortionMenuOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl bg-[#1c1c22] border border-white/[0.12] shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--gym)] hover:bg-white/[0.08] cursor-pointer border-b border-white/[0.08]"
                    onClick={() => {
                      setPortionMenuOpen(false);
                      setCreatePortionOpen(true);
                    }}
                  >
                    + Crear porción
                  </button>
                  {portions.map((p, idx) => (
                    <button
                      key={p.nombre + idx}
                      className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                      onClick={() => {
                        setPortionMode("porcion");
                        setSelectedPortionIdx(idx);
                        setPortionMenuOpen(false);
                      }}
                    >
                      {p.nombre} <span className="text-white/40">({p.gramos}g)</span>
                    </button>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.08]"
                    onClick={() => {
                      setPortionMode("gramos");
                      setPortionMenuOpen(false);
                    }}
                  >
                    Gramos
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                    onClick={() => {
                      setPortionMode("onzas");
                      setPortionMenuOpen(false);
                    }}
                  >
                    Onzas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {portionMode === "gramos" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/50">Gramos</span>
            <GlassInput
              type="number"
              inputMode="decimal"
              value={gramosDirect}
              onChange={(e) => setGramosDirect(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
        {portionMode === "onzas" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/50">Onzas</span>
            <GlassInput
              type="number"
              inputMode="decimal"
              value={onzasDirect}
              onChange={(e) => setOnzasDirect(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}

        {createPortionOpen && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-3 border border-white/[0.08]">
            <p className="text-xs text-white/50">Nueva porción personalizada para {food.nombre}</p>
            <div className="flex gap-2">
              <GlassInput placeholder="Nombre" value={newPortionName} onChange={(e) => setNewPortionName(e.target.value)} className="flex-1" />
              <GlassInput
                placeholder="Gramos"
                type="number"
                inputMode="decimal"
                value={newPortionGrams}
                onChange={(e) => setNewPortionGrams(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex gap-2">
              <GlassButton
                size="sm"
                className="flex-1"
                disabled={!newPortionName.trim() || !newPortionGrams}
                onClick={() => {
                  const grams = parseFloat(newPortionGrams);
                  if (!newPortionName.trim() || !grams) return;
                  addCustomPortion(food.id, { nombre: newPortionName.trim(), gramos: grams });
                  setSelectedPortionIdx(portions.length);
                  setPortionMode("porcion");
                  setNewPortionName("");
                  setNewPortionGrams("");
                  setCreatePortionOpen(false);
                }}
              >
                Guardar
              </GlassButton>
              <GlassButton size="sm" variant="ghost" className="flex-1" onClick={() => setCreatePortionOpen(false)}>
                Cancelar
              </GlassButton>
            </div>
          </div>
        )}

        <QuantityKeypad open={keypadOpen} onClose={() => setKeypadOpen(false)} initialValue={cantidad} onChange={setCantidad} />

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="relative">
            <button
              onClick={() => setMealMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-xs text-white/70 cursor-pointer"
            >
              {MEAL_LABELS[selectedMeal]} <ChevronDown size={12} />
            </button>
            {mealMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMealMenuOpen(false)} />
                <div className="absolute bottom-full mb-1 left-0 z-40 w-36 rounded-xl bg-[#1c1c22] border border-white/[0.12] shadow-2xl overflow-hidden">
                  {MEALS.map((m) => (
                    <button
                      key={m}
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/[0.08] cursor-pointer"
                      onClick={() => {
                        setSelectedMeal(m);
                        setMealMenuOpen(false);
                      }}
                    >
                      {MEAL_LABELS[m]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <GlassButton className="w-full" size="lg" onClick={handleConfirm}>
          {isEditing ? "Actualizar" : "Agregar"}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
