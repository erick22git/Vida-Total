import { createBrowserClient } from "@supabase/ssr";

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
  );
}
