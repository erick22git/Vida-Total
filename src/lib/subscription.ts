import type { Profile } from "@/lib/types/profile";

/**
 * Estado de suscripción de una cuenta, derivado de lo que ya existe en `profiles` (0001) + si hay un comprobante esperando.
 * - activa: no está bloqueada y no pasó su `access_until` (sin `access_until` = acceso indefinido, como hasta hoy).
 * - pendiente: el acceso está cortado (vencida o bloqueada) pero el usuario ya subió un comprobante que nadie revisó.
 * - vencida: el acceso está cortado y no hay comprobante pendiente.
 * El pago se confirma A MANO por un admin: no hay pasarela, webhook ni API que lo haga solo.
 */
export type SubscriptionStatus = "activa" | "pendiente" | "vencida" | "sin_plan";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** Fecha (ISO "YYYY-MM-DD") del próximo pago = fin de la vigencia; `null` si no tiene vencimiento. */
  nextPayment: string | null;
  /** true cuando el acceso a los módulos debe estar cortado. */
  locked: boolean;
}

export function getSubscription(
  profile: Pick<Profile, "is_blocked" | "access_until" | "role"> & Partial<Pick<Profile, "payment_required" | "deleted_at">>,
  hasPendingReceipt = false,
  now: Date = new Date(),
): SubscriptionInfo {
  const nextPayment = profile.access_until ?? null;
  const expired = nextPayment ? new Date(`${nextPayment}T23:59:59`).getTime() < now.getTime() : false;
  // Cuenta nueva que todavía no pagó ni recibió prueba gratuita: no entra a nada hasta que el admin lo confirme.
  const neverPaid = profile.payment_required === true;
  const locked = profile.is_blocked || expired || neverPaid || !!profile.deleted_at;
  // Un admin nunca queda fuera de su propia app.
  if (profile.role === "admin" || !locked) return { status: "activa", nextPayment, locked: false };
  if (hasPendingReceipt) return { status: "pendiente", nextPayment, locked: true };
  return { status: neverPaid && !expired && !profile.is_blocked ? "sin_plan" : "vencida", nextPayment, locked: true };
}

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, { label: string; color: string }> = {
  activa: { label: "Activa", color: "#22c55e" },
  pendiente: { label: "Pago en revisión", color: "#f59e0b" },
  vencida: { label: "Vencida", color: "#ef4444" },
  sin_plan: { label: "Sin plan (nuevo)", color: "#94a3b8" },
};

/** Nueva fecha de fin al aprobar un pago de 1 mes: parte de hoy o del vencimiento actual, lo que sea posterior. */
export function nextAccessUntil(current: string | null, now: Date = new Date(), months = 1): string {
  return extendAccessUntil(current, months, "meses", now);
}

/** Suma `amount` días o meses a hoy o al vencimiento actual (lo que sea posterior). Sirve para pagos de varios meses y pruebas gratuitas. */
export function extendAccessUntil(current: string | null, amount: number, unit: "dias" | "meses", now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const base = current ? new Date(`${current}T00:00:00`) : today;
  const start = base.getTime() > today.getTime() ? base : today;
  const d =
    unit === "meses"
      ? new Date(start.getFullYear(), start.getMonth() + amount, start.getDate())
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + amount);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export { moduleForPath } from "@/lib/account/module-catalog";
