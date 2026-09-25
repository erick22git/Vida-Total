"use client";

import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const WEEKS = 22;

/**
 * Historial de puntos: una columna por semana (lunes a domingo, de arriba a
 * abajo), la última es la semana actual. Completado = blanco. En modo
 * edición cada día pasado se puede marcar/desmarcar.
 */
export function HistoryGrid({
  completedDates,
  todayISO,
  editing,
  onToggle,
}: {
  completedDates: string[];
  todayISO: string;
  editing: boolean;
  onToggle: (iso: string) => void;
}) {
  const done = new Set(completedDates);
  const today = new Date(`${todayISO}T12:00:00`);
  const firstMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), -(WEEKS - 1) * 7);

  const cells: React.ReactNode[] = [];
  const monthMarks: { col: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      const iso = format(date, "yyyy-MM-dd");
      const future = iso > todayISO;
      const isDone = done.has(iso);
      if (d === 0 && date.getDate() <= 7) monthMarks.push({ col: w, label: format(date, "MMM", { locale: es }).replace(".", "").toUpperCase() });
      cells.push(
        <button
          key={iso}
          disabled={!editing || future}
          onClick={() => onToggle(iso)}
          aria-label={`${format(date, "d 'de' MMMM", { locale: es })}: ${isDone ? "completado" : "sin completar"}`}
          className="aspect-square w-full rounded-full"
          style={{
            background: isDone ? "#fff" : "#050505",
            opacity: future ? 0.35 : 1,
            boxShadow: isDone ? "none" : "inset 0 1px 1px rgba(255,255,255,0.08)",
            outline: editing && !future ? "1px solid rgba(245,179,1,0.5)" : "none",
            cursor: editing && !future ? "pointer" : "default",
          }}
        />,
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column" }}>
        {cells}
      </div>
      <div className="relative h-4">
        {monthMarks.map((m) => (
          <span
            key={m.col}
            className="absolute text-[11px] text-white/60 -translate-x-1/2"
            style={{ ...MONO, left: `${((m.col + 0.5) / WEEKS) * 100}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
