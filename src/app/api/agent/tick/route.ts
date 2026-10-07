import { NextResponse } from "next/server";
import { runTick } from "@/lib/agent/server/tick";
import { safeEqual } from "@/lib/telegram/link-code";

// Programador de avisos. Lo llama CUALQUIER disparador cada minuto (Supabase pg_cron + pg_net, Vercel Cron, n8n…):
//   curl -X POST https://tu-app.vercel.app/api/agent/tick -H "Authorization: Bearer $CRON_SECRET"
// Sin el secreto correcto responde 401. Es idempotente: los avisos se deduplican por (usuario, clave) en la base, así que
// llamarlo dos veces seguidas no envía nada repetido. Ver docs/notificaciones.md.

export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || secret.length < 24 || !safeEqual(token, secret)) return new NextResponse(null, { status: 401 });
  const result = await runTick();
  return NextResponse.json(result);
}

export const POST = handle;
// Vercel Cron llama con GET.
export const GET = handle;
