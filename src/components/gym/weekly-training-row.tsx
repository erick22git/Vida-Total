"use client";

import { Check, Dumbbell } from "lucide-react";
import { eachDayOfInterval, endOfWeek, isToday, startOfWeek } from "date-fns";
import type { WorkoutSession } from "@/lib/types";
import { dayHasWorkout } from "@/lib/gym/training-streaks";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/** Compact row of 7 circles (L-D) showing which days this week had a
 * completed workout — reuses `dayHasWorkout` from training-streaks.ts so the
 * "was this day trained" rule stays identical to the Rachas page. */
export function WeeklyTrainingRow({ sessions }: { sessions: WorkoutSession[] }) {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end }).map((date) => ({
    date,
    trained: dayHasWorkout(sessions, date),
  }));

  return (
    <div className="flex justify-between gap-1">
      {days.map((d, i) => {
        const today = isToday(d.date);
        return (
          <div key={d.date.toISOString()} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full"
              style={{
                background: d.trained ? "white" : "rgba(255,255,255,0.06)",
                border: today ? "1.5px solid white" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: d.trained ? "0 0 8px rgba(255,255,255,0.4)" : undefined,
              }}
            >
              {d.trained ? (
                <Check size={12} className="text-black" strokeWidth={3} />
              ) : (
                <Dumbbell size={11} className="text-white/25" />
              )}
            </div>
            <span className="text-[9px] text-white/35">{WEEKDAY_LABELS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
