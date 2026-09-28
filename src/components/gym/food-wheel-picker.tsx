"use client";

/**
 * Rediseño de detalle de alimento: rueda para ajustar un número arrastrando el dedo (en vez del
 * slider horizontal que había antes). Dos variantes, según las fotos de referencia del usuario:
 *   - "cylinder" (gramos): perilla alta y angosta, acanalada, el número se muestra AL LADO (lo
 *     dibuja quien la usa).
 *   - "counter" (cantidad): bloque cuadrado con ranuras arriba y el número grande DENTRO, abajo.
 * Arrastrar hacia arriba aumenta, hacia abajo disminuye; funciona con decimales o como contador
 * entero según `decimals`.
 */
import { useRef } from "react";

const RIDGES = "repeating-linear-gradient(0deg, #050505 0px, #050505 2px, #232323 2px, #232323 6px)";

export function FoodWheelPicker({
  value,
  onChange,
  decimals = 0,
  min = 0,
  max,
  /** Cuántas unidades cambia el valor por pixel arrastrado — más chico = más fino. */
  sensitivity = 0.4,
  label,
  variant = "cylinder",
}: {
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  sensitivity?: number;
  label?: string;
  variant?: "cylinder" | "counter";
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
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") onChange(clamp(value + (decimals > 0 ? 0.1 : 1)));
    if (e.key === "ArrowDown") onChange(clamp(value - (decimals > 0 ? 0.1 : 1)));
  }

  if (variant === "counter") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          role="slider"
          aria-label={label}
          aria-valuenow={value}
          tabIndex={0}
          className="cursor-ns-resize touch-none select-none shrink-0 w-16 h-16 rounded-2xl flex flex-col overflow-hidden"
          style={{ background: "#151515", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), 0 3px 10px rgba(0,0,0,0.45)" }}
        >
          <div className="h-1/2 w-full" style={{ background: RIDGES }} />
          <div className="h-1/2 w-full flex items-center justify-center">
            <span className="text-lg font-bold text-white tabular-nums">{value}</span>
          </div>
        </div>
        {label && <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        tabIndex={0}
        className="cursor-ns-resize touch-none select-none shrink-0 w-9 h-24 rounded-2xl"
        style={{
          background: RIDGES,
          boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), inset 0 -3px 8px rgba(255,255,255,0.04), 0 3px 10px rgba(0,0,0,0.45)",
        }}
      />
      {label && <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>}
    </div>
  );
}
