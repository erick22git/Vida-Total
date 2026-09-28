"use client";

/**
 * Rediseño de detalle de alimento: rueda vertical para ajustar un número arrastrando el dedo (en vez
 * del slider horizontal que había antes) — referencia visual: una perilla acanalada, como la de un
 * dial físico. Arrastrar hacia arriba aumenta, hacia abajo disminuye; funciona con decimales o como
 * contador entero según `decimals`. El número en sí NO se dibuja acá — el que la usa lo muestra al
 * lado (así lo pidió el usuario: "a su lado hay un número").
 */
import { useRef } from "react";

export function FoodWheelPicker({
  value,
  onChange,
  decimals = 0,
  min = 0,
  max,
  /** Cuántas unidades cambia el valor por pixel arrastrado — más chico = más fino. */
  sensitivity = 0.4,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  sensitivity?: number;
  label?: string;
}) {
  const drag = useRef<{ startY: number; startValue: number } | null>(null);

  function clamp(v: number) {
    const factor = 10 ** decimals;
    let rounded = Math.round(v * factor) / factor;
    if (rounded < min) rounded = min;
    if (max !== undefined && rounded > max) rounded = max;
    return rounded;
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startValue: value };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY; // arrastrar hacia arriba = subir
    onChange(clamp(drag.current.startValue + dy * sensitivity));
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onChange(clamp(value + (decimals > 0 ? 0.1 : 1)));
          if (e.key === "ArrowDown") onChange(clamp(value - (decimals > 0 ? 0.1 : 1)));
        }}
        className="w-9 h-20 rounded-2xl cursor-ns-resize touch-none select-none shrink-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, #050505 0px, #050505 2px, #232323 2px, #232323 6px)",
          boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), inset 0 -3px 8px rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.4)",
        }}
      />
      {label && <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>}
    </div>
  );
}
