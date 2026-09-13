import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Segundo paso del flujo de impersonación (ver
 * src/app/api/admin/impersonate/route.ts para el primero). El admin
 * llega acá con un `token_hash` de un magic link generado server-side
 * con la service_role key vía `supabase.auth.admin.generateLink(...)`.
 *
 * `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })` es el
 * método público y documentado de Supabase para canjear ese token por
 * una sesión real — no requiere la service_role key acá, solo la anon
 * key (el cliente de servidor normal), porque el token_hash YA es la
 * prueba de que alguien con privilegios de admin lo generó.
 *
 * ANTES de canjear el token (lo que sobreescribe las cookies de sesión
 * con las del usuario objetivo), guardamos la sesión ACTUAL del admin en
 * una cookie propia `vt_admin_return` (httpOnly) para poder restaurarla
 * después con el botón "Volver a mi sesión" del banner de impersonación
 * — ver src/app/api/admin/stop-impersonation/route.ts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const targetEmail = searchParams.get("email");

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/admin/usuarios?error=impersonate_missing_token`);
  }

  const supabase = await createClient();

  // 1) Guardar la sesión actual (del admin) antes de perderla.
  let adminSessionToRestore: { access_token: string; refresh_token: string } | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      adminSessionToRestore = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };
    }
  } catch (err) {
    console.error("Impersonación: no se pudo leer la sesión actual del admin:", err);
  }

  // 2) Canjear el token_hash por una sesión como el usuario objetivo.
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });

  if (error) {
    console.error("Impersonación: fallo al verificar el token de sesión:", error.message);
    return NextResponse.redirect(`${origin}/admin/usuarios?error=impersonate_failed`);
  }

  // 3) Persistir la sesión del admin (para poder volver) y un marcador
  //    legible server-side de que hay una impersonación en curso.
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60, // 1 hora — ventana razonable para una sesión de soporte.
  };

  if (adminSessionToRestore) {
    cookieStore.set("vt_admin_return", JSON.stringify(adminSessionToRestore), cookieOpts);
  }
  if (targetEmail) {
    cookieStore.set("vt_impersonating_email", targetEmail, { ...cookieOpts, httpOnly: false });
  }

  return NextResponse.redirect(`${origin}/`);
}
