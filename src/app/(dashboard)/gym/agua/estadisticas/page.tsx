"use client";

/**
 * Agua: tercera vista del stack vertical (vaso → fecha → ESTA). Reemplaza la vieja pantalla de
 * pestañas (Resumen/Por bebida/Tendencias con tarjetas de cristal) por el mismo lenguaje visual que
 * ya tiene el vaso y Fecha: pantalla fija, sin tarjetas, botones con el bisel oscuro de siempre.
 * Acá viven DOS sub-vistas que se alternan con los 2 íconos de abajo (no son parte del stack vertical,
 * son pestañas sueltas — por eso van con texto "1/2" + íconos, no con swipe):
 *   - Por bebida: rueda + lista (como antes, pero sin `GlassCard`).
 *   - Tendencia: el total de agua del día a lo largo del tiempo, en blanco y negro, sin tarjeta.
 * Tocar una bebida de la lista entra a su propio detalle (`bebida/[drinkId]`), con el mismo look de
 * Tendencia (ver ese archivo).
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Droplet, TrendingUp, X } from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { ViewDots } from "@/components/habitos/view-dots";
import { BezelPill } from "@/components/gym/bezel-pill";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { totalMlForDay, totalsByDrink } from "@/lib/gym/water-stats";
import { useGymStore, useTodayWaterEntries } from "@/lib/store/gymStore";

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
const SWIPE_Y = 60;
const PREV_HREF = "/gym/agua/fecha";

export default function EstadisticasAguaPage() {
  const router = useRouter();
  const waterEntries = useGymStore((s) => s.waterEntries);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const removeWaterEntry = useGymStore((s) => s.removeWaterEntry);
  const todayEntries = useTodayWaterEntries();
  const [sub, setSub] = useState<0 | 1>(0);
  const [range, setRange] = useState(RANGE_OPTIONS[3]);
  const [trendPeriod, setTrendPeriod] = useState(TREND_PERIODS[1]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  const now = new Date();

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
    return days.map((date) => ({ date: format(date, "d MMM", { locale: es }), ml: totalMlForDay(waterEntries, date) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterEntries, trendPeriod]);

  const goBack = () => router.push(PREV_HREF);

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const st = start.current;
        start.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (dy > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) goBack();
      }}
      onPointerCancel={() => (start.current = null)}
      onWheel={(e) => {
        if (wheelLock.current || e.deltaY > -30) return;
        wheelLock.current = true;
        setTimeout(() => (wheelLock.current = false), 800);
        goBack();
      }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button onClick={goBack} aria-label="Volver" className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform">
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[20px] uppercase tracking-[0.12em]" style={MONO_FONT}>
          {sub === 0 ? "Por bebida" : "Tendencia"}
        </h1>
        <span className="w-10 h-10 -mr-2 flex items-center justify-center" aria-hidden>
          <SettingsGlyph />
        </span>
      </header>

      <main className="flex-1 min-h-0 flex flex-col gap-4 px-5 pb-2 overflow-y-auto">
        {sub === 0 ? (
          <>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1 shrink-0">
              {RANGE_OPTIONS.map((r) => (
                <BezelPill key={r.label} label={r.label} selected={range.label === r.label} onClick={() => setRange(r)} />
              ))}
            </div>

            {range.label === "Hoy" && todayEntries.length > 0 && (
              <div className="flex flex-col gap-1.5 shrink-0">
                {todayEntries
                  .slice()
                  .reverse()
                  .map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-2 text-sm px-1 py-1.5">
                      <span className="text-white/70">
                        {w.drinkEmoji ?? "💧"} {w.drinkNombre ?? "Agua"} · {w.ml} ml
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-white/35 text-xs">{format(new Date(w.timestamp), "HH:mm")}</span>
                        <button onClick={() => removeWaterEntry(w.id)} aria-label="Quitar registro" className="text-white/30 hover:text-white/70 cursor-pointer">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {byDrink.length > 0 ? (
              <>
                <div className="relative w-full max-w-[220px] mx-auto shrink-0">
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
                    <span className="text-3xl font-black text-white">{(totalRangeMl / 1000).toFixed(2)}L</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  {byDrink.map((d) => (
                    <button
                      key={d.drinkId}
                      onClick={() => router.push(`/gym/agua/estadisticas/bebida/${d.drinkId}`)}
                      className="w-full flex items-center gap-3 px-1 py-2.5 border-b border-white/[0.06] last:border-b-0 cursor-pointer"
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-full text-base shrink-0" style={{ background: `${d.color}33` }}>
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
          </>
        ) : (
          <>
            <div className="flex gap-2.5 shrink-0">
              {TREND_PERIODS.map((p) => (
                <BezelPill key={p.label} label={p.label} selected={trendPeriod.label === p.label} onClick={() => setTrendPeriod(p)} />
              ))}
            </div>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -24, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="waterTrendBw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={trendPeriod.days > 14 ? Math.ceil(trendPeriod.days / 6) : 0}
                  />
                  <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, waterGoalMl) * 1.15]} />
                  <Tooltip
                    contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [`${Number(value).toLocaleString()} ml`, "Total"]}
                  />
                  <Area type="monotone" dataKey="ml" stroke="#ffffff" strokeWidth={2.5} fill="url(#waterTrendBw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),20px)] pt-2 flex flex-col items-center gap-2 shrink-0">
        <span className="text-[11px] text-white/35 tabular-nums" style={MONO_FONT}>
          {sub + 1}/2
        </span>
        <div className="relative w-full flex items-center justify-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setSub(0)} aria-label="Por bebida" aria-current={sub === 0} className="w-11 h-11 flex items-center justify-center cursor-pointer">
              <Droplet size={20} className={sub === 0 ? "text-white" : "text-white/40"} />
            </button>
            <button onClick={() => setSub(1)} aria-label="Tendencia" aria-current={sub === 1} className="w-11 h-11 flex items-center justify-center cursor-pointer">
              <TrendingUp size={20} className={sub === 1 ? "text-white" : "text-white/40"} />
            </button>
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <ViewDots index={2} count={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
