import type { Profile } from "@/lib/types/profile";

/**
 * Estado de suscripción de una cuenta, derivado de lo que ya existe en `profiles` (0001) + si hay un comprobante esperando.
 * - activa: no está bloqueada y no pasó su `access_until` (sin `access_until` = acceso indefinido, como hasta hoy).
 * - pendiente: el acceso está cortado (vencida o bloqueada) pero el usuario ya subió un comprobante que nadie revisó.
 * - vencida: el acceso está cortado y no hay comprobante pendiente.
 * El pago se confirma A MANO por un admin: no hay pasarela, webhook ni API que lo haga solo.
 */
export type SubscriptionStatus = "activa" | "pendiente" | "vencida";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** Fecha (ISO "YYYY-MM-DD") del próximo pago = fin de la vigencia; `null` si no tiene vencimiento. */
  nextPayment: string | null;
  /** true cuando el acceso a los módulos debe estar cortado. */
  locked: boolean;
}

export function getSubscription(
  profile: Pick<Profile, "is_blocked" | "access_until" | "role">,
  hasPendingReceipt = false,
  now: Date = new Date(),
): SubscriptionInfo {
  const nextPayment = profile.access_until ?? null;
  const expired = nextPayment ? new Date(`${nextPayment}T23:59:59`).getTime() < now.getTime() : false;
  const locked = profile.is_blocked || expired;
  // Un admin nunca queda fuera de su propia app.
  if (profile.role === "admin" || !locked) return { status: "activa", nextPayment, locked: false };
  return { status: hasPendingReceipt ? "pendiente" : "vencida", nextPayment, locked: true };
}

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, { label: string; color: string }> = {
  activa: { label: "Activa", color: "#22c55e" },
  pendiente: { label: "Pago en revisión", color: "#f59e0b" },
  vencida: { label: "Vencida", color: "#ef4444" },
};

/** Nueva fecha de fin al aprobar un pago de 1 mes: parte de hoy o del vencimiento actual, lo que sea posterior. */
export function nextAccessUntil(current: string | null, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const base = current ? new Date(`${current}T00:00:00`) : today;
  const start = base.getTime() > today.getTime() ? base : today;
  const d = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Módulo (clave de `user_module_access`) al que pertenece una ruta; `null` = ruta libre (home, configuración, etc.). */
export function moduleForPath(pathname: string): "gym_calorias" | "gym_entrenamiento" | "habitos" | "outfit" | "paz_mental" | "finanzas" | "voz" | null {
  if (pathname.startsWith("/gym/calorias")) return "gym_calorias";
  if (pathname.startsWith("/gym/entrenamiento")) return "gym_entrenamiento";
  if (pathname.startsWith("/habitos")) return "habitos";
  if (pathname.startsWith("/outfit")) return "outfit";
  if (pathname.startsWith("/paz-mental")) return "paz_mental";
  if (pathname.startsWith("/finanzas")) return "finanzas";
  if (pathname.startsWith("/voz")) return "voz";
  return null;
}
