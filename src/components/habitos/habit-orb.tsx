"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Esfera negra con volumen (referencia: Not Boring Habits). Todo el "3D" es
 * CSS puro: un degradado radial desplazado hacia arriba simula la luz, y las
 * sombras internas/externas dan el borde y el peso. Sin imágenes ni canvas.
 *
 * Compartida entre la card del Home (`HabitOrbsCard`) y el círculo grande de
 * la pantalla del hábito (`/habitos/habito`), para que ambos se vean como el
 * mismo objeto a distinta escala.
 */
export function orbStyle(done: boolean): CSSProperties {
  return done
    ? {
        background: "radial-gradient(circle at 50% 38%, #ffffff 0%, #d9d9d9 55%, #a9a9a9 100%)",
        boxShadow:
          "inset 0 3px 8px rgba(255,255,255,0.9), inset 0 -14px 28px rgba(0,0,0,0.28), 0 10px 26px rgba(0,0,0,0.55)",
      }
    : {
        background: "radial-gradient(circle at 50% 30%, #1e1e1e 0%, #0d0d0d 55%, #050505 100%)",
        boxShadow:
          "inset 0 2px 5px rgba(255,255,255,0.10), inset 0 -14px 26px rgba(0,0,0,0.85), 0 10px 26px rgba(0,0,0,0.55)",
      };
}

export function HabitOrb({
  done = false,
  className,
  style,
  children,
}: {
  done?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-full aspect-square flex items-center justify-center ${className ?? ""}`}
      style={{ ...orbStyle(done), ...style }}
    >
      {children}
    </div>
  );
}
