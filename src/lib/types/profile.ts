/**
 * Tipos TypeScript para las tablas base de administración, definidas en
 * `supabase/migrations/0001_admin_foundation.sql`. Este archivo es la
 * base que usará un trabajo POSTERIOR para construir el panel de
 * administrador — hoy solo se consume desde
 * `src/app/(dashboard)/layout.tsx` para el chequeo de bloqueo/vigencia
 * de la cuenta.
 */

export type UserRole = "user" | "admin";

/** Debe coincidir exactamente con el CHECK de `user_module_access.module`
 * en la migración SQL. */
export const MODULE_KEYS = [
  "gym_calorias",
  "gym_agua",
  "gym_entrenamiento",
  "gym_kegel",
  "habitos",
  "outfit",
  "paz_mental",
  "finanzas",
  "voz",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  /** Fecha desde la que la cuenta tiene acceso (ISO date, "YYYY-MM-DD"). */
  access_from: string;
  /** Fecha hasta la que la cuenta tiene acceso; `null` = acceso indefinido. */
  access_until: string | null;
  is_blocked: boolean;
  created_at: string;
  /** Migración 0018. `undefined` = la migración todavía no se aplicó: se trata como «ya hecho» (no se fuerza nada). */
  onboarding_done?: boolean;
  tutorial_seen?: boolean;
  /** Migración 0019. `undefined`/`null` = sin migración o cuenta anterior a este cambio. */
  username?: string | null;
  /** Migración 0020. `undefined` = la migración todavía no se aplicó. 0 también puede significar
   * "nunca contado" en una cuenta que ya existía antes de este contador. */
  login_count?: number;
  last_login_at?: string | null;
  /** Migración 0021. `true` = cuenta nueva que todavía no pagó ni recibió prueba gratuita (ve la pantalla de pago).
   * `undefined` = la migración no se aplicó: se trata como "no exige pago" (nunca se corta a nadie por una columna que no existe). */
  payment_required?: boolean;
  /** Soft-delete (migración 0021): cuenta eliminada por el admin, bloqueada y oculta del listado, con los datos intactos. */
  deleted_at?: string | null;
  /** Cómo la llama la mascota (onboarding). */
  display_name?: string | null;
  phone?: string | null;
}

export interface UserModuleAccess {
  user_id: string;
  module: ModuleKey;
  enabled: boolean;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string | null;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Resultado de evaluar si una cuenta tiene algún aviso pendiente
 * (bloqueada manualmente por un admin, o con `access_until` vencido).
 * Un aviso (banner) se sigue usando para cuentas no vencidas pero con aviso; el CORTE de acceso por suscripción vencida lo
 * decide `src/lib/subscription.ts` y lo aplica `src/app/(dashboard)/layout.tsx`.
 */
export interface AccountNotice {
  reason: "blocked" | "expired";
  message: string;
}

export function getAccountNotice(profile: Pick<Profile, "is_blocked" | "access_until">): AccountNotice | null {
  if (profile.is_blocked) {
    return {
      reason: "blocked",
      message: "Tu cuenta tiene un pago pendiente. Contacta al administrador para regularizar el acceso.",
    };
  }
  if (profile.access_until) {
    const vencimiento = new Date(`${profile.access_until}T23:59:59`);
    if (vencimiento.getTime() < Date.now()) {
      return {
        reason: "expired",
        message: `Tu acceso venció el ${profile.access_until}. Contacta al administrador para renovarlo.`,
      };
    }
  }
  return null;
}
