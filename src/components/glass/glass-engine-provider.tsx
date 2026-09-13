"use client";

import { useEffect } from "react";

/**
 * Monta una sola vez el motor de vidrio (glass-engine/refraction.ts):
 * al importarlo, el singleton `refraction` hace fetch() de
 * /svg/filters.svg y lo inyecta en <body>. Este componente no
 * renderiza nada — es solo el punto donde se dispara ese
 * side-effect en el cliente, evitando que ocurra durante el SSR
 * (el import se resuelve igual en el servidor, pero refraction.ts
 * detecta `typeof document === "undefined"` y no hace nada ahí).
 *
 * Se monta una única vez en el layout raíz (ver src/app/layout.tsx)
 * para que los filtros SVG estén disponibles para cualquier
 * consumidor (BottomNav, .glass-panel) sin importar en qué página
 * se entre primero.
 */
export function GlassEngineProvider() {
  useEffect(() => {
    // Import dinámico: mantiene el fetch/inject fuera del bundle de
    // server components y garantiza que el efecto secundario del
    // módulo (crear el singleton) corre después del mount, nunca
    // durante el render de servidor.
    import("@/glass-engine/refraction").catch(() => {
      // isAvailable()/isLensAvailable() del singleton ya devuelven
      // false por defecto — cualquier consumidor cae a su fallback
      // CSS solo, sin pantalla en blanco ni error no capturado.
    });
  }, []);

  return null;
}
