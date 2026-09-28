"use client";

/**
 * Rediseño de detalle de alimento (fotos de referencia del usuario): sin tarjetas — ícono/nombre,
 * kcal+macros, anillo de distribución y las dos ruedas (gramos / cantidad) van directo sobre el
 * fondo oscuro. Dos carruseles nuevos, con la misma mecánica que ya usa el resto del rediseño:
 *   - HORIZONTAL (los puntos de arriba, bajo el título): un alimento de la comida a la vez — cada
 *     alimento YA registrado en esta comida (mismo día) es una "página"; deslizar cambia de uno a
 *     otro. Solo aplica editando (`entryId`); agregando uno nuevo desde el buscador no hay carrusel.
 *   - VERTICAL (dentro del bloque de números, con sus propios 3 puntos): kcal+macros → información
 *     nutricional → micronutrientes.
 * El botón "Actualizar" (editando) empieza negro/apagado y se pone blanco recién cuando se tocó algo
 * (gramos, cocido/crudo, cantidad) — agregando uno nuevo (desde el buscador) dice "Agregar" y va
 * blanco directo, sin ese estado "sin cambios".
 */
import { Suspense, use, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, MoreVertical, Share2, Sparkles, Check, Plus } from "lucide-react";
import { FoodPhoto } from "@/components/gym/food-photo";
import { DigitWheel } from "@/components/gym/digit-wheel";
import { CantidadCounter } from "@/components/gym/cantidad-counter";
import { MacroRingChart } from "@/components/gym/macro-ring-chart";
import { MenuItem } from "@/components/gym/meal-actions-menu";
import { SwipeCarouselDots, SwipeCarouselStage, useSwipeCarousel } from "@/components/shared/swipe-carousel";
import { useGymStore } from "@/lib/store/gymStore";
import {
  BASE_FOODS,
  defaultPortions,
  parsePorcionGramos,
  scaleNutrition,
  scaleMicronutrients,
  MICRONUTRIENT_LABELS,
  DAILY_VALUES,
} from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MEAL_LABELS } from "@/lib/types";
import type { CookedState, MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";

/** Mismo factor que food-entry-sheet.tsx: un alimento "cocido" concentra más nutrientes por gramo. */
const COOKED_FACTOR = 0.7;

const RECIPE_DRAFT_KEY = "vt-recipe-draft";

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

const INFO_VIEW_COUNT = 3;

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
  const returnTo = searchParams.get("returnTo");
  const isForRecipe = returnTo === "recipe";
  const entryId = searchParams.get("entryId");
  const mealParam = (searchParams.get("meal") as MealType | null) ?? "desayuno";

  const customFoods = useGymStore((s) => s.customFoods);
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const loggedFoods = useGymStore((s) => s.loggedFoods);

  const existingEntry = useMemo(() => (entryId ? loggedFoods.find((f) => f.id === entryId) : undefined), [entryId, loggedFoods]);
  const isEditing = !!existingEntry;
  const mealDate = useMemo(
    () => (existingEntry ? startOfDay(new Date(existingEntry.timestamp)) : startOfDay(new Date())),
    [existingEntry],
  );
  const meal = existingEntry?.meal ?? mealParam;

  // Carrusel HORIZONTAL: un alimento de esta comida (mismo día) a la vez — solo cuando se está
  // editando uno ya registrado (agregando uno nuevo desde el buscador no hay "otros" con quién armar
  // el carrusel todavía).
  const mealFoods = useMemo(
    () => loggedFoods.filter((f) => f.meal === meal && isSameDay(new Date(f.timestamp), mealDate)),
    [loggedFoods, meal, mealDate],
  );
  const showCarousel = isEditing && mealFoods.length > 0;
  const derivedIndex = Math.max(0, mealFoods.findIndex((f) => f.id === entryId));
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const index = manualIndex ?? derivedIndex;
  const { direction, goTo, onDragEnd } = useSwipeCarousel({
    index,
    length: mealFoods.length,
    onIndexChange: (next) => {
      setManualIndex(next);
      const entry = mealFoods[next];
      if (entry) window.history.replaceState(null, "", `/gym/calorias/alimento/${entry.foodId}?meal=${meal}&entryId=${entry.id}`);
    },
  });

  const currentEntry = showCarousel ? mealFoods[index] : existingEntry;
  const currentFoodId = currentEntry?.foodId ?? id;
  const food = useMemo(
    () => customFoods.find((f) => f.id === currentFoodId) ?? BASE_FOODS.find((f) => f.id === currentFoodId),
    [customFoods, currentFoodId],
  );

  // "Sucio" por alimento (para el botón Actualizar negro/blanco) — el store (Zustand persist)
  // hidrata de forma asíncrona, así que solo se guarda lo que el usuario TOCÓ a mano; mientras no
  // toque nada se sigue leyendo en vivo de `currentEntry` (mismo patrón "controlado con anulación"
  // de siempre, sin useEffect).
  const overrideKey = currentEntry?.id ?? "new";
  const [overrides, setOverrides] = useState<Record<string, { gramos?: number; cooked?: CookedState }>>({});
  const dirty = !!overrides[overrideKey];
  const gramos = overrides[overrideKey]?.gramos ?? currentEntry?.gramos ?? (food ? parsePorcionGramos(food) : 100);
  const cookedState = overrides[overrideKey]?.cooked ?? currentEntry?.cookedState ?? "crudo";
  const setGramos = (v: number) => setOverrides((o) => ({ ...o, [overrideKey]: { ...o[overrideKey], gramos: v } }));
  const setCookedState = (updater: CookedState | ((c: CookedState) => CookedState)) =>
    setOverrides((o) => ({
      ...o,
      [overrideKey]: { ...o[overrideKey], cooked: typeof updater === "function" ? updater(cookedState) : updater },
    }));

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Carrusel VERTICAL (dentro del bloque de números): calorías+macros → información nutricional →
  // micronutrientes — misma mecánica que MealHomeScreen (swipe/wheel verticales).
  const [infoView, setInfoView] = useState(0);

  if (!food) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-white">
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
  const portionsForRatio = defaultPortions(food);
  const portionGramos = portionsForRatio[0]?.gramos || 100;
  const approxCantidad = gramos / portionGramos;

  const macroKcal = { proteina: nutrition.proteina * 4, carbos: nutrition.carbos * 4, grasas: nutrition.grasas * 9 };
  const totalMacroKcal = macroKcal.proteina + macroKcal.carbos + macroKcal.grasas || 1;
  const macroPct = {
    proteina: (macroKcal.proteina / totalMacroKcal) * 100,
    carbos: (macroKcal.carbos / totalMacroKcal) * 100,
    grasas: (macroKcal.grasas / totalMacroKcal) * 100,
  };

  const nutritionRows: { label: string; value: number | undefined; unit: string; dvKey: string }[] = [
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

  function buildPayload() {
    return {
      foodId: food!.id,
      nombre: food!.nombre,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
      meal,
      gramos: Math.round(gramos * 10) / 10,
      porcionNombre: `${Math.round(gramos * 10) / 10} g`,
      photoUrl: food!.photoUrl,
      cookedState,
    };
  }

  function handleConfirm() {
    if (food && food.configurado === false) {
      router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
      return;
    }
    if (isEditing && currentEntry) {
      updateLoggedFood(currentEntry.id, buildPayload());
    } else {
      addLoggedFood(buildPayload());
    }
    router.push("/gym/calorias");
  }

  function handleDelete() {
    if (currentEntry) removeLoggedFood(currentEntry.id);
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
    <div
      className="fixed inset-0 z-[45] overflow-hidden text-white select-none"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <div className="relative z-10 flex flex-col gap-3 pb-24 px-4 pt-1 max-w-md mx-auto">
        <header className="flex items-center justify-between gap-2 pt-[max(env(safe-area-inset-top),10px)]">
          <button
            onClick={() => router.push("/gym/calorias")}
            aria-label="Volver"
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
            style={{ background: "#0d0d0d" }}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <h1 className="text-[15px] uppercase tracking-[0.12em] truncate" style={MONO_FONT}>
            {MEAL_LABELS[meal]}
          </h1>
          <button
            onClick={() => setOptionsOpen((v) => !v)}
            aria-label="Más opciones"
            className="w-10 h-10 flex items-center justify-center cursor-pointer shrink-0"
          >
            <MoreVertical size={20} className="text-white/70" />
          </button>
        </header>

        {/* Por ahora, el "..." solo tiene Verificar y Compartir — el usuario pidió explícitamente
            dejar el resto (Copiar/Pegar/Repetir/Vaciar/Ajustar porciones/Guardar como receta, el
            check de "contar este alimento", Modo admin, Eliminar) afuera del menú por el momento,
            SIN borrar el código: sigue en `MealActionsMenu`/este mismo archivo, listo para volver a
            engancharse apenas lo pida. Por eso el menú vive fuera del header: si en el futuro se
            reactivan los paneles de Vaciar/Ajustar/Plantilla, necesitan todo el ancho. */}
        <div className="relative">
          {optionsOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOptionsOpen(false)} />
              <div className="absolute right-4 top-1 z-40 w-48 rounded-2xl glass-panel shadow-2xl overflow-hidden py-1">
                <MenuItem
                  icon={<Sparkles size={14} />}
                  label="Verificar"
                  onClick={() => {
                    setOptionsOpen(false);
                    router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
                  }}
                />
                <MenuItem
                  icon={<Share2 size={14} />}
                  label="Compartir"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      navigator.share({ title: food.nombre, text: `${food.nombre} — ${Math.round(nutrition.calorias)} kcal` }).catch(() => {});
                    }
                    setOptionsOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </div>

        {showCarousel && (
          <SwipeCarouselDots
            length={mealFoods.length}
            index={index}
            onSelect={goTo}
            getKey={(i) => mealFoods[i].id}
            getAriaLabel={(i) => `Ver ${mealFoods[i].nombre}`}
          />
        )}

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

        {/* className explícito (no el default "absolute inset-0"): sin esto, el carrusel se estira
            por TODO el contenedor relativo de arriba —el mismo que envuelve el header— y su capa
            arrastrable queda tapando el botón de volver y el de "..." (no respondían al toque). */}
        <SwipeCarouselStage
          itemKey={currentEntry?.id ?? currentFoodId}
          direction={direction}
          length={mealFoods.length || 1}
          onDragEnd={onDragEnd}
          className="relative w-full"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-1.5 pt-7">
              <div style={{ filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.55))" }}>
                <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={150} rounded="rounded-full" emoji={categoryEmoji(food.categoria)} />
              </div>
              <span className="rounded-full border border-white/25 px-5 py-2 text-xs uppercase tracking-[0.1em] text-white/85" style={MONO_FONT}>
                {food.nombre}
              </span>
              {food.verificado && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <Check size={12} /> Verificado
                </span>
              )}
            </div>

            {food.configurado === false ? (
              <p className="text-center text-sm text-amber-300/90 px-4">
                Sin configurar — este alimento todavía no tiene calorías ni macros reales cargados.
              </p>
            ) : (
              <>
                {/* Bloque de números — 3 vistas con swipe/scroll vertical, sin tarjeta. */}
                <div
                  className="flex flex-col gap-3"
                  onWheel={(e) => {
                    if (Math.abs(e.deltaY) < 30) return;
                    setInfoView((v) => Math.max(0, Math.min(INFO_VIEW_COUNT - 1, v + (e.deltaY > 0 ? 1 : -1))));
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex flex-col gap-3">
                      {infoView === 0 && (
                        <>
                          <StatRow label="Kcal" value={`${Math.round(nutrition.calorias)}`} big />
                          <StatRow label="Proteínas" value={`${Math.round(nutrition.proteina)} g`} />
                          <StatRow label="Carbohidratos" value={`${Math.round(nutrition.carbos)} g`} />
                          <StatRow label="Grasas" value={`${Math.round(nutrition.grasas)} g`} />
                        </>
                      )}
                      {infoView === 1 &&
                        nutritionRows
                          .filter((r) => r.value !== undefined)
                          .map((row) => {
                            const dv = DAILY_VALUES[row.dvKey];
                            return (
                              <StatRow
                                key={row.label}
                                label={row.label}
                                value={`${Math.round((row.value ?? 0) * 10) / 10}${row.unit}${dv ? ` / ${dv}${row.unit}` : ""}`}
                              />
                            );
                          })}
                      {infoView === 2 &&
                        (vitaminEntries.length === 0 && mineralEntries.length === 0 ? (
                          <p className="text-xs text-white/40">Sin micronutrientes registrados.</p>
                        ) : (
                          <>
                            {vitaminEntries.map(([key, value]) => (
                              <StatRow key={key} label={MICRONUTRIENT_LABELS[key]?.label} value={`${value} ${MICRONUTRIENT_LABELS[key]?.unit}`} />
                            ))}
                            {mineralEntries.map(([key, value]) => (
                              <StatRow key={key} label={MICRONUTRIENT_LABELS[key]?.label} value={`${value} ${MICRONUTRIENT_LABELS[key]?.unit}`} />
                            ))}
                          </>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {Array.from({ length: INFO_VIEW_COUNT }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setInfoView(i)}
                          aria-label={["Calorías y macros", "Información nutricional", "Micronutrientes"][i]}
                          className="w-4 h-4 flex items-center justify-center cursor-pointer"
                        >
                          <span
                            className="rounded-full"
                            style={{ width: 6, height: 6, background: i === infoView ? "#fff" : "rgba(255,255,255,0.3)" }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <MacroRingChart proteinaPct={macroPct.proteina} carbosPct={macroPct.carbos} grasasPct={macroPct.grasas} />

                <div className="flex items-center justify-center gap-5 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <DigitWheel
                      wrap
                      faces={[]}
                      onStep={(steps) => setGramos(Math.max(0, gramos + steps * 5))}
                      width={25}
                      height={54}
                      pxPerStep={10}
                      label="Gramos"
                    />
                    <span className="text-xs font-semibold text-white tabular-nums">{Math.round(gramos * 10) / 10} G</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <CookedToggle
                      cocido={cookedState === "cocido"}
                      onChange={(cocido) => setCookedState(cocido ? "cocido" : "crudo")}
                    />
                    <span className="text-[10px] font-normal text-white/40 uppercase tracking-wide">{cookedState}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <CantidadCounter
                      value={Math.max(0, Math.min(9, Math.round(approxCantidad)))}
                      onChange={(v) => setGramos(Math.max(0, v) * portionGramos)}
                    />
                    <span className="text-[10px] font-normal text-white/40 uppercase">Cantidad</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </SwipeCarouselStage>

        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,#1c1c1c_85%,transparent)] border-t border-white/[0.08]">
          <div className="max-w-md mx-auto w-full">
            {isForRecipe ? (
              <button
                onClick={handleAddToRecipe}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black"
              >
                <Plus size={16} /> {food.configurado === false ? "Configurar alimento" : "Agregar a la receta"}
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer transition-colors"
                style={
                  food.configurado === false || !isEditing || dirty
                    ? { background: "white", color: "black" }
                    : { background: "#0d0d0d", color: "rgba(255,255,255,0.4)" }
                }
              >
                {food.configurado === false ? "Configurar alimento" : isEditing ? "Actualizar" : "Agregar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Interruptor crudo/cocido — se puede tocar (invierte) o arrastrar el círculo de un lado al otro
 * (referencia visual del usuario: no es un botón de texto, es un switch de verdad). */
function CookedToggle({ cocido, onChange }: { cocido: boolean; onChange: (cocido: boolean) => void }) {
  // Todo el gesto (tocar Y arrastrar) se resuelve acá, en los eventos de puntero — sin onClick
  // aparte, para no terminar invirtiendo el valor dos veces (uno por el arrastre, otro por el click
  // que el navegador dispara igual al soltar).
  const dragRef = useRef<{ startX: number } | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const TRACK = 38;
  const KNOB = 17;
  const MAX_X = TRACK - KNOB - 4;

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX };
    setDragX(cocido ? MAX_X : 2);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const base = cocido ? MAX_X : 2;
    setDragX(Math.max(2, Math.min(MAX_X, base + delta)));
  }
  function onPointerUp() {
    if (dragRef.current) {
      const base = cocido ? MAX_X : 2;
      // Un toque simple (o un temblor mínimo del dedo, normal al tocar una pantalla) invierte el
      // estado. Solo cuenta como arrastre "de verdad" cuando recorrió más de la mitad de la pista —
      // antes el umbral era de apenas 4px, que un toque normal ya supera por vibración/temblor,
      // así que a veces NO invertía (quedaba "a mitad de camino" y el color no cambiaba).
      const traveled = dragX !== null ? Math.abs(dragX - base) : 0;
      const draggedFarEnough = traveled > MAX_X * 0.55;
      onChange(draggedFarEnough ? (dragX ?? 0) > MAX_X / 2 : !cocido);
    }
    dragRef.current = null;
    setDragX(null);
  }

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragX(null);
      }}
      aria-label={cocido ? "Cambiar a crudo" : "Cambiar a cocido"}
      role="switch"
      aria-checked={cocido}
      className="relative rounded-full cursor-pointer touch-none shrink-0"
      style={{ width: TRACK, height: 22, background: cocido ? "#6b6b6b" : "rgba(255,255,255,0.12)", transition: "background 0.15s" }}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white"
        style={{
          width: KNOB,
          height: KNOB,
          left: dragX ?? (cocido ? MAX_X : 2),
          transition: dragX === null ? "left 0.15s" : "none",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

function StatRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={big ? "text-[12.5px] font-bold uppercase tracking-wide text-white shrink-0" : "text-[11px] uppercase tracking-wide text-white/70 shrink-0"}
      >
        {label}
      </span>
      <span className="flex-1 h-px bg-white/15" />
      <span className={big ? "text-lg font-bold text-white tabular-nums shrink-0" : "text-[12.5px] font-semibold text-white tabular-nums shrink-0"}>
        {value}
      </span>
    </div>
  );
}
