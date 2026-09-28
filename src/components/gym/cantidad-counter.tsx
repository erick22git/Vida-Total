"use client";

/**
 * Contador de Cantidad (0-9) — reemplaza a la versión con `DigitWheel` (rotateX + perspectiva 3D):
 * después de varias vueltas ese diseño seguía mostrando el número cortado/comprimido en vez de
 * grande y centrado, así que para Cantidad se cambió a algo más simple y robusto: el número ACTUAL
 * ocupa todo el cuadro en grande, y solo al cambiar de valor desliza hacia arriba/abajo (como un
 * contador de aeropuerto) — se arrastra con el dedo o se gira con la rueda del mouse, igual que
 * antes, pero sin la fragilidad del truco de las 10 caras en cilindro.
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function CantidadCounter({
  value,
  onChange,
  width = 40,
  height = 46,
  /** Píxeles de arrastre por paso — más chico = más sensible. */
  pxPerStep = 24,
}: {
  value: number;
  onChange: (next: number) => void;
  width?: number;
  height?: number;
  pxPerStep?: number;
}) {
  const drag = useRef<{ startY: number; lastWhole: number } | null>(null);
  const [dir, setDir] = useState(1);

  function commit(delta: number) {
    if (delta === 0) return;
    setDir(delta > 0 ? 1 : -1);
    onChange(Math.max(0, Math.min(9, value + delta)));
  }
  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastWhole: 0 };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY;
    const whole = Math.round(dy / pxPerStep);
    if (whole !== drag.current.lastWhole) {
      commit(whole - drag.current.lastWhole);
      drag.current.lastWhole = whole;
    }
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    commit(e.deltaY > 0 ? 1 : -1);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="slider"
      aria-label="Cantidad"
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") commit(1);
        if (e.key === "ArrowDown") commit(-1);
      }}
      className="relative rounded-2xl overflow-hidden cursor-ns-resize touch-none select-none flex items-center justify-center shrink-0"
      style={{
        width,
        height,
        background: "linear-gradient(rgb(22,22,22), rgb(40,40,40), rgb(22,22,22))",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), 0 3px 10px rgba(0,0,0,0.45)",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          initial={{ y: dir * height * 0.7, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dir * -height * 0.7, opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute font-bold text-white tabular-nums"
          style={{ fontSize: height * 0.6 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
