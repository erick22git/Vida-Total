// Registra (o quita) el webhook del bot de Telegram. Ejecutar:
//   npx tsx tools/telegram/set-webhook.ts            → setWebhook a APP_PUBLIC_URL/api/telegram/webhook
//   npx tsx tools/telegram/set-webhook.ts --delete   → deleteWebhook (para usar el script de polling en local)
//   npx tsx tools/telegram/set-webhook.ts --info     → getWebhookInfo
// Lee TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET y APP_PUBLIC_URL de .env.local. No imprime ningún secreto.
import { config } from "dotenv";

config({ path: ".env.local" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
const arg = process.argv[2];

async function api(method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as { ok: boolean; description?: string; result?: unknown };
}

async function main() {
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en .env.local");
  if (arg === "--delete") {
    console.log(await api("deleteWebhook", { drop_pending_updates: false }));
    return;
  }
  if (arg === "--info") {
    const r = await api("getWebhookInfo");
    // El resultado trae la URL y errores recientes; no incluye el secreto.
    console.log(JSON.stringify(r.result, null, 2));
    return;
  }
  if (!secret || secret.length < 32) throw new Error("TELEGRAM_WEBHOOK_SECRET debe tener al menos 32 caracteres");
  if (!base.startsWith("https://")) throw new Error("APP_PUBLIC_URL debe ser https:// (Telegram no acepta http ni localhost)");
  const r = await api("setWebhook", {
    url: `${base}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  console.log(r.ok ? `Webhook registrado en ${base}/api/telegram/webhook` : `Falló: ${r.description}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
