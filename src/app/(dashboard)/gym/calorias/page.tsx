"use client";

import { useMemo, useState } from "react";
import { Flame, ArrowLeft, ChevronDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalorieArcCard } from "@/components/gym/calorie-arc-card";
import { OtherNutrientsCard } from "@/components/gym/other-nutrients-card";
import { MealCard } from "@/components/gym/meal-card";
import { useGymStore, useTodayLoggedFoods } from "@/lib/store/gymStore";
import { BASE_FOODS, nutrientTotalsForLoggedFoods } from "@/lib/food-utils";
import { computeLoggedDaysStreak, dayHasLoggedFood } from "@/lib/gym/streaks";
import type { Food, MealType } from "@/lib/types";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];

export default function CaloriasPage() {
  const router = useRouter();
  const todayFoods = useTodayLoggedFoods();
  const customFoods = useGymStore((s) => s.customFoods);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const dashboardPrefs = useGymStore((s) => s.dashboardPrefs);
  const [page, setPage] = useState(0);

  const loggedStreak = useMemo(() => computeLoggedDaysStreak(loggedFoods), [loggedFoods]);

  const weekDays = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      hasEntry: dayHasLoggedFood(loggedFoods, date),
    }));
  }, [loggedFoods]);

  const totals = todayFoods.reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  const allFoods = useMemo<Food[]>(() => [...customFoods, ...BASE_FOODS], [customFoods]);
  const otherNutrientTotals = useMemo(
    () => nutrientTotalsForLoggedFoods(todayFoods, allFoods),
    [todayFoods, allFoods],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Flame style={{ color: "var(--gym)" }} /> Calorías
        </h1>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/gym/calorias/rachas")}
            className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            Hoy
            <ChevronDown size={16} className="text-white/50" />
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/gym/calorias/progreso")}
              className="flex items-center gap-1.5 cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] transition-colors rounded-full px-3 py-1.5"
              aria-label="Ver progreso"
            >
              <TrendingUp size={14} className="text-white/70" />
              <span className="text-xs font-semibold text-white/80">Progreso</span>
            </button>
            <button
              onClick={() => router.push("/gym/calorias/rachas")}
              className="flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0"
              aria-label="Ver racha"
            >
              <Flame size={18} style={{ color: "var(--gym)" }} fill="var(--gym)" fillOpacity={0.3} />
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--gym)" }}>
                {loggedStreak.current}
              </span>
            </button>
          </div>
        </div>

        {dashboardPrefs.showWeekStrip && (
        <div className="flex justify-between gap-1">
          {weekDays.map((day, i) => {
            const today = isToday(day.date);
            return (
              <button
                key={i}
                onClick={() => router.push("/gym/calorias/rachas")}
                className="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-xl cursor-pointer transition-colors"
                style={{ background: today ? "color-mix(in srgb, var(--gym) 18%, transparent)" : "transparent" }}
              >
                <span className="text-[10px] uppercase text-white/40 font-medium">
                  {format(day.date, "eeeeee", { locale: es })}
                </span>
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold tabular-nums"
                  style={{
                    background: today ? "var(--gym)" : "transparent",
                    color: today ? "white" : "rgba(255,255,255,0.75)",
                  }}
                >
                  {format(day.date, "d")}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: day.hasEntry ? "var(--gym)" : "rgba(255,255,255,0.15)" }}
                />
              </button>
            );
          })}
        </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {dashboardPrefs.showOtherNutrients ? (
          <>
            <div
              className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-1 px-1 no-scrollbar"
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                if (idx !== page) setPage(idx);
              }}
            >
              <div className="w-full shrink-0 snap-center">
                <CalorieArcCard totals={totals} />
              </div>
              <div className="w-full shrink-0 snap-center">
                <OtherNutrientsCard totals={otherNutrientTotals as Record<string, number>} />
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: page === i ? 16 : 6,
                    background: page === i ? "var(--gym)" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <CalorieArcCard totals={totals} />
        )}
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MEALS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            foods={todayFoods.filter((f) => f.meal === meal)}
            onAdd={() => router.push(`/gym/calorias/buscar?meal=${meal}`)}
          />
        ))}
      </section>
    </div>
  );
}
