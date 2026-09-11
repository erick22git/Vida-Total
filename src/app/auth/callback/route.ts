import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Recibe el redirect de Supabase/Google tras el login OAuth, intercambia
 * el `code` por una sesión (esto es lo que efectivamente crea las cookies
 * de sesión, vía el cliente de servidor) y redirige al dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Error al intercambiar el código de auth por una sesión:", error.message);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Ruta raíz del grupo (dashboard) — ver src/app/(dashboard)/page.tsx.
  return NextResponse.redirect(`${origin}/`);
}
