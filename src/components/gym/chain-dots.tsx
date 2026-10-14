"use client";

import { useRouter } from "next/navigation";

/**
 * Indicador vertical de posición en la cadena de swipe vertical de Entrenamiento (Hoy/Año/Rango/
 * Coach), para Rango y Coach — que son páginas separadas y no pueden reusar el `ViewDots` que ya
 * usan Hoy/Año a través de `WeekStrip`/`CalorieYearView` (ambos vía un prop, no una ruta). Mismo
 * estilo visual (columna vertical, puntos de 6px) para que las 4 pantallas se vean como una sola
 * cadena continua, posicionado al lado derecho igual que `ViewDots` en Calorías/Hábitos. A diferencia
 * de `ViewDots` (solo indicador), estos puntos SÍ navegan al tocarlos — el gesto de swipe vertical no
 * es confiable en todos los dispositivos (reportado por el usuario), así que cada punto es también un
 * atajo directo a esa pantalla.
 */
const CHAIN = [
  { href: "/gym/entrenamiento", label: "Hoy" },
  { href: "/gym/entrenamiento?view=1", label: "Año" },
  { href: "/gym/entrenamiento/rango", label: "Rango" },
  { href: "/gym/entrenamiento/coach", label: "Coach" },
] as const;

export function ChainDots({ current }: { current: number }) {
  const router = useRouter();
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
      {CHAIN.map((item, i) => (
        <button
          key={item.href}
          type="button"
          aria-label={i === current ? `Ya estás en ${item.label}` : `Ir a ${item.label}`}
          disabled={i === current}
          onClick={() => router.push(item.href)}
          className="p-1.5 -m-1.5 cursor-pointer disabled:cursor-default"
        >
          <span
            className="block w-1.5 h-1.5 rounded-full transition-colors"
            style={{ background: i === current ? "#fff" : "rgba(255,255,255,0.35)" }}
          />
        </button>
      ))}
    </div>
  );
}
