import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";

/** Ver comentario equivalente en gym/calorias/layout.tsx. */
export default function VozLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageBackdrop src="/backgrounds/voz.webp" />
      <div className="relative">{children}</div>
    </>
  );
}
