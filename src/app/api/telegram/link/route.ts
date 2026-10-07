import { NextResponse } from "next/server";
import { admin } from "@/lib/agent/server/db";
import { generateLinkCode, hashLinkCode } from "@/lib/telegram/link-code";
import { sendMessage } from "@/lib/telegram/api";
import { LINK_CODE_TTL_MS } from "@/lib/telegram/update";
import { createClient } from "@/lib/supabase/server";

// Vincular / desvincular Telegram. SOLO desde la app, con sesión (vincular es de la lista "nunca automático").
//   GET     → { linked, username?, botUsername? }
//   POST    → genera un código de un solo uso (10 min). Se muestra una vez; en la base solo queda su hash.
//   DELETE  → desvincula (y avisa en el chat).

async function currentUser() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

const bot = () => (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "") || null;

export async function GET() {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ linked: false, botUsername: bot(), configured: false });
  const { data } = await db.from("telegram_links").select("username,linked_at").eq("user_id", userId).maybeSingle();
  return NextResponse.json({ linked: !!data, username: data?.username ?? null, linkedAt: data?.linked_at ?? null, botUsername: bot(), configured: !!process.env.TELEGRAM_BOT_TOKEN });
}

export async function POST() {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  if (!db || !process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data: existing } = await db.from("telegram_links").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) return NextResponse.json({ error: "already_linked" }, { status: 409 });

  // Un solo código vigente por usuario.
  await db.from("telegram_link_codes").delete().eq("user_id", userId).is("used_at", null);
  const code = generateLinkCode();
  const expires = new Date(Date.now() + LINK_CODE_TTL_MS);
  const { error } = await db.from("telegram_link_codes").insert({ code_hash: hashLinkCode(code), user_id: userId, expires_at: expires.toISOString() });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ code, expiresAt: expires.toISOString(), botUsername: bot() });
}

export async function DELETE() {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data } = await db.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle();
  await db.from("telegram_links").delete().eq("user_id", userId);
  await db.from("telegram_link_codes").delete().eq("user_id", userId);
  await db.from("agent_pending").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "open");
  await db.from("agent_chat_state").delete().eq("user_id", userId);
  if (data) await sendMessage(Number(data.chat_id), "Tu cuenta se desvinculó desde la app. Ya no puedo ayudarte por aquí.");
  return NextResponse.json({ linked: false });
}
