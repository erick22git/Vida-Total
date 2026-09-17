import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Ver comentario equivalente en gym/calorias/layout.tsx: todas las
 * pantallas de Entrenamiento (rutinas, sesión activa, planificaciones,
 * escaneo, perfil, etc.) comparten la misma foto de fondo, no solo la
 * principal. */
export default function EntrenamientoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop
        src="/backgrounds/entrenamiento.webp"
        positionClass="object-[50%_70%] md:object-[50%_60%] lg:object-[50%_50%]"
      />
      <div className="relative">{children}</div>
    </>
  );
}
