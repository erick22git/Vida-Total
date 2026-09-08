"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Scale } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { groupLoggedFoodsByDay, computeLoggedDaysStreak, computePerfectDaysStreak } from "@/lib/gym/streaks";
import { computeNutritionScore, nutritionScoreLabel } from "@/lib/gym/nutrition-score";

const SCORE_PERIODS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
];

const CHART_PERIODS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "3 meses", days: 90 },
];

export default function ProgresoPage() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal) || 2000;
  const weightEntries = useGymStore((s) => s.weightEntries);
  const dashboardPrefs = useGymStore((s) => s.dashboardPrefs);
  const setDashboardPref = useGymStore((s) => s.setDashboardPref);

  const [scorePeriod, setScorePeriod] = useState(SCORE_PERIODS[1]);
  const [chartPeriod, setChartPeriod] = useState(CHART_PERIODS[1]);

  const scoreResult = useMemo(
    () => computeNutritionScore(loggedFoods, calorieGoal, scorePeriod.days),
    [loggedFoods, calorieGoal, scorePeriod],
  );

  const loggedStreak = useMemo(() => computeLoggedDaysStreak(loggedFoods), [loggedFoods]);
  const perfectStreak = useMemo(
    () => computePerfectDaysStreak(loggedFoods, calorieGoal),
    [loggedFoods, calorieGoal],
  );

  const calorieChartData = useMemo(() => {
    const byDay = groupLoggedFoodsByDay(loggedFoods);
    const today = new Date();
    const days = Array.from({ length: chartPeriod.days }, (_, i) => subDays(today, chartPeriod.days - 1 - i));
    return days.map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const foods = byDay.get(key) ?? [];
      const kcal = foods.reduce((sum, f) => sum + f.calorias, 0);
      return {
        date: format(date, chartPeriod.days > 30 ? "d MMM" : "d MMM", { locale: es }),
        kcal,
      };
    });
  }, [loggedFoods, chartPeriod]);

  const weightChartData = useMemo(() => {
    const cutoff = subDays(new Date(), chartPeriod.days);
    return weightEntries
      .filter((w) => new Date(w.date) >= cutoff)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((w) => ({ date: format(new Date(w.date), "d MMM", { locale: es }), kg: w.kg }));
  }, [weightEntries, chartPeriod]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex-1 text-center pr-6">
          Progreso
        </h1>
      </header>

      {/* 1. Score Nutricional */}
      <GlassCard padding="md" className="flex flex-col gap-4" style={{ background: "rgba(10,10,14,0.55)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/85">Score Nutricional</h2>
          <div className="flex gap-1.5">
            {SCORE_PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setScorePeriod(p)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
                style={{
                  background: scorePeriod.label === p.label ? "var(--gym)" : "rgba(255,255,255,0.06)",
                  color: scorePeriod.label === p.label ? "white" : "rgba(255,255,255,0.55)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <ScoreRing score={scoreResult.score} />
          <div className="flex flex-col gap-1">
            <p className="text-4xl font-extrabold text-white tabular-nums leading-none">
              {scoreResult.score}
              <span className="text-lg text-white/35 font-medium">/100</span>
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--gym)" }}>
              {nutritionScoreLabel(scoreResult.score, scoreResult.daysLogged)}
            </p>
            <p className="text-xs text-white/40">
              {scoreResult.daysLogged} de {scoreResult.periodDays} días con registro
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 2. Gráficas */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {CHART_PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setChartPeriod(p)}
              className="flex-1 rounded-xl py-1.5 text-xs font-semibold cursor-pointer transition-colors"
              style={{
                background: chartPeriod.label === p.label ? "var(--gym)" : "rgba(255,255,255,0.05)",
                color: chartPeriod.label === p.label ? "white" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <GlassCard padding="md" interactive={false} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white/85">Calorías por día</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={calorieChartData} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="kcalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gym)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--gym)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartPeriod.days > 14 ? Math.ceil(chartPeriod.days / 6) : 0}
                />
                <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, calorieGoal) * 1.15]} />
                <Tooltip
                  contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                  formatter={(value) => [`${Number(value).toLocaleString()} kcal`, "Total"]}
                />
                <ReferenceLine y={calorieGoal} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="kcal" stroke="var(--gym)" strokeWidth={2.5} fill="url(#kcalGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/35">
            Línea punteada: meta diaria ({calorieGoal.toLocaleString()} kcal)
          </p>
        </GlassCard>

        <GlassCard padding="md" interactive={false} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white/85">Peso corporal</h3>
          {weightChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="kg" stroke="var(--gym-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gym-2)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-3 text-center">
              <Scale size={28} className="text-white/25" />
              <p className="text-sm text-white/40">Aún no hay registros de peso.</p>
              <Link
                href="/gym/entrenamiento/perfil/peso"
                className="text-xs font-semibold px-3.5 py-2 rounded-full transition-colors"
                style={{ background: "var(--gym-2)", color: "white" }}
              >
                Registrar mi primer peso
              </Link>
            </div>
          )}
        </GlassCard>
      </div>

      {/* 3. Mis Rachas */}
      <GlassCard padding="md" className="flex flex-col gap-4" style={{ background: "rgba(10,10,14,0.55)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/85">Mis Rachas</h2>
          <Link
            href="/gym/calorias/rachas"
            className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            Ver calendario completo <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StreakMini label="Días Registrados" current={loggedStreak.current} best={loggedStreak.best} color="var(--gym)" />
          <StreakMini label="Días Perfectos" current={perfectStreak.current} best={perfectStreak.best} color="#22c55e" />
        </div>
      </GlassCard>

      {/* 4. Personalizar Dashboard */}
      <GlassCard padding="md" className="flex flex-col gap-1" style={{ background: "rgba(10,10,14,0.55)" }}>
        <h2 className="text-sm font-semibold text-white/85 mb-2">Personalizar Dashboard</h2>
        <PrefToggle
          label="Tarjeta “Otros nutrientes”"
          description="Segunda tarjeta del carrusel superior"
          checked={dashboardPrefs.showOtherNutrients}
          onChange={(v) => setDashboardPref("showOtherNutrients", v)}
        />
        <PrefToggle
          label="Tira de la semana"
          description="Días de la semana con racha de registro"
          checked={dashboardPrefs.showWeekStrip}
          onChange={(v) => setDashboardPref("showWeekStrip", v)}
        />
        <PrefToggle
          label="Botón “Terminar Día”"
          description="Botón para marcar el día como registrado"
          checked={dashboardPrefs.showFinishDayButton}
          onChange={(v) => setDashboardPref("showFinishDayButton", v)}
        />
      </GlassCard>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 85 ? "var(--gym)" : score >= 65 ? "var(--gym)" : score >= 40 ? "#eab308" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

function StreakMini({ label, current, best, color }: { label: string; current: number; best: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-[11px] text-white/50 font-medium text-center">{label}</p>
      <p className="text-2xl font-extrabold text-white tabular-nums" style={{ color }}>
        {current}
      </p>
      <p className="text-[10px] text-white/40">🏆 Mejor: {best}</p>
    </div>
  );
}

function PrefToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.06] last:border-b-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="text-[11px] text-white/40">{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-[26px] rounded-full shrink-0 cursor-pointer transition-colors"
        style={{ background: checked ? "var(--gym)" : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(21px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
