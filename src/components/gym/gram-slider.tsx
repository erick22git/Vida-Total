"use client";

/**
 * Barra para ajustar la porción en gramos (rediseño Calorías, etapa 3 — reemplaza los botones
 * "Cantidad"/"Porción" con teclado numérico modal por esto: todo en la misma pantalla, sin abrir nada,
 * con decimales exactos). Marcas cada 20 g arriba; el valor exacto se ve grande al costado.
 *
 * Es un <input type="range"> nativo (no un gesto custom) a propósito: en un WIP sin fotos de referencia
 * todavía, un control nativo es preciso, accesible y funciona igual en mouse/touch — el aspecto final se
 * ajusta cuando lleguen las fotos, sin tocar la mecánica.
 */
import { useMemo } from "react";

export function GramSlider({
  gramos,
  onChange,
  min = 0,
}: {
  gramos: number;
  onChange: (g: number) => void;
  min?: number;
}) {
  const max = useMemo(() => Math.max(300, Math.ceil((gramos + 60) / 100) * 100), [gramos]);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = min; t <= max; t += 20) out.push(t);
    return out;
  }, [min, max]);
  const pct = max > min ? ((Math.min(max, Math.max(min, gramos)) - min) / (max - min)) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between px-0.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/40">Gramos</span>
        <span className="text-xl font-bold text-white tabular-nums">
          {Math.round(gramos * 10) / 10}
          <span className="text-xs font-normal text-white/40 ml-0.5">g</span>
        </span>
      </div>

      <div className="relative pt-1">
        {/* marcas cada 20 g, con el número — se ven finitas, es lo pedido; el look final se ajusta con fotos */}
        <div className="relative h-3 select-none">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[8px] text-white/30 tabular-nums"
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={gramos}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="w-full accent-white"
          style={{ height: 28 }}
          aria-label="Gramos de la porción"
        />
        {/* marcas cada 20 g sobre la barra */}
        <div className="absolute left-0 right-0 top-[38px] h-2 pointer-events-none">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute w-px bg-white/15"
              style={{ left: `${((t - min) / (max - min)) * 100}%`, height: t % 100 === 0 ? 8 : 4 }}
            />
          ))}
        </div>
      </div>
      <div className="h-0.5 w-full rounded-full bg-white/[0.08] overflow-hidden -mt-1">
        <div className="h-full bg-white/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
