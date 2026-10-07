"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronDown, Clock, Plus, X } from "lucide-react";
import { FoodSectionHeader, FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import {
  buildUsageMap,
  getResolverIndex,
  nutritionForResult,
  resolveCandidate,
  resolveFoodText,
  type Candidate,
  type ResolveResult,
  type ResolvedIngredient,
  type ResolverIndex,
} from "@/lib/nutrition/food-resolver";
import { MEAL_LABELS, type CookedState, type Food, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];
const MAX_CANDIDATES = 4;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Macros {
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

/** Un ítem capturado en "Lista" pero todavía no guardado: vive en estado local hasta confirmar en el paso 2.
 * Los macros se guardan para `base.gramos` y se escalan en vivo al cambiar `gramos` (todo es lineal). */
interface DraftItem {
  id: string;
  meal: MealType;
  /** Lo que escribió el usuario (sin la cantidad). */
  texto: string;
  tipo: "alimento" | "receta" | "nuevo";
  nombre: string;
  foodId?: string;
  recipeId?: string;
  cookedState?: CookedState;
  gramos: number;
  base: Macros & { gramos: number };
  ingredientesBase?: ResolvedIngredient[];
  /** Para el chip "cambiar": hasta 4 alternativas del resolvedor. */
  candidates: Candidate[];
}

function liveMacros(it: DraftItem): Macros {
  const f = it.base.gramos > 0 ? it.gramos / it.base.gramos : 0;
  return {
    calorias: it.base.calorias * f,
    proteina: it.base.proteina * f,
    carbos: it.base.carbos * f,
    grasas: it.base.grasas * f,
  };
}

function draftFromResult(meal: MealType, texto: string, r: ResolveResult, id = uid()): DraftItem | null {
  if (!r.chosen || r.tipo === "sin_resultado") return null;
  const candidates = r.candidates.slice(0, MAX_CANDIDATES);
  if (r.tipo === "receta" && r.ingredientes) {
    const tot = r.ingredientes.reduce(
      (a, i) => ({ calorias: a.calorias + i.calorias, proteina: a.proteina + i.proteina, carbos: a.carbos + i.carbos, grasas: a.grasas + i.grasas }),
      { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
    );
    return {
      id, meal, texto, tipo: "receta", nombre: r.chosen.nombre, recipeId: r.recipeId, gramos: r.gramos,
      base: { gramos: r.gramos, ...tot }, ingredientesBase: r.ingredientes, candidates,
    };
  }
  // Macros de referencia a 100 g (más precisos al escalar que partir de una porción chica ya redondeada).
  const n = nutritionForResult(r, 100);
  if (!n || !r.chosen.food) return null;
  return {
    id, meal, texto, tipo: "alimento", nombre: r.chosen.food.nombre, foodId: r.chosen.food.id, cookedState: r.cookedState, gramos: r.gramos,
    base: { gramos: 100, calorias: n.calorias, proteina: n.proteina, carbos: n.carbos, grasas: n.grasas },
    candidates,
  };
}

function draftNuevo(meal: MealType, texto: string, gramos: number | null, candidates: Candidate[]): DraftItem {
  return {
    id: uid(), meal, texto, tipo: "nuevo", nombre: texto.trim(), gramos: gramos ?? 100,
    base: { gramos: gramos ?? 100, calorias: 0, proteina: 0, carbos: 0, grasas: 0 }, candidates,
  };
}

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

  const total = draftItems.reduce<Macros>(
    (acc, it) => {
      const m = liveMacros(it);
      return { calorias: acc.calorias + m.calorias, proteina: acc.proteina + m.proteina, carbos: acc.carbos + m.carbos, grasas: acc.grasas + m.grasas };
    },
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  const mealsWithItems = MEALS.filter((m) => draftItems.some((it) => it.meal === m));

  function confirmAll() {
    for (const it of draftItems) {
      const gr = Math.round(it.gramos * 10) / 10;
      if (it.tipo === "receta" && it.ingredientesBase) {
        // La receta se registra como sus ingredientes (cada uno con su alimento y micronutrientes), todos con el vínculo `recipeId`.
        const f = it.base.gramos > 0 ? it.gramos / it.base.gramos : 0;
        for (const ing of it.ingredientesBase) {
          addLoggedFood({
            foodId: ing.foodId,
            nombre: ing.nombre,
            calorias: Math.round(ing.calorias * f),
            proteina: Math.round(ing.proteina * f * 10) / 10,
            carbos: Math.round(ing.carbos * f * 10) / 10,
            grasas: Math.round(ing.grasas * f * 10) / 10,
            meal: it.meal,
            gramos: Math.round(ing.gramos * f * 10) / 10,
            porcionNombre: `${Math.round(ing.gramos * f * 10) / 10} g`,
            recipeId: it.recipeId,
          });
        }
        continue;
      }
      let foodId = it.foodId;
      if (it.tipo === "nuevo") {
        // Flujo "sin configurar" de siempre (aparece en Buscar > Creados): se crea recién ahora, al confirmar.
        const placeholder = addCustomFood({
          nombre: it.nombre,
          categoria: "Otros",
          porcion: "1 unidad",
          calorias: 0,
          proteina: 0,
          carbos: 0,
          grasas: 0,
          configurado: false,
        });
        foodId = placeholder.id;
      }
      const m = liveMacros(it);
      addLoggedFood({
        foodId: foodId ?? `lista-${it.id}`,
        nombre: it.nombre,
        calorias: Math.round(m.calorias),
        proteina: Math.round(m.proteina * 10) / 10,
        carbos: Math.round(m.carbos * 10) / 10,
        grasas: Math.round(m.grasas * 10) / 10,
        meal: it.meal,
        gramos: gr,
        porcionNombre: `${gr} g`,
        cookedState: it.cookedState,
      });
    }
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

/** Gramos editables: el texto se escribe libremente y solo se confirma un número válido (> 0). */
function GramsInput({ value, onChange, className }: { value: number; onChange: (g: number) => void; className?: string }) {
  const [text, setText] = useState(String(Math.round(value * 10) / 10));
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-white/[0.08] glass-specular-ring pl-3 pr-2 focus-within:shadow-[var(--glass-specular-strong)]", className)}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        aria-label="Gramos"
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d*$/.test(t)) return;
          setText(t);
          const n = parseFloat(t);
          if (Number.isFinite(n) && n > 0) onChange(n);
        }}
        onBlur={() => setText(String(Math.round(value * 10) / 10))}
        className="w-14 bg-transparent py-1.5 text-base text-white text-right outline-none"
      />
      <span className="text-xs text-white/45">g</span>
    </span>
  );
}

/** Chip con el alimento elegido; al tocarlo se despliegan las alternativas (y "Crear nuevo"). */
function FoodChip({
  item,
  idx,
  usage,
  onReplace,
  onOpenChange,
}: {
  item: DraftItem;
  idx: ResolverIndex;
  usage: Map<string, number>;
  onReplace: (next: DraftItem) => void;
  /** Para que el bloque que lo contiene se eleve por encima de los de abajo mientras el menú está abierto. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const alternatives = item.candidates.filter((c) => !(c.id === (item.foodId ?? item.recipeId) && c.kind === (item.tipo === "receta" ? "receta" : "alimento")));
  const canChange = item.tipo !== "nuevo" || item.candidates.length > 0;

  function pick(c: Candidate) {
    const r = resolveCandidate(item.texto, c, item.candidates, idx, { gramos: item.gramos, usage });
    const next = draftFromResult(item.meal, item.texto, r, item.id);
    if (next) onReplace({ ...next, gramos: item.gramos });
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => canChange && setOpen((v) => !v)}
        className={cn(
          "max-w-full inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white",
          item.tipo === "nuevo" ? "bg-amber-400/15 text-amber-200" : "bg-white/[0.08]",
          canChange ? "cursor-pointer" : "cursor-default",
        )}
      >
        {item.tipo === "receta" && <BookOpen size={13} className="shrink-0 text-white/60" />}
        <span className="truncate">{item.nombre}</span>
        {item.tipo === "nuevo" && <span className="text-[10px] uppercase shrink-0">nuevo</span>}
        {canChange && <ChevronDown size={13} className="shrink-0 text-white/40" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 max-w-[80vw] rounded-2xl glass-panel shadow-2xl overflow-hidden" style={{ background: "#151515" }}>
          {alternatives.map((c) => (
            <button key={`${c.kind}-${c.id}`} onClick={() => pick(c)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-b border-white/[0.06] last:border-b-0">
              {c.kind === "receta" ? <BookOpen size={14} className="text-white/50 shrink-0" /> : <Clock size={14} className="text-white/40 shrink-0" />}
              <span className="text-sm text-white/90 truncate flex-1 min-w-0">{c.nombre}</span>
            </button>
          ))}
          {item.tipo !== "nuevo" && (
            <button
              onClick={() => {
                onReplace(draftNuevo(item.meal, item.texto, item.gramos, item.candidates));
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.06]"
            >
              <Plus size={14} className="text-white/50 shrink-0" />
              <span className="text-sm text-white truncate">Crear nuevo “{item.texto}”</span>
            </button>
          )}
          {alternatives.length === 0 && item.tipo === "nuevo" && <p className="px-3.5 py-2.5 text-xs text-white/45">Sin alternativas.</p>}
        </div>
      )}
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
                <span className="text-sm text-white/90 truncate flex-1 min-w-0">{c.nombre}</span>
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
