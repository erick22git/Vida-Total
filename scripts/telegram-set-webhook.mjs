// Registra (o quita) el webhook del bot de Telegram y muestra getWebhookInfo. Sin dependencias: solo Node 18+.
//
//   node scripts/telegram-set-webhook.mjs            → setWebhook a APP_PUBLIC_URL/api/telegram/webhook y luego getWebhookInfo
//   node scripts/telegram-set-webhook.mjs --info     → solo getWebhookInfo
//   node scripts/telegram-set-webhook.mjs --delete   → deleteWebhook (para usar tools/telegram/poll.ts en local)
//
// Lee de variables de entorno (o de .env.local si existe): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_PUBLIC_URL.
// NUNCA imprime el token ni el secreto.
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
const arg = process.argv[2];

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

async function api(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function showInfo() {
  const r = await api("getWebhookInfo");
  if (!r.ok) fail(`getWebhookInfo falló: ${r.description}`);
  const i = r.result;
  console.log("getWebhookInfo:");
  console.log(`  url:                     ${i.url || "(ninguna)"}`);
  console.log(`  actualizaciones pend.:   ${i.pending_update_count}`);
  console.log(`  último error:            ${i.last_error_message ?? "(ninguno)"}${i.last_error_date ? ` · ${new Date(i.last_error_date * 1000).toISOString()}` : ""}`);
  console.log(`  tipos permitidos:        ${(i.allowed_updates ?? []).join(", ") || "(todos)"}`);
  console.log(`  IP:                      ${i.ip_address ?? "—"}`);
}

if (!token) fail("Falta TELEGRAM_BOT_TOKEN (variable de entorno o .env.local).");

if (arg === "--info") {
  await showInfo();
} else if (arg === "--delete") {
  const r = await api("deleteWebhook", { drop_pending_updates: false });
  console.log(r.ok ? "✓ Webhook quitado." : `✗ ${r.description}`);
  await showInfo();
} else {
  if (!secret || secret.length < 32) fail("TELEGRAM_WEBHOOK_SECRET debe tener al menos 32 caracteres (genera uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\").");
  if (!base.startsWith("https://")) fail("APP_PUBLIC_URL debe empezar con https:// (Telegram no acepta http ni localhost). Usa tu dominio de PRODUCCIÓN.");
  const url = `${base}/api/telegram/webhook`;
  const r = await api("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  if (!r.ok) fail(`setWebhook falló: ${r.description}`);
  console.log(`✓ Webhook registrado en ${url}`);
  await showInfo();
}
