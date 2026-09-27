"use client";

/**
 * Rediseño Calorías (fase con fotos de referencia — Not Boring Habits/Weather): franja de los
 * últimos 7 días, adaptada de `HabitWeekStrip` (ver ese archivo). Diferencias con Hábitos:
 * - Cada día es tocable: cambia `selectedDate` (Hábitos no necesita esto, siempre mira hoy).
 * - Suma un botón de racha (🔥 + contador) que lleva a `/gym/calorias/rachas` — en Hábitos esa
 *   franja no tiene racha, acá la pidió el usuario específicamente ahí.
 */
import { addDays, format, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { ViewDots } from "@/components/habitos/view-dots";

const WEEKDAY = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

export function CalorieWeekStrip({
  loggedDayKeys,
  selectedDate,
  onSelectDate,
  todayISO,
  streakCurrent,
  viewIndex = 0,
  viewCount = 3,
}: {
  loggedDayKeys: Set<string>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  todayISO: string;
  streakCurrent: number;
  viewIndex?: number;
  viewCount?: number;
}) {
  const router = useRouter();
  const today = new Date(`${todayISO}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <div className="flex items-center gap-2 px-4">
      <button
        onClick={() => router.push("/gym/calorias/rachas")}
        aria-label={`Ver racha (${streakCurrent})`}
        className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
      >
        <span className="text-lg leading-none">🔥</span>
        <span className="text-[11px] font-semibold tabular-nums text-white/80" style={MONO}>
          {streakCurrent}
        </span>
      </button>
      <div className="flex flex-1 justify-between">
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const done = loggedDayKeys.has(iso);
          const isToday = iso === todayISO;
          const selected = isSameDay(d, selectedDate);
          return (
            <button
              key={iso}
              onClick={() => onSelectDate(d)}
              aria-label={format(d, "d 'de' MMMM")}
              className="flex flex-col items-center gap-2 w-[13.5%] cursor-pointer"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] tabular-nums"
                style={{
                  ...MONO,
                  background: done ? "#fff" : "#050505",
                  color: done ? "#000" : "#fff",
                  boxShadow: selected
                    ? "0 0 0 2px rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.4)"
                    : done
                      ? "inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 6px rgba(0,0,0,0.4)"
                      : "inset 0 1px 2px rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.5)",
                }}
              >
                {done ? <Check size={17} strokeWidth={3} /> : format(d, "d")}
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] tracking-wide text-white/85" style={MONO}>
                  {isToday ? "HOY" : WEEKDAY[d.getDay()]}
                </span>
                <span
                  className="h-[2px] w-6 rounded-full"
                  style={{ background: isToday ? "#f5a800" : "transparent" }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <div className="pt-2 pl-1 shrink-0">
        <ViewDots index={viewIndex} count={viewCount} />
      </div>
    </div>
  );
}
