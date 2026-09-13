import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";

/**
 * Re-verifica en el servidor (nunca confiando en nada que mande el
 * cliente) que quien hace la request está logueado Y es admin, leyendo
 * `profiles.role` con el cliente de servidor (cookies de sesión reales).
 *
 * Usado tanto por `src/app/admin/layout.tsx` (para el redirect) como por
 * CADA Route Handler bajo `src/app/api/admin/*` — un layout de Next.js
 * NO protege una API route contra requests directas, así que cada
 * endpoint debe repetir este chequeo por su cuenta.
 */
export async function requireAdmin(): Promise<
  { ok: true; userId: string; profile: Profile } | { ok: false; reason: "no_session" | "not_admin" }
> {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return { ok: false, reason: "no_session" };
  }

  if (!userId) {
    return { ok: false, reason: "no_session" };
  }

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error || !profile || (profile as Profile).role !== "admin") {
    return { ok: false, reason: "not_admin" };
  }

  return { ok: true, userId, profile: profile as Profile };
}
