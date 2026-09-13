import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la `service_role` key — privilegios de
 * administrador TOTAL, se salta TODAS las políticas de RLS. SOLO debe
 * instanciarse dentro de Route Handlers server-side (nunca en un Server
 * Component reutilizable, nunca en un Client Component, nunca exportado
 * como singleton reutilizable fuera de este archivo).
 *
 * Hoy el único consumidor es `src/app/api/admin/impersonate/route.ts`,
 * para poder generar un magic link de sesión de otro usuario vía
 * `supabase.auth.admin.generateLink(...)` (el Admin API de GoTrue
 * requiere la service_role key; no existe forma de hacer esto con la
 * anon key, ni siquiera para un usuario admin autenticado).
 *
 * No se agregó el paquete `server-only` (no estaba instalado y esta app
 * evita dependencias nuevas innecesarias) — la protección real es de
 * disciplina de import: este archivo NUNCA debe importarse desde un
 * archivo marcado `"use client"` ni desde código compartido con el
 * cliente. `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo NEXT_PUBLIC_) de
 * por sí ya es `undefined` en el bundle del navegador, así que un
 * import accidental fallaría de forma ruidosa (createAdminClient()
 * devolviendo null) antes de poder filtrar nada.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey === "TU_SERVICE_ROLE_KEY_AQUI") {
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
