"use client";

/**
 * Check 3D negro que aparece sobre la esfera blanca cuando el hábito está
 * completado (referencia: Not Boring Habits, hábito completado). Es un SVG
 * con la forma "extruida": se apilan copias desplazadas y oscuras detrás de
 * la cara frontal, que da el grosor sin necesidad de canvas/WebGL.
 */
const CHECK_POINTS = "14,54 28,40 42,54 74,22 88,36 42,82";
const DEPTH_LAYERS = 9;

export function BigCheck({ size = 150 }: { size?: number }) {
  // ANIMATION_POINT: big-check-complete
  // Acá va la animación de entrada del check al completar el hábito
  // (escala/rotación/trazo). Hoy aparece de golpe: cuando definamos la
  // animación se envuelve este <svg> (framer-motion) o se dispara desde el
  // Animation Engine con el evento `habit.completed` — el resto de la
  // pantalla no necesita cambios.
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{ transform: "rotate(-8deg)", filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.35))" }}
    >
      {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
        const d = DEPTH_LAYERS - i;
        return (
          <polygon
            key={d}
            points={CHECK_POINTS}
            fill={d > DEPTH_LAYERS - 2 ? "#000" : "#0c0c0c"}
            transform={`translate(${d * 0.55} ${d * 0.85})`}
          />
        );
      })}
      <polygon points={CHECK_POINTS} fill="#272727" />
      <polygon points="14,54 28,40 42,54 42,58 28,44 14,58" fill="rgba(255,255,255,0.10)" />
    </svg>
  );
}
