import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/admin/audit";

/**
 * Eliminar una cuenta, en DOS pasos a propósito:
 *  1) `softDeleteAccount` (reversible): la cuenta queda bloqueada y oculta del listado, con TODOS sus datos intactos. Si
 *     entra de nuevo ve "cuenta eliminada". Es el "Eliminar" normal.
 *  2) `purgeAccount` (irreversible): solo para una cuenta que ya está en ese estado. Corre en el SERVIDOR con la service role
 *     (/api/admin/users): borra el usuario de Auth y, por las claves foráneas en cascada, todo lo suyo (comidas, entrenos,
 *     hábitos…), más sus comprobantes del almacenamiento.
 * Por qué dos pasos: un borrado real de un clic, en una cuenta con meses de datos y un pago confirmado, no tiene vuelta atrás.
 */
export async function softDeleteAccount(
  supabase: SupabaseClient,
  p: { adminId: string; userId: string; email: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), deleted_by: p.adminId, is_blocked: true })
    .eq("id", p.userId);
  if (error) return { ok: false, error: /deleted_at/i.test(error.message) ? "Falta aplicar la migración 0021 en Supabase." : error.message };
  await logAdminAction(supabase, { adminId: p.adminId, targetUserId: p.userId, action: AUDIT_ACTIONS.DELETED_ACCOUNT, details: { email: p.email } });
  return { ok: true };
}

export async function restoreAccount(
  supabase: SupabaseClient,
  p: { adminId: string; userId: string; email: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("profiles").update({ deleted_at: null, deleted_by: null, is_blocked: false }).eq("id", p.userId);
  if (error) return { ok: false, error: error.message };
  await logAdminAction(supabase, { adminId: p.adminId, targetUserId: p.userId, action: AUDIT_ACTIONS.RESTORED_ACCOUNT, details: { email: p.email } });
  return { ok: true };
}

export async function purgeAccount(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `Error ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin conexión." };
  }
}
