"use client";

/**
 * Rediseño Calorías: Progreso, al estilo oscuro del resto del módulo — mismo envoltorio que las demás
 * pantallas rediseñadas (fondo con grano, círculo de volver + título centrado), bloques sin tarjeta de
 * vidrio. La lógica (score nutricional, gráficas, rachas) es la misma de siempre.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Scale } from "lucide-react";
import Link from "next/link";
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
import { FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { useGymStore } from "@/lib/store/gymStore";
import { groupLoggedFoodsByDay, computeLoggedDaysStreak, computePerfectDaysStreak } from "@/lib/gym/streaks";
import { computeNutritionScore, nutritionScoreLabel } from "@/lib/gym/nutrition-score";
import { MONO_FONT } from "@/lib/ui/mono-font";

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
  const router = useRouter();
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal) || 2000;
  const weightEntries = useGymStore((s) => s.weightEntries);

  const [scorePeriod, setScorePeriod] = useState(SCORE_PERIODS[1]);
  const [chartPeriod, setChartPeriod] = useState(CHART_PERIODS[1]);

  const scoreResult = useMemo(
    () => computeNutritionScore(loggedFoods, calorieGoal, scorePeriod.days),
    [loggedFoods, calorieGoal, scorePeriod],
  );

  const loggedStreak = useMemo(() => computeLoggedDaysStreak(loggedFoods), [loggedFoods]);
  const perfectStreak = useMemo(() => computePerfectDaysStreak(loggedFoods, calorieGoal), [loggedFoods, calorieGoal]);

  const calorieChartData = useMemo(() => {
    const byDay = groupLoggedFoodsByDay(loggedFoods);
    const today = new Date();
    const days = Array.from({ length: chartPeriod.days }, (_, i) => subDays(today, chartPeriod.days - 1 - i));
    return days.map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const foods = byDay.get(key) ?? [];
      const kcal = foods.reduce((sum, f) => sum + f.calorias, 0);
      return { date: format(date, "d MMM", { locale: es }), kcal };
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
    <div className="fixed inset-0 z-[45] overflow-y-auto text-white select-none" style={FOOD_SECTION_BG}>
      <div className="max-w-md mx-auto px-4 pb-10 flex flex-col gap-5">
        <header className="flex items-center justify-between gap-2 pt-[max(env(safe-area-inset-top),14px)]">
          <button
            onClick={() => router.push("/gym/calorias")}
            aria-label="Volver"
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            style={{ background: "#0d0d0d" }}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
            Progreso
          </h1>
          <span className="w-10 h-10" />
        </header>

        {/* 1. Score Nutricional */}
        <div className="flex flex-col gap-4 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-wide text-white/40">Score nutricional</h2>
            <div className="flex gap-1.5">
              {SCORE_PERIODS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setScorePeriod(p)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
                  style={
                    scorePeriod.label === p.label
                      ? { background: "#fff", color: "#000" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }
                  }
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
        </div>

        {/* 2. Gráficas */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {CHART_PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setChartPeriod(p)}
                className="flex-1 rounded-xl py-1.5 text-xs font-semibold cursor-pointer transition-colors border border-white/10"
                style={
                  chartPeriod.label === p.label
                    ? { background: "#fff", color: "#000" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
            <h3 className="text-[11px] uppercase tracking-wide text-white/40">Calorías por día</h3>
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
            <p className="text-[11px] text-white/35">Línea punteada: meta diaria ({Math.round(calorieGoal).toLocaleString()} kcal)</p>
          </div>

          <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
            <h3 className="text-[11px] uppercase tracking-wide text-white/40">Peso corporal</h3>
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
          </div>
        </div>

        {/* 3. Mis Rachas */}
        <div className="flex flex-col gap-4 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40">Mis rachas</h2>
          <div className="grid grid-cols-2 gap-3">
            <StreakMini label="Días registrados" current={loggedStreak.current} best={loggedStreak.best} />
            <StreakMini label="Días perfectos" current={perfectStreak.current} best={perfectStreak.best} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 65 ? "var(--gym)" : score >= 40 ? "#eab308" : "#ef4444";

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

function StreakMini({ label, current, best }: { label: string; current: number; best: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-[11px] text-white/50 font-medium text-center">{label}</p>
      <p className="text-2xl font-extrabold text-white tabular-nums">{current}</p>
      <p className="text-[10px] text-white/40">🏆 Mejor: {best}</p>
    </div>
  );
}
