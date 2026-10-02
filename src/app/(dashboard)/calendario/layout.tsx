import type { ReactNode } from "react";

/** Sin foto de fondo propia todavía — reutiliza la de Hábitos como
 * placeholder (ver mismo comentario en rutinas/layout.tsx). */
export default function CalendarioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative">{children}</div>
    </>
  );
}
