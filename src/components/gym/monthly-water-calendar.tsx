"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isFuture,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import type { WaterEntry } from "@/lib/types";
import { totalMlForDay } from "@/lib/gym/water-stats";

function DayCell({ dayNum, pct, today, future }: { dayNum: string; pct: number; today: boolean; future: boolean }) {
  const size = 34;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, pct));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size, opacity: future ? 0.25 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className={`text-[11px] font-medium ${today ? "text-white font-bold" : "text-white/70"}`}>{dayNum}</span>
    </div>
  );
}

export function MonthlyWaterCalendar({ waterEntries, waterGoalMl }: { waterEntries: WaterEntry[]; waterGoalMl: number }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = (days[0].getDay() + 6) % 7; // lunes = 0

  const dayStats = days.map((date) => ({
    date,
    pct: waterGoalMl > 0 ? totalMlForDay(waterEntries, date) / waterGoalMl : 0,
  }));

  const validDays = dayStats.filter((d) => !isFuture(d.date) || isToday(d.date));
  const avgPct = validDays.length
    ? Math.round((validDays.reduce((sum, d) => sum + d.pct, 0) / validDays.length) * 100)
    : 0;
  const metGoalDays = validDays.filter((d) => d.pct >= 1).length;

  return (
    <div className="rounded-2xl bg-white/[0.04] glass-specular-ring p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white capitalize">{format(month, "MMMM yyyy", { locale: es })}</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Mes anterior"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} className="text-white/70" />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={format(month, "yyyy-MM") === format(new Date(), "yyyy-MM")}
            aria-label="Mes siguiente"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} className="text-white/70" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-2 justify-items-center">
        {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
          <span key={d} className="text-[9px] uppercase text-white/35 font-medium">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dayStats.map((d) => (
          <DayCell
            key={d.date.toISOString()}
            dayNum={format(d.date, "d")}
            pct={d.pct}
            today={isToday(d.date)}
            future={isFuture(d.date) && !isToday(d.date)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08]">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] text-white/50 text-center">Porcentaje promedio diario</span>
          <span className="text-xl font-bold text-white">{avgPct}%</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] text-white/50 text-center">Logro del objetivo</span>
          <span className="text-xl font-bold text-white">{metGoalDays} días</span>
        </div>
      </div>
    </div>
  );
}
