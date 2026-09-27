"use client";

/**
 * Página dedicada de racha — "la misma interfaz" que la vista 2 de la home nueva
 * (`CalorieYearView`, ver meal-home-screen.tsx), solo que acá el título de arriba dice "RACHA" en
 * vez de vivir dentro del swipe de comidas. Se llega tocando el fuego (en la franja de 7 días o en
 * la vista de racha embebida).
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CalorieYearView } from "@/components/gym/calorie-year-view";
import { useGymStore } from "@/lib/store/gymStore";
import { computeLoggedDaysStreak, loggedDayKeys, perfectDayKeys } from "@/lib/gym/streaks";
import { MONO_FONT } from "@/lib/ui/mono-font";

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

export default function RachasPage() {
  const router = useRouter();
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal);

  const loggedStreak = useMemo(() => computeLoggedDaysStreak(loggedFoods), [loggedFoods]);
  const loggedDays = useMemo(() => loggedDayKeys(loggedFoods), [loggedFoods]);
  const perfectDays = useMemo(() => perfectDayKeys(loggedFoods, calorieGoal), [loggedFoods, calorieGoal]);
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3rem+max(env(safe-area-inset-top),10px))]">
        <button
          onClick={() => router.push("/gym/calorias")}
          aria-label="Volver a Calorías"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ background: "#0d0d0d", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
          Racha
        </h1>
        <div className="w-10 h-10" aria-hidden />
      </header>

      <main className="flex-1 min-h-0 relative">
        <CalorieYearView
          loggedDayKeys={loggedDays}
          perfectDayKeys={perfectDays}
          todayISO={todayISO}
          streakCurrent={loggedStreak.current}
          viewIndex={0}
          viewCount={1}
        />
      </main>
    </div>
  );
}
