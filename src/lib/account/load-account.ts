import type { SupabaseClient } from "@supabase/supabase-js";
import { buildModuleAccess, type ModuleAccessMap } from "@/lib/account/modules";

export interface PaymentSettings {
  /** Texto EXACTO decodificado del QR del banco: la fuente de verdad. Nunca se guarda ni se muestra la imagen original. */
  qrPayload: string | null;
  amountLabel: string | null;
  instructions: string | null;
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
    payment: { qrPayload: null, amountLabel: null, instructions: null },
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
      };
    }
  } catch (err) {
    console.error("loadAccountExtras: app_settings:", err);
  }

  return extras;
}
