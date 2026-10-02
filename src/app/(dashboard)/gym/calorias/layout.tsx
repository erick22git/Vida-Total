import type { ReactNode } from "react";
import { CalorieGoalCelebration } from "@/components/gym/calorie-goal-celebration";

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
