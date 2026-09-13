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
  "gym_entrenamiento",
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
 * El acceso NUNCA se corta por esto — ver
 * `src/app/(dashboard)/layout.tsx` — solo se usa para mostrar un banner.
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
