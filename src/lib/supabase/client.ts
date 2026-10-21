import { createBrowserClient } from "@supabase/ssr";

/** true mientras un admin está "entrando como" otra cuenta (marcador legible que pone `/auth/impersonate`). */
function isImpersonating(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)vt_impersonating_email=/.test(document.cookie);
}

/**
 * Durante una impersonación el navegador TIENE la sesión de la otra persona: cualquier escritura (anotar una comida, un
 * formulario, la sincronización de fondo de los stores…) se guardaría en SU cuenta, no en la del admin. Por eso en ese modo
 * el cliente es de SOLO LECTURA: las lecturas pasan, las escrituras a datos/almacenamiento/usuario se rechazan acá mismo.
 * (Renovar el token y cerrar sesión siguen funcionando.)
 */
const readOnlyFetch: typeof fetch = (input, init) => {
  if (!isImpersonating()) return fetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const touchesData = /\/(rest|storage)\/v1\//.test(url) || /\/auth\/v1\/user(\?|$)/.test(url);
  if (!touchesData) return fetch(input, init);
  return Promise.resolve(
    new Response(JSON.stringify({ message: "Modo solo lectura: estás viendo la cuenta de otra persona como administrador.", code: "read_only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }),
  );
};

/**
 * Cliente de Supabase para Client Components (navegador).
 * Usa la anon key pública — segura de exponer en el bundle del cliente,
 * ya que el acceso real a los datos se controla vía RLS en Supabase.
 *
 * Se puede llamar múltiples veces: `createBrowserClient` reutiliza la
 * misma instancia internamente (singleton) en el navegador.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: readOnlyFetch } },
  );
}
