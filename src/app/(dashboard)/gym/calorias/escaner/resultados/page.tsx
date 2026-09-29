"use client";

/**
 * Resultados del escaneo por IA — pantalla compartida por DOS entradas: la foto del Escáner y el
 * dictado de Voz (ambos guardan la lista detectada en el mismo `sessionStorage["vt-scan-results"]`
 * y navegan acá). Reskin al estilo oscuro "Not Boring" del resto de Calorías (antes era la interfaz
 * vieja de tarjetas de vidrio, que no combinaba con nada más del módulo).
 * Al confirmar, se guarda con la MISMA acción que el resto (`addLoggedFood`) y se vuelve a la home:
 * si todo fue a una sola comida, se abre ahí mismo con `?justAdded=` (el círculo muestra las kcal un
 * par de segundos, igual que agregar por búsqueda); si tocó más de una comida, se vuelve sin eso (no
 * hay un único círculo que revelar).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Minus, Plus, Sparkles, Check, X } from "lucide-react";
import { FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

const RESULTS_KEY = "vt-scan-results";

const MEAL_OPTIONS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface EditableItem {
  id: string;
  name: string;
  grams: number;
  confidence: "alta" | "media" | "baja";
  // Per-gram rates, derived once from the AI estimate — used to recompute
  // totals proportionally whenever the user edits the grams.
  caloriesPerGram: number;
  proteinPerGram: number;
  carbsPerGram: number;
  fatPerGram: number;
}

const CONFIDENCE_COLOR: Record<EditableItem["confidence"], string> = {
  alta: "#4ade80",
  media: "#f5a800",
  baja: "#ff6b35",
};

function toEditableItem(raw: AnalyzedFoodItem): EditableItem {
  const grams = raw.estimatedGrams > 0 ? raw.estimatedGrams : 100;
  return {
    id: uid(),
    name: raw.name || "Alimento",
    grams,
    confidence: raw.confidence === "alta" || raw.confidence === "media" || raw.confidence === "baja" ? raw.confidence : "media",
    caloriesPerGram: (raw.calories || 0) / grams,
    proteinPerGram: (raw.protein || 0) / grams,
    carbsPerGram: (raw.carbs || 0) / grams,
    fatPerGram: (raw.fat || 0) / grams,
  };
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

  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mealParam = searchParams.get("meal") as MealType | null;
  const [meal, setMeal] = useState<MealType>(() => (mealParam && MEAL_OPTIONS.includes(mealParam) ? mealParam : "desayuno"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { photo?: string; items?: AnalyzedFoodItem[] };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read from sessionStorage on mount to hydrate this page from el escáner/voz
        setPhoto(parsed.photo ?? null);
        setItems((parsed.items ?? []).map(toEditableItem));
      }
    } catch {
      // Nothing usable in sessionStorage — the empty state below handles it.
    } finally {
      setLoaded(true);
    }
  }, []);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => {
          acc.calorias += it.caloriesPerGram * it.grams;
          acc.proteina += it.proteinPerGram * it.grams;
          acc.carbos += it.carbsPerGram * it.grams;
          acc.grasas += it.fatPerGram * it.grams;
          return acc;
        },
        { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
      ),
    [items],
  );

  function updateGrams(id: string, delta: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, grams: Math.max(1, it.grams + delta) } : it)));
  }
  function updateName(id: string, name: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function goAddMore() {
    // El buscador NUEVO (rediseñado) — antes esto llevaba al viejo `/gym/calorias/buscar`.
    router.push(`/gym/calorias/buscar-nuevo?meal=${meal}`);
  }

  function confirmAll() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    for (const it of items) {
      addLoggedFood({
        foodId: `scan-${uid()}`,
        nombre: it.name.trim() || "Alimento",
        calorias: Math.round(it.caloriesPerGram * it.grams),
        proteina: Math.round(it.proteinPerGram * it.grams * 10) / 10,
        carbos: Math.round(it.carbsPerGram * it.grams * 10) / 10,
        grasas: Math.round(it.fatPerGram * it.grams * 10) / 10,
        meal,
        porcionNombre: `${Math.round(it.grams)} g`,
        gramos: it.grams,
        photoUrl: photo,
        source: "escaner-ia",
      });
    }
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
            const calorias = Math.round(it.caloriesPerGram * it.grams);
            const proteina = Math.round(it.proteinPerGram * it.grams * 10) / 10;
            const carbos = Math.round(it.carbsPerGram * it.grams * 10) / 10;
            const grasas = Math.round(it.fatPerGram * it.grams * 10) / 10;
            return (
              <div key={it.id} className="flex flex-col gap-3 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
                <div className="flex items-start gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => updateName(it.id, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium text-white border-b border-white/10 focus:border-white/40 py-1"
                  />
                  <button
                    onClick={() => removeItem(it.id)}
                    aria-label="Quitar alimento"
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ color: CONFIDENCE_COLOR[it.confidence], background: `${CONFIDENCE_COLOR[it.confidence]}1A` }}
                  >
                    Confianza {it.confidence}
                  </span>

                  <div className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1 py-1">
                    <button
                      onClick={() => updateGrams(it.id, -10)}
                      aria-label="Reducir gramos"
                      className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-sm text-white font-medium min-w-[56px] text-center tabular-nums">{Math.round(it.grams)} g</span>
                    <button
                      onClick={() => updateGrams(it.id, 10)}
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
