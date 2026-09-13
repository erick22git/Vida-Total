"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { WeeklyWaterCard } from "@/components/gym/weekly-water-card";
import { MonthlyWaterCalendar } from "@/components/gym/monthly-water-calendar";
import { totalMlForDay, totalsByDrink } from "@/lib/gym/water-stats";
import { useGymStore } from "@/lib/store/gymStore";

const TABS = ["Resumen", "Por bebida", "Tendencias"] as const;
type Tab = (typeof TABS)[number];

const RANGE_OPTIONS = [
  { label: "Hoy", days: 0 },
  { label: "Semana", days: 7 },
  { label: "Mes", days: 30 },
  { label: "Todo el tiempo", days: Infinity },
];

const TREND_PERIODS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "3 meses", days: 90 },
];

function DayRow({ date, ml, goal }: { date: Date; ml: number; goal: number }) {
  const pct = goal > 0 ? Math.round((ml / goal) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] glass-specular-ring px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/45 mb-1.5 capitalize">{format(date, "d MMMM", { locale: es })}</p>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: "#3b82f6" }} />
        </div>
      </div>
      <span className="text-sm font-semibold text-white tabular-nums shrink-0">{pct}%</span>
    </div>
  );
}

export default function EstadisticasAguaPage() {
  const router = useRouter();
  const waterEntries = useGymStore((s) => s.waterEntries);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const [tab, setTab] = useState<Tab>("Resumen");
  const [range, setRange] = useState(RANGE_OPTIONS[3]);
  const [trendPeriod, setTrendPeriod] = useState(TREND_PERIODS[1]);

  const now = new Date();
  const pctHoy = waterGoalMl > 0 ? Math.round((totalMlForDay(waterEntries, now) / waterGoalMl) * 100) : 0;

  const previousDays = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => subDays(now, i + 1));
    return days
      .map((date) => ({ date, ml: totalMlForDay(waterEntries, date) }))
      .filter((d) => d.ml > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterEntries]);

  const rangeEntries = useMemo(() => {
    if (range.days === 0) return waterEntries.filter((e) => isSameDay(new Date(e.timestamp), now));
    if (!Number.isFinite(range.days)) return waterEntries;
    const cutoff = subDays(now, range.days);
    return waterEntries.filter((e) => new Date(e.timestamp) >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterEntries, range]);

  const byDrink = useMemo(() => totalsByDrink(rangeEntries, drinkOverrides), [rangeEntries, drinkOverrides]);
  const totalRangeMl = byDrink.reduce((sum, d) => sum + d.ml, 0);

  const trendData = useMemo(() => {
    const days = Array.from({ length: trendPeriod.days }, (_, i) => subDays(now, trendPeriod.days - 1 - i));
    return days.map((date) => ({
      date: format(date, "d MMM", { locale: es }),
      ml: totalMlForDay(waterEntries, date),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterEntries, trendPeriod]);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/agua" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Estadísticas</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: tab === t ? "#3b82f6" : "rgba(255,255,255,0.06)",
              color: tab === t ? "white" : "rgba(255,255,255,0.6)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Resumen" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white/[0.04] glass-specular-ring p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Hoy</span>
              <span className="text-sm font-semibold text-[#3b82f6]">{pctHoy}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pctHoy)}%`, background: "#3b82f6" }} />
            </div>
          </div>

          <WeeklyWaterCard waterEntries={waterEntries} waterGoalMl={waterGoalMl} />

          <MonthlyWaterCalendar waterEntries={waterEntries} waterGoalMl={waterGoalMl} />

          {previousDays.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-white/80">Días anteriores</p>
              {previousDays.map((d) => (
                <DayRow key={d.date.toISOString()} date={d.date} ml={d.ml} goal={waterGoalMl} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Por bebida" && (
        <div className="flex flex-col gap-5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors glass-specular-ring"
                style={{
                  background: range.label === r.label ? "#3b82f6" : "rgba(255,255,255,0.05)",
                  color: range.label === r.label ? "white" : "rgba(255,255,255,0.6)",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {byDrink.length > 0 ? (
            <>
              <GlassCard padding="md" interactive={false} className="flex flex-col items-center">
                <div className="relative w-full max-w-[220px] mx-auto">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byDrink} dataKey="ml" nameKey="nombre" innerRadius={68} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                        {byDrink.map((d) => (
                          <Cell key={d.drinkId} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                        formatter={(v, n) => [`${(Number(v) / 1000).toFixed(2)} L`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-2xl font-extrabold text-white">{(totalRangeMl / 1000).toFixed(2)} l</span>
                  </div>
                </div>
              </GlassCard>

              <div className="rounded-2xl bg-white/[0.04] glass-specular-ring overflow-hidden">
                {byDrink.map((d) => (
                  <button
                    key={d.drinkId}
                    onClick={() => router.push(`/gym/agua/estadisticas/bebida/${d.drinkId}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <span
                      className="flex items-center justify-center w-9 h-9 rounded-full text-base shrink-0"
                      style={{ background: `${d.color}33` }}
                    >
                      {d.emoji}
                    </span>
                    <span className="flex-1 text-left text-sm font-medium text-white">{d.nombre}</span>
                    <span className="text-sm text-white/60 tabular-nums">
                      {(d.ml / 1000).toFixed(2)} l · {totalRangeMl > 0 ? Math.round((d.ml / totalRangeMl) * 100) : 0}%
                    </span>
                    <ChevronRight size={15} className="text-white/30 shrink-0" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/40 text-center py-8">No hay registros en este período.</p>
          )}
        </div>
      )}

      {tab === "Tendencias" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {TREND_PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setTrendPeriod(p)}
                className="flex-1 rounded-xl py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  background: trendPeriod.label === p.label ? "#3b82f6" : "rgba(255,255,255,0.05)",
                  color: trendPeriod.label === p.label ? "white" : "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <GlassCard padding="md" interactive={false} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-white/85">Agua total por día</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="waterTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={trendPeriod.days > 14 ? Math.ceil(trendPeriod.days / 6) : 0}
                  />
                  <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, waterGoalMl) * 1.15]} />
                  <Tooltip
                    contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [`${Number(value).toLocaleString()} ml`, "Total"]}
                  />
                  <ReferenceLine y={waterGoalMl} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="ml" stroke="#3b82f6" strokeWidth={2.5} fill="url(#waterTrendGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-white/35">Línea punteada: meta diaria ({waterGoalMl.toLocaleString()} ml)</p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
