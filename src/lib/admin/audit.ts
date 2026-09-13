import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acciones de admin que escriben en `admin_audit_log`. El valor es el
 * string que se guarda literal en la columna `action` — mantenerlo en un
 * solo lugar para que `src/app/admin/auditoria/*` pueda formatear cada
 * una de forma legible sin adivinar strings mágicos.
 */
export const AUDIT_ACTIONS = {
  BLOCKED_ACCOUNT: "blocked_account",
  UNBLOCKED_ACCOUNT: "unblocked_account",
  UPDATED_ACCESS_DATES: "updated_access_dates",
  ENABLED_MODULE: "enabled_module",
  DISABLED_MODULE: "disabled_module",
  IMPERSONATED_USER: "impersonated_user",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Inserta una fila en `admin_audit_log` desde el cliente (Client
 * Component), usando el cliente de navegador de Supabase. Esto SÍ es
 * seguro sin pasar por una API route: la policy `audit_log_insert_admin`
 * (ver supabase/migrations/0001_admin_foundation.sql) exige
 * `public.is_admin() and admin_id = auth.uid()` — un usuario no-admin no
 * puede insertar nada acá aunque llame a esta función directamente, y un
 * admin no puede falsear `admin_id` a nombre de otro admin.
 *
 * Se usa `void` en las llamadas (fire-and-forget) desde los componentes
 * de UI: si la escritura de auditoría falla, no debe bloquear ni
 * revertir la acción real (bloquear/desbloquear, cambiar fechas, etc.),
 * solo se loguea a consola.
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  params: { adminId: string; targetUserId: string; action: AuditAction; details?: Record<string, unknown> },
) {
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_id: params.adminId,
    target_user_id: params.targetUserId,
    action: params.action,
    details: params.details ?? null,
  });
  if (error) {
    console.error("No se pudo registrar la acción en admin_audit_log:", error.message);
  }
}
