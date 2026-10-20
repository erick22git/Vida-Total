import type { SupabaseClient } from "@supabase/supabase-js";
import { buildModuleAccess, type ModuleAccessMap } from "@/lib/account/modules";
import { DEFAULT_PLANS, sortPlans, type SubscriptionPlan } from "@/lib/subscription-plans";

export interface PaymentSettings {
  /** Texto EXACTO decodificado del QR del banco: la fuente de verdad. Nunca se guarda ni se muestra la imagen original. */
  qrPayload: string | null;
  amountLabel: string | null;
  instructions: string | null;
  /** Planes activos (tabla `subscription_plans`, o la siembra de respaldo si la migración 0021 no está aplicada). */
  plans: SubscriptionPlan[];
}

/** Precios del esquema viejo (app_settings.payment_prices, JSON {"1":"Bs 30",…}): solo se usa como respaldo si no hay tabla de planes. */
export function parsePrices(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v.trim()) as [string, string][]);
  } catch {
    return {};
  }
}

export interface AccountExtras {
  modules: ModuleAccessMap;
  hasPendingReceipt: boolean;
  payment: PaymentSettings;
}

export const SETTING_KEYS = {
  qrPayload: "payment_qr_payload",
  amountLabel: "payment_amount_label",
  instructions: "payment_instructions",
  prices: "payment_prices", // esquema viejo; ver `parsePrices`
} as const;

/**
 * Carga lo que el layout necesita además del perfil: módulos habilitados, si hay un comprobante esperando y los datos de pago.
 * Cada consulta degrada sola: si la migración 0018 todavía no se aplicó (tabla inexistente), se usan los valores neutros y la
 * app sigue funcionando igual que antes.
 */
export async function loadAccountExtras(supabase: SupabaseClient, userId: string): Promise<AccountExtras> {
  const extras: AccountExtras = {
    modules: buildModuleAccess([]),
    hasPendingReceipt: false,
    payment: { qrPayload: null, amountLabel: null, instructions: null, plans: DEFAULT_PLANS },
  };

  try {
    const { data } = await supabase.from("user_module_access").select("module, enabled").eq("user_id", userId);
    extras.modules = buildModuleAccess(data);
  } catch (err) {
    console.error("loadAccountExtras: user_module_access:", err);
  }

  try {
    const { data, error } = await supabase
      .from("payment_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pendiente")
      .limit(1);
    if (!error) extras.hasPendingReceipt = (data ?? []).length > 0;
  } catch (err) {
    console.error("loadAccountExtras: payment_requests:", err);
  }

  try {
    const { data, error } = await supabase.from("app_settings").select("key, value").in("key", Object.values(SETTING_KEYS));
    if (!error) {
      const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value ?? null;
      extras.payment = {
        qrPayload: get(SETTING_KEYS.qrPayload),
        amountLabel: get(SETTING_KEYS.amountLabel),
        instructions: get(SETTING_KEYS.instructions),
        plans: DEFAULT_PLANS.map((p) => ({ ...p, price_label: parsePrices(get(SETTING_KEYS.prices))[String(p.months)] ?? "" })),
      };
    }
  } catch (err) {
    console.error("loadAccountExtras: app_settings:", err);
  }

  // Planes configurables del admin (migración 0021). Sin la tabla (o vacía) quedan los de respaldo con el precio viejo, si había.
  try {
    const { data, error } = await supabase.from("subscription_plans").select("id, name, months, price_label, sort_order, active").eq("active", true);
    if (!error && data && data.length > 0) extras.payment = { ...extras.payment, plans: sortPlans(data as SubscriptionPlan[]) };
  } catch (err) {
    console.error("loadAccountExtras: subscription_plans:", err);
  }

  return extras;
}
