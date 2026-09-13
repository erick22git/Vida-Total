"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarRange, Plus, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { OutfitThumbRow } from "@/components/outfit/outfit-thumb-row";
import { DayOutfitModal } from "@/components/outfit/day-outfit-modal";
import { WeatherIcon } from "@/components/outfit/weather-icon";
import { getWeatherForDate } from "@/lib/data/weather";
import {
  startOfWeekISO,
  todayWeekdayIndex,
  useOutfitStore,
} from "@/lib/store/outfitStore";

export default function PlanSemanalPage() {
  const outfits = useOutfitStore((s) => s.outfits);
  const setWeeklyPlanDay = useOutfitStore((s) => s.setWeeklyPlanDay);
  const clearWeeklyPlanDay = useOutfitStore((s) => s.clearWeeklyPlanDay);
  const weeklyPlans = useOutfitStore((s) => s.weeklyPlans);

  const [range, setRange] = useState<3 | 7>(7);
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const weekStart = startOfWeekISO();
  const plan = weeklyPlans.find((p) => p.weekStartDate === weekStart);
  const currentDay = todayWeekdayIndex();

  const days = useMemo(() => {
    const monday = new Date(weekStart + "T00:00:00");
    const list = [];
    for (let i = 0; i < range; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dayIndex = i + 1;
      list.push({
        dayIndex,
        date: d,
        weather: getWeatherForDate(d),
        outfitId: plan?.dayOutfits[dayIndex],
      });
    }
    return list;
  }, [weekStart, range, plan]);

  const pickerDayInfo = days.find((d) => d.dayIndex === pickerDay);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/outfit"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] glass-specular-ring text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarRange style={{ color: "var(--outfit)" }} /> Plan Semanal
        </h1>
      </header>

      <div className="inline-flex self-start rounded-full glass-specular-ring bg-white/[0.04] p-1">
        {([3, 7] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: range === r ? "var(--outfit)" : "transparent",
              color: range === r ? "white" : "rgba(255,255,255,0.6)",
            }}
          >
            {r} días
          </button>
        ))}
      </div>

      <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-x-auto pb-2 -mx-1 px-1 md:overflow-visible">
        {days.map((day) => {
          const outfit = day.outfitId ? outfits.find((o) => o.id === day.outfitId) : undefined;
          const isToday = day.dayIndex === currentDay;
          return (
            <GlassCard
              key={day.dayIndex}
              accentColor="var(--outfit)"
              glow={isToday}
              className="shrink-0 w-[180px] md:w-auto flex flex-col gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold capitalize">
                  {format(day.date, "EEEE", { locale: es })}
                </p>
                <p className="text-xs text-white/45">
                  {format(day.date, "d 'de' MMMM", { locale: es })}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] glass-specular-ring px-3 py-2">
                <span className="text-lg font-semibold">{day.weather.temp}°</span>
                <WeatherIcon icon={day.weather.icon} condition={day.weather.condition} size={22} />
              </div>
              {outfit ? (
                <button
                  onClick={() => setPickerDay(day.dayIndex)}
                  className="flex flex-col gap-2 cursor-pointer text-left"
                >
                  <OutfitThumbRow outfitId={outfit.id} size={30} />
                  <p className="text-xs font-medium text-white/75 truncate">{outfit.name}</p>
                </button>
              ) : (
                <button
                  onClick={() => setPickerDay(day.dayIndex)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-3 text-sm text-white/45 hover:text-white/70 hover:border-white/30 transition-colors cursor-pointer"
                >
                  <Plus size={15} /> Asignar outfit
                </button>
              )}
              {outfit && (
                <button
                  onClick={() => clearWeeklyPlanDay(weekStart, day.dayIndex)}
                  className="flex items-center justify-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors cursor-pointer"
                >
                  <X size={11} /> Quitar
                </button>
              )}
            </GlassCard>
          );
        })}
      </div>

      <DayOutfitModal
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        dayLabel={pickerDayInfo ? format(pickerDayInfo.date, "EEEE d 'de' MMMM", { locale: es }) : ""}
        onSelect={(outfitId) => {
          if (pickerDay !== null) setWeeklyPlanDay(weekStart, pickerDay, outfitId);
        }}
      />
    </div>
  );
}
