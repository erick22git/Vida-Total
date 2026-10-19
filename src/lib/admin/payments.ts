import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/admin/audit";
import { SETTING_KEYS } from "@/lib/account/load-account";
import { extendAccessUntil } from "@/lib/subscription";

function fmtAccessDate(iso: string) {
  try {
    return format(new Date(`${iso}T00:00:00`), "d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}

/** Avisa al USUARIO (no al admin) que su acceso se extendió — se ve en la Isla Dinámica la próxima vez
 * que abra la app (mismo camino que los avisos de admin, `agent_notification_log`, migración 0020: si
 * la tabla o la policy de insert para admin todavía no existen, esto falla solo y no rompe nada; el
 * cambio de `access_until` ya se guardó antes de llamar esto). */
async function notifyUserAccessGranted(supabase: SupabaseClient, p: { userId: string; accessUntil: string; title: string; body: string }) {
  try {
    await supabase.from("agent_notification_log").insert({
      user_id: p.userId,
      key: `trial_${p.userId}_${p.accessUntil}`,
      kind: "trial_granted",
      title: p.title,
      body: p.body,
      payload: {},
    });
  } catch {
    /* migración 0020 sin aplicar, o la tabla 0015 no existe: el usuario no se entera por acá, pero su acceso ya quedó extendido */
  }
}

/**
 * Operaciones de pago que corren en el navegador con la sesión del admin (las policies RLS de la migración 0018 son la barrera
 * real: un usuario que no es admin no puede ejecutar ninguna de estas escrituras aunque llame esta función).
 *
 * EL PAGO SE CONFIRMA A MANO. El QR es de una transferencia bancaria: no hay webhook ni API que avise cuando llega el dinero.
 * Estas funciones solo registran la decisión del admin.
 */

export interface PaymentRequestRow {
  id: string;
  user_id: string;
  receipt_path: string | null;
  note: string | null;
  status: "pendiente" | "aprobado" | "rechazado";
  created_at: string;
  reviewed_at: string | null;
}

export async function approvePayment(
  supabase: SupabaseClient,
  p: { adminId: string; request: PaymentRequestRow | null; userId: string; email: string | null; currentAccessUntil: string | null; months?: number },
): Promise<{ ok: true; accessUntil: string } | { ok: false; error: string }> {
  const accessUntil = extendAccessUntil(p.currentAccessUntil, p.months ?? 1, "meses");
  const { error } = await supabase.from("profiles").update({ access_until: accessUntil, is_blocked: false }).eq("id", p.userId);
  if (error) return { ok: false, error: error.message };
  if (p.request) {
    const { error: reqError } = await supabase
      .from("payment_requests")
      .update({ status: "aprobado", reviewed_by: p.adminId, reviewed_at: new Date().toISOString() })
      .eq("id", p.request.id);
    if (reqError) console.error("approvePayment: no se pudo cerrar el comprobante:", reqError.message);
  }
  await logAdminAction(supabase, {
    adminId: p.adminId,
    targetUserId: p.userId,
    action: AUDIT_ACTIONS.APPROVED_PAYMENT,
    details: { email: p.email, before: { access_until: p.currentAccessUntil }, after: { access_until: accessUntil }, requestId: p.request?.id ?? null, months: p.months ?? 1 },
  });
  void notifyUserAccessGranted(supabase, {
    userId: p.userId,
    accessUntil,
    title: "Pago confirmado",
    body: `Tu pago quedó confirmado. Tenés acceso hasta el ${fmtAccessDate(accessUntil)}.`,
  });
  return { ok: true, accessUntil };
}

export async function rejectPayment(
  supabase: SupabaseClient,
  p: { adminId: string; request: PaymentRequestRow; email: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("payment_requests")
    .update({ status: "rechazado", reviewed_by: p.adminId, reviewed_at: new Date().toISOString() })
    .eq("id", p.request.id);
  if (error) return { ok: false, error: error.message };
  await logAdminAction(supabase, {
    adminId: p.adminId,
    targetUserId: p.request.user_id,
    action: AUDIT_ACTIONS.REJECTED_PAYMENT,
    details: { email: p.email, requestId: p.request.id },
  });
  return { ok: true };
}

export async function saveAppSetting(supabase: SupabaseClient, adminId: string, key: string, value: string | null) {
  return supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: adminId }, { onConflict: "key" });
}

export async function saveQrPayload(supabase: SupabaseClient, adminId: string, payload: string) {
  const res = await saveAppSetting(supabase, adminId, SETTING_KEYS.qrPayload, payload);
  if (!res.error) {
    await logAdminAction(supabase, {
      adminId,
      targetUserId: adminId,
      action: AUDIT_ACTIONS.UPDATED_PAYMENT_QR,
      details: { length: payload.length },
    });
  }
  return res;
}

/** Sube el comprobante del usuario al bucket privado y registra la solicitud como «pendiente». */
export async function submitReceipt(
  supabase: SupabaseClient,
  p: { userId: string; file: File | null; note: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  let receiptPath: string | null = null;
  if (p.file) {
    const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    receiptPath = `${p.userId}/${Date.now()}-${safe}`;
    const { error: upError } = await supabase.storage.from("comprobantes").upload(receiptPath, p.file, { contentType: p.file.type || undefined });
    if (upError) return { ok: false, error: upError.message };
  }
  const { error } = await supabase
    .from("payment_requests")
    .insert({ user_id: p.userId, receipt_path: receiptPath, note: p.note.trim() || null, status: "pendiente" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Prueba gratuita o extensión manual: suma días/meses al acceso del usuario y lo desbloquea. */
export async function grantAccess(
  supabase: SupabaseClient,
  p: { adminId: string; userId: string; email: string | null; currentAccessUntil: string | null; amount: number; unit: "dias" | "meses" },
): Promise<{ ok: true; accessUntil: string } | { ok: false; error: string }> {
  const accessUntil = extendAccessUntil(p.currentAccessUntil, p.amount, p.unit);
  const { error } = await supabase.from("profiles").update({ access_until: accessUntil, is_blocked: false }).eq("id", p.userId);
  if (error) return { ok: false, error: error.message };
  await logAdminAction(supabase, {
    adminId: p.adminId,
    targetUserId: p.userId,
    action: AUDIT_ACTIONS.GRANTED_ACCESS,
    details: { email: p.email, before: { access_until: p.currentAccessUntil }, after: { access_until: accessUntil }, amount: p.amount, unit: p.unit },
  });
  void notifyUserAccessGranted(supabase, {
    userId: p.userId,
    accessUntil,
    title: "¡Felicidades! Tenés prueba gratuita",
    body: `El administrador te dio acceso gratis hasta el ${fmtAccessDate(accessUntil)}. Después de esa fecha se vuelve a pedir el pago para seguir — tus datos quedan guardados igual.`,
  });
  return { ok: true, accessUntil };
}
