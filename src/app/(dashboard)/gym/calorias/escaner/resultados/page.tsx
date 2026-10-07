"use client";

/**
 * Resultados del escaneo por IA — pantalla compartida por DOS entradas: la foto del Escáner y el
 * dictado de Voz (ambos guardan la lista detectada en el mismo `sessionStorage["vt-scan-results"]`
 * y navegan acá). Reskin al estilo oscuro "Not Boring" del resto de Calorías.
 *
 * La IA (o la voz) solo aporta NOMBRE y GRAMOS: todo lo demás (qué alimento de la base es, calorías, macros, estado
 * crudo/cocido, receta relacionada) lo resuelve nuestro resolvedor (`lib/nutrition/food-resolver.ts`), igual que Lista.
 * Solo si no hay equivalente en la base se conserva la estimación de la IA (etiqueta "estimado IA"); si tampoco hay
 * estimación (voz), queda como alimento nuevo "sin configurar".
 * Al confirmar se guarda con la MISMA acción que el resto (`addLoggedFood`) y se vuelve a la home: si todo fue a una
 * sola comida, se abre ahí mismo con `?justAdded=`.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Minus, Plus, Sparkles, Check, X } from "lucide-react";
import { FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { FoodChip } from "@/components/gym/food-draft-ui";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import {
  commitDraftItems,
  draftFromResult,
  draftIa,
  draftNuevo,
  liveMacros,
  MAX_CANDIDATES,
  sumMacros,
  type DraftItem,
} from "@/lib/nutrition/draft-item";
import { buildUsageMap, getResolverIndex, resolveFoodText, type ResolverIndex } from "@/lib/nutrition/food-resolver";
import { MEAL_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

const RESULTS_KEY = "vt-scan-results";

const MEAL_OPTIONS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

interface ScanItem {
  draft: DraftItem;
  /** Qué tan segura estaba la IA de haber reconocido el alimento (no tiene que ver con el resolvedor). */
  confidence: "alta" | "media" | "baja";
  /** Lo que la IA estimó, por si hay que volver a "estimado IA" al corregir el nombre. */
  ai: { gramos: number; calorias: number; proteina: number; carbos: number; grasas: number };
}

const CONFIDENCE_COLOR: Record<ScanItem["confidence"], string> = {
  alta: "#4ade80",
  media: "#f5a800",
  baja: "#ff6b35",
};

/** Texto + gramos → borrador. `preferAiOnLow`: con confianza baja del resolvedor y estimación de la IA, se conserva la IA. */
function resolveDraft(
  texto: string,
  gramos: number,
  ai: ScanItem["ai"],
  idx: ResolverIndex,
  usage: Map<string, number>,
  meal: MealType,
  id?: string,
): DraftItem {
  const r = resolveFoodText(texto, idx, { gramos: gramos > 0 ? gramos : undefined, usage, maxCandidates: MAX_CANDIDATES });
  const hasAi = ai.calorias > 0;
  const useBase = r.tipo !== "sin_resultado" && (r.confidence !== "baja" || !hasAi);
  const fromBase = useBase ? draftFromResult(meal, texto, r, id) : null;
  if (fromBase) return { ...fromBase, gramos: gramos > 0 ? gramos : fromBase.gramos };
  const g = gramos > 0 ? gramos : ai.gramos;
  if (hasAi) return draftIa(meal, texto, g, { calorias: ai.calorias, proteina: ai.proteina, carbos: ai.carbos, grasas: ai.grasas }, r.candidates.slice(0, MAX_CANDIDATES), id);
  return draftNuevo(meal, texto, g, r.candidates.slice(0, MAX_CANDIDATES), id);
}

export default function EscanerResultadosPage() {
  return (
    <Suspense fallback={null}>
      <EscanerResultadosContent />
    </Suspense>
  );
}

function EscanerResultadosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const addCustomFood = useGymStore((s) => s.addCustomFood);
  const customFoods = useGymStore((s) => s.customFoods);
  const recipes = useGymStore((s) => s.recipes);
  const loggedFoods = useGymStore((s) => s.loggedFoods);

  const allFoods = useMemo(() => mergeFoods(customFoods), [customFoods]);
  const idx = useMemo(() => getResolverIndex(allFoods, recipes), [allFoods, recipes]);
  const usage = useMemo(() => buildUsageMap(loggedFoods), [loggedFoods]);

  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mealParam = searchParams.get("meal") as MealType | null;
  const [meal, setMeal] = useState<MealType>(() => (mealParam && MEAL_OPTIONS.includes(mealParam) ? mealParam : "desayuno"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { photo?: string; items?: AnalyzedFoodItem[] };
        // Estado fresco del store (no el de la primera pintada): las recetas/alimentos propios ya están hidratados.
        const st = useGymStore.getState();
        const idx0 = getResolverIndex(mergeFoods(st.customFoods), st.recipes);
        const usage0 = buildUsageMap(st.loggedFoods);
        const initialMeal = mealParam && MEAL_OPTIONS.includes(mealParam) ? mealParam : "desayuno";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read from sessionStorage on mount to hydrate this page from el escáner/voz
        setPhoto(parsed.photo ?? null);
        setItems(
          (parsed.items ?? []).map((raw): ScanItem => {
            const gr = raw.estimatedGrams > 0 ? raw.estimatedGrams : 0;
            const ai = { gramos: gr > 0 ? gr : 100, calorias: raw.calories || 0, proteina: raw.protein || 0, carbos: raw.carbs || 0, grasas: raw.fat || 0 };
            const name = (raw.name || "Alimento").trim();
            return {
              draft: resolveDraft(name, gr, ai, idx0, usage0, initialMeal),
              confidence: raw.confidence === "alta" || raw.confidence === "media" || raw.confidence === "baja" ? raw.confidence : "media",
              ai,
            };
          }),
        );
      }
    } catch {
      // Nothing usable in sessionStorage — the empty state below handles it.
    } finally {
      setLoaded(true);
    }
    // Solo al montar: leer lo detectado una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => sumMacros(items.map((i) => i.draft)), [items]);

  function patch(id: string, fn: (it: ScanItem) => ScanItem) {
    setItems((prev) => prev.map((it) => (it.draft.id === id ? fn(it) : it)));
  }
  function updateGrams(id: string, delta: number) {
    patch(id, (it) => ({ ...it, draft: { ...it.draft, gramos: Math.max(1, it.draft.gramos + delta) } }));
  }
  /** Corregir el nombre = volver a resolver con ese texto (misma cantidad). */
  function updateName(id: string, name: string) {
    patch(id, (it) => ({ ...it, draft: resolveDraft(name, it.draft.gramos, it.ai, idx, usage, it.draft.meal, id) }));
  }
  function replaceDraft(next: DraftItem) {
    patch(next.id, (it) => ({ ...it, draft: next }));
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.draft.id !== id));
  }

  function goAddMore() {
    // El buscador NUEVO (rediseñado) — antes esto llevaba al viejo `/gym/calorias/buscar`.
    router.push(`/gym/calorias/buscar-nuevo?meal=${meal}`);
  }

  function confirmAll() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    commitDraftItems(
      items.map((it) => ({ ...it.draft, meal })),
      { addLoggedFood, addCustomFood },
      () => ({ photoUrl: photo, source: "escaner-ia" as const }),
    );
    try {
      sessionStorage.removeItem(RESULTS_KEY);
    } catch {
      // ignore
    }
    // Todos los alimentos de este escaneo van a la MISMA comida (el selector de abajo es único, no
    // por ítem) — así que siempre hay un solo círculo para revelar, como agregar por búsqueda.
    router.push(`/gym/calorias?justAdded=${meal}`);
  }

  if (loaded && items.length === 0 && !photo) {
    return (
      <div className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-y-auto" style={FOOD_SECTION_BG}>
        <Header onBack={() => router.push("/gym/calorias/escaner")} />
        <p className="text-sm text-white/45 text-center py-16 px-6">
          No hay un escaneo reciente para mostrar. Volvé al escáner e intentá de nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-y-auto" style={FOOD_SECTION_BG}>
      <Header onBack={() => router.push("/gym/calorias/escaner")} />

      <div className="max-w-md mx-auto w-full px-4 pb-40 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Foto capturada" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
          )}
          <div className="flex items-center gap-1.5 text-white/55 text-xs">
            <Sparkles size={14} style={{ color: "var(--gym)" }} />
            <span>
              {items.length} alimento{items.length === 1 ? "" : "s"} detectado{items.length === 1 ? "" : "s"}. Revisá y ajustá antes de guardar.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it) => {
            const d = it.draft;
            const m = liveMacros(d);
            const calorias = Math.round(m.calorias);
            const proteina = Math.round(m.proteina * 10) / 10;
            const carbos = Math.round(m.carbos * 10) / 10;
            const grasas = Math.round(m.grasas * 10) / 10;
            return (
              <div key={d.id} className="flex flex-col gap-3 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
                <div className="flex items-start gap-2">
                  <input
                    value={d.texto}
                    onChange={(e) => updateName(d.id, e.target.value)}
                    aria-label="Nombre detectado"
                    className="flex-1 min-w-0 bg-transparent outline-none text-base font-medium text-white border-b border-white/10 focus:border-white/40 py-1"
                  />
                  <button
                    onClick={() => removeItem(d.id)}
                    aria-label="Quitar alimento"
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <FoodChip item={d} idx={idx} usage={usage} onReplace={replaceDraft} />

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ color: CONFIDENCE_COLOR[it.confidence], background: `${CONFIDENCE_COLOR[it.confidence]}1A` }}
                  >
                    Confianza {it.confidence}
                  </span>

                  <div className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1 py-1">
                    <button
                      onClick={() => updateGrams(d.id, -10)}
                      aria-label="Reducir gramos"
                      className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-sm text-white font-medium min-w-[56px] text-center tabular-nums">{Math.round(d.gramos)} g</span>
                    <button
                      onClick={() => updateGrams(d.id, 10)}
                      aria-label="Aumentar gramos"
                      className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <MacroMini label="Kcal" value={calorias} />
                  <MacroMini label="Prot" value={`${proteina}g`} />
                  <MacroMini label="Carbs" value={`${carbos}g`} />
                  <MacroMini label="Grasas" value={`${grasas}g`} />
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="text-sm text-white/35 text-center py-8">
              No quedan alimentos en la lista. Usá &quot;Agregar alimento&quot; para sumar uno manualmente.
            </p>
          )}
        </div>

        <button
          onClick={goAddMore}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-white/50 hover:text-white hover:border-white/35 transition-colors py-3 text-sm cursor-pointer"
        >
          <Plus size={15} /> Agregar alimento
        </button>

        <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <p className="text-[11px] uppercase tracking-wide text-white/40" style={MONO_FONT}>
            Totales
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <MacroMini label="Kcal" value={Math.round(totals.calorias)} accent />
            <MacroMini label="Prot" value={`${Math.round(totals.proteina * 10) / 10}g`} />
            <MacroMini label="Carbs" value={`${Math.round(totals.carbos * 10) / 10}g`} />
            <MacroMini label="Grasas" value={`${Math.round(totals.grasas * 10) / 10}g`} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/45">Agregar a</label>
          <div className="grid grid-cols-5 gap-1.5">
            {MEAL_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className="rounded-xl py-2 text-[11px] font-medium transition-colors cursor-pointer truncate px-1"
                style={meal === m ? { background: "#fff", color: "#000" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,#1c1c1c_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto">
          <button
            disabled={items.length === 0 || saving}
            onClick={confirmAll}
            className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
          >
            <Check size={16} /> Confirmar y agregar todo
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] pb-2 max-w-md mx-auto w-full shrink-0">
      <button
        onClick={onBack}
        aria-label="Volver"
        className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
        style={{ background: "#0d0d0d" }}
      >
        <ChevronLeft size={22} strokeWidth={2.6} />
      </button>
      <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
        Resultados
      </h1>
      <span className="w-10 h-10" />
    </header>
  );
}

function MacroMini({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-bold" style={{ color: accent ? "var(--gym)" : "white" }}>
        {value}
      </span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  );
}
