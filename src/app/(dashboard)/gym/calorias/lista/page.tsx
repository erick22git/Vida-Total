"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Clock, Plus, X } from "lucide-react";
import { FoodSectionHeader, FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { GlassCard } from "@/components/glass/glass-card";
import { FoodChip, GramsInput } from "@/components/gym/food-draft-ui";
import { VerifiedBadge } from "@/components/gym/verified-badge";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import {
  commitDraftItems,
  draftFromResult,
  draftNuevo,
  liveMacros,
  MAX_CANDIDATES,
  sumMacros,
  type DraftItem,
  type Macros,
} from "@/lib/nutrition/draft-item";
import {
  buildUsageMap,
  getResolverIndex,
  resolveCandidate,
  resolveFoodText,
  type Candidate,
  type ResolverIndex,
} from "@/lib/nutrition/food-resolver";
import { MEAL_LABELS, type Food, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

/** Flujo rápido de dos pasos (à la Fitia): 1) captura en texto libre por comida con el resolvedor de alimentos
 * (`lib/nutrition/food-resolver.ts`), 2) revisar/editar y guardar todo junto. Nada toca el store hasta "Añadir al plan".
 * Regla: NUNCA se crea un alimento nuevo por defecto — solo si el usuario toca "Crear nuevo" o si no hay ningún
 * candidato razonable (ahí se usa el flujo "sin configurar" de siempre, y recién al confirmar). */
export default function ListaPage() {
  const router = useRouter();
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const addCustomFood = useGymStore((s) => s.addCustomFood);
  const customFoods = useGymStore((s) => s.customFoods);
  const recipes = useGymStore((s) => s.recipes);
  const loggedFoods = useGymStore((s) => s.loggedFoods);

  const [step, setStep] = useState<"captura" | "confirmar">("captura");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);
  const idx = useMemo(() => getResolverIndex(allFoods, recipes), [allFoods, recipes]);
  const usage = useMemo(() => buildUsageMap(loggedFoods), [loggedFoods]);

  function addDraft(item: DraftItem) {
    setDraftItems((prev) => [...prev, item]);
  }
  function removeDraftItem(id: string) {
    setDraftItems((prev) => prev.filter((it) => it.id !== id));
  }
  function updateDraftItem(id: string, patch: Partial<DraftItem>) {
    setDraftItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function replaceDraftItem(next: DraftItem) {
    setDraftItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
  }

  const total = sumMacros(draftItems);

  const mealsWithItems = MEALS.filter((m) => draftItems.some((it) => it.meal === m));

  function confirmAll() {
    commitDraftItems(draftItems, { addLoggedFood, addCustomFood });
    setDraftItems([]);
    // Si todo fue a una sola comida, se vuelve mostrando sus kcal (igual que agregar por búsqueda).
    // Si tocó varias comidas distintas, no hay un único círculo que revelar — se vuelve sin eso.
    router.push(mealsWithItems.length === 1 ? `/gym/calorias?justAdded=${mealsWithItems[0]}` : "/gym/calorias");
  }

  if (step === "confirmar") {
    return (
      <ConfirmStep
        mealsWithItems={mealsWithItems}
        draftItems={draftItems}
        total={total}
        idx={idx}
        usage={usage}
        onBack={() => setStep("captura")}
        onRemove={removeDraftItem}
        onUpdate={updateDraftItem}
        onReplace={replaceDraftItem}
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
    <div className="fixed inset-0 z-[45] overflow-y-auto text-white" style={FOOD_SECTION_BG}>
    <div className="max-w-md mx-auto px-4 flex flex-col gap-4 pb-40 md:pb-24">
      <FoodSectionHeader current="lista" />

      <div className="flex flex-col gap-3">
        {MEALS.map((meal) => (
          <MealCaptureBlock
            key={meal}
            meal={meal}
            items={draftItems.filter((it) => it.meal === meal)}
            idx={idx}
            usage={usage}
            onAdd={addDraft}
            onRemove={removeDraftItem}
            onUpdate={updateDraftItem}
            onReplace={replaceDraftItem}
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
    </div>
  );
}

/** Bloque de captura de UNA comida: ítems ya agregados + un input libre con su propio desplegable de candidatos. */
function MealCaptureBlock({
  meal,
  items,
  idx,
  usage,
  onAdd,
  onRemove,
  onUpdate,
  onReplace,
}: {
  meal: MealType;
  items: DraftItem[];
  idx: ResolverIndex;
  usage: Map<string, number>;
  onAdd: (item: DraftItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DraftItem>) => void;
  onReplace: (next: DraftItem) => void;
}) {
  const [text, setText] = useState("");
  const [needsChoice, setNeedsChoice] = useState(false);
  const [chipOpen, setChipOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsOpen = text.trim().length > 0;

  const result = useMemo(() => (text.trim() ? resolveFoodText(text, idx, { usage, maxCandidates: MAX_CANDIDATES }) : null), [text, idx, usage]);
  const cleanText = useMemo(() => text.replace(/\d+(?:[.,]\d+)?\s*(kilos?|kg|gramos?|grs?|g|mililitros?|ml|litros?|l)\b/i, "").trim(), [text]);

  function reset() {
    setText("");
    setNeedsChoice(false);
    inputRef.current?.focus();
  }

  function addNuevo() {
    if (!cleanText) return;
    onAdd(draftNuevo(meal, cleanText, result?.gramosPedidos ?? null, result?.candidates ?? []));
    reset();
  }

  function addCandidate(c: Candidate) {
    if (!result) return;
    const r = resolveCandidate(cleanText, c, result.candidates, idx, { gramos: result.gramosPedidos, usage });
    const draft = draftFromResult(meal, cleanText, r);
    if (draft) onAdd(draft);
    reset();
  }

  function submit() {
    if (!result || !cleanText) return;
    if (result.tipo === "sin_resultado" || result.candidates.length === 0) {
      // Ningún candidato razonable → flujo "sin configurar" de siempre.
      addNuevo();
      return;
    }
    if (result.confidence === "alta" || result.confidence === "media") {
      const draft = draftFromResult(meal, cleanText, result);
      if (draft) onAdd(draft);
      reset();
      return;
    }
    // Confianza baja: no se elige solo — se muestran los candidatos.
    setNeedsChoice(true);
  }

  return (
    <GlassCard
      id={`meal-block-${meal}`}
      padding="sm"
      className={cn("relative flex flex-col gap-2.5", suggestionsOpen || chipOpen ? "z-50" : "z-0")}
      style={{ background: "var(--glass-bg-dark)" }}
    >
      <h2 className="text-sm font-bold text-white/85">{MEAL_LABELS[meal]}</h2>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((it) => {
            const m = liveMacros(it);
            return (
              <div key={it.id} className="flex items-center gap-2 flex-wrap">
                <FoodChip item={it} idx={idx} usage={usage} onReplace={onReplace} onOpenChange={setChipOpen} />
                <GramsInput key={`${it.foodId ?? it.recipeId ?? it.id}`} value={it.gramos} onChange={(g) => onUpdate(it.id, { gramos: g })} />
                <span className="text-xs text-white/45 tabular-nums">{Math.round(m.calorias)} kcal</span>
                <button
                  onClick={() => onRemove(it.id)}
                  className="text-white/30 hover:text-white/70 cursor-pointer shrink-0 p-1 ml-auto"
                  aria-label={`Quitar ${it.nombre}`}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm shrink-0">•</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setNeedsChoice(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escribe un alimento (ej. arroz 200 g)"
            enterKeyHint="done"
            className="flex-1 min-w-0 bg-transparent outline-none text-base text-white placeholder:text-white/35"
          />
          {text && (
            <button onClick={reset} className="text-white/30 hover:text-white/70 cursor-pointer shrink-0 p-0.5" aria-label="Borrar texto">
              <X size={13} />
            </button>
          )}
        </div>

        {suggestionsOpen && result && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl glass-panel shadow-2xl overflow-hidden max-h-64 overflow-y-auto" style={{ background: "#151515" }}>
            {needsChoice && <p className="px-3.5 pt-2.5 pb-1 text-xs text-amber-200/90">No estoy seguro. ¿Cuál es?</p>}
            {result.candidates.slice(0, MAX_CANDIDATES).map((c) => (
              <button
                key={`${c.kind}-${c.id}`}
                onClick={() => addCandidate(c)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-b border-white/[0.06]"
              >
                {c.kind === "receta" ? <BookOpen size={14} className="text-white/50 shrink-0" /> : <Clock size={14} className="text-white/40 shrink-0" />}
                <span className="text-sm text-white/90 truncate min-w-0">{c.nombre}</span>
                <VerifiedBadge item={c.food ?? c.recipe} size={13} className="mr-auto" />
                <span className="text-xs text-white/40 shrink-0">{c.kind === "receta" ? "Receta" : c.food ? `${Math.round(c.food.calorias)} kcal` : ""}</span>
              </button>
            ))}
            <button onClick={addNuevo} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer">
              <Plus size={14} className="text-white/50 shrink-0" />
              <span className="text-sm text-white truncate">Crear nuevo “{cleanText}”</span>
            </button>
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
  idx,
  usage,
  onBack,
  onRemove,
  onUpdate,
  onReplace,
  onAddMore,
  onConfirm,
}: {
  mealsWithItems: MealType[];
  draftItems: DraftItem[];
  total: Macros;
  idx: ResolverIndex;
  usage: Map<string, number>;
  onBack: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DraftItem>) => void;
  onReplace: (next: DraftItem) => void;
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
                .map((it) => {
                  const m = liveMacros(it);
                  return (
                    <div key={it.id} className="flex items-center gap-2 flex-wrap rounded-2xl bg-white/[0.04] glass-specular-ring px-3 py-2.5">
                      <FoodChip item={it} idx={idx} usage={usage} onReplace={onReplace} />
                      <GramsInput key={`${it.foodId ?? it.recipeId ?? it.id}`} value={it.gramos} onChange={(g) => onUpdate(it.id, { gramos: g })} />
                      <span className="text-xs text-white/45 tabular-nums">{Math.round(m.calorias)} kcal</span>
                      <button
                        onClick={() => onRemove(it.id)}
                        className="text-white/30 hover:text-white/70 cursor-pointer shrink-0 p-1 ml-auto"
                        aria-label={`Quitar ${it.nombre}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
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

      <div className="fixed bottom-3 left-0 right-0 z-30 px-4">
        <div className="max-w-md mx-auto w-full">
          <button
            onClick={onConfirm}
            disabled={draftItems.length === 0}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white glass-specular-ring backdrop-blur-xl cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--glass-bg-dark)", boxShadow: "0 8px 28px rgba(0,0,0,0.45)" }}
          >
            Añadir al plan · {Math.round(total.calorias)} kcal
          </button>
        </div>
      </div>
    </div>
  );
}
