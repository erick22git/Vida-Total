"use client";

import { useMemo } from "react";
import { DAY_MIN, durationLabel, durationShort, timeRange } from "@/lib/agenda/time";
import { WheelPicker } from "./wheel-picker";
import { CARD, RoundButton } from "./sheet";
import { Ellipsis } from "lucide-react";

/** Rueda de hora: cada fila es "inicio–fin" con la duración actual (como en la captura). */
export function TimeWheel({ startMin, durationMin, step, onChange }: { startMin: number; durationMin: number; step: number; onChange: (startMin: number) => void }) {
  const items = useMemo(() => {
    const list: { value: number; label: string }[] = [];
    for (let m = 0; m < DAY_MIN; m += step) list.push({ value: m, label: timeRange(m, durationMin) });
    return list;
  }, [step, durationMin]);
  // La hora guardada se ajusta al paso de la rueda para que coincida con una fila.
  const snapped = Math.round(startMin / step) * step;
  return (
    <div className="rounded-[26px] py-1" style={{ background: "rgba(255,255,255,0.04)" }}>
      <WheelPicker items={items} value={Math.min(snapped, DAY_MIN - step)} onChange={onChange} itemHeight={42} rows={5} ariaLabel="Hora de inicio" />
    </div>
  );
}

/** Segmentos de duración rápida: el elegido lleva la etiqueta completa ("15 min"), el resto solo el número. */
export function DurationSegments({ presets, value, onChange }: { presets: number[]; value: number; onChange: (min: number) => void }) {
  const list = presets.includes(value) ? presets : [...presets, value].sort((a, b) => a - b);
  return (
    <div className="flex items-center rounded-full p-1.5 overflow-x-auto [scrollbar-width:none]" style={{ background: "rgba(255,255,255,0.06)" }} role="radiogroup" aria-label="Duración">
      {list.map((p) => {
        const sel = p === value;
        return (
          <button
            key={p}
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(p)}
            className="flex-1 min-w-fit h-11 px-3.5 rounded-full text-[16px] font-bold whitespace-nowrap cursor-pointer transition-colors"
            style={{ background: sel ? "#fff" : "transparent", color: sel ? "#111" : "rgba(255,255,255,0.55)" }}
          >
            {sel ? durationLabel(p) : durationShort(p)}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, onMore, moreLabel }: { children: string; onMore?: () => void; moreLabel?: string }) {
  return (
    <div className="flex items-center justify-between mt-6 mb-3 px-1">
      <h3 className="text-[22px] font-extrabold tracking-tight">{children}</h3>
      {onMore && (
        <RoundButton label={moreLabel ?? "Más opciones"} size={36} onClick={onMore}>
          <Ellipsis size={18} />
        </RoundButton>
      )}
    </div>
  );
}

/** Bloque "Tiempo" + "Duración" reutilizable (creación paso 1 y hoja de tiempo). */
export function TimeAndDuration({
  startMin, durationMin, step, presets, onStart, onDuration, onTimeMore, onDurationMore,
}: {
  startMin: number; durationMin: number; step: number; presets: number[];
  onStart: (m: number) => void; onDuration: (m: number) => void; onTimeMore?: () => void; onDurationMore?: () => void;
}) {
  return (
    <div style={{ color: "#fff" }}>
      <SectionTitle onMore={onTimeMore} moreLabel="Opciones de tiempo">Tiempo</SectionTitle>
      <TimeWheel startMin={startMin} durationMin={durationMin} step={step} onChange={onStart} />
      <SectionTitle onMore={onDurationMore} moreLabel="Opciones de duración">Duración</SectionTitle>
      <DurationSegments presets={presets} value={durationMin} onChange={onDuration} />
    </div>
  );
}

export { CARD };
