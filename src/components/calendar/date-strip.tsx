"use client";

import { dayNumber, isToday, shortWeekday, toISO } from "@/lib/calendar/date-utils";
import { cn } from "@/lib/utils";

/**
 * Franja horizontal de fechas — el día actual destacado, seleccionable.
 * Compartida: no vive dentro de un módulo específico a propósito (mismo
 * criterio que `src/lib/progress`/`src/lib/animations`).
 */
export function DateStrip({
  days,
  selected,
  onSelect,
  accentColor = "var(--calendario)",
  hasActivity,
}: {
  days: Date[];
  selected: Date;
  onSelect: (date: Date) => void;
  accentColor?: string;
  /** true si ese día tuvo algo completado — para el punto debajo del número. */
  hasActivity?: (date: Date) => boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
      {days.map((d) => {
        const isSelected = toISO(d) === toISO(selected);
        const today = isToday(d);
        const active = hasActivity?.(d) ?? false;
        return (
          <button
            key={toISO(d)}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 shrink-0 cursor-pointer transition-colors min-w-14"
            style={{
              background: isSelected ? accentColor : today ? `${accentColor}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${isSelected ? accentColor : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span className={cn("text-[10px] font-semibold uppercase", isSelected ? "text-white" : "text-white/45")}>
              {shortWeekday(d)}
            </span>
            <span className={cn("text-base font-bold", isSelected ? "text-white" : "text-white/80")}>{dayNumber(d)}</span>
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: active ? (isSelected ? "white" : accentColor) : "transparent" }}
            />
          </button>
        );
      })}
    </div>
  );
}
