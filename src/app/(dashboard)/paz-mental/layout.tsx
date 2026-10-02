import type { ReactNode } from "react";

/** Ver comentario equivalente en gym/calorias/layout.tsx. */
export default function PazMentalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative">{children}</div>
    </>
  );
}
