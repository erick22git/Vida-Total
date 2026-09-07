"use client";

import Link from "next/link";
import { Flame, Droplets, Dumbbell, Sparkles, Shirt, Leaf, Wallet, CalendarCheck2, Rows3, ArrowUpRight, ArrowDownRight, Mic } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  useGymStore,
  useTodayLoggedFoods,
  useTodayWaterEntries,
} from "@/lib/store/gymStore";
import { DEFAULT_WEEKLY_PLAN, todayDayIndex } from "@/lib/data/weekly-plan";
import { useHabitsCompletedToday, useHabitsStore } from "@/lib/store/habitsStore";
import { HABIT_ICON_MAP, formatHour } from "@/lib/habits-utils";
import { useTodayOutfit } from "@/lib/store/outfitStore";
import { getWeatherForDate } from "@/lib/data/weather";
import { WeatherIcon } from "@/components/outfit/weather-icon";
import { OutfitThumbRow } from "@/components/outfit/outfit-thumb-row";
import { useTodayMood } from "@/lib/store/pazMentalStore";
import { useMonthSummary, useMonthTrend, useCurrencySymbol, formatMoney } from "@/lib/store/financeStore";
import { useVoiceStreak, useTodayVoiceLesson, VOICE_CATEGORY_LABEL } from "@/lib/store/voiceStore";

export default function HomePage() {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const kegelStreak = useGymStore((s) => s.kegelStreak);
  const todayFoods = useTodayLoggedFoods();
  const todayWater = useTodayWaterEntries();

  const caloriesToday = todayFoods.reduce((sum, f) => sum + f.calorias, 0);
  const waterToday = todayWater.reduce((sum, w) => sum + w.ml, 0);
  const todayPlan = DEFAULT_WEEKLY_PLAN[todayDayIndex()];

  const timeBlocks = useHabitsStore((s) => s.timeBlocks);
  const { completed: habitsCompleted, total: habitsTotal } = useHabitsCompletedToday();
  const currentHour = new Date().getHours();
  const upcomingBlocks = [...timeBlocks]
    .filter((b) => b.endHour >= currentHour)
    .sort((a, b) => a.startHour - b.startHour)
    .slice(0, 3);

  const todayOutfit = useTodayOutfit();
  const todayWeather = getWeatherForDate(new Date());

  const todayMood = useTodayMood();

  const financeSymbol = useCurrencySymbol();
  const financeSummary = useMonthSummary();
  const { pct: financeTrendPct } = useMonthTrend();

  const vozStreak = useVoiceStreak();
  const todayVoiceLesson = useTodayVoiceLesson();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Hola de nuevo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Tu resumen de hoy
        </h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard accentColor="var(--gym)" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Flame size={16} style={{ color: "var(--gym)" }} />
            Calorías
          </div>
          <p className="text-2xl font-semibold">
            {caloriesToday} <span className="text-white/40 text-base font-normal">/ {calorieGoal} kcal</span>
          </p>
          <ProgressBar value={caloriesToday} max={calorieGoal} color="var(--gym)" />
        </GlassCard>

        <GlassCard accentColor="#3b82f6" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Droplets size={16} style={{ color: "#3b82f6" }} />
            Agua
          </div>
          <p className="text-2xl font-semibold">
            {(waterToday / 1000).toFixed(1)}
            <span className="text-white/40 text-base font-normal"> / {(waterGoalMl / 1000).toFixed(1)} L</span>
          </p>
          <ProgressBar value={waterToday} max={waterGoalMl} color="#3b82f6" />
        </GlassCard>

        <GlassCard accentColor="var(--gym-2)" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Dumbbell size={16} style={{ color: "var(--gym-2)" }} />
            Entrenamiento de hoy
          </div>
          <p className="text-2xl font-semibold">{todayPlan.grupoMuscular}</p>
          <Link
            href="/gym/entrenamiento"
            className="text-sm font-medium"
            style={{ color: "var(--gym-2)" }}
          >
            Ver plan de la semana →
          </Link>
        </GlassCard>

        <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Sparkles size={16} style={{ color: "var(--paz-mental)" }} />
            Racha Kegel
          </div>
          <p className="text-2xl font-semibold">
            {kegelStreak} <span className="text-white/40 text-base font-normal">días</span>
          </p>
          <Link
            href="/gym/kegel"
            className="text-sm font-medium"
            style={{ color: "var(--paz-mental)" }}
          >
            Iniciar sesión →
          </Link>
        </GlassCard>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/outfit">
          <GlassCard accentColor="var(--outfit)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--outfit)" }}>
                <Shirt size={16} />
                Outfit de hoy
              </div>
              <WeatherIcon icon={todayWeather.icon} condition={todayWeather.condition} size={18} />
            </div>
            {todayOutfit ? (
              <div className="flex items-center gap-3">
                <OutfitThumbRow outfitId={todayOutfit.id} size={30} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{todayOutfit.name}</span>
                  <span className="text-xs text-white/40">{todayWeather.temp}° hoy</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/45">
                Aún no tienes outfit para hoy. Planifica tu semana →
              </p>
            )}
          </GlassCard>
        </Link>
        <Link href="/paz-mental">
          <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--paz-mental)" }}>
              <Leaf size={16} />
              Paz Mental
            </div>
            {todayMood ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl">{todayMood.emoji}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Humor registrado hoy</span>
                  <span className="text-xs text-white/40">Nivel {todayMood.level}/5</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/45">
                Aún no registras tu humor de hoy. Tócalo para hacerlo →
              </p>
            )}
          </GlassCard>
        </Link>
        <Link href="/finanzas">
          <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--finanzas)" }}>
                <Wallet size={16} />
                Finanzas
              </div>
              <span
                className="text-xs flex items-center gap-0.5"
                style={{ color: financeTrendPct >= 0 ? "#22c55e" : "#ef4444" }}
              >
                {financeTrendPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(financeTrendPct).toFixed(0)}%
              </span>
            </div>
            <p className="text-2xl font-semibold">
              {formatMoney(financeSummary.balance, financeSymbol)}
            </p>
            <p className="text-xs text-white/40">Balance del mes</p>
          </GlassCard>
        </Link>
        <Link href="/habitos">
          <GlassCard accentColor="var(--habitos)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--habitos)" }}>
                <CalendarCheck2 size={16} />
                Hábitos y tareas
              </div>
              <span className="text-xs text-white/40">
                {habitsCompleted}/{habitsTotal} hábitos
              </span>
            </div>
            {upcomingBlocks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {upcomingBlocks.map((b) => {
                  const Icon = HABIT_ICON_MAP[b.icon] ?? Rows3;
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <Icon size={13} style={{ color: b.color }} />
                      <span className="text-white/70 truncate">{b.title}</span>
                      <span className="text-white/35 ml-auto shrink-0">{formatHour(b.startHour)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/45">Sin bloques próximos en tu timeline hoy.</p>
            )}
          </GlassCard>
        </Link>
        <Link href="/voz">
          <GlassCard accentColor="var(--voz)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--voz)" }}>
                <Mic size={16} />
                Voz &amp; Comunicación
              </div>
              {vozStreak > 0 && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Flame size={12} className="text-orange-400" /> {vozStreak}d
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white truncate">{todayVoiceLesson.title}</span>
              <span className="text-xs text-white/40">
                Lección de hoy · {VOICE_CATEGORY_LABEL[todayVoiceLesson.category]}
              </span>
            </div>
          </GlassCard>
        </Link>
      </section>
    </div>
  );
}
