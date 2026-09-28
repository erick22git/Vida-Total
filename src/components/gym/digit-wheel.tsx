"use client";

/**
 * Rueda de dígitos 3D — puerto del código HTML/CSS/JS que pasó el usuario (una rueda física con
 * caras dispuestas en cilindro vía `rotateX`, se gira arrastrando el dedo o con la rueda del mouse).
 * Dos modos, según quién la use:
 *   - `wrap={false}` (Cantidad): caras 0-9 con tope duro en los extremos, como en el original — el
 *     valor que "mira al frente" es real y se refleja en `index`/`onIndexChange` (estado del padre).
 *   - `wrap={true}` (Gramos): caras en blanco (`faces` vacío) que giran SIN límite — folución sigue
 *     acumulando internamente aunque se suelte y se vuelva a agarrar (como el `wheelMoves` del
 *     código original, que nunca se resetea), para que no "salte" a la posición de reposo entre un
 *     arrastre y el siguiente. No representa un valor propio: solo avisa "avancé/retrocedí" vía
 *     `onStep`; quien la usa decide cuánto vale cada paso.
 */
import { useRef, useState } from "react";
import styles from "./digit-wheel.module.css";

export function DigitWheel({
  faces,
  index = 0,
  onIndexChange,
  onStep,
  wrap = false,
  width = 96,
  height = 96,
  /** Píxeles de arrastre por paso — más chico = gira más rápido/sensible. */
  pxPerStep = 26,
  label,
}: {
  /** Contenido de cada cara, en orden. Vacío (`[]`) = caras en blanco (modo `wrap`, gramos). */
  faces?: React.ReactNode[];
  index?: number;
  onIndexChange?: (next: number) => void;
  onStep?: (deltaSteps: number) => void;
  wrap?: boolean;
  width?: number;
  height?: number;
  pxPerStep?: number;
  label?: string;
}) {
  const faceCount = faces && faces.length > 0 ? faces.length : 12;
  const anglePerFace = 360 / faceCount;
  const drag = useRef<{ startY: number; lastWhole: number } | null>(null);
  const [liveFrac, setLiveFrac] = useState(0);
  // Solo para wrap=true: rotación acumulada que NUNCA se resetea entre gestos (mismo espíritu que
  // el `wheelMoves` del código original) — así el tambor sigue girando en vez de "saltar" a 0 cada
  // vez que se suelta el dedo.
  const [spin, setSpin] = useState(0);

  function applyWholeSteps(steps: number) {
    if (steps === 0) return;
    if (wrap) {
      setSpin((s) => s + steps);
      onStep?.(steps);
    } else {
      onIndexChange?.(Math.max(0, Math.min(faceCount - 1, index + steps)));
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastWhole: 0 };
    setLiveFrac(0);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY; // arrastrar hacia arriba = avanzar
    const steps = dy / pxPerStep;
    const whole = Math.round(steps);
    if (whole !== drag.current.lastWhole) {
      applyWholeSteps(whole - drag.current.lastWhole);
      drag.current.lastWhole = whole;
    }
    setLiveFrac(steps - whole);
  }
  function onPointerUp() {
    drag.current = null;
    setLiveFrac(0);
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    applyWholeSteps(e.deltaY > 0 ? 1 : -1);
  }

  const baseIndex = wrap ? spin : index;
  const liveIndex = baseIndex + liveFrac;

  return (
    <div
      className={styles.flexDigits}
      style={{ ["--wheel-w" as string]: `${width}px`, ["--wheel-h" as string]: `${height}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="slider"
      aria-label={label}
      aria-valuenow={wrap ? undefined : index}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") applyWholeSteps(1);
        if (e.key === "ArrowDown") applyWholeSteps(-1);
      }}
    >
      <div className={styles.digits}>
        {Array.from({ length: faceCount }, (_, i) => {
          const angle = (i - liveIndex) * anglePerFace;
          return (
            <div key={i} className={styles.digit} style={{ transform: `rotateX(${angle}deg)` }}>
              {faces?.[i] ?? ""}
            </div>
          );
        })}
      </div>
      {label && (
        <span className="sr-only" aria-hidden>
          {label}
        </span>
      )}
    </div>
  );
}
