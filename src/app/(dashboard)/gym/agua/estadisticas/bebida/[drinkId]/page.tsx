"use client";

/**
 * Detalle de una bebida — mismo look que "Tendencia" (ver `estadisticas/page.tsx`): sin tarjetas,
 * gráfica en blanco y negro directo sobre el fondo, los mismos botones con bisel para el período.
 * Se llega acá tocando una bebida en "Por bebida"; el botón de arriba a la izquierda vuelve ahí.
 */
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BezelPill } from "@/components/gym/bezel-pill";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { ALL_DRINKS, applyDrinkOverride, type DrinkOption } from "@/lib/data/drinks";
import { useGymStore } from "@/lib/store/gymStore";

const AGUA_FALLBACK: DrinkOption = { id: "agua", nombre: "Agua", emoji: "💧", color: "#3b82f6", hidratacion: 100 };

const PERIODS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "3 meses", days: 90 },
];

export default function BebidaEstadisticasPage() {
  const router = useRouter();
  const params = useParams<{ drinkId: string }>();
  const drinkId = params.drinkId;
  const waterEntries = useGymStore((s) => s.waterEntries);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const [period, setPeriod] = useState(PERIODS[1]);

  const base = ALL_DRINKS.find((d) => d.id === drinkId) ?? AGUA_FALLBACK;
  const drink = applyDrinkOverride(base, drinkOverrides[drinkId]);

  const entries = useMemo(() => waterEntries.filter((e) => (e.drinkId ?? "agua") === drinkId), [waterEntries, drinkId]);

  const now = new Date();
  const trendData = useMemo(() => {
    const days = Array.from({ length: period.days }, (_, i) => subDays(now, period.days - 1 - i));
    return days.map((date) => ({
      date: format(date, "d MMM", { locale: es }),
      ml: entries.filter((e) => isSameDay(new Date(e.timestamp), date)).reduce((sum, e) => sum + e.ml, 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, period]);

  const totalPeriodMl = trendData.reduce((sum, d) => sum + d.ml, 0);

  return (
    <div className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.push("/gym/agua/estadisticas")}
          aria-label="Salir"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[20px] uppercase tracking-[0.12em] truncate max-w-[60%]" style={MONO_FONT}>
          {drink.emoji} {drink.nombre}
        </h1>
        <span className="w-10 h-10 -mr-2" aria-hidden />
      </header>

      <main className="flex-1 min-h-0 flex flex-col gap-4 px-5 pb-6">
        <div className="flex gap-2.5 shrink-0">
          {PERIODS.map((p) => (
            <BezelPill key={p.label} label={p.label} selected={period.label === p.label} onClick={() => setPeriod(p)} />
          ))}
        </div>

        <p className="text-sm text-white/50 shrink-0">
          Total del período: <span className="font-semibold text-white">{(totalPeriodMl / 1000).toFixed(2)} L</span>
        </p>

        <div className="flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ left: -24, right: 4, top: 8 }}>
              <defs>
                <linearGradient id="drinkTrendBw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={period.days > 14 ? Math.ceil(period.days / 6) : 0}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                formatter={(value) => [`${Number(value).toLocaleString()} ml`, drink.nombre]}
              />
              <Area type="monotone" dataKey="ml" stroke="#ffffff" strokeWidth={2.5} fill="url(#drinkTrendBw)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
