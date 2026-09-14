"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, CornerUpLeft, Plus, X } from "lucide-react";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { BASE_FOODS, defaultPortions, scaleNutrition } from "@/lib/food-utils";
import { MEAL_LABELS, type Food, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];

// Palabras que no forman parte del nombre del alimento en sí, sino de su
// estado de preparación — se ignoran al buscar coincidencias en el dataset
// (para que "pollo crudo" siga encontrando "Pollo") pero se conservan como
// sufijo visible en el nombre guardado.
const PREP_QUALIFIERS = ["crudo", "cruda", "cocido", "cocida", "frito", "frita", "asado", "asada", "hervido", "hervida"];

function stripPrepQualifier(text: string): { base: string; qualifier: string | null } {
  const words = text.trim().split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  if (words.length > 1 && last && PREP_QUALIFIERS.includes(last)) {
    return { base: words.slice(0, -1).join(" "), qualifier: last };
  }
  return { base: text, qualifier: null };
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** An item captured in the "Lista" quick-capture flow but not yet committed to
 * the store — held in local state until the user confirms on step 2. Macros
 * are stored per-unit so editing `cantidad` scales them proportionally. */
interface DraftItem {
  id: string;
  meal: MealType;
  nombre: string;
  cantidad: number;
  porcionNombre: string;
  caloriasPerUnit: number;
  proteinaPerUnit: number;
  carbosPerUnit: number;
  grasasPerUnit: number;
  matchedFoodId?: string;
}

/** Two-step quick-capture flow (à la Fitia): 1) free-text capture per meal with
 * autocomplete against the food database, 2) review/edit captured items and
 * commit them all to the store at once. Nothing touches the store until the
 * user taps "Añadir al plan". */
export default function ListaPage() {
  const router = useRouter();
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const customFoods = useGymStore((s) => s.customFoods);

  const [step, setStep] = useState<"captura" | "confirmar">("captura");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const allFoods = useMemo<Food[]>(() => [...customFoods, ...BASE_FOODS], [customFoods]);

  function addFreeTextItem(meal: MealType, nombre: string) {
    if (!nombre.trim()) return;
    setDraftItems((prev) => [
      ...prev,
      {
        id: uid(),
        meal,
        nombre: nombre.trim(),
        cantidad: 1,
        porcionNombre: "1 unidad",
        caloriasPerUnit: 0,
        proteinaPerUnit: 0,
        carbosPerUnit: 0,
        grasasPerUnit: 0,
      },
    ]);
  }

  function addFoodItem(meal: MealType, food: Food, qualifier?: string | null) {
    const portion = defaultPortions(food)[0];
    const n = scaleNutrition(food, portion.gramos);
    setDraftItems((prev) => [
      ...prev,
      {
        id: uid(),
        meal,
        nombre: qualifier ? `${food.nombre} ${qualifier}` : food.nombre,
        cantidad: 1,
        porcionNombre: portion.nombre,
        caloriasPerUnit: n.calorias,
        proteinaPerUnit: n.proteina,
        carbosPerUnit: n.carbos,
        grasasPerUnit: n.grasas,
        matchedFoodId: food.id,
      },
    ]);
  }

  function removeDraftItem(id: string) {
    setDraftItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateDraftItem(id: string, patch: Partial<DraftItem>) {
    setDraftItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  const total = draftItems.reduce(
    (acc, it) => ({
      calorias: acc.calorias + it.caloriasPerUnit * it.cantidad,
      proteina: acc.proteina + it.proteinaPerUnit * it.cantidad,
      carbos: acc.carbos + it.carbosPerUnit * it.cantidad,
      grasas: acc.grasas + it.grasasPerUnit * it.cantidad,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  const mealsWithItems = MEALS.filter((m) => draftItems.some((it) => it.meal === m));

  function confirmAll() {
    for (const it of draftItems) {
      addLoggedFood({
        foodId: it.matchedFoodId ?? `lista-${it.id}`,
        nombre: it.nombre,
        calorias: Math.round(it.caloriasPerUnit * it.cantidad),
        proteina: Math.round(it.proteinaPerUnit * it.cantidad * 10) / 10,
        carbos: Math.round(it.carbosPerUnit * it.cantidad * 10) / 10,
        grasas: Math.round(it.grasasPerUnit * it.cantidad * 10) / 10,
        meal: it.meal,
        cantidad: it.cantidad,
        porcionNombre: it.porcionNombre,
      });
    }
    setDraftItems([]);
    router.push("/gym/calorias");
  }

  if (step === "confirmar") {
    return (
      <ConfirmStep
        mealsWithItems={mealsWithItems}
        draftItems={draftItems}
        total={total}
        onBack={() => setStep("captura")}
        onRemove={removeDraftItem}
        onUpdate={updateDraftItem}
        onAddMore={(meal) => {
          setStep("captura");
          requestAnimationFrame(() => {
            document.getElementById(`meal-block-${meal}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }}
        onConfirm={confirmAll}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-40 md:pb-24">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 pt-2">
        <button
          onClick={() => router.push("/gym/calorias")}
          className="text-white/50 hover:text-white transition-colors shrink-0 cursor-pointer"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-center">Lista</h1>
        <span className="w-5" />
      </header>

      <CaloriasMethodNav />

      <div className="flex flex-col gap-3">
        {MEALS.map((meal) => (
          <MealCaptureBlock
            key={meal}
            meal={meal}
            items={draftItems.filter((it) => it.meal === meal)}
            allFoods={allFoods}
            onAddFreeText={(nombre) => addFreeTextItem(meal, nombre)}
            onAddFood={(food, qualifier) => addFoodItem(meal, food, qualifier)}
            onRemove={removeDraftItem}
            onUpdate={updateDraftItem}
          />
        ))}
      </div>

      <button
        onClick={() => draftItems.length > 0 && setStep("confirmar")}
        disabled={draftItems.length === 0}
        className="fixed bottom-40 right-5 md:bottom-24 md:right-8 z-30 flex items-center justify-center w-14 h-14 rounded-full disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-transform active:scale-95"
        style={{
          background: "linear-gradient(135deg, var(--gym), var(--gym)CC)",
          boxShadow: "0 4px 20px var(--gym)66",
        }}
        aria-label="Continuar a confirmar"
      >
        <Check size={24} className="text-white" strokeWidth={3} />
      </button>
    </div>
  );
}

/** One meal's always-visible capture block: already-added items as a plain
 * bullet list, plus an inline text input (with its own autocomplete
 * dropdown) to add more — no "active meal" selection needed since all 5
 * blocks are shown at once. */
function MealCaptureBlock({
  meal,
  items,
  allFoods,
  onAddFreeText,
  onAddFood,
  onRemove,
  onUpdate,
}: {
  meal: MealType;
  items: DraftItem[];
  allFoods: Food[];
  onAddFreeText: (nombre: string) => void;
  onAddFood: (food: Food, qualifier?: string | null) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DraftItem>) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsOpen = text.trim().length > 0;

  const { base: searchBase, qualifier } = useMemo(() => stripPrepQualifier(text), [text]);

  const suggestions = useMemo(() => {
    const q = searchBase.trim().toLowerCase();
    if (!q) return [];
    return allFoods.filter((f) => f.nombre.toLowerCase().includes(q)).slice(0, 5);
  }, [searchBase, allFoods]);

  function submitFreeText() {
    if (!text.trim()) return;
    onAddFreeText(text);
    setText("");
    inputRef.current?.focus();
  }

  function submitFood(food: Food) {
    onAddFood(food, qualifier);
    setText("");
    inputRef.current?.focus();
  }

  return (
    <GlassCard
      id={`meal-block-${meal}`}
      padding="sm"
      className={cn("relative flex flex-col gap-2.5", suggestionsOpen ? "z-50" : "z-0")}
      style={{ background: "var(--glass-bg-dark)" }}
    >
      <h2 className="text-sm font-bold text-white/85">{MEAL_LABELS[meal]}</h2>

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="text-sm text-white min-w-0 truncate flex-1">• {it.nombre}</span>
              <input
                type="text"
                inputMode="decimal"
                value={it.porcionNombre}
                onChange={(e) => onUpdate(it.id, { porcionNombre: e.target.value })}
                placeholder="ej. 20g"
                className="w-20 shrink-0 rounded-full bg-white/[0.08] glass-specular-ring px-2 py-1 text-xs text-white text-center outline-none focus:shadow-[var(--glass-specular-strong)]"
              />
              <button
                onClick={() => onRemove(it.id)}
                className="text-white/30 hover:text-white/70 cursor-pointer shrink-0 p-0.5"
                aria-label={`Quitar ${it.nombre}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm shrink-0">•</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitFreeText();
              }
            }}
            placeholder="Escribe un alimento"
            className="flex-1 min-w-0 bg-transparent outline-none text-base text-white placeholder:text-white/35"
          />
          {text && (
            <button
              onClick={() => {
                setText("");
                inputRef.current?.focus();
              }}
              className="text-white/30 hover:text-white/70 cursor-pointer shrink-0 p-0.5"
              aria-label="Borrar texto"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {suggestionsOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl glass-panel shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
            <button
              onClick={submitFreeText}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer"
            >
              <CornerUpLeft size={14} className="text-white/50 shrink-0" />
              <span className="text-sm text-white truncate">{text.trim()}</span>
            </button>
            {suggestions.map((food) => {
              const portion = defaultPortions(food)[0];
              return (
                <button
                  key={food.id}
                  onClick={() => submitFood(food)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.06]"
                >
                  <Clock size={14} className="text-white/40 shrink-0" />
                  <span className="text-sm text-white/85 truncate flex-1 min-w-0">{food.nombre}</span>
                  <span className="text-xs text-white/40 shrink-0">{portion.nombre}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function ConfirmStep({
  mealsWithItems,
  draftItems,
  total,
  onBack,
  onRemove,
  onUpdate,
  onAddMore,
  onConfirm,
}: {
  mealsWithItems: MealType[];
  draftItems: DraftItem[];
  total: { calorias: number; proteina: number; carbos: number; grasas: number };
  onBack: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DraftItem>) => void;
  onAddMore: (meal: MealType) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 pb-32">
      <header className="flex flex-col gap-1.5 pt-2">
        <button onClick={onBack} className="text-white/50 hover:text-white transition-colors w-fit cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Confirma tus alimentos</h1>
        <p className="text-sm text-white/60">
          🔥 {Math.round(total.calorias)} kcal · {Math.round(total.proteina)} P · {Math.round(total.carbos)} C ·{" "}
          {Math.round(total.grasas)} G
        </p>
      </header>

      {mealsWithItems.length === 0 && (
        <p className="text-sm text-white/40 text-center py-10">No has capturado ningún alimento todavía.</p>
      )}

      <div className="flex flex-col gap-5">
        {mealsWithItems.map((meal) => (
          <section key={meal} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</h2>
            <div className="flex flex-col gap-2">
              {draftItems
                .filter((it) => it.meal === meal)
                .map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 rounded-2xl bg-white/[0.04] glass-specular-ring px-3 py-2.5"
                  >
                    <span className="flex-1 min-w-0 text-sm text-white truncate">{it.nombre}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={it.cantidad}
                      onChange={(e) => onUpdate(it.id, { cantidad: parseFloat(e.target.value) || 0 })}
                      className="w-16 shrink-0 rounded-full bg-white/[0.08] glass-specular-ring px-2 py-1.5 text-base text-white text-center outline-none focus:shadow-[var(--glass-specular-strong)]"
                    />
                    <input
                      type="text"
                      value={it.porcionNombre}
                      onChange={(e) => onUpdate(it.id, { porcionNombre: e.target.value })}
                      className="w-28 sm:w-32 shrink-0 rounded-full bg-white/[0.08] glass-specular-ring px-2.5 py-1.5 text-base text-white outline-none focus:shadow-[var(--glass-specular-strong)] truncate"
                    />
                    <button
                      onClick={() => onRemove(it.id)}
                      className="text-white/30 hover:text-white/70 cursor-pointer shrink-0"
                      aria-label={`Quitar ${it.nombre}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>
            <button
              onClick={() => onAddMore(meal)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/[0.18] py-2 text-xs text-white/60 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Agregar otro
            </button>
          </section>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto w-full">
          <button
            onClick={onConfirm}
            disabled={draftItems.length === 0}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white shadow-2xl cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--gym)", boxShadow: "0 4px 20px var(--gym)66" }}
          >
            Añadir al plan
          </button>
        </div>
      </div>
    </div>
  );
}
