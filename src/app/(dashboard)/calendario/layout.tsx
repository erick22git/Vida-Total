import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Sin foto de fondo propia todavía — reutiliza la de Hábitos como
 * placeholder (ver mismo comentario en rutinas/layout.tsx). */
export default function CalendarioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop src="/backgrounds/habitos.webp" />
      <div className="relative">{children}</div>
    </>
  );
}
