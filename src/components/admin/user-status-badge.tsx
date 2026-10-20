import { GlassBadge } from "@/components/glass/glass-badge";
import type { Profile } from "@/lib/types/profile";

type StatusProfile = Pick<Profile, "is_blocked" | "access_until"> & Partial<Pick<Profile, "payment_required" | "deleted_at">>;

export type UserStatusKey = "deleted" | "blocked" | "pending" | "new" | "expired" | "active";

/**
 * Estado de una cuenta para el admin. Orden de prioridad: eliminada > bloqueada > pago en revisión > sin plan (cuenta nueva que
 * todavía no pagó ni recibió prueba) > vencida > activa. `pending` = tiene un comprobante sin revisar y hoy no tiene acceso.
 */
export function userStatus(profile: StatusProfile, hasPendingReceipt = false): { key: UserStatusKey; label: string; color: string } {
  if (profile.deleted_at) return { key: "deleted", label: "Eliminado", color: "#6b7280" };
  if (profile.is_blocked) return { key: "blocked", label: "Bloqueado", color: "#ff3b3b" };
  const expired = profile.access_until ? new Date(`${profile.access_until}T23:59:59`).getTime() < Date.now() : false;
  const noAccess = profile.payment_required === true || expired;
  if (noAccess && hasPendingReceipt) return { key: "pending", label: "Pago en revisión", color: "#f59e0b" };
  if (profile.payment_required === true) return { key: "new", label: "Sin plan", color: "#94a3b8" };
  if (expired) return { key: "expired", label: "Vencido", color: "#f59e0b" };
  return { key: "active", label: "Activo", color: "#22c55e" };
}

export function UserStatusBadge({ profile, hasPendingReceipt = false }: { profile: StatusProfile; hasPendingReceipt?: boolean }) {
  const status = userStatus(profile, hasPendingReceipt);
  return <GlassBadge color={status.color}>{status.label}</GlassBadge>;
}
