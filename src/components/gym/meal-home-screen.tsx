"use client";

/**
 * Pantalla principal de una comida — rediseño Calorías, etapa 2 (WIP, estilo provisional: ver
 * docs del pedido "REDISEÑO CALORÍAS — ESTILO NOT BORING"). Reutiliza la mecánica de Hábitos:
 * el título de arriba es la comida actual (según la hora, `mealForTime`), se navega entre comidas
 * con el mismo carrusel de swipe/dots que usa `/habitos/habito`, y el centro es un círculo (mismo
 * `HabitOrb`) que colapsa/expande al tocarlo — sin comida: un "+"; con comida: resumen (kcal) que
 * expande a la lista de esa comida (el `MealCard` que ya existe, sin tocarlo).
 *
 * Ruta de PREVIEW (`/gym/calorias/inicio-nuevo`): no reemplaza todavía `/gym/calorias` (esa sigue
 * intacta) hasta que las etapas siguientes (detalle de alimento, buscador, menú +, ajustes) estén
 * listas y se haga un solo corte. El selector de gráfico 3D, el arco, "Terminar Día" y el resto de
 * lo que hoy vive en la pantalla principal se mueven en una etapa posterior — acá no están.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { MealCard } from "@/components/gym/meal-card";
import { useGymStore, useLoggedFoodsForDate } from "@/lib/store/gymStore";
import { activeLoggedFoods } from "@/lib/food-utils";
import { mealForTime } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { SwipeCarouselDots, SwipeCarouselStage, swipeSlide, useSwipeCarousel } from "@/components/shared/swipe-carousel";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];

// Mismo grano de fondo que Hábitos — la referencia visual (Not Boring) es la misma para las dos pantallas.
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

export function MealHomeScreen() {
  const router = useRouter();
  const loggedFoods = useLoggedFoodsForDate(new Date());
  const customFoods = useGymStore((s) => s.customFoods);
  void customFoods; // reservado para cuando el ícono use la categoría real del alimento (etapa 3)

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

  // El título sigue la hora real mientras el usuario no navegó a mano — si ya está mirando otra
  // comida, no se lo salteamos de abajo cada minuto.
  const [followClock, setFollowClock] = useState(true);
  useEffect(() => {
    if (!followClock) return;
    const id = setInterval(() => {
      const i = MEALS.indexOf(mealForTime());
      setIndex((cur) => (cur === i ? cur : i));
    }, 60_000);
    return () => clearInterval(id);
  }, [followClock]);

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <div className="flex items-center px-5 pt-[max(env(safe-area-inset-top),10px)]">
        <button
          onClick={() => router.push("/gym/calorias")}
          aria-label="Volver a Calorías"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ background: "#0d0d0d", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
      </div>

      <header className="flex items-center justify-between px-5 h-12">
        <button
          onClick={() => router.push(`/gym/calorias/buscar?meal=${meal}`)}
          aria-label="Agregar comida"
          className="w-10 h-10 flex items-center justify-center cursor-pointer"
        >
          <Plus size={30} strokeWidth={2.6} />
        </button>
        <div className="flex-1 min-w-0 relative h-6">
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
        </div>
        <div className="w-10 h-10" aria-hidden />
      </header>

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

      <main className="flex-1 min-h-0 relative touch-none">
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
                  <button
                    onClick={() => (hasFood ? setExpanded(true) : router.push(`/gym/calorias/buscar?meal=${meal}`))}
                    aria-label={hasFood ? `Ver ${MEAL_LABELS[meal]}` : `Agregar a ${MEAL_LABELS[meal]}`}
                    className="w-[68vw] max-w-[340px] aspect-square cursor-pointer"
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
                        <Plus size={64} strokeWidth={2} className="text-white/70" />
                      )}
                    </HabitOrb>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.22 }}
                  className="flex-1 min-h-0 flex flex-col gap-3 px-4 pt-2 overflow-y-auto"
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
                    date={new Date()}
                    foods={loggedFoods.filter((f) => f.meal === meal)}
                    onAdd={() => router.push(`/gym/calorias/buscar?meal=${meal}`)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SwipeCarouselStage>
      </main>
    </div>
  );
}
