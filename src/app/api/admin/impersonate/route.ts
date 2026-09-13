import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * POST { targetUserId } -> { tokenHash, email } | { error }
 *
 * Primer paso de "Entrar como este usuario" (ver
 * src/app/admin/usuarios/[userId]/*). Genera un magic link de sesión
 * para el usuario objetivo usando el Admin API de Supabase
 * (`auth.admin.generateLink`), que SOLO puede llamarse con la
 * service_role key (no existe otra forma segura de "iniciar sesión como
 * otro usuario" sin conocer su contraseña). El frontend recibe el
 * `token_hash` y navega el navegador a
 * `/auth/impersonate?token_hash=...` (Route Handler GET, ver ese
 * archivo) para canjearlo por una sesión real — el token nunca se usa
 * directamente acá, solo se genera y se devuelve.
 *
 * Re-verificamos `role === 'admin'` en el servidor con la sesión real de
 * cookies (`requireAdmin()`) — NUNCA confiamos en que el usuario ya pasó
 * el chequeo del layout de `/admin`, porque esta ruta puede recibir un
 * POST directo sin pasar por ningún layout.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  let targetUserId: string | undefined;
  try {
    const body = await request.json();
    targetUserId = body?.targetUserId;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!targetUserId || typeof targetUserId !== "string") {
    return NextResponse.json({ error: "missing_target_user_id" }, { status: 400 });
  }

  if (targetUserId === admin.userId) {
    return NextResponse.json({ error: "cannot_impersonate_self" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  }

  // Necesitamos el email del usuario objetivo — generateLink lo pide.
  // Lo leemos con el cliente NORMAL de servidor (respeta RLS: un admin
  // puede leer cualquier perfil, ver policy "profiles_select_own_or_admin").
  const supabase = await createClient();
  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetError || !targetProfile?.email) {
    return NextResponse.json({ error: "target_user_not_found" }, { status: 404 });
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: targetProfile.email,
  });

  if (error || !data?.properties?.hashed_token) {
    console.error("Impersonación: fallo al generar el magic link:", error?.message);
    return NextResponse.json({ error: "generate_link_failed" }, { status: 500 });
  }

  await logAdminAction(supabase, {
    adminId: admin.userId,
    targetUserId,
    action: AUDIT_ACTIONS.IMPERSONATED_USER,
    details: { target_email: targetProfile.email },
  });

  return NextResponse.json({
    tokenHash: data.properties.hashed_token,
    email: targetProfile.email,
  });
}
