"use client";

import Link from "next/link";
import { Flame, Droplets, Dumbbell, Sparkles, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import {
  useGymStore,
  useTodayLoggedFoods,
  useTodayWaterEntries,
} from "@/lib/store/gymStore";
import { DEFAULT_WEEKLY_PLAN, todayDayIndex } from "@/lib/data/weekly-plan";
import { activeLoggedFoods } from "@/lib/food-utils";

export default function GymHubPage() {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const kegelStreak = useGymStore((s) => s.kegelStreak);
  const kegelLevel = useGymStore((s) => s.kegelLevel);
  const todayFoods = useTodayLoggedFoods();
  const todayWater = useTodayWaterEntries();

  const caloriesToday = activeLoggedFoods(todayFoods).reduce((sum, f) => sum + f.calorias, 0);
  const waterToday = todayWater.reduce((sum, w) => sum + w.ml, 0);
  const todayPlan = DEFAULT_WEEKLY_PLAN[todayDayIndex()];

  const cards = [
    {
      href: "/gym/calorias",
      color: "var(--gym)",
      icon: Flame,
      title: "Calorías",
      value: `${caloriesToday} / ${calorieGoal} kcal`,
      bar: <ProgressBar value={caloriesToday} max={calorieGoal} color="var(--gym)" />,
    },
    {
      href: "/gym/agua",
      color: "#3b82f6",
      icon: Droplets,
      title: "Agua",
      value: `${(waterToday / 1000).toFixed(1)} / ${(waterGoalMl / 1000).toFixed(1)} L`,
      bar: <ProgressBar value={waterToday} max={waterGoalMl} color="#3b82f6" />,
    },
    {
      href: "/gym/entrenamiento",
      color: "var(--gym-2)",
      icon: Dumbbell,
      title: "Entrenamiento",
      value: `Hoy: ${todayPlan.grupoMuscular}`,
      bar: null,
    },
    {
      href: "/gym/kegel",
      color: "var(--paz-mental)",
      icon: Sparkles,
      title: "Kegel",
      value: `Racha: ${kegelStreak} días · Nivel ${kegelLevel}`,
      bar: <ProgressBar value={kegelLevel} max={10} color="var(--paz-mental)" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageBackdrop
        src="/backgrounds/gym.png"
        positionClass="object-[75%_center] md:object-[65%_center] lg:object-[50%_center]"
      />

      {/* `relative`: sin position, estos hijos se pintan debajo del
      PageBackdrop (fixed) sin importar el orden en el DOM. */}
      <div className="relative flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Dumbbell style={{ color: "var(--gym)" }} /> Gym
        </h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <GlassCard accentColor={c.color} glow className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{ background: `${c.color}22` }}
                >
                  <c.icon size={20} style={{ color: c.color }} />
                </div>
                <ChevronRight size={18} className="text-white/30" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-white/55">{c.title}</p>
                <p className="text-lg md:text-xl font-semibold">{c.value}</p>
              </div>
              {c.bar}
            </GlassCard>
          </Link>
        ))}
      </section>
      </div>
    </div>
  );
}
