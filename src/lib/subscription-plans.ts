/**
 * Planes de suscripción CONFIGURABLES (tabla `subscription_plans`, migración 0021): nombre, duración en meses, precio, orden y
 * si está activo. El admin los agrega, edita y desactiva desde /admin/pagos; no hay ninguna lista fija en el código salvo
 * `DEFAULT_PLANS`, que solo se usa mientras la migración no esté aplicada (para que la pantalla de pago siga funcionando).
 *
 * Al confirmar un pago, el vencimiento se calcula con los MESES del plan que el usuario eligió (se guardan en el comprobante,
 * `payment_requests.plan_months`), no con un número fijo de días.
 *
 * La prueba gratuita NO es un plan ni aparece nunca en la pantalla de pago: solo existe si el admin se la asigna a un usuario.
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  months: number;
  /** Texto libre que ve el usuario junto al QR, p. ej. "Bs 80". Vacío = el admin todavía no lo cargó. */
  price_label: string;
  sort_order: number;
  active: boolean;
}

/** Siembra de respaldo (mismos 4 planes que siembra la migración). Sus ids empiezan con "default-" y NO existen en la base. */
export const DEFAULT_PLANS: SubscriptionPlan[] = [
  { id: "default-1", name: "1 mes", months: 1, price_label: "", sort_order: 1, active: true },
  { id: "default-3", name: "3 meses", months: 3, price_label: "", sort_order: 2, active: true },
  { id: "default-6", name: "6 meses", months: 6, price_label: "", sort_order: 3, active: true },
  { id: "default-12", name: "1 año", months: 12, price_label: "", sort_order: 4, active: true },
];

export const isFallbackPlan = (p: Pick<SubscriptionPlan, "id">) => p.id.startsWith("default-");

export function sortPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return [...plans].sort((a, b) => a.sort_order - b.sort_order || a.months - b.months);
}
