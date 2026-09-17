import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Todas las pantallas de Calorías (buscar, lista, detalle de alimento,
 * configurar, escáner, progreso, recetas, etc.) comparten la misma foto de
 * fondo del módulo — antes solo la pantalla principal la tenía. Los
 * modales (GlassModal y similares) se renderizan DENTRO de cada página, no
 * como rutas propias, así que quedan fuera de este layout y no se ven
 * afectados. */
export default function CaloriasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop
        src="/backgrounds/calorias.webp"
        positionClass="object-[60%_center] md:object-[50%_center] lg:object-[50%_center]"
      />
      {/* `relative`: sin position, el contenido de cada página quedaría
      pintado debajo del PageBackdrop (fixed) sin importar el orden en el
      DOM. */}
      <div className="relative">{children}</div>
    </>
  );
}
