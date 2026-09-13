import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Botón "Volver a mi sesión" del banner de impersonación
 * (src/components/admin/impersonation-banner.tsx). Restaura la sesión
 * del admin guardada en la cookie `vt_admin_return` (ver
 * src/app/auth/impersonate/route.ts) vía `setSession()`, y limpia las
 * cookies de impersonación.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const cookieStore = await cookies();
  const raw = cookieStore.get("vt_admin_return")?.value;

  cookieStore.delete("vt_admin_return");
  cookieStore.delete("vt_impersonating_email");

  if (!raw) {
    // No había sesión de admin guardada (cookie vencida o flujo
    // iniciado de otra forma) — igual cerramos la sesión del usuario
    // impersonado para no dejar al admin "atrapado" en esa cuenta, y lo
    // mandamos a login.
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const { access_token, refresh_token } = JSON.parse(raw) as {
      access_token: string;
      refresh_token: string;
    };
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      console.error("Impersonación: fallo al restaurar la sesión del admin:", error.message);
      return NextResponse.redirect(`${origin}/login?error=restore_session_failed`);
    }
  } catch (err) {
    console.error("Impersonación: cookie de retorno inválida:", err);
    return NextResponse.redirect(`${origin}/login`);
  }

  return NextResponse.redirect(`${origin}/admin/usuarios`);
}
