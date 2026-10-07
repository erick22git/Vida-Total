import { after, NextResponse } from "next/server";
import { admin } from "@/lib/agent/server/db";
import { handleInbound } from "@/lib/agent/server/telegram-agent";
import { safeEqual } from "@/lib/telegram/link-code";
import { parseUpdate } from "@/lib/telegram/update";

// Webhook de Telegram (Bot API). Es público (no hay sesión de usuario): se protege con el `secret_token` que se registra en
// setWebhook y que Telegram manda en la cabecera X-Telegram-Bot-Api-Secret-Token. Sin él (o distinto) → 401 sin más datos.
// Telegram reintenta si no recibe 200: se deduplica por update_id y se responde rápido; el trabajo corre en `after`.
//
// Variables de entorno (SOLO servidor, nunca en el repo): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, GROQ_API_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Ver docs/telegram.md.

export const maxDuration = 60;

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || expected.length < 16 || !safeEqual(got, expected)) return new NextResponse(null, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const inb = parseUpdate(raw);
  if (!inb) return NextResponse.json({ ok: true });

  const db = admin();
  if (!db) return NextResponse.json({ ok: true });
  // Deduplicación: el primer insert gana; un reintento de Telegram choca con la clave primaria y se ignora.
  const { error } = await db.from("telegram_updates").insert({ update_id: inb.updateId });
  // 23505 = clave duplicada = Telegram reintentó un update que ya se recibió. Cualquier otro error (p. ej. la tabla aún no existe)
  // se registra y se sigue: sin deduplicación, pero el mensaje no se pierde.
  if (error?.code === "23505") return NextResponse.json({ ok: true, dup: true });
  if (error) console.error("[telegram] no se pudo registrar el update_id (¿falta aplicar la migración 0014?):", error.message);

  after(async () => {
    try {
      await handleInbound(inb);
    } catch (err) {
      console.error("[telegram] handleInbound falló:", err instanceof Error ? err.message : err);
    }
  });
  return NextResponse.json({ ok: true });
}
