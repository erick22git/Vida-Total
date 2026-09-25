"use client";

/** Los 3 puntos verticales que indican la vista del hábito (CHECK / AÑO /
 * FIGURA). Solo indicador — el cambio se hace deslizando en vertical. */
export function ViewDots({ index, count = 3 }: { index: number; count?: number }) {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-colors"
          style={{ background: i === index ? "#fff" : "rgba(255,255,255,0.35)" }}
        />
      ))}
    </div>
  );
}
