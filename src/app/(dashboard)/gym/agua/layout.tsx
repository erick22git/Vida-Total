import type { ReactNode } from "react";

/** Ver comentario equivalente en gym/calorias/layout.tsx: todas las
 * pantallas de Agua (estadísticas, detalle de bebida) comparten la misma
 * foto de fondo, no solo la principal. */
export default function AguaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative">{children}</div>
    </>
  );
}
