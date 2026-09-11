import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server
 * Actions. Lee/escribe las cookies de sesión vía `next/headers` para que
 * la sesión persista correctamente entre requests (server-side).
 *
 * IMPORTANTE: `cookies()` es async en este proyecto (Next.js 16 / App
 * Router), así que este helper también es async — debe usarse con
 * `await createClient()`.
 *
 * `cookieStore.set` solo puede llamarse desde un Server Action o un Route
 * Handler. Si este cliente se usa dentro de un Server Component (p.ej. un
 * layout), `set` lanzará un error al intentar refrescar la sesión — por
 * eso el try/catch: el middleware (`src/proxy.ts`) ya se encarga de
 * refrescar la sesión en cada request, así que aquí simplemente lo
 * ignoramos si falla.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` fue llamado desde un Server Component (no desde un
            // Route Handler ni un Server Action). Se puede ignorar si hay
            // un middleware (src/proxy.ts) refrescando la sesión de
            // usuario en cada request.
          }
        },
      },
    },
  );
}
