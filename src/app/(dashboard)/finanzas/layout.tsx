import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Ver comentario equivalente en gym/calorias/layout.tsx. */
export default function FinanzasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop src="/backgrounds/finanzas.webp" />
      <div className="relative">{children}</div>
    </>
  );
}
