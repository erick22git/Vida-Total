"use client";

import { getDaysInMonth } from "date-fns";
import { ViewDots } from "@/components/habitos/view-dots";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const MONTH_LETTERS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Cono ámbar con dos caras (luz/sombra) — un día completado. */
function Cone() {
  return (
    <svg viewBox="0 0 10 22" className="h-full max-h-[20px]" aria-hidden>
      <polygon points="5,0 5,20 0,20" fill="#f5b301" />
      <polygon points="5,0 10,20 5,20" fill="#b97f00" />
    </svg>
  );
}

/**
 * Vista AÑO: una columna por mes (E–D), una fila por día (1–31). Cada día
 * completado es un cono ámbar; hoy se marca con un punto blanco. Referencia:
 * Not Boring Habits, vista anual.
 */
export function YearView({ completedDates, todayISO }: { completedDates: string[]; todayISO: string }) {
  const year = Number(todayISO.slice(0, 4));
  const done = new Set(completedDates);

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
      const isDone = done.has(iso);
      const isToday = iso === todayISO;
      cells.push(
        <div key={key} className="flex items-center justify-center min-h-0">
          {isDone ? (
            <Cone />
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
        <span
          className="text-[46px] font-black leading-none tracking-tight inline-block origin-center"
          style={{ transform: "scaleX(0.78)" }}
        >
          {year}
        </span>
        <div className="absolute right-1 bottom-4">
          <ViewDots index={1} />
        </div>
      </div>
    </div>
  );
}
