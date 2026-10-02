import type { ReactNode } from "react";

/** Ver comentario equivalente en gym/calorias/layout.tsx: todas las
 * pantallas de Entrenamiento (rutinas, sesión activa, planificaciones,
 * escaneo, perfil, etc.) comparten la misma foto de fondo, no solo la
 * principal. */
export default function EntrenamientoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative">{children}</div>
    </>
  );
}
