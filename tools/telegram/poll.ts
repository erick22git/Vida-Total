// Polling para DESARROLLO LOCAL (Telegram no acepta webhooks hacia localhost). Ejecutar con la app corriendo (npm run dev):
//   npx tsx tools/telegram/poll.ts
// Quita el webhook, pide updates con getUpdates (long polling) y reenvía cada uno a /api/telegram/webhook de la app local con
// el mismo secret_token, así el flujo es idéntico al de producción (deduplicación, vinculación, permisos). Ctrl+C para parar.
// Lee TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET de .env.local. Opcional: LOCAL_APP_URL (por defecto http://localhost:3000).
import { config } from "dotenv";

config({ path: ".env.local" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const local = (process.env.LOCAL_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

async function api<T>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

async function main() {
  if (!token || !secret) throw new Error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en .env.local");
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log(`Escuchando a Telegram… reenviando a ${local}/api/telegram/webhook (Ctrl+C para parar)`);
  let offset = 0;
  for (;;) {
    const r = await api<Array<{ update_id: number }>>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
    if (!r.ok) {
      console.error("getUpdates falló:", r.description);
      await new Promise((res) => setTimeout(res, 5000));
      continue;
    }
    for (const u of r.result ?? []) {
      offset = u.update_id + 1;
      try {
        const res = await fetch(`${local}/api/telegram/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret }, body: JSON.stringify(u) });
        console.log(`update ${u.update_id} → ${res.status}`);
      } catch (e) {
        console.error(`update ${u.update_id}: no pude llegar a la app local (¿está corriendo?)`, e instanceof Error ? e.message : e);
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
