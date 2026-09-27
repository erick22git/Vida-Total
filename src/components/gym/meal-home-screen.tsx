"use client";

/**
 * Pantalla principal de Calorías — rediseño "estilo Not Boring", con fotos de referencia ya
 * confirmadas por el usuario. Mecánica calcada de `/habitos/habito` (ver ese archivo): el swipe
 * HORIZONTAL cambia de comida (desayuno/almuerzo/...), el swipe VERTICAL cambia de VISTA — acá hay
 * 3, igual que en Hábitos:
 *   0 = círculo de la comida actual + franja de los últimos 7 días (sin racha: se sacó de acá).
 *   1 = detalle de nutrientes del día: número + gráfico elegido (`CalorieGaugeDisplay`, sin tarjeta,
 *       directo sobre el fondo) y, debajo, las 4 categorías de nutrientes (`NutrientCategoryTabs`,
 *       ahí viven los macros — no se repiten en ningún otro lado).
 *   2 = calendario de racha del año (`CalorieYearView`) — cada día se colorea según el largo de la
 *       racha a la que pertenece: aislado = dorado, racha de 2-6 días = rojo, racha de 7+ = verde.
 *       Es la ÚNICA pantalla de racha (no hay página aparte, sería repetir lo mismo dos veces).
 * Las vistas 1 y 2 son del DÍA (no cambian al swipear entre comidas), así que solo la vista 0 vive
 * dentro del carrusel horizontal de comidas.
 *
 * Esto ES la pantalla principal de `/gym/calorias` (reemplaza a la vieja, basada en arco+grilla de
 * comidas). El botón de arriba a la izquierda vuelve a `/gym`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { isToday, startOfDay } from "date-fns";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { MealCard } from "@/components/gym/meal-card";
import { AddFoodMenu } from "@/components/gym/add-food-menu";
import { CalorieSettingsSheet } from "@/components/gym/calorie-settings-sheet";
import { CalorieWeekStrip } from "@/components/gym/calorie-week-strip";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { NutrientDetailView } from "@/components/gym/nutrient-detail-view";
import { useGymStore, useLoggedFoodsForDate } from "@/lib/store/gymStore";
import { activeLoggedFoods, mergeFoods, nutrientTotalsForLoggedFoods } from "@/lib/food-utils";
import { computeLoggedDaysStreak, loggedDayKeys } from "@/lib/gym/streaks";
import { mealForTime } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type Food, type MealType, type TrackableNutrient } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { SwipeCarouselDots, SwipeCarouselStage, swipeSlide, useSwipeCarousel } from "@/components/shared/swipe-carousel";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];
const VIEW_COUNT = 3; // 0 = comida, 1 = nutrientes, 2 = racha (año)
const SWIPE_Y = 60;

// Cambio de vista (vertical): la nueva sube/baja desde el borde — igual que en Hábitos.
const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};

// Mismo grano de fondo que Hábitos — la referencia visual (Not Boring) es la misma para las dos pantallas.
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

export function MealHomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const viendoHoy = isToday(selectedDate);
  const todayISO = new Date().toISOString().slice(0, 10);

  const loggedFoods = useLoggedFoodsForDate(selectedDate);
  const allLoggedFoods = useGymStore((s) => s.loggedFoods);
  const customFoods = useGymStore((s) => s.customFoods);
  const loggedStreak = useMemo(() => computeLoggedDaysStreak(allLoggedFoods), [allLoggedFoods]);
  const loggedDays = useMemo(() => loggedDayKeys(allLoggedFoods), [allLoggedFoods]);

  const [index, setIndex] = useState(() => MEALS.indexOf(mealForTime()));
  const [expanded, setExpanded] = useState(false);
  const { direction, goTo, onDragEnd } = useSwipeCarousel({
    index,
    length: MEALS.length,
    onIndexChange: (next) => {
      setIndex(next);
      setExpanded(false); // cada comida arranca colapsada al llegar a ella
    },
  });

  const meal = MEALS[index];
  const foodsForMeal = useMemo(
    () => activeLoggedFoods(loggedFoods.filter((f) => f.meal === meal)),
    [loggedFoods, meal],
  );
  const hasFood = foodsForMeal.length > 0;
  const totalKcal = foodsForMeal.reduce((sum, f) => sum + f.calorias, 0);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openMealCircle = () => {
    if (hasFood) setExpanded(true);
    else if (viendoHoy) setAddMenuOpen(true);
  };

  // Totales del día para la vista de nutrientes (número, gráfico, macros, categorías).
  const totals = activeLoggedFoods(loggedFoods).reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );
  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);
  const otherNutrientTotals = useMemo(
    () => nutrientTotalsForLoggedFoods(activeLoggedFoods(loggedFoods), allFoods),
    [loggedFoods, allFoods],
  ) as Partial<Record<TrackableNutrient, number>>;

  // El título sigue la hora real mientras el usuario no navegó a mano ni cambió de día — si ya
  // está mirando otra comida o un día pasado, no se lo salteamos de abajo cada minuto.
  const [followClock, setFollowClock] = useState(true);
  useEffect(() => {
    if (!followClock || !viendoHoy) return;
    const id = setInterval(() => {
      const i = MEALS.indexOf(mealForTime());
      setIndex((cur) => (cur === i ? cur : i));
    }, 60_000);
    return () => clearInterval(id);
  }, [followClock, viendoHoy]);

  // Swipe VERTICAL = cambia de vista (comida / nutrientes / racha) — igual mecánica que
  // `/habitos/habito` (el horizontal es entre comidas, drag="x" con dragDirectionLock, así que no
  // compite con esto). Se desactiva mientras la comida está expandida (esa lista ya scrollea sola).
  const [view, setView] = useState(0);
  const [viewDir, setViewDir] = useState(1);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  function goView(next: number) {
    if (next < 0 || next >= VIEW_COUNT || next === view) return;
    setViewDir(next > view ? 1 : -1);
    setView(next);
  }
  function onStagePointerDown(e: React.PointerEvent) {
    if (view === 0 && expanded) return;
    gestureStart.current = { x: e.clientX, y: e.clientY };
  }
  function onStagePointerUp(e: React.PointerEvent) {
    const st = gestureStart.current;
    gestureStart.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dy) > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) goView(view + (dy < 0 ? 1 : -1));
  }
  function onStageWheel(e: React.WheelEvent) {
    if (view === 0 && expanded) return;
    if (wheelLock.current || Math.abs(e.deltaY) < 30) return;
    wheelLock.current = true;
    setTimeout(() => (wheelLock.current = false), 500);
    goView(view + (e.deltaY > 0 ? 1 : -1));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view === 0) {
        if (e.key === "ArrowRight") goTo(index + 1);
        if (e.key === "ArrowLeft") goTo(index - 1);
      }
      if (e.key === "ArrowDown") goView(view + 1);
      if (e.key === "ArrowUp") goView(view - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, index, view]);

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3rem+max(env(safe-area-inset-top),10px))]">
        <button
          onClick={() => router.push("/gym")}
          aria-label="Volver a Gym"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
          style={{ background: "#0d0d0d", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <div className="flex-1 min-w-0 relative h-6">
          {view === 0 && (
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.h1
                key={meal}
                custom={direction}
                variants={swipeSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute inset-0 text-center text-[15px] uppercase tracking-[0.12em] truncate px-2 leading-6"
                style={MONO_FONT}
              >
                {MEAL_LABELS[meal]}
              </motion.h1>
            </AnimatePresence>
          )}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes de calorías"
          className="w-10 h-10 flex items-center justify-center cursor-pointer shrink-0"
        >
          <SlidersHorizontal size={20} strokeWidth={2.2} className="text-white/70" />
        </button>
      </header>

      {view === 0 && (
        <SwipeCarouselDots
          length={MEALS.length}
          index={index}
          onSelect={(i) => {
            setFollowClock(false);
            goTo(i);
          }}
          getKey={(i) => MEALS[i]}
          getAriaLabel={(i) => `Ir a ${MEAL_LABELS[MEALS[i]]}`}
        />
      )}

      <main
        className="flex-1 min-h-0 relative touch-none"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        onPointerCancel={() => (gestureStart.current = null)}
        onWheel={onStageWheel}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={viewDir}>
          <motion.div
            key={view}
            custom={viewDir}
            variants={slideY}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {view === 0 && (
              <SwipeCarouselStage
                itemKey={meal}
                direction={direction}
                length={MEALS.length}
                onDragEnd={(e, info) => {
                  setFollowClock(false);
                  onDragEnd(e, info);
                }}
              >
                <div className="w-full h-full flex flex-col">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {!expanded ? (
                      <motion.div
                        key="collapsed"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.22 }}
                        className="flex-1 flex flex-col items-center justify-center gap-7 px-6"
                      >
                        {/* No es un <button> nativo: sobre un botón normal, el toque en el celular lo capta el propio
                            elemento y compite con el gesto de swipe (mismo motivo por el que HoldCircle, en Hábitos,
                            tampoco es un <button>). Se maneja el toque a mano, igual que allá. */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openMealCircle()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") openMealCircle();
                          }}
                          aria-label={
                            hasFood
                              ? `Ver ${MEAL_LABELS[meal]}`
                              : viendoHoy
                                ? `Agregar a ${MEAL_LABELS[meal]}`
                                : `Sin registro en ${MEAL_LABELS[meal]}`
                          }
                          className={`w-[68vw] max-w-[340px] aspect-square select-none ${hasFood || viendoHoy ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <HabitOrb done={hasFood} className="w-full">
                            {hasFood ? (
                              <div className="flex flex-col items-center gap-1 px-6">
                                <span className="text-4xl">🍽️</span>
                                <span className="text-2xl font-bold text-black tabular-nums">{Math.round(totalKcal)} kcal</span>
                                <span className="text-[11px] uppercase tracking-[0.12em] text-black/50" style={MONO_FONT}>
                                  {foodsForMeal.length} {foodsForMeal.length === 1 ? "alimento" : "alimentos"}
                                </span>
                              </div>
                            ) : (
                              <Plus size={64} strokeWidth={2} className={viendoHoy ? "text-white/70" : "text-white/25"} />
                            )}
                          </HabitOrb>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.22 }}
                        className="flex-1 min-h-0 flex flex-col gap-3 px-4 pt-2 overflow-y-auto"
                        style={{ touchAction: "pan-y" }}
                      >
                        <button
                          onClick={() => setExpanded(false)}
                          className="flex items-center justify-center gap-2 py-2 text-white/50 text-xs cursor-pointer"
                          style={MONO_FONT}
                        >
                          {Math.round(totalKcal)} kcal · toca para colapsar
                        </button>
                        <MealCard
                          meal={meal}
                          date={selectedDate}
                          disableAdd={!viendoHoy}
                          foods={loggedFoods.filter((f) => f.meal === meal)}
                          onAdd={() => viendoHoy && setAddMenuOpen(true)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!expanded && (
                    <div className="pb-[max(env(safe-area-inset-bottom),20px)]">
                      <CalorieWeekStrip
                        loggedDayKeys={loggedDays}
                        selectedDate={selectedDate}
                        onSelectDate={(d) => {
                          setFollowClock(false);
                          setSelectedDate(startOfDay(d));
                          setExpanded(false);
                        }}
                        todayISO={todayISO}
                        viewIndex={0}
                        viewCount={VIEW_COUNT}
                      />
                    </div>
                  )}
                </div>
              </SwipeCarouselStage>
            )}

            {view === 1 && <NutrientDetailView totals={totals} otherNutrientTotals={otherNutrientTotals} />}

            {view === 2 && (
              <CalorieYearView
                loggedDayKeys={loggedDays}
                todayISO={todayISO}
                streakCurrent={loggedStreak.current}
                viewIndex={2}
                viewCount={VIEW_COUNT}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AddFoodMenu open={addMenuOpen} onClose={() => setAddMenuOpen(false)} meal={meal} />
      <CalorieSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
