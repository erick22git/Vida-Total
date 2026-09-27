"use client";

/**
 * Rediseño Calorías, etapa 3 (WIP, estilo provisional): fondo oscuro (no la foto del módulo), la barra
 * de gramos reemplaza los botones "Cantidad"/"Porción" con teclado modal, "Información Nutricional" y
 * "Micronutrientes" se fusionaron en una sola tarjeta con pestañas. Ahora también sirve para EDITAR un
 * alimento ya registrado (`?entryId=`, botón "Actualizar" + eliminar) además de agregar uno nuevo — antes
 * eso vivía aparte, en el modal `FoodEntrySheet` (que sigue existiendo y se sigue usando desde MealCard;
 * no se tocó esa parte todavía, ver informe de la etapa).
 */
import { Suspense, use, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Share2, MoreVertical, Sparkles, Plus, Check, Trash2, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { FoodPhoto } from "@/components/gym/food-photo";
import { GramSlider } from "@/components/gym/gram-slider";
import { useGymStore } from "@/lib/store/gymStore";
import { BASE_FOODS, defaultPortions, parsePorcionGramos, scaleNutrition, scaleMicronutrients, MICRONUTRIENT_LABELS, DAILY_VALUES } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { useAdminMode } from "@/lib/gym/admin-mode";
import type { CookedState, MealType } from "@/lib/types";

/** Rough water-loss factor applied when a food is marked "cocido" (cooked): the
 * same displayed weight of a cooked food packs more nutrients per gram than raw,
 * so we scale the effective grams used for the nutrition lookup up by ~1/0.7.
 * Kept consistent with src/components/gym/food-entry-sheet.tsx. */
const COOKED_FACTOR = 0.7;

/** Ver recetas/crear/page.tsx: mismo key de sessionStorage usado para pasar
 * el formulario de la receta en progreso ida y vuelta a esta pantalla. */
const RECIPE_DRAFT_KEY = "vt-recipe-draft";

const ADD_TARGETS: { key: string; label: string; meal: MealType }[] = [
  { key: "desayuno", label: "Desayuno", meal: "desayuno" },
  { key: "almuerzo", label: "Almuerzo", meal: "almuerzo" },
  { key: "cena", label: "Cena", meal: "cena" },
  { key: "snack1", label: "Snack 1", meal: "snack1" },
  { key: "snack2", label: "Snack 2", meal: "snack2" },
];

const MACRO_COLORS = { proteina: "#22c55e", carbos: "#eab308", grasas: "#f97316" };

// Mismo grano de fondo oscuro que Hábitos y la nueva home de Calorías — reemplaza la foto del módulo
// (que sigue de fondo en el resto de las pantallas de Calorías todavía sin rediseñar).
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

export default function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <FoodDetailContent params={params} />
    </Suspense>
  );
}

function FoodDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Si llegamos acá desde "Agregar ingrediente" al crear una receta (ver
  // recetas/crear/page.tsx), el botón principal configura cantidad/porción
  // de este alimento para la receta en vez de registrarlo en una comida.
  const returnTo = searchParams.get("returnTo");
  const isForRecipe = returnTo === "recipe";
  // Editar un alimento YA registrado (viene de MealCard/otro flujo con ?entryId=) en vez de agregar uno nuevo.
  const entryId = searchParams.get("entryId");

  const customFoods = useGymStore((s) => s.customFoods);
  const favoriteFoodIds = useGymStore((s) => s.favoriteFoodIds);
  const toggleFavoriteFood = useGymStore((s) => s.toggleFavoriteFood);
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const [adminMode, setAdminMode] = useAdminMode();

  const existingEntry = useMemo(() => (entryId ? loggedFoods.find((f) => f.id === entryId) : undefined), [entryId, loggedFoods]);
  const isEditing = !!existingEntry;

  const food = useMemo(
    () => customFoods.find((f) => f.id === id) ?? BASE_FOODS.find((f) => f.id === id),
    [customFoods, id],
  );

  const initialTargetIdx = useMemo(() => {
    const mealParam = existingEntry?.meal ?? searchParams.get("meal");
    if (!mealParam) return 0;
    const idx = ADD_TARGETS.findIndex((t) => t.meal === mealParam);
    return idx >= 0 ? idx : 0;
  }, [searchParams, existingEntry]);

  // El store (Zustand persist) hidrata desde localStorage de forma asíncrona: en una carga directa de esta
  // URL (no navegación dentro de la app) `existingEntry` puede llegar undefined en el primer render y recién
  // aparecer un instante después. Por eso el estado solo guarda lo que el usuario TOCÓ a mano (null = nada
  // todavía) y, mientras no toque nada, se sigue leyendo en vivo de `existingEntry` — sin useEffect ni
  // sincronización: cuando el store termina de hidratar y el componente se vuelve a renderizar, el valor ya
  // sale bien solo.
  const [manualGramos, setManualGramos] = useState<number | null>(null);
  const [manualCooked, setManualCooked] = useState<CookedState | null>(null);
  const gramos = manualGramos ?? existingEntry?.gramos ?? (food ? parsePorcionGramos(food) : 100);
  const cookedState = manualCooked ?? existingEntry?.cookedState ?? "crudo";
  const setGramos = setManualGramos;
  const setCookedState = (updater: CookedState | ((c: CookedState) => CookedState)) =>
    setManualCooked(typeof updater === "function" ? updater(cookedState) : updater);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addedTarget, setAddedTarget] = useState<string | null>(null);
  const [targetIdx, setTargetIdx] = useState(initialTargetIdx);
  const [nutriTab, setNutriTab] = useState<"macros" | "micro">("macros");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const effectiveGramos = cookedState === "cocido" ? gramos / COOKED_FACTOR : gramos;
  const nutrition = scaleNutrition(food, effectiveGramos);
  const micronutrients = scaleMicronutrients(food, effectiveGramos);
  const isFavorite = favoriteFoodIds.includes(food.id);
  const portionsForRatio = defaultPortions(food);
  const approxCantidad = gramos / (portionsForRatio[0]?.gramos || 100);

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

  const vitaminEntries = Object.entries(micronutrients ?? {}).filter(([k]) => MICRONUTRIENT_LABELS[k]?.group === "vitamina");
  const mineralEntries = Object.entries(micronutrients ?? {}).filter(([k]) => MICRONUTRIENT_LABELS[k]?.group === "mineral");

  function buildPayload(target: MealType) {
    return {
      foodId: food!.id,
      nombre: food!.nombre,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
      meal: target,
      gramos: Math.round(gramos * 10) / 10,
      porcionNombre: `${Math.round(gramos * 10) / 10} g`,
      photoUrl: food!.photoUrl,
      cookedState,
    };
  }

  function handleConfirm(target: (typeof ADD_TARGETS)[number]) {
    // Bloque 10: un alimento sin datos reales cargados no puede registrarse
    // en una comida (se vería como si 0 kcal fuera un valor real) — se
    // manda directo a completarlo primero.
    if (food && food.configurado === false) {
      router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
      return;
    }
    if (isEditing && existingEntry) {
      updateLoggedFood(existingEntry.id, buildPayload(target.meal));
    } else {
      addLoggedFood(buildPayload(target.meal));
    }
    setAddedTarget(target.key);
    setAddMenuOpen(false);
    setTimeout(() => router.push("/gym/calorias"), 550);
  }

  function handleDelete() {
    if (existingEntry) removeLoggedFood(existingEntry.id);
    router.push("/gym/calorias");
  }

  function handleAddToRecipe() {
    if (!food) return;
    if (food.configurado === false) {
      router.push(`/gym/calorias/crear-alimento?editId=${food.id}&returnTo=recipe`);
      return;
    }
    try {
      const raw = sessionStorage.getItem(RECIPE_DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) : { recipeId: null, ingredientes: [] };
      draft.ingredientes = [
        ...(draft.ingredientes ?? []),
        {
          foodId: food.id,
          nombre: food.nombre,
          cantidad: Math.round(approxCantidad * 100) / 100,
          porcionNombre: `${Math.round(gramos * 10) / 10} g`,
          gramos,
          calorias: nutrition.calorias,
          proteina: nutrition.proteina,
          carbos: nutrition.carbos,
          grasas: nutrition.grasas,
        },
      ];
      sessionStorage.setItem(RECIPE_DRAFT_KEY, JSON.stringify(draft));
      router.push(draft.recipeId ? `/gym/calorias/recetas/crear?recipeId=${draft.recipeId}` : "/gym/calorias/recetas/crear");
    } catch {
      router.push("/gym/calorias/recetas/crear");
    }
  }

  return (
    <div className="relative min-h-screen text-white">
      {/* Tapa la foto de fondo del módulo (PageBackdrop, en el layout — sigue detrás en el resto de Calorías,
          todavía sin rediseñar). El contenido de acá abajo lleva z-10 explícito para quedar siempre arriba. */}
      <div className="fixed inset-0" style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }} aria-hidden />
      <div className="relative z-10 flex flex-col gap-5 pb-44 md:pb-28 px-4 pt-2 max-w-md mx-auto">
        <header className="flex items-center justify-between pt-2 gap-2">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate flex-1 text-center">{food.nombre}</h1>
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
                  <div className="absolute right-0 top-11 z-40 w-52 rounded-2xl glass-panel shadow-2xl overflow-hidden">
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
                    {adminMode && (
                      <button
                        className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.06]"
                        onClick={() => {
                          setOptionsOpen(false);
                          router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
                        }}
                      >
                        <Sparkles size={14} /> Verificación
                      </button>
                    )}
                    <button
                      className="w-full flex items-center justify-between gap-2 text-left px-4 py-3 text-sm text-white/70 hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.06]"
                      onClick={() => setAdminMode(!adminMode)}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} /> Modo admin
                      </span>
                      {adminMode && <Check size={14} className="text-[var(--gym)]" />}
                    </button>
                    {isEditing && (
                      <button
                        className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm text-red-300 hover:bg-red-500/10 cursor-pointer border-t border-white/[0.06]"
                        onClick={() => {
                          setOptionsOpen(false);
                          setConfirmDelete(true);
                        }}
                      >
                        <Trash2 size={14} /> Eliminar de la comida
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2.5">
            <span className="text-xs text-red-200">¿Eliminar este alimento de la comida?</span>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={handleDelete} className="rounded-lg px-2.5 py-1 text-xs font-medium bg-red-500 text-white cursor-pointer">
                Eliminar
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-2.5 py-1 text-xs font-medium bg-white/10 text-white cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {/* Ícono transparente (sin foto real todavía) en vez de una figura 3D — mismo lugar que el
              modelo animado de Not Boring Weather. */}
          <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={104} rounded="rounded-full" emoji={categoryEmoji(food.categoria)} />
          {food.verificado && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Check size={12} /> Verificado
            </span>
          )}
        </div>

        {food.configurado === false ? (
          <GlassCard padding="md" className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-semibold text-amber-300/90">Sin configurar</p>
            <p className="text-xs text-white/50">
              Este alimento todavía no tiene calorías ni macros reales cargados. Complétalos para poder registrarlo.
            </p>
          </GlassCard>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <MacroCard label="Kcal" value={Math.round(nutrition.calorias)} color="var(--gym)" />
              <MacroCard label="Proteínas" value={`${Math.round(nutrition.proteina)}g`} color={MACRO_COLORS.proteina} />
              <MacroCard label="Carbos" value={`${Math.round(nutrition.carbos)}g`} color={MACRO_COLORS.carbos} />
              <MacroCard label="Grasas" value={`${Math.round(nutrition.grasas)}g`} color={MACRO_COLORS.grasas} />
            </div>

            {/* Barra de gramos: reemplaza los botones "Cantidad"/"Porción" con teclado modal — todo acá,
                sin abrir nada, con decimales. Al lado, "Tipo de Peso" sigue como antes. */}
            <GlassCard padding="md" className="flex flex-col gap-3">
              <GramSlider gramos={gramos} onChange={setGramos} />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>≈ {Math.round(approxCantidad * 100) / 100} {portionsForRatio[0]?.nombre ?? "porción"}</span>
                <button
                  onClick={() => setCookedState((v) => (v === "cocido" ? "crudo" : "cocido"))}
                  className="rounded-full bg-white/[0.06] px-3 py-1 capitalize cursor-pointer text-white/70"
                >
                  {cookedState}
                </button>
              </div>
            </GlassCard>
          </>
        )}

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

        {/* Información Nutricional / Micronutrientes fusionadas en una sola tarjeta con pestañas (antes
            eran dos tarjetas separadas, cada una con su propio desplegable). */}
        <GlassCard padding="md" className="flex flex-col gap-3">
          <div className="flex rounded-full bg-white/[0.06] p-1">
            <button
              onClick={() => setNutriTab("macros")}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold cursor-pointer transition-colors ${nutriTab === "macros" ? "bg-white text-black" : "text-white/60"}`}
            >
              Información Nutricional
            </button>
            <button
              onClick={() => setNutriTab("micro")}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold cursor-pointer transition-colors ${nutriTab === "micro" ? "bg-white text-black" : "text-white/60"}`}
            >
              Micronutrientes
            </button>
          </div>

          {nutriTab === "macros" ? (
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
          ) : vitaminEntries.length === 0 && mineralEntries.length === 0 ? (
            <p className="text-xs text-white/40">Este alimento no tiene micronutrientes registrados.</p>
          ) : (
            <div className="flex flex-col gap-4">
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
            </div>
          )}
        </GlassCard>

        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,#1c1c1c_85%,transparent)] border-t border-white/[0.08] flex flex-col gap-2">
          <div className="max-w-md mx-auto w-full relative">
            {isForRecipe ? (
              <GlassButton className="w-full flex items-center justify-center gap-2" size="lg" onClick={handleAddToRecipe}>
                <Plus size={16} /> {food.configurado === false ? "Configurar alimento" : "Agregar a la receta"}
              </GlassButton>
            ) : (
              <div className="flex items-stretch gap-2">
                <GlassButton
                  className="flex-1 flex items-center justify-center gap-2"
                  size="lg"
                  onClick={() => handleConfirm(ADD_TARGETS[targetIdx])}
                >
                  <Plus size={16} />{" "}
                  {food.configurado === false
                    ? "Configurar alimento"
                    : isEditing
                      ? "Actualizar"
                      : `Agregar a ${ADD_TARGETS[targetIdx].label}`}
                </GlassButton>
                <div className="relative shrink-0">
                  {addMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
                      <div className="absolute bottom-full mb-2 right-0 z-40 w-48 rounded-2xl glass-panel shadow-2xl overflow-hidden">
                        {ADD_TARGETS.map((t, i) => (
                          <button
                            key={t.key}
                            className="w-full flex items-center justify-between text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] cursor-pointer"
                            onClick={() => {
                              setTargetIdx(i);
                              handleConfirm(t);
                            }}
                          >
                            {t.label}
                            {addedTarget === t.key && <Check size={14} className="text-[var(--gym)]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => setAddMenuOpen((v) => !v)}
                    aria-label="Elegir otra comida"
                    className="h-full w-11 flex items-center justify-center rounded-2xl bg-white/[0.06] glass-specular-ring hover:bg-white/[0.1] transition-colors cursor-pointer"
                  >
                    {ADD_TARGETS[targetIdx].label[0]}
                  </button>
                </div>
              </div>
            )}
          </div>
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
