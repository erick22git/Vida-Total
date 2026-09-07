"use client";

import Link from "next/link";
import { ArrowLeft, Droplets, X } from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { WaterBottle } from "@/components/gym/water-bottle";
import { useGymStore, useTodayWaterEntries } from "@/lib/store/gymStore";

const QUICK_ADDS = [150, 250, 500];

export default function AguaPage() {
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const waterEntries = useGymStore((s) => s.waterEntries);
  const addWater = useGymStore((s) => s.addWater);
  const removeWaterEntry = useGymStore((s) => s.removeWaterEntry);
  const todayEntries = useTodayWaterEntries();

  const totalToday = todayEntries.reduce((sum, w) => sum + w.ml, 0);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const total = waterEntries
      .filter((w) => isSameDay(new Date(w.timestamp), date))
      .reduce((sum, w) => sum + w.ml, 0);
    return {
      day: format(date, "EEE", { locale: es }),
      ml: total,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Droplets style={{ color: "#3b82f6" }} /> Agua
        </h1>
      </header>

      <GlassCard accentColor="#3b82f6" glow className="flex flex-col items-center gap-6 py-8">
        <WaterBottle value={totalToday} max={waterGoalMl} />
        <div className="flex gap-3">
          {QUICK_ADDS.map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              className="rounded-2xl px-4 py-2.5 text-sm font-medium text-white cursor-pointer transition-transform hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #2563ebcc)",
                boxShadow: "0 4px 20px #3b82f655, inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              +{ml}ml
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Últimos 7 días</p>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7Days}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  background: "rgba(20,20,26,0.9)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  color: "white",
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} ml`, "Agua"]}
              />
              <Bar dataKey="ml" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-white/80">Registros de hoy</p>
        {todayEntries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {todayEntries
              .slice()
              .reverse()
              .map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between text-sm bg-white/[0.04] rounded-xl px-3 py-2"
                >
                  <span className="text-white/80">{w.ml} ml</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">
                      {format(new Date(w.timestamp), "HH:mm")}
                    </span>
                    <button
                      onClick={() => removeWaterEntry(w.id)}
                      className="text-white/30 hover:text-white/70 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-white/30">Aún no registras agua hoy</p>
        )}
      </GlassCard>
    </div>
  );
}
