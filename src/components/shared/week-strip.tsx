"use client";

/**
 * Franja de los últimos 7 días (el último es HOY, subrayado en ámbar) con los puntos verticales a
 * la derecha que indican la vista actual. Es EL diseño de Hábitos, compartido: Hábitos, Calorías,
 * Kegel, Entrenamiento y Agua la usan para verse exactamente igual (mismo tamaño, mismas medidas).
 * `onSelectDate` es opcional: si se pasa, cada día es tocable y el seleccionado lleva un aro.
 */
import { addDays, format, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { ViewDots } from "@/components/habitos/view-dots";

const WEEKDAY = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

export function WeekStrip({
  doneKeys,
  todayISO,
  selectedDate,
  onSelectDate,
  viewIndex = 0,
  viewCount = 3,
}: {
  /** Días ("yyyy-MM-dd") que van con check blanco. */
  doneKeys: Set<string> | string[];
  todayISO: string;
  selectedDate?: Date;
  onSelectDate?: (d: Date) => void;
  viewIndex?: number;
  /** 0 = sin puntos (la pantalla tiene una sola vista); se reserva el espacio igual para que los días midan lo mismo. */
  viewCount?: number;
}) {
  const today = new Date(`${todayISO}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const isDone = (iso: string) => (Array.isArray(doneKeys) ? doneKeys.includes(iso) : doneKeys.has(iso));

  return (
    <div className="flex items-start gap-1 px-4">
      <div className="flex flex-1 justify-between">
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const done = isDone(iso);
          const isToday = iso === todayISO;
          const selected = !!selectedDate && isSameDay(d, selectedDate);
          const Tag = onSelectDate ? "button" : "div";
          return (
            <Tag
              key={iso}
              {...(onSelectDate ? { onClick: () => onSelectDate(d), "aria-label": format(d, "d 'de' MMMM") } : {})}
              className={`flex flex-col items-center gap-2 w-[13.5%] ${onSelectDate ? "cursor-pointer" : ""}`}
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
                <span className="h-[2px] w-6 rounded-full" style={{ background: isToday ? "#f5a800" : "transparent" }} />
              </div>
            </Tag>
          );
        })}
      </div>
      <div className={`pt-2 pl-1 shrink-0 ${viewCount > 0 ? "" : "invisible"}`}>
        <ViewDots index={viewIndex} count={viewCount > 0 ? viewCount : 1} />
      </div>
    </div>
  );
}
