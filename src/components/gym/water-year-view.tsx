"use client";

/**
 * Agua: vista AÑO ("Fecha"), entre el vaso (arriba) y Por bebida/Tendencia (abajo) — mismo layout que
 * `CalorieYearView` (una columna por mes, una fila por día, el número de año centrado abajo), pero
 * cada día muestra el % de la meta de agua de ESE día (no un cono de racha): sin dato = puntito, con
 * dato = el número coloreado por semáforo (`waterDayColor`).
 */
import { format, getDaysInMonth } from "date-fns";
import { ViewDots } from "@/components/habitos/view-dots";
import { WATER_DAY_COLORS, waterDayColor } from "@/lib/gym/water-state";
import type { WaterEntry } from "@/lib/types";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const MONTH_LETTERS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function WaterYearView({
  waterEntries,
  waterGoalMl,
  todayISO,
  viewIndex = 1,
  viewCount = 3,
}: {
  waterEntries: WaterEntry[];
  waterGoalMl: number;
  todayISO: string;
  viewIndex?: number;
  viewCount?: number;
}) {
  const year = Number(todayISO.slice(0, 4));

  const mlByDay = new Map<string, number>();
  for (const e of waterEntries) {
    const key = format(new Date(e.timestamp), "yyyy-MM-dd");
    mlByDay.set(key, (mlByDay.get(key) ?? 0) + e.ml);
  }

  const cells: React.ReactNode[] = [];
  for (let m = 0; m < 12; m++) {
    const days = getDaysInMonth(new Date(year, m, 1));
    for (let d = 1; d <= 31; d++) {
      const key = `${m}-${d}`;
      if (d > days) {
        cells.push(<div key={key} />);
        continue;
      }
      const iso = `${year}-${pad(m + 1)}-${pad(d)}`;
      const ml = mlByDay.get(iso) ?? 0;
      const isToday = iso === todayISO;
      const pct = waterGoalMl > 0 ? Math.round((ml / waterGoalMl) * 100) : 0;
      cells.push(
        <div key={key} className="flex items-center justify-center min-h-0">
          {ml > 0 ? (
            <span className="text-[8px] font-bold tabular-nums leading-none" style={{ ...MONO, color: WATER_DAY_COLORS[waterDayColor(pct)] }}>
              {pct}
            </span>
          ) : (
            <span
              className="rounded-full"
              style={{
                width: isToday ? 5 : 3.5,
                height: isToday ? 5 : 3.5,
                background: isToday ? "#fff" : "rgba(255,255,255,0.28)",
              }}
            />
          )}
        </div>,
      );
    }
  }

  return (
    <div className="w-full h-full flex flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-1">
      <div className="grid grid-cols-12 text-center text-[15px] text-white/85 mb-2" style={MONO}>
        {MONTH_LETTERS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-12 grid-flow-col" style={{ gridTemplateRows: "repeat(31, minmax(0, 1fr))" }}>
        {cells}
      </div>
      <div className="relative flex items-center justify-center h-16">
        <span className="text-[46px] font-black leading-none tracking-tight inline-block origin-center" style={{ transform: "scaleX(0.78)" }}>
          {year}
        </span>
        {viewCount > 1 && (
          <div className="absolute right-1 bottom-4">
            <ViewDots index={viewIndex} count={viewCount} />
          </div>
        )}
      </div>
    </div>
  );
}
