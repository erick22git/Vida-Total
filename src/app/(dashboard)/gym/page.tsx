"use client";

import Link from "next/link";
import { Flame, Droplets, Dumbbell, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { CalorieArcMini } from "@/components/gym/calorie-arc-visual";
import { WeeklyWaterCard } from "@/components/gym/weekly-water-card";
import { WeeklyTrainingRow } from "@/components/gym/weekly-training-row";
import {
  useGymStore,
  useTodayLoggedFoods,
  useTodayWaterEntries,
} from "@/lib/store/gymStore";
import { computeWorkoutStreak, dayHasWorkout } from "@/lib/gym/training-streaks";
import { activeLoggedFoods } from "@/lib/food-utils";

export default function GymHubPage() {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const waterEntries = useGymStore((s) => s.waterEntries);
  const sessions = useGymStore((s) => s.sessions);
  const kegelStreak = useGymStore((s) => s.kegelStreak);
  const kegelLevel = useGymStore((s) => s.kegelLevel);
  const todayFoods = useTodayLoggedFoods();
  const todayWater = useTodayWaterEntries();

  const todayTotals = activeLoggedFoods(todayFoods).reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  const waterToday = todayWater.reduce((sum, w) => sum + w.ml, 0);
  const waterPct = waterGoalMl > 0 ? Math.round((waterToday / waterGoalMl) * 100) : 0;

  const streak = computeWorkoutStreak(sessions);
  const trainedToday = dayHasWorkout(sessions, new Date());

  return (
    <div className="flex flex-col gap-6">
      <PageBackdrop
        src="/backgrounds/gym.webp"
        positionClass="object-[75%_center] md:object-[65%_center] lg:object-[50%_center]"
      />

      {/* `relative`: sin position, estos hijos se pintan debajo del
      PageBackdrop (fixed) sin importar el orden en el DOM. */}
      <div className="relative flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Dumbbell className="text-white" /> Gym
        </h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calorías */}
        <Link href="/gym/calorias">
          <GlassCard
            padding="sm"
            glow
            accentColor="var(--gym)"
            className="flex flex-col gap-2 h-full justify-center"
            style={{ background: "var(--glass-bg-dark)" }}
          >
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-white" />
              <p className="text-sm text-white/55">Calorías</p>
            </div>
            <CalorieArcMini
              totals={todayTotals}
              calorieGoal={calorieGoal}
              proteinGoal={proteinGoal}
              carbsGoal={carbsGoal}
              fatGoal={fatGoal}
            />
          </GlassCard>
        </Link>

        {/* Agua */}
        <Link href="/gym/agua">
          <GlassCard
            padding="sm"
            glow
            accentColor="rgba(255,255,255,0.6)"
            className="flex flex-col gap-2 h-full justify-center"
            style={{ background: "var(--glass-bg-dark)" }}
          >
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-white" />
              <p className="text-sm text-white/55">Agua</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold text-white tabular-nums">{waterPct}%</span>
              <span className="text-xs text-white/45 tabular-nums">
                {(waterToday / 1000).toFixed(1)} l de {(waterGoalMl / 1000).toFixed(1)} l
              </span>
            </div>
            <WeeklyWaterCard waterEntries={waterEntries} waterGoalMl={waterGoalMl} compact />
          </GlassCard>
        </Link>

        {/* Entrenamiento */}
        <Link href="/gym/entrenamiento">
          <GlassCard
            padding="md"
            glow
            accentColor="var(--gym-2)"
            className="flex flex-col gap-3 h-full"
            style={{ background: "var(--glass-bg-dark)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-extrabold text-white tabular-nums">
                  {streak.current} {streak.current === 1 ? "DÍA" : "DÍAS"}
                </span>
                <span className="text-xs font-semibold text-white">
                  {trainedToday ? "Entrenaste hoy" : "Entrena hoy"}
                </span>
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                style={{
                  background: trainedToday
                    ? "radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)"
                    : "transparent",
                }}
              >
                <Flame
                  size={28}
                  style={{ color: "white" }}
                  fill={trainedToday ? "white" : "none"}
                  fillOpacity={trainedToday ? 0.25 : 0}
                />
              </div>
            </div>
            <WeeklyTrainingRow sessions={sessions} />
          </GlassCard>
        </Link>

        {/* Kegel */}
        <Link href="/gym/kegel">
          <GlassCard
            padding="md"
            glow
            accentColor="var(--paz-mental)"
            className="flex flex-col gap-3 h-full"
            style={{ background: "var(--glass-bg-dark)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-white" />
              <p className="text-sm text-white/55">Kegel</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-lg md:text-xl font-semibold text-white">
                Racha: {kegelStreak} días · Nivel {kegelLevel}
              </p>
            </div>
            <ProgressBar value={kegelLevel} max={10} color="rgba(255,255,255,0.85)" />
          </GlassCard>
        </Link>
      </section>
      </div>
    </div>
  );
}
