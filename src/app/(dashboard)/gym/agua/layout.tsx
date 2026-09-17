import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Ver comentario equivalente en gym/calorias/layout.tsx: todas las
 * pantallas de Agua (estadísticas, detalle de bebida) comparten la misma
 * foto de fondo, no solo la principal. */
export default function AguaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop
        src="/backgrounds/agua.webp"
        positionClass="object-[60%_40%] md:object-[55%_45%] lg:object-[50%_50%]"
      />
      <div className="relative">{children}</div>
    </>
  );
}
