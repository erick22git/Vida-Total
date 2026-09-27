"use client";

/**
 * Rediseño Calorías: vista AÑO de la racha, adaptada de `YearView` de Hábitos (mismo layout: una
 * columna por mes, una fila por día). Única pantalla de racha que existe — no hay una página
 * dedicada aparte (se sacó, era redundante: mostraba lo mismo dos veces).
 *
 * Color por día según el largo de la racha (días consecutivos con registro) a la que pertenece ese
 * día — no por si "llegó a la meta" (eso ya NO se distingue acá):
 *   - aislado (racha de 1 día): DORADO
 *   - racha de 2 a 6 días: ROJO
 *   - racha de 7 días o más: VERDE
 * El fuego de abajo es solo informativo (racha actual) — no lleva a ningún lado, sería repetir la
 * misma racha que ya se ve arriba en los colores.
 */
import { getDaysInMonth } from "date-fns";
import { ViewDots } from "@/components/habitos/view-dots";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const MONTH_LETTERS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

type StreakColor = "dorado" | "rojo" | "verde";

const CONE_COLORS: Record<StreakColor, { color: string; colorDark: string }> = {
  dorado: { color: "#f5b301", colorDark: "#b97f00" },
  rojo: { color: "#f87171", colorDark: "#b91c1c" },
  verde: { color: "#4ade80", colorDark: "#16803c" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "yyyy-MM-dd" → número de día (para comparar consecutividad sin líos de huso horario). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Agrupa TODOS los días registrados (sin importar el año que se está mostrando, para que una
 * racha que cruza de diciembre a enero se cuente bien) en rachas consecutivas, y le asigna a cada
 * día el color según el largo de su racha. */
function streakColorsByDay(loggedDayKeys: Set<string>): Map<string, StreakColor> {
  const days = Array.from(loggedDayKeys)
    .map((iso) => ({ iso, n: dayNumber(iso) }))
    .sort((a, b) => a.n - b.n);
  const colors = new Map<string, StreakColor>();
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1].n === days[j].n + 1) j++;
    const runLength = j - i + 1;
    const color: StreakColor = runLength >= 7 ? "verde" : runLength >= 2 ? "rojo" : "dorado";
    for (let k = i; k <= j; k++) colors.set(days[k].iso, color);
    i = j + 1;
  }
  return colors;
}

/** Cono de un día completado, coloreado según `streakColorsByDay`. */
function Cone({ streakColor }: { streakColor: StreakColor }) {
  const { color, colorDark } = CONE_COLORS[streakColor];
  return (
    <svg viewBox="0 0 10 22" className="h-full max-h-[20px]" aria-hidden>
      <polygon points="5,0 5,20 0,20" fill={color} />
      <polygon points="5,0 10,20 5,20" fill={colorDark} />
    </svg>
  );
}

export function CalorieYearView({
  loggedDayKeys,
  todayISO,
  streakCurrent,
  viewIndex = 2,
  viewCount = 3,
}: {
  loggedDayKeys: Set<string>;
  todayISO: string;
  streakCurrent: number;
  viewIndex?: number;
  viewCount?: number;
}) {
  const year = Number(todayISO.slice(0, 4));
  const dayColors = streakColorsByDay(loggedDayKeys);

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
      const streakColor = dayColors.get(iso);
      const isToday = iso === todayISO;
      cells.push(
        <div key={key} className="flex items-center justify-center min-h-0">
          {streakColor ? (
            <Cone streakColor={streakColor} />
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
      <div className="relative flex items-center justify-center h-16 gap-3">
        <span
          className="text-[46px] font-black leading-none tracking-tight inline-block origin-center"
          style={{ transform: "scaleX(0.78)" }}
        >
          {year}
        </span>
        <span className="flex items-center gap-1" aria-label={`Racha actual: ${streakCurrent}`}>
          <span className="text-2xl leading-none">🔥</span>
          <span className="text-lg font-bold tabular-nums">{streakCurrent}</span>
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
