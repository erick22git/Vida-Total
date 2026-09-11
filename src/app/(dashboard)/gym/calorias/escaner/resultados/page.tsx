"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, X, Sparkles, Check } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

const RESULTS_KEY = "vt-scan-results";

const MEAL_OPTIONS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface EditableItem {
  id: string;
  name: string;
  grams: number;
  confidence: "alta" | "media" | "baja";
  // Per-gram rates, derived once from Gemini's estimate — used to recompute
  // totals proportionally whenever the user edits the grams.
  caloriesPerGram: number;
  proteinPerGram: number;
  carbsPerGram: number;
  fatPerGram: number;
}

const CONFIDENCE_COLOR: Record<EditableItem["confidence"], string> = {
  alta: "#22c55e",
  media: "#eab308",
  baja: "#f97316",
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
  const router = useRouter();
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);

  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [meal, setMeal] = useState<MealType>("desayuno");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { photo?: string; items?: AnalyzedFoodItem[] };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read from sessionStorage on mount to hydrate this page from the escáner's navigation payload
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
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, grams: Math.max(1, it.grams + delta) } : it)),
    );
  }

  function updateName(id: string, name: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function goAddMore() {
    // Reutiliza el buscador de alimentos ya existente en el módulo — el
    // alimento elegido ahí se agrega directamente a `meal` en el store.
    router.push(`/gym/calorias/buscar?meal=${meal}`);
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
    router.push("/gym/calorias");
  }

  if (loaded && items.length === 0 && !photo) {
    return (
      <div className="flex flex-col gap-4 pb-10">
        <header className="flex items-center gap-3 pt-2">
          <button onClick={() => router.push("/gym/calorias/escaner")} className="text-white/50 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Resultados del escaneo</h1>
        </header>
        <p className="text-sm text-white/50 text-center py-16">
          No hay un escaneo reciente para mostrar. Vuelve al escáner e intenta de nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-40">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.push("/gym/calorias/escaner")} className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg md:text-2xl font-semibold tracking-tight">Resultados del escaneo</h1>
      </header>

      <div className="flex items-center gap-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Foto capturada" className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-white/10" />
        )}
        <div className="flex items-center gap-1.5 text-white/60 text-xs">
          <Sparkles size={14} className="text-[var(--gym)]" />
          <span>{items.length} alimento{items.length === 1 ? "" : "s"} detectado{items.length === 1 ? "" : "s"}. Revisa y ajusta antes de guardar.</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((it) => {
          const calorias = Math.round(it.caloriesPerGram * it.grams);
          const proteina = Math.round(it.proteinPerGram * it.grams * 10) / 10;
          const carbos = Math.round(it.carbsPerGram * it.grams * 10) / 10;
          const grasas = Math.round(it.fatPerGram * it.grams * 10) / 10;
          return (
            <GlassCard key={it.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <GlassInput
                    value={it.name}
                    onChange={(e) => updateName(it.id, e.target.value)}
                    className="text-sm font-medium"
                  />
                </div>
                <button
                  onClick={() => removeItem(it.id)}
                  aria-label="Quitar alimento"
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border"
                  style={{
                    color: CONFIDENCE_COLOR[it.confidence],
                    background: `${CONFIDENCE_COLOR[it.confidence]}1A`,
                    borderColor: `${CONFIDENCE_COLOR[it.confidence]}40`,
                  }}
                >
                  Confianza {it.confidence}
                </span>

                <div className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.12] px-1 py-1">
                  <button
                    onClick={() => updateGrams(it.id, -10)}
                    aria-label="Reducir gramos"
                    className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm text-white font-medium min-w-[64px] text-center">
                    {Math.round(it.grams)} g
                  </span>
                  <button
                    onClick={() => updateGrams(it.id, 10)}
                    aria-label="Aumentar gramos"
                    className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <MacroMini label="Kcal" value={calorias} />
                <MacroMini label="Prot" value={`${proteina}g`} />
                <MacroMini label="Carbs" value={`${carbos}g`} />
                <MacroMini label="Grasas" value={`${grasas}g`} />
              </div>
            </GlassCard>
          );
        })}

        {items.length === 0 && (
          <p className="text-sm text-white/40 text-center py-8">
            No quedan alimentos en la lista. Usa &quot;Agregar alimento&quot; para añadir uno manualmente.
          </p>
        )}
      </div>

      <button
        onClick={goAddMore}
        className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors py-3 text-sm cursor-pointer"
      >
        <Plus size={15} /> Agregar alimento
      </button>

      <GlassCard padding="md" className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-white/70">Totales</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <MacroMini label="Kcal" value={Math.round(totals.calorias)} accent />
          <MacroMini label="Prot" value={`${Math.round(totals.proteina * 10) / 10}g`} />
          <MacroMini label="Carbs" value={`${Math.round(totals.carbos * 10) / 10}g`} />
          <MacroMini label="Grasas" value={`${Math.round(totals.grasas * 10) / 10}g`} />
        </div>
      </GlassCard>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50">Agregar a</label>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType)}
          className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] backdrop-blur-md px-4 py-3 text-sm text-white outline-none focus:border-white/30 min-h-[44px]"
        >
          {MEAL_OPTIONS.map((m) => (
            <option key={m} value={m} className="bg-[#1c1c22]">
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto">
          <GlassButton
            className="w-full flex items-center justify-center gap-2"
            size="lg"
            disabled={items.length === 0 || saving}
            onClick={confirmAll}
          >
            <Check size={16} /> Confirmar y Agregar Todo
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

function MacroMini({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-bold" style={{ color: accent ? "var(--gym)" : "white" }}>
        {value}
      </span>
      <span className="text-[10px] text-white/45">{label}</span>
    </div>
  );
}
