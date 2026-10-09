"use client";

/**
 * Pantalla de detalle de alimento, compartida por DOS rutas separadas con el mismo diseño pero distinto uso:
 *   - /gym/calorias/alimento/[id]  (mode="agregar": viene del buscador, botón "Agregar", menú "..." solo Verificar/Compartir)
 *   - /gym/calorias/editar/[id]    (mode="editar": viene de tocar el fondo de una comida, botón "Actualizar", menú completo,
 *     y deslizando sobre la foto/nombre se ve cada alimento de la comida; abre en el último agregado)
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
import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, MoreVertical, Share2, Sparkles, Circle, CheckCircle2, Plus, Copy, Trash2 } from "lucide-react";
import { CaloriasSkeleton } from "@/components/gym/calorias-skeleton";
import { VerifiedBadge } from "@/components/gym/verified-badge";
import { FoodPhoto } from "@/components/gym/food-photo";
import { DigitWheel } from "@/components/gym/digit-wheel";
import { CantidadCounter } from "@/components/gym/cantidad-counter";
import { GramsKeypadSheet } from "@/components/gym/grams-keypad-sheet";
import { MacroRingChart } from "@/components/gym/macro-ring-chart";
import { MealActionsMenu, MenuItem } from "@/components/gym/meal-actions-menu";
import { SwipeCarouselDots, SwipeCarouselStage, useSwipeCarousel } from "@/components/shared/swipe-carousel";
import { useGymStore } from "@/lib/store/gymStore";
import {
  BASE_FOODS,
  defaultPortions,
  parsePorcionGramos,
  scaleNutrition,
  scaleMicronutrients,
  scaleCookedNutrition,
  scaleCookedMicronutrients,
  DAILY_VALUES,
} from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MEAL_LABELS } from "@/lib/types";
import type { CookedState, Food, MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { buildInfoPages, formatInfoValue, rowsThatFit } from "@/lib/nutrition/info-pages";
import { playEvent } from "@/lib/sound/sound-manager";

const RECIPE_DRAFT_KEY = "vt-recipe-draft";

// Bloque de nutrientes con ALTURA FIJA: título + `INFO_ROWS_H` de filas. Cuántas filas entran por página se calcula de ahí
// (no está escrito a mano) y los grupos que no caben se parten en más páginas; así la configuración de abajo (anillo,
// gramos y botones) queda siempre en el mismo lugar, sin importar la página ni el contenido.
const INFO_ROW_H = 24;
// Filas de las páginas que no son "Calorías y macros": más chicas (letra y alto) para que el resto de
// la pantalla (anillo, rueda de gramos, botones) no quede cortado abajo. "Calorías y macros" (siempre
// 4 filas) se queda con INFO_ROW_H sin cambios.
const INFO_ROW_H_COMPACT = 19;
const INFO_GAP = 6;
const INFO_TITLE_H = 18;
const INFO_ROWS_H = 140;
const INFO_AREA_H = INFO_TITLE_H + INFO_GAP + INFO_ROWS_H;
const INFO_ROWS_PER_PAGE = rowsThatFit(INFO_ROWS_H, INFO_ROW_H_COMPACT, INFO_GAP);

export function FoodDetailScreen({ id, mode }: { id: string; mode: "agregar" | "editar" }) {
  return (
    <Suspense fallback={<CaloriasSkeleton />}>
      <FoodDetailContent id={id} mode={mode} />
    </Suspense>
  );
}

function FoodDetailContent({ id, mode }: { id: string; mode: "agregar" | "editar" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const isForRecipe = returnTo === "recipe";
  const entryId = mode === "editar" ? searchParams.get("entryId") : null;
  const mealParam = (searchParams.get("meal") as MealType | null) ?? "desayuno";

  const customFoods = useGymStore((s) => s.customFoods);
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const copyFoodEntry = useGymStore((s) => s.copyFoodEntry);
  const loggedFoods = useGymStore((s) => s.loggedFoods);

  // Comida vacía (se llega sin `entryId`): en cuanto Pegar/Repetir le agregan alimentos, se adopta el
  // primero como entrada actual para que la pantalla se llene al instante, sin salir y volver a entrar.
  const firstOfEmptyMeal = useMemo(
    () => (mode === "editar" && !entryId ? loggedFoods.find((f) => f.meal === mealParam && isSameDay(new Date(f.timestamp), new Date())) : undefined),
    [mode, entryId, loggedFoods, mealParam],
  );
  const existingEntry = useMemo(
    () => (entryId ? loggedFoods.find((f) => f.id === entryId) : firstOfEmptyMeal),
    [entryId, loggedFoods, firstOfEmptyMeal],
  );
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
      if (entry) window.history.replaceState(null, "", `/gym/calorias/editar/${entry.foodId}?meal=${meal}&entryId=${entry.id}`);
    },
  });

  const currentEntry = showCarousel ? mealFoods[index] : existingEntry;
  const currentFoodId = currentEntry?.foodId ?? id;
  const catalogFood = useMemo(
    () => customFoods.find((f) => f.id === currentFoodId) ?? BASE_FOODS.find((f) => f.id === currentFoodId),
    [customFoods, currentFoodId],
  );
  // Entradas de escáner IA / manuales / lista de compras tienen un `foodId` que no existe en el
  // catálogo (`scan-…`, `manual-…`, `lista-…`), o el alimento pudo borrarse después: antes caía en
  // "Vacío" sin salida. Se arma un alimento sintético con los datos que la propia entrada guardó,
  // así se puede ver, ajustar gramos, eliminar y seguir deslizando el carrusel.
  const isSynthetic = !catalogFood && !!currentEntry;
  const food = useMemo<Food | undefined>(() => {
    if (catalogFood) return catalogFood;
    if (!currentEntry) return undefined;
    const base = currentEntry.gramos ?? 100;
    return {
      id: currentEntry.foodId,
      nombre: currentEntry.nombre,
      categoria: "Otros",
      porcion: `${base} g`,
      pesoGramos: base,
      calorias: currentEntry.calorias,
      proteina: currentEntry.proteina,
      carbos: currentEntry.carbos,
      grasas: currentEntry.grasas,
      photoUrl: currentEntry.photoUrl ?? null,
      configurado: true,
    };
  }, [catalogFood, currentEntry]);

  // "Sucio" por alimento (para el botón Actualizar negro/blanco) — el store (Zustand persist)
  // hidrata de forma asíncrona, así que solo se guarda lo que el usuario TOCÓ a mano; mientras no
  // toque nada se sigue leyendo en vivo de `currentEntry` (mismo patrón "controlado con anulación"
  // de siempre, sin useEffect).
  const overrideKey = currentEntry?.id ?? "new";
  const [overrides, setOverrides] = useState<Record<string, { gramos?: number; cooked?: CookedState }>>({});
  const dirty = !!overrides[overrideKey];
  const gramos = overrides[overrideKey]?.gramos ?? currentEntry?.gramos ?? (food ? parsePorcionGramos(food) : 100);
  // Un alimento nuevo (sin entrada registrada todavía) puede definir con qué estado prefiere abrir
  // (arroz/avena/pollo/huevo suelen registrarse ya cocidos) — un `LoggedFood` ya guardado siempre
  // conserva el estado con el que se registró, eso nunca lo pisa `estadoDefault`.
  const cookedState = overrides[overrideKey]?.cooked ?? currentEntry?.cookedState ?? food?.estadoDefault ?? "crudo";
  const setGramos = (v: number) => setOverrides((o) => ({ ...o, [overrideKey]: { ...o[overrideKey], gramos: v } }));
  const setCookedState = (updater: CookedState | ((c: CookedState) => CookedState)) =>
    setOverrides((o) => ({
      ...o,
      [overrideKey]: { ...o[overrideKey], cooked: typeof updater === "function" ? updater(cookedState) : updater },
    }));

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);

  // Carrusel VERTICAL (dentro del bloque de números): calorías+macros → información nutricional →
  // micronutrientes — misma mecánica que MealHomeScreen (swipe/wheel verticales).
  const [infoView, setInfoView] = useState(0);
  const infoSwipe = useRef<{ y: number } | null>(null);
  // Guarda contra doble toque en "Agregar"/"Actualizar" (ver `handleConfirm`).
  const confirmedRef = useRef(false);

  if (!food) {
    // Editando una comida que todavía no tiene ningún alimento (se llega acá manteniendo presionado
    // el fondo vacío): sin foto ni datos — solo el "..." para poder Pegar (o Copiar todo/Repetir, etc.).
    if (mode === "editar") {
      return (
        <div
          className="fixed inset-0 z-[45] overflow-hidden text-white select-none"
          style={{ background: "var(--app-bg)" }}
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
            <MealActionsMenu meal={meal} date={mealDate} foods={mealFoods} open={optionsOpen} onOpenChange={setOptionsOpen} />
            <div className="flex flex-col items-center gap-2 pt-20">
              <span className="text-sm uppercase tracking-[0.15em] text-white/35" style={MONO_FONT}>
                Vacío
              </span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-white">
        <p className="text-white/60">Alimento no encontrado.</p>
        <Link href="/gym/calorias/buscar-nuevo" className="text-sm text-[var(--gym)]">
          Volver a la búsqueda
        </Link>
      </div>
    );
  }

  // Sin datos reales de cocido cargados para este alimento, el estado queda forzado a "crudo" — ya
  // no existe una fórmula que invente un valor cocido (antes era `gramos ÷ 0.7`).
  const hasCocido = !!food.cocido;
  const effectiveCookedState: CookedState = hasCocido ? cookedState : "crudo";
  const nutrition =
    effectiveCookedState === "cocido" ? scaleCookedNutrition(food, gramos)! : scaleNutrition(food, gramos);
  const micronutrients =
    effectiveCookedState === "cocido" ? scaleCookedMicronutrients(food, gramos) : scaleMicronutrients(food, gramos);
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

  const infoPages = buildInfoPages(nutrition, micronutrients as Record<string, number> | undefined, INFO_ROWS_PER_PAGE);
  const pageIndex = Math.min(infoView, infoPages.length - 1);
  const infoPage = infoPages[pageIndex];
  const goInfo = (next: number) => setInfoView(Math.max(0, Math.min(infoPages.length - 1, next)));

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
      cookedState: effectiveCookedState,
    };
  }

  // "Agregar"/"Actualizar" dispara la navegación de inmediato, pero el botón sigue montado (y
  // clicable) hasta que la ruta termina de cambiar — varios toques rápidos antes de eso agregaban
  // la misma entrada más de una vez; `confirmedRef` (declarado arriba, con los demás hooks) lo evita.
  function handleConfirm() {
    if (confirmedRef.current) return;
    if (food && food.configurado === false) {
      router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
      return;
    }
    confirmedRef.current = true;
    if (isEditing && currentEntry) {
      updateLoggedFood(currentEntry.id, buildPayload());
      router.push("/gym/calorias");
    } else {
      addLoggedFood(buildPayload());
      void playEvent("add-item");
      // Vuelve al buscador (no a la home) para poder seguir agregando alimentos a esta comida sin
      // tener que volver a entrar a buscar; el aviso de "agregado" lo muestra el buscador.
      router.push(`/gym/calorias/buscar-nuevo?meal=${meal}&agregado=1`);
    }
  }

  // Elimina y se queda en Editar mostrando el siguiente alimento de la cola de esta comida (no navega
  // a ningún lado): antes volvía a la home y había que volver a entrar para borrar el siguiente.
  // Solo navega si la comida se queda sin alimentos.
  function handleDelete() {
    if (!currentEntry) {
      router.push("/gym/calorias");
      return;
    }
    const deletedId = currentEntry.id;
    removeLoggedFood(deletedId);
    setConfirmDelete(false);
    const remaining = mealFoods.filter((f) => f.id !== deletedId);
    if (remaining.length === 0) {
      router.push("/gym/calorias");
      return;
    }
    const nextIndex = Math.min(index, remaining.length - 1);
    const next = remaining[nextIndex];
    setManualIndex(nextIndex);
    window.history.replaceState(null, "", `/gym/calorias/editar/${next.foodId}?meal=${meal}&entryId=${next.id}`);
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
      style={{ background: "var(--app-bg)" }}
    >
      <div className="relative z-10 flex flex-col gap-3 pb-24 px-4 pt-1 max-w-md mx-auto">
        <header className="flex items-center justify-between gap-2 pt-[max(env(safe-area-inset-top),10px)]">
          <button
            onClick={() => router.push(isEditing ? "/gym/calorias" : `/gym/calorias/buscar-nuevo?meal=${meal}`)}
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

        {/* El menú vive fuera del header (mismo motivo que en MealCard antes de sacarlo): los
            paneles de "Vaciar comida"/"Ajustar porciones"/"Guardar como plantilla" necesitan todo
            el ancho, no el hueco de 40px del botón "...". */}
        {isEditing ? (
        <MealActionsMenu
          meal={meal}
          date={mealDate}
          foods={mealFoods}
          open={optionsOpen}
          onOpenChange={setOptionsOpen}
          beforeItems={
            <>
              {!isSynthetic && (
                <MenuItem
                  icon={<Sparkles size={14} />}
                  label="Verificar"
                  onClick={() => {
                    setOptionsOpen(false);
                    router.push(`/gym/calorias/crear-alimento?editId=${food.id}`);
                  }}
                />
              )}
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
              {currentEntry && (
                <MenuItem
                  icon={<Copy size={14} />}
                  label="Copiar solo este alimento"
                  onClick={() => {
                    copyFoodEntry(currentEntry);
                    setOptionsOpen(false);
                  }}
                />
              )}
              <div className="h-px mx-3 my-1 bg-white/10" />
            </>
          }
          afterItems={
            currentEntry && (
              <>
                <div className="h-px mx-3 my-1 bg-white/10" />
                <MenuItem
                  icon={currentEntry.activo === false ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                  label={currentEntry.activo === false ? "Contar este alimento" : "No contar este alimento"}
                  onClick={() => {
                    updateLoggedFood(currentEntry.id, { activo: currentEntry.activo === false });
                    setOptionsOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Trash2 size={14} />}
                  label="Eliminar este alimento"
                  danger
                  onClick={() => {
                    setOptionsOpen(false);
                    setConfirmDelete(true);
                  }}
                />
              </>
            )
          }
        />
        ) : (
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
        )}

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
        <div className="flex flex-col gap-3">
        <SwipeCarouselStage
          itemKey={currentEntry?.id ?? currentFoodId}
          direction={direction}
          length={mealFoods.length || 1}
          onDragEnd={onDragEnd}
          className="relative w-full"
        >
            <div className="flex flex-col items-center gap-1.5 pt-7">
              <div style={{ filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.55))" }}>
                <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={150} rounded="rounded-full" emoji={categoryEmoji(food.categoria)} />
              </div>
              <span className="rounded-full border border-white/25 px-5 py-2 text-xs uppercase tracking-[0.1em] text-white/85" style={MONO_FONT}>
                {food.nombre}
              </span>
              <VerifiedBadge item={food} label />
            </div>
        </SwipeCarouselStage>

            {food.configurado === false ? (
              <p className="text-center text-sm text-amber-300/90 px-4">
                Sin configurar — este alimento todavía no tiene calorías ni macros reales cargados.
              </p>
            ) : (
              <>
                {/* Bloque de números — páginas con swipe/rueda vertical o tocando los puntos, SIN tarjeta y con
                    altura fija (ver INFO_AREA_H). `touch-action: none`: sin eso el navegador se queda con el
                    gesto vertical y dispara pointercancel, y el deslizamiento no cambia de página. */}
                <div
                  className="relative pr-6 select-none"
                  style={{ height: INFO_AREA_H, overflow: "hidden", touchAction: "none" }}
                  onWheel={(e) => {
                    if (Math.abs(e.deltaY) < 30) return;
                    goInfo(pageIndex + (e.deltaY > 0 ? 1 : -1));
                  }}
                  onPointerDown={(e) => {
                    infoSwipe.current = { y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    const st = infoSwipe.current;
                    infoSwipe.current = null;
                    if (!st) return;
                    const dy = e.clientY - st.y;
                    if (Math.abs(dy) > 36) goInfo(pageIndex + (dy < 0 ? 1 : -1));
                  }}
                  onPointerCancel={() => {
                    infoSwipe.current = null;
                  }}
                >
                  <div className="flex flex-col" style={{ gap: INFO_GAP }}>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 truncate" style={{ ...MONO_FONT, height: INFO_TITLE_H, lineHeight: `${INFO_TITLE_H}px` }}>
                      {infoPage.title}
                    </p>
                    {infoPage.rows.map((row) => (
                      <StatRow
                        key={row.key}
                        label={row.label}
                        value={formatInfoValue(row, row.dvKey ? DAILY_VALUES[row.dvKey] : undefined)}
                        big={row.big}
                        muted={row.value === undefined}
                        compact={infoPage.id !== "macros"}
                      />
                    ))}
                  </div>
                  {/* Los puntos salen de los datos (uno por página) y quedan centrados en el alto fijo. */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col shrink-0">
                    {infoPages.map((pg, i) => (
                      <button
                        key={pg.id}
                        onClick={() => goInfo(i)}
                        aria-label={pg.title}
                        className="w-3.5 flex items-center justify-center cursor-pointer"
                        style={{ height: Math.min(14, Math.floor(INFO_AREA_H / infoPages.length)) }}
                      >
                        <span className="rounded-full" style={{ width: 5, height: 5, background: i === pageIndex ? "#fff" : "rgba(255,255,255,0.3)" }} />
                      </button>
                    ))}
                  </div>
                </div>

                <MacroRingChart proteinaPct={macroPct.proteina} carbosPct={macroPct.carbos} grasasPct={macroPct.grasas} />

                <div className="flex items-center justify-center gap-5 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <DigitWheel
                      wrap
                      faces={[]}
                      onStep={(steps) => setGramos(Math.max(0, Math.round((gramos + steps * 0.1) * 10) / 10))}
                      width={25}
                      height={54}
                      pxPerStep={2}
                      label="Gramos"
                    />
                    <button
                      onClick={() => setKeypadOpen(true)}
                      className="text-xs font-semibold text-white tabular-nums cursor-pointer"
                      aria-label="Poner los gramos con el teclado"
                    >
                      {Math.round(gramos * 10) / 10} G
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    {hasCocido ? (
                      <CookedToggle
                        cocido={effectiveCookedState === "cocido"}
                        onChange={(cocido) => setCookedState(cocido ? "cocido" : "crudo")}
                      />
                    ) : (
                      // Sin datos reales de cocido para este alimento — nada que tocar (antes acá
                      // se simulaba "cocido" con una fórmula fija; ahora directamente no se ofrece).
                      <div className="w-[38px] h-[22px] rounded-full opacity-25" style={{ background: "rgba(255,255,255,0.12)" }} />
                    )}
                    <span className="text-[10px] font-normal text-white/40 uppercase tracking-wide">
                      {hasCocido ? effectiveCookedState : "crudo"}
                    </span>
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

      {keypadOpen && (
        <GramsKeypadSheet
          initial={gramos}
          portionGramos={portionGramos}
          onConfirm={(v) => {
            setGramos(v);
            setKeypadOpen(false);
          }}
          onClose={() => setKeypadOpen(false)}
        />
      )}
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
      style={{
        width: TRACK,
        height: 22,
        background: cocido
          ? "linear-gradient(rgb(58,58,58), rgb(38,38,38))"
          : "rgba(255,255,255,0.12)",
        boxShadow: cocido
          ? "inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -1px 3px rgba(0,0,0,0.6)"
          : "none",
        transition: "background 0.15s",
      }}
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

function StatRow({ label, value, big, muted, compact = false }: { label: string; value: string; big?: boolean; muted?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ height: compact ? INFO_ROW_H_COMPACT : INFO_ROW_H }}>
      <span
        className={big ? "text-[12.5px] font-bold uppercase tracking-wide text-white shrink-0" : compact ? "text-[9.5px] uppercase tracking-wide text-white/70 shrink-0" : "text-[11px] uppercase tracking-wide text-white/70 shrink-0"}
      >
        {label}
      </span>
      <span className="flex-1 h-px bg-white/15" />
      <span
        className={
          big
            ? "text-[19px] leading-6 font-bold text-white tabular-nums shrink-0"
            : muted
              ? compact
                ? "text-[10px] font-normal text-white/35 shrink-0"
                : "text-[11.5px] font-normal text-white/35 shrink-0"
              : compact
                ? "text-[11px] font-semibold text-white tabular-nums shrink-0"
                : "text-[12.5px] font-semibold text-white tabular-nums shrink-0"
        }
      >
        {value}
      </span>
    </div>
  );
}
