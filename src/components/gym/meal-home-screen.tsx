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
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { AnimatePresence, motion } from "framer-motion";
import { isToday, startOfDay } from "date-fns";
import { MealHoldOrb } from "@/components/gym/meal-hold-orb";
import { CalorieSettingsSheet } from "@/components/gym/calorie-settings-sheet";
import { CalorieWeekStrip } from "@/components/gym/calorie-week-strip";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { NutrientDetailView } from "@/components/gym/nutrient-detail-view";
import { useGymStore, useLoggedFoodsForDate } from "@/lib/store/gymStore";
import { activeLoggedFoods, mergeFoods, nutrientDayReport } from "@/lib/food-utils";
import { computeLoggedDaysStreak, loggedDayKeys } from "@/lib/gym/streaks";
import { mealForTime, mealTimePassed } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type MealType, type TrackableNutrient } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { SwipeCarouselDots, SwipeCarouselStage, swipeSlide, useSwipeCarousel } from "@/components/shared/swipe-carousel";

const MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];
const VIEW_COUNT = 3; // 0 = comida, 1 = nutrientes, 2 = racha (año)
const SWIPE_Y = 60;

// Cambio de vista (vertical): la nueva sube/baja desde el borde — igual que en Hábitos.
const slideY = {
  enter: (dir: number) => ({ y: dir * 70, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -70, opacity: 0 }),
};

// Mismo grano de fondo que Hábitos — la referencia visual (Not Boring) es la misma para las dos pantallas.
export function MealHomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const viendoHoy = isToday(selectedDate);
  const todayISO = new Date().toISOString().slice(0, 10);

  const loggedFoods = useLoggedFoodsForDate(selectedDate);
  const allLoggedFoods = useGymStore((s) => s.loggedFoods);
  const customFoods = useGymStore((s) => s.customFoods);
  const loggedStreak = useMemo(() => computeLoggedDaysStreak(allLoggedFoods), [allLoggedFoods]);
  const loggedDays = useMemo(() => loggedDayKeys(allLoggedFoods), [allLoggedFoods]);

  const [view, setView] = useState(0);
  const [index, setIndex] = useState(() => MEALS.indexOf(mealForTime()));
  const { direction, goTo, onDragEnd } = useSwipeCarousel({
    index,
    length: MEALS.length,
    onIndexChange: (next) => setIndex(next),
  });

  const meal = MEALS[index];
  const foodsForMeal = useMemo(
    () => activeLoggedFoods(loggedFoods.filter((f) => f.meal === meal)),
    [loggedFoods, meal],
  );
  const hasFood = foodsForMeal.length > 0;
  const totalKcal = foodsForMeal.reduce((sum, f) => sum + f.calorias, 0);
  // Al aplicar la meta desde la calculadora se vuelve con ?ajustes=1 para ver Ajustes ya abierto.
  const [settingsOpen, setSettingsOpen] = useState(() => searchParams.get("ajustes") === "1");
  // El círculo (el "+") siempre lleva a buscar para AGREGAR más. Para EDITAR hay que mantener presionado
  // 2 s el fondo negro de atrás: ahí se abre la pantalla de edición (misma interfaz que la de agregar,
  // pero es otra página), empezando por el ÚLTIMO alimento agregado — deslizando sobre su foto/nombre se
  // ven los demás. Si la comida todavía no tiene nada, igual se abre (vacía, sin foto) para poder pegar
  // desde el "..." (ver `food-detail-screen.tsx`).
  // Precalienta la ruta del "+" (en producción Next la deja lista; en desarrollo no hace nada).
  useEffect(() => {
    if (viendoHoy) router.prefetch(`/gym/calorias/buscar-nuevo?meal=${meal}`);
  }, [router, viendoHoy, meal]);
  const openSearch = () => {
    if (viendoHoy) router.push(`/gym/calorias/buscar-nuevo?meal=${meal}`);
  };
  const openEdit = () => {
    if (!hasFood) {
      router.push(`/gym/calorias/editar/vacio?meal=${meal}`);
      return;
    }
    const last = foodsForMeal[foodsForMeal.length - 1];
    router.push(`/gym/calorias/editar/${last.foodId}?meal=${meal}&entryId=${last.id}`);
  };

  // Mantener presionado el fondo (2 s) abre editar — no es un simple toque, para no chocar con el
  // gesto de swipe horizontal (cambiar de comida) ni con el círculo del "+" (que corta la propagación).
  const bgHold = useRef<{ timer: ReturnType<typeof setTimeout> | null; start: { x: number; y: number } | null; moved: boolean }>({
    timer: null,
    start: null,
    moved: false,
  });
  function cancelBgHold() {
    if (bgHold.current.timer) clearTimeout(bgHold.current.timer);
    bgHold.current.timer = null;
    bgHold.current.start = null;
  }
  function onBgPointerDown(e: React.PointerEvent) {
    cancelBgHold();
    bgHold.current.start = { x: e.clientX, y: e.clientY };
    bgHold.current.moved = false;
    bgHold.current.timer = setTimeout(() => {
      bgHold.current.timer = null;
      openEdit();
    }, 2000);
  }
  function onBgPointerMove(e: React.PointerEvent) {
    const st = bgHold.current.start;
    if (!st || bgHold.current.moved) return;
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) {
      bgHold.current.moved = true;
      cancelBgHold();
    }
  }

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
  // Los nutrientes "otros" solo se ven en la vista 1: no se calculan hasta que el usuario llega ahí.
  const dayReport = useMemo(
    () => (view === 1 ? nutrientDayReport(activeLoggedFoods(loggedFoods), mergeFoods(customFoods)) : null),
    [view, loggedFoods, customFoods],
  );
  const otherNutrientTotals = (dayReport?.totals ?? {}) as Partial<Record<TrackableNutrient, number>>;

  // El título sigue la hora real mientras el usuario no navegó a mano ni cambió de día — si ya
  // está mirando otra comida o un día pasado, no se lo salteamos de abajo cada minuto.
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
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
  const [viewDir, setViewDir] = useState(1);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  // Al terminar de agregar un alimento se vuelve con ?justAdded=<comida>: se abre en esa comida (vista 0,
  // sin tocar `view`) y se dispara sola la revelación de kcal del círculo — como si se hubiera mantenido
  // presionado — por un par de segundos, y después vuelve al "+" solo.
  const [autoRevealMeal, setAutoRevealMeal] = useState<{ meal: MealType; nonce: number } | null>(null);
  useEffect(() => {
    const justAdded = searchParams.get("justAdded") as MealType | null;
    if (!justAdded || !MEALS.includes(justAdded)) return;
    const id = setTimeout(() => {
      setIndex(MEALS.indexOf(justAdded));
      setFollowClock(false);
      setAutoRevealMeal({ meal: justAdded, nonce: Date.now() });
      router.replace("/gym/calorias");
    }, 0);
    return () => clearTimeout(id);
    // Solo al montar (leer el param una vez, ya lo limpiamos de la URL después).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goView(next: number) {
    if (next < 0 || next >= VIEW_COUNT || next === view) return;
    setViewDir(next > view ? 1 : -1);
    setView(next);
  }
  function onStagePointerDown(e: React.PointerEvent) {
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
      style={{ background: "var(--app-bg)" }}
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
          <SettingsGlyph />
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
                  <div
                    className="flex-1 flex flex-col items-center justify-center gap-7 px-6 cursor-pointer"
                    onPointerDown={onBgPointerDown}
                    onPointerMove={onBgPointerMove}
                    onPointerUp={cancelBgHold}
                    onPointerCancel={cancelBgHold}
                    onPointerLeave={cancelBgHold}
                  >
                    <MealHoldOrb
                      passed={mealTimePassed(meal, selectedDate)}
                      canAdd={viendoHoy}
                      kcal={totalKcal}
                      foodCount={foodsForMeal.length}
                      label={MEAL_LABELS[meal]}
                      onTap={openSearch}
                      autoReveal={autoRevealMeal?.meal === meal ? autoRevealMeal.nonce : undefined}
                    />
                  </div>

                  <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px]">
                      <CalorieWeekStrip
                        loggedDayKeys={loggedDays}
                        selectedDate={selectedDate}
                        onSelectDate={(d) => {
                          setFollowClock(false);
                          setSelectedDate(startOfDay(d));
                        }}
                        todayISO={todayISO}
                        viewIndex={0}
                        viewCount={VIEW_COUNT}
                      />
                  </div>
                </div>
              </SwipeCarouselStage>
            )}

            {view === 1 && <NutrientDetailView totals={totals} otherNutrientTotals={otherNutrientTotals} coverage={dayReport?.coverage} />}

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

      <CalorieSettingsSheet
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          if (searchParams.get("ajustes") === "1") router.replace("/gym/calorias");
        }}
      />
    </div>
  );
}
