"use client";

/**
 * Rediseño Calorías: vista AÑO de la racha, adaptada de `YearView` de Hábitos (mismo layout: una
 * columna por mes, una fila por día). Dos modos:
 * - `perfectDayKeys` SIN pasar: modo simple, idéntico a Hábitos — todo día con registro es un cono
 *   DORADO. Es el que se ve al deslizar hasta acá desde la home (vista embebida).
 * - `perfectDayKeys` pasado: modo dual, solo para la página dedicada `/gym/calorias/rachas` — cono
 *   ROJO (día con registro) vs VERDE (día perfecto, llegó a la meta). No se mezclan los dos modos
 *   en la misma pantalla.
 * Abajo, en vez de solo el año, hay un botón de racha (🔥 + contador) — Hábitos no lo tiene ahí.
 */
import { getDaysInMonth } from "date-fns";
import { ViewDots } from "@/components/habitos/view-dots";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const MONTH_LETTERS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Cono de un día completado — dorado (modo simple) o rojo/verde (modo dual, ver arriba). */
function Cone({ color, colorDark }: { color: string; colorDark: string }) {
  return (
    <svg viewBox="0 0 10 22" className="h-full max-h-[20px]" aria-hidden>
      <polygon points="5,0 5,20 0,20" fill={color} />
      <polygon points="5,0 10,20 5,20" fill={colorDark} />
    </svg>
  );
}

export function CalorieYearView({
  loggedDayKeys,
  perfectDayKeys,
  todayISO,
  streakCurrent,
  onFlameClick,
  viewIndex = 2,
  viewCount = 3,
}: {
  loggedDayKeys: Set<string>;
  /** Si se pasa, activa el modo dual (rojo/verde) — ver comentario del componente. */
  perfectDayKeys?: Set<string>;
  todayISO: string;
  streakCurrent: number;
  onFlameClick?: () => void;
  viewIndex?: number;
  viewCount?: number;
}) {
  const year = Number(todayISO.slice(0, 4));

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
      const isPerfect = !!perfectDayKeys?.has(iso);
      const isLogged = loggedDayKeys.has(iso);
      const isToday = iso === todayISO;
      cells.push(
        <div key={key} className="flex items-center justify-center min-h-0">
          {isPerfect ? (
            <Cone color="#4ade80" colorDark="#16803c" />
          ) : isLogged ? (
            perfectDayKeys ? <Cone color="#f87171" colorDark="#b91c1c" /> : <Cone color="#f5b301" colorDark="#b97f00" />
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
        <button
          onClick={onFlameClick}
          disabled={!onFlameClick}
          aria-label={`Racha actual: ${streakCurrent}`}
          className={onFlameClick ? "flex items-center gap-1 cursor-pointer" : "flex items-center gap-1"}
        >
          <span className="text-2xl leading-none">🔥</span>
          <span className="text-lg font-bold tabular-nums">{streakCurrent}</span>
        </button>
        {viewCount > 1 && (
          <div className="absolute right-1 bottom-4">
            <ViewDots index={viewIndex} count={viewCount} />
          </div>
        )}
      </div>
    </div>
  );
}
