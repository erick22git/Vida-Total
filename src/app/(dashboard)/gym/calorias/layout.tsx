import type { ReactNode } from "react";
import type { Viewport } from "next";
import { CalorieGoalCelebration } from "@/components/gym/calorie-goal-celebration";

/** Chrome/Android: con el teclado abierto el layout se achica (en vez de taparse), así el carrusel de Buscar queda
 * por encima. Safari no lo soporta: ahí lo cubre `useKeyboardInset` (visualViewport). Sin `maximumScale` ni
 * `userScalable`: el zoom del usuario nunca se bloquea. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

/** Todas las pantallas de Calorías (buscar, lista, detalle de alimento,
 * configurar, escáner, progreso, recetas, etc.) comparten el fondo global
 * de la app (textura oscura / blanca, ver --app-bg en globals.css). Los
 * modales (GlassModal y similares) se renderizan DENTRO de cada página, no
 * como rutas propias, así que quedan fuera de este layout y no se ven
 * afectados. */
export default function CaloriasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative">{children}</div>
      {/* Confeti + felicitación al cruzar la meta (evento calories.goal_reached, una vez por día). */}
      <CalorieGoalCelebration />
    </>
  );
}
