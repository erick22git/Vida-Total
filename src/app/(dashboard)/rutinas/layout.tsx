import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** No hay todavía una foto de fondo propia para Rutinas — se reutiliza la
 * de Hábitos como placeholder (mismo dominio conceptual) hasta que haya
 * un asset dedicado. Ver comentario equivalente en gym/calorias/layout.tsx. */
export default function RutinasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop src="/backgrounds/habitos.webp" />
      <div className="relative">{children}</div>
    </>
  );
}
