import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE { userId } -> { ok: true } | { error }
 *
 * Borrado DEFINITIVO de una cuenta ("Eliminar" del admin). Solo admin (se re-verifica acá, un layout no protege una API) y nunca
 * sobre un admin ni sobre uno mismo. Si esa persona vuelve a entrar con Google se crea un usuario NUEVO (otro id): empieza de cero.
 * Borra el usuario de Auth con la service role: las claves foráneas `on delete cascade` se llevan `profiles` y todos los datos
 * del usuario. Antes limpia sus comprobantes del bucket privado `comprobantes` (la base no los borra sola).
 */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "not_admin" }, { status: 403 });

  let userId: unknown;
  try {
    userId = (await request.json())?.userId;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof userId !== "string" || !userId) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  if (userId === admin.userId) return NextResponse.json({ error: "No podés borrar tu propia cuenta." }, { status: 400 });

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id, email, role, deleted_at").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "No existe esa cuenta." }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "No se puede borrar a un administrador." }, { status: 400 });

  const adminClient = createAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 503 });

  // Comprobantes de pago del usuario (carpeta <user_id>/ del bucket privado).
  try {
    const { data: files } = await adminClient.storage.from("comprobantes").list(userId, { limit: 1000 });
    if (files && files.length > 0) await adminClient.storage.from("comprobantes").remove(files.map((f) => `${userId}/${f.name}`));
  } catch (e) {
    console.error("purge: no se pudieron limpiar los comprobantes:", e);
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    console.error("purge: deleteUser falló:", error.message);
    return NextResponse.json({ error: `No se pudo borrar: ${error.message}` }, { status: 500 });
  }

  // La fila de auditoría se escribe DESPUÉS (la FK target_user_id quedó en null por el borrado); el email queda en `details`.
  await supabase.from("admin_audit_log").insert({
    admin_id: admin.userId,
    target_user_id: null,
    action: AUDIT_ACTIONS.PURGED_ACCOUNT,
    details: { email: target.email, userId },
  });
  return NextResponse.json({ ok: true });
}
