"use client";

import { useMemo } from "react";
import { eachDayOfInterval, format, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { WorkoutSession } from "@/lib/types";

export function TrainingHeatmap({ sessions, days = 90 }: { sessions: WorkoutSession[]; days?: number }) {
  const cells = useMemo(() => {
    const end = new Date();
    const start = subDays(end, days - 1);
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      trained: sessions.some((s) => isSameDay(new Date(s.date), date)),
    }));
  }, [sessions, days]);

  // pad to a multiple of 7 so it forms clean week-columns
  const leadingPad = (7 - (cells.length % 7)) % 7;
  const padded = [...Array.from({ length: leadingPad }).map(() => null), ...cells];
  const weeks: (typeof cells[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const trainedCount = cells.filter((c) => c.trained).length;
  const perWeek = (trainedCount / (days / 7)).toFixed(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) =>
              cell ? (
                <div
                  key={di}
                  title={format(cell.date, "d MMM yyyy", { locale: es })}
                  className="w-3 h-3 rounded-[3px]"
                  style={{
                    background: cell.trained ? "var(--gym-2)" : "rgba(255,255,255,0.06)",
                    boxShadow: cell.trained ? "0 0 6px var(--gym-2)aa" : undefined,
                  }}
                />
              ) : (
                <div key={di} className="w-3 h-3" />
              ),
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-white/45">
        {trainedCount}/{days} días · {perWeek}/semana
      </p>
    </div>
  );
}
