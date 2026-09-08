"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Share2,
  MoreVertical,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { FoodPhoto } from "@/components/gym/food-photo";
import { QuantityKeypad } from "@/components/gym/quantity-keypad";
import { useGymStore } from "@/lib/store/gymStore";
import { BASE_FOODS, defaultPortions, scaleNutrition, scaleMicronutrients, MICRONUTRIENT_LABELS, DAILY_VALUES } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import type { FoodPortion, MealType } from "@/lib/types";

const ADD_TARGETS: { key: string; label: string; meal: MealType }[] = [
  { key: "desayuno", label: "Desayuno", meal: "desayuno" },
  { key: "almuerzo", label: "Almuerzo", meal: "almuerzo" },
  { key: "cena", label: "Cena", meal: "cena" },
  { key: "snack1", label: "Snack 1", meal: "snacks" },
  { key: "snack2", label: "Snack 2", meal: "snacks" },
];

const MACRO_COLORS = { proteina: "#22c55e", carbos: "#eab308", grasas: "#f97316" };

export default function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const customFoods = useGymStore((s) => s.customFoods);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);
  const toggleFavoriteFood = useGymStore((s) => s.toggleFavoriteFood);
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);

  const food = useMemo(
    () => customFoods.find((f) => f.id === id) ?? BASE_FOODS.find((f) => f.id === id),
    [customFoods, id],
  );

  const [portions, setPortions] = useState<FoodPortion[]>(() => (food ? defaultPortions(food) : []));
  const [selectedPortionIdx, setSelectedPortionIdx] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [portionMenuOpen, setPortionMenuOpen] = useState(false);
  const [createPortionOpen, setCreatePortionOpen] = useState(false);
  const [newPortionName, setNewPortionName] = useState("");
  const [newPortionGrams, setNewPortionGrams] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addedTarget, setAddedTarget] = useState<string | null>(null);
  const [nutritionOpen, setNutritionOpen] = useState(true);
  const [microOpen, setMicroOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  if (!food) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-white/60">Alimento no encontrado.</p>
        <Link href="/gym/calorias/buscar" className="text-sm text-[var(--gym)]">
          Volver a la búsqueda
        </Link>
      </div>
    );
  }

  const selectedPortion = portions[selectedPortionIdx] ?? portions[0];
  const gramos = cantidad * (selectedPortion?.gramos ?? 100);
  const nutrition = scaleNutrition(food, gramos);
  const micronutrients = scaleMicronutrients(food, gramos);
  const isFavorite = favoriteFoodIds.includes(food.id);

  const macroKcal = {
    proteina: nutrition.proteina * 4,
    carbos: nutrition.carbos * 4,
    grasas: nutrition.grasas * 9,
  };
  const totalMacroKcal = macroKcal.proteina + macroKcal.carbos + macroKcal.grasas || 1;
  const macroPct = {
    proteina: Math.round((macroKcal.proteina / totalMacroKcal) * 100),
    carbos: Math.round((macroKcal.carbos / totalMacroKcal) * 100),
    grasas: Math.round((macroKcal.grasas / totalMacroKcal) * 100),
  };

  const aiInsight = buildAiInsight(nutrition, food.categoria);

  const nutritionRows: { label: string; value: number | undefined; unit: string; dvKey: string }[] = [
    { label: "Carbohidratos", value: nutrition.carbos, unit: "g", dvKey: "carbos" },
    { label: "Proteínas", value: nutrition.proteina, unit: "g", dvKey: "proteina" },
    { label: "Grasas Totales", value: nutrition.grasas, unit: "g", dvKey: "grasas" },
    { label: "Grasas Saturadas", value: nutrition.grasasSaturadas, unit: "g", dvKey: "grasasSaturadas" },
    { label: "Grasas Trans", value: nutrition.grasasTrans, unit: "g", dvKey: "" },
    { label: "Colesterol", value: nutrition.colesterol, unit: "mg", dvKey: "colesterol" },
    { label: "Sodio", value: nutrition.sodio, unit: "mg", dvKey: "sodio" },
    { label: "Fibra", value: nutrition.fibra, unit: "g", dvKey: "fibra" },
    { label: "Azúcares", value: nutrition.azucares, unit: "g", dvKey: "azucares" },
    { label: "Azúcares Añadidos", value: nutrition.azucaresAnadidos, unit: "g", dvKey: "azucaresAnadidos" },
  ];

  const vitaminEntries = Object.entries(micronutrients ?? {}).filter(
    ([k]) => MICRONUTRIENT_LABELS[k]?.group === "vitamina",
  );
  const mineralEntries = Object.entries(micronutrients ?? {}).filter(
    ([k]) => MICRONUTRIENT_LABELS[k]?.group === "mineral",
  );

  function handleAdd(target: (typeof ADD_TARGETS)[number]) {
    addLoggedFood({
      foodId: food!.id,
      nombre: food!.nombre,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
      meal: target.meal,
      cantidad,
      porcionNombre: selectedPortion?.nombre,
      photoUrl: food!.photoUrl,
    });
    setAddedTarget(target.key);
    setAddMenuOpen(false);
    setTimeout(() => router.push("/gym/calorias"), 550);
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between pt-2 gap-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate flex-1 text-center">
          {food.nombre}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleFavoriteFood(food.id)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
          >
            <Heart size={16} fill={isFavorite ? "#ff5c5c" : "none"} color={isFavorite ? "#ff5c5c" : "white"} />
          </button>
          <div className="relative">
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
            >
              <MoreVertical size={16} className="text-white" />
            </button>
            {optionsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOptionsOpen(false)} />
                <div className="absolute right-0 top-11 z-40 w-44 rounded-2xl bg-[#1c1c22] border border-white/[0.12] shadow-2xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        navigator.share({ title: food.nombre, text: `${food.nombre} — ${nutrition.calorias} kcal` }).catch(() => {});
                      }
                      setOptionsOpen(false);
                    }}
                  >
                    <Share2 size={14} /> Compartir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center gap-2">
        <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={104} rounded="rounded-full" emoji={categoryEmoji(food.categoria)} />
        {food.verificado && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--gym)]">
            <Check size={12} /> Verificado
          </span>
        )}
        <p className="text-xs text-white/45">
          Datos por {cantidad} {selectedPortion?.nombre}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <MacroCard label="Kcal" value={Math.round(nutrition.calorias)} color="var(--gym)" />
        <MacroCard label="Proteínas" value={`${Math.round(nutrition.proteina)}g`} color={MACRO_COLORS.proteina} />
        <MacroCard label="Carbos" value={`${Math.round(nutrition.carbos)}g`} color={MACRO_COLORS.carbos} />
        <MacroCard label="Grasas" value={`${Math.round(nutrition.grasas)}g`} color={MACRO_COLORS.grasas} />
      </div>

      <GlassCard padding="md" className="flex items-center gap-3" glow>
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", boxShadow: "0 0 16px #a855f755" }}
        >
          <Sparkles size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white/80 mb-0.5">Analizar con IA</p>
          <p className="text-xs text-white/50">{aiInsight}</p>
        </div>
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-white/70">Distribución de macros</p>
        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-white/[0.06]">
          <div style={{ width: `${macroPct.proteina}%`, background: MACRO_COLORS.proteina }} />
          <div style={{ width: `${macroPct.carbos}%`, background: MACRO_COLORS.carbos }} />
          <div style={{ width: `${macroPct.grasas}%`, background: MACRO_COLORS.grasas }} />
        </div>
        <div className="flex justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1"><Dot color={MACRO_COLORS.proteina} /> Proteína {macroPct.proteina}%</span>
          <span className="flex items-center gap-1"><Dot color={MACRO_COLORS.carbos} /> Carbos {macroPct.carbos}%</span>
          <span className="flex items-center gap-1"><Dot color={MACRO_COLORS.grasas} /> Grasas {macroPct.grasas}%</span>
        </div>
      </GlassCard>

      {/* Portion selector */}
      <GlassCard padding="md" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white">Porción</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setKeypadOpen(true)}
            className="rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-2.5 text-left cursor-pointer"
          >
            <span className="text-[10px] text-white/40 block">Cantidad</span>
            <span className="text-sm text-white font-medium">{cantidad}</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setPortionMenuOpen((v) => !v)}
              className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-2.5 text-left cursor-pointer flex items-center justify-between"
            >
              <span className="min-w-0">
                <span className="text-[10px] text-white/40 block">Porción</span>
                <span className="text-sm text-white font-medium truncate block">{selectedPortion?.nombre}</span>
              </span>
              <ChevronDown size={14} className="text-white/40 shrink-0" />
            </button>
            {portionMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPortionMenuOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl bg-[#1c1c22] border border-white/[0.12] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {portions.map((p, idx) => (
                    <button
                      key={p.nombre + idx}
                      className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                      onClick={() => {
                        setSelectedPortionIdx(idx);
                        setPortionMenuOpen(false);
                      }}
                    >
                      {p.nombre}
                    </button>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--gym)] hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.08]"
                    onClick={() => {
                      setPortionMenuOpen(false);
                      setCreatePortionOpen(true);
                    }}
                  >
                    + Crear Porción
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {createPortionOpen && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-3 border border-white/[0.08]">
            <p className="text-xs text-white/50">Nueva porción personalizada</p>
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
                  setPortions((prev) => {
                    const next = [...prev, { nombre: newPortionName.trim(), gramos: grams }];
                    setSelectedPortionIdx(next.length - 1);
                    return next;
                  });
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
      </GlassCard>

      {/* Nutrition info */}
      <GlassCard padding="md" className="flex flex-col gap-3">
        <button className="flex items-center justify-between cursor-pointer" onClick={() => setNutritionOpen((v) => !v)}>
          <h2 className="text-sm font-semibold text-white">Información Nutricional</h2>
          {nutritionOpen ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
        </button>
        {nutritionOpen && (
          <div className="flex flex-col gap-3">
            {nutritionRows
              .filter((r) => r.value !== undefined)
              .map((row) => {
                const dv = DAILY_VALUES[row.dvKey];
                const pct = dv ? Math.min(100, Math.round(((row.value ?? 0) / dv) * 100)) : null;
                return (
                  <div key={row.label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">{row.label}</span>
                      <span className="text-white/50">
                        {Math.round((row.value ?? 0) * 10) / 10}
                        {row.unit}
                        {dv ? ` / ${dv}${row.unit}` : ""}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gym)" }} />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </GlassCard>

      {/* Micronutrients */}
      <GlassCard padding="md" className="flex flex-col gap-3">
        <button className="flex items-center justify-between cursor-pointer" onClick={() => setMicroOpen((v) => !v)}>
          <h2 className="text-sm font-semibold text-white">Micronutrientes</h2>
          {microOpen ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
        </button>
        {microOpen && (
          <div className="flex flex-col gap-4">
            {vitaminEntries.length === 0 && mineralEntries.length === 0 ? (
              <p className="text-xs text-white/40">Este alimento no tiene micronutrientes registrados.</p>
            ) : (
              <>
                {vitaminEntries.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-white/40 uppercase tracking-wide">Vitaminas</p>
                    {vitaminEntries.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-white/70">{MICRONUTRIENT_LABELS[key]?.label}</span>
                        <span className="text-white/50">
                          {value} {MICRONUTRIENT_LABELS[key]?.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {mineralEntries.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-white/40 uppercase tracking-wide">Minerales</p>
                    {mineralEntries.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-white/70">{MICRONUTRIENT_LABELS[key]?.label}</span>
                        <span className="text-white/50">
                          {value} {MICRONUTRIENT_LABELS[key]?.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </GlassCard>

      <QuantityKeypad open={keypadOpen} onClose={() => setKeypadOpen(false)} initialValue={cantidad} onChange={setCantidad} />

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto relative">
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute bottom-full mb-2 left-0 right-0 z-40 rounded-2xl bg-[#1c1c22] border border-white/[0.12] shadow-2xl overflow-hidden">
                {ADD_TARGETS.map((t) => (
                  <button
                    key={t.key}
                    className="w-full flex items-center justify-between text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                    onClick={() => handleAdd(t)}
                  >
                    {t.label}
                    {addedTarget === t.key && <Check size={14} className="text-[var(--gym)]" />}
                  </button>
                ))}
              </div>
            </>
          )}
          <GlassButton className="w-full flex items-center justify-center gap-2" size="lg" onClick={() => setAddMenuOpen((v) => !v)}>
            <Plus size={16} /> Agregar a {ADD_TARGETS[0].label} <ChevronDown size={14} />
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

function MacroCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <GlassCard padding="sm" className="flex flex-col items-center gap-0.5 text-center" accentColor={color}>
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-[10px] text-white/45">{label}</span>
    </GlassCard>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />;
}

function buildAiInsight(nutrition: { calorias: number; proteina: number; carbos: number; grasas: number; fibra?: number; sodio?: number }, categoria: string) {
  const proteinRatio = nutrition.calorias > 0 ? (nutrition.proteina * 4) / nutrition.calorias : 0;
  if (proteinRatio > 0.35) return "Buena fuente de proteína — ideal para mantener saciedad y masa muscular.";
  if ((nutrition.fibra ?? 0) > 4) return "Alto en fibra, favorece la digestión y la saciedad.";
  if ((nutrition.sodio ?? 0) > 500) return "Contenido alto de sodio — modera su consumo diario.";
  if (nutrition.carbos * 4 > nutrition.calorias * 0.6) return "Predominan los carbohidratos, buena fuente de energía rápida.";
  if (categoria === "Fruta" || categoria === "Verdura") return "Alimento natural, aporta vitaminas y bajo en calorías.";
  return "Alimento equilibrado dentro de una dieta variada.";
}
