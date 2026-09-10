"use client";

import { eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { WaterEntry } from "@/lib/types";
import { totalMlForDay } from "@/lib/gym/water-stats";

function DayRing({ label, dayNum, pct, ml, highlight }: { label: string; dayNum: string; pct: number; ml: number; highlight: boolean }) {
  const size = 40;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, pct));

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] uppercase text-white/70 font-medium">{label}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
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
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xs font-semibold text-white ${highlight ? "font-extrabold" : ""}`}
        >
          {dayNum}
        </span>
      </div>
      <span className="text-[10px] text-white/85 font-medium">{ml} ml</span>
    </div>
  );
}

export function WeeklyWaterCard({ waterEntries, waterGoalMl }: { waterEntries: WaterEntry[]; waterGoalMl: number }) {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end }).map((date) => {
    const ml = totalMlForDay(waterEntries, date);
    return { date, ml, pct: waterGoalMl > 0 ? ml / waterGoalMl : 0 };
  });

  const totalWeek = days.reduce((sum, d) => sum + d.ml, 0);
  const avgPct = Math.round((days.reduce((sum, d) => sum + d.pct, 0) / days.length) * 100);

  return (
    <div
      className="rounded-3xl p-5 flex flex-col gap-5"
      style={{
        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
        boxShadow: "0 8px 30px #3b82f655",
      }}
    >
      <div className="flex justify-between gap-1">
        {days.map((d) => (
          <DayRing
            key={d.date.toISOString()}
            label={format(d.date, "eeeeee", { locale: es })}
            dayNum={format(d.date, "d")}
            pct={d.pct}
            ml={d.ml}
            highlight={isToday(d.date)}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/20">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] text-white/80 text-center">Porcentaje promedio diario</span>
          <span className="text-2xl font-extrabold text-white">{avgPct}%</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] text-white/80 text-center">Total de la semana</span>
          <span className="text-2xl font-extrabold text-white">{totalWeek} ml</span>
        </div>
      </div>
    </div>
  );
}
