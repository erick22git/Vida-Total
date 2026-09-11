import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y la propaga tanto al
 * request (para Server Components de esa misma request) como a la
 * response (para que el navegador reciba las cookies actualizadas).
 *
 * Esto es lo que mantiene la sesión viva sin pedir login de nuevo: el
 * access token de Supabase expira cada ~1h, y `getUser()` aquí dispara el
 * refresh automático usando el refresh token (de vida mucho más larga)
 * antes de que el access token expire.
 *
 * Llamado desde `src/proxy.ts` (Next.js 16 renombró `middleware.ts` a
 * `proxy.ts`, ver ese archivo).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales reales (placeholders todavía en .env.local, ver
  // .env.local) no intentamos contactar a Supabase: dejamos pasar la
  // request tal cual, sin tocar la sesión. La verificación "fuerte" en
  // src/app/(dashboard)/layout.tsx igual redirige a /login en ese caso,
  // así que no hay riesgo de exponer el dashboard sin credenciales reales.
  const looksLikePlaceholder =
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes("TU_SUPABASE_URL_AQUI") ||
    supabaseAnonKey.includes("TU_SUPABASE_ANON_KEY_AQUI");

  if (looksLikePlaceholder) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // IMPORTANTE: no eliminar. `getUser()` revalida el token contra el
    // servidor de Supabase (a diferencia de `getSession()`, que solo lee
    // la cookie) y dispara el refresh automático cuando hace falta.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isPublicRoute = pathname === "/login" || pathname.startsWith("/auth");

    if (!user && !isPublicRoute) {
      const redirectUrl = new URL("/login", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // NOTA: la verificación "fuerte" (la que decide si se renderiza el
    // dashboard) vive en `src/app/(dashboard)/layout.tsx` vía
    // `supabase.auth.getUser()` + `redirect('/login')`. Esta redirección
    // aquí es solo una capa extra de defensa en el edge/middleware — ver
    // el aviso de Next.js sobre no confiar únicamente en Proxy para auth.

    return supabaseResponse;
  } catch (err) {
    // Supabase inalcanzable (URL inválida, red caída, etc.) — no
    // tumbamos la app: dejamos pasar la request y confiamos en la
    // verificación server-side del layout del dashboard.
    console.error("Supabase proxy: fallo al refrescar sesión:", err);
    return supabaseResponse;
  }
}
