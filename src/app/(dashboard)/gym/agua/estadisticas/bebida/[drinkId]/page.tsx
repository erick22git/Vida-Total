"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { ALL_DRINKS, applyDrinkOverride, type DrinkOption } from "@/lib/data/drinks";
import { useGymStore } from "@/lib/store/gymStore";

const AGUA_FALLBACK: DrinkOption = { id: "agua", nombre: "Agua", emoji: "💧", color: "#3b82f6", hidratacion: 100 };

const PERIODS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "3 meses", days: 90 },
];

function DayRow({ date, ml, color }: { date: Date; ml: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] glass-specular-ring px-4 py-3">
      <span className="text-sm text-white/80 capitalize">{format(date, "eeee d MMMM", { locale: es })}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>
        {ml} ml
      </span>
    </div>
  );
}

export default function BebidaEstadisticasPage() {
  const params = useParams<{ drinkId: string }>();
  const drinkId = params.drinkId;
  const waterEntries = useGymStore((s) => s.waterEntries);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const [period, setPeriod] = useState(PERIODS[1]);

  const base = ALL_DRINKS.find((d) => d.id === drinkId) ?? AGUA_FALLBACK;
  const drink = applyDrinkOverride(base, drinkOverrides[drinkId]);

  const entries = useMemo(
    () => waterEntries.filter((e) => (e.drinkId ?? "agua") === drinkId),
    [waterEntries, drinkId],
  );

  const now = new Date();
  const chartData = useMemo(() => {
    const days = Array.from({ length: period.days }, (_, i) => subDays(now, period.days - 1 - i));
    return days.map((date) => ({
      date,
      label: format(date, "d MMM", { locale: es }),
      ml: entries.filter((e) => isSameDay(new Date(e.timestamp), date)).reduce((sum, e) => sum + e.ml, 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, period]);

  const totalPeriodMl = chartData.reduce((sum, d) => sum + d.ml, 0);
  const daysWithEntries = chartData.filter((d) => d.ml > 0).slice().reverse();

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/agua/estadisticas" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <span>{drink.emoji}</span> {drink.nombre}
        </h1>
      </header>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriod(p)}
            className="flex-1 rounded-xl py-1.5 text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: period.label === p.label ? drink.color : "rgba(255,255,255,0.05)",
              color: period.label === p.label ? "white" : "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <GlassCard padding="md" interactive={false} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/85">Total en el período</h3>
          <span className="text-sm font-bold" style={{ color: drink.color }}>
            {(totalPeriodMl / 1000).toFixed(2)} l
          </span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={period.days > 14 ? Math.ceil(period.days / 6) : 0}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                formatter={(value) => [`${Number(value).toLocaleString()} ml`, drink.nombre]}
              />
              <Bar dataKey="ml" fill={drink.color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {daysWithEntries.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-white/80">Por fecha</p>
          {daysWithEntries.map((d) => (
            <DayRow key={d.date.toISOString()} date={d.date} ml={d.ml} color={drink.color} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40 text-center py-8">No hay registros de {drink.nombre.toLowerCase()} en este período.</p>
      )}
    </div>
  );
}
