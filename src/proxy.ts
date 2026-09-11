import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// NOTA: en Next.js 16 el archivo `middleware.ts` fue renombrado a
// `proxy.ts` (y la función exportada de `middleware` a `proxy`) — ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Este archivo reemplaza al `middleware.ts` clásico de Supabase SSR.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - archivos con extensión (imágenes, fuentes, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
