// Simula a Telegram contra tu servidor LOCAL (o el que indiques) con el secret_token correcto. Sin dependencias.
//
//   node scripts/telegram-simulate.mjs                       → seguridad + mensaje + botón + update repetido
//   node scripts/telegram-simulate.mjs --code ABCD2345       → además simula /start ABCD2345 (el código que muestra la app)
//   node scripts/telegram-simulate.mjs --callback p:<uuid>:all   → botón en línea con un callback_data real
//
// Antes: arranca la app (npm run dev) con TELEGRAM_WEBHOOK_SECRET y CRON_SECRET definidos (en .env.local).
// Opciones por entorno: LOCAL_APP_URL (por defecto http://localhost:3000), SIM_CHAT_ID (por defecto 424242001), SIM_TEXT.
// El chat simulado NO está vinculado, así que el bot responde el mensaje neutro; con --code y un código válido queda vinculado
// (ese chat falso no recibirá los mensajes de vuelta de Telegram: solo sirve para comprobar el servidor).
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const base = (process.env.LOCAL_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const cron = process.env.CRON_SECRET;
const chat = Number(process.env.SIM_CHAT_ID || 424242001);
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failed++;
};

// update_id únicos por ejecución (Telegram los manda crecientes).
let nextId = Math.floor(Date.now() / 1000);
const message = (text) => ({ update_id: nextId++, message: { message_id: nextId, from: { id: chat, is_bot: false, username: "simulador" }, chat: { id: chat, type: "private" }, text } });
const callback = (data) => ({ update_id: nextId++, callback_query: { id: `cb${nextId}`, from: { id: chat, is_bot: false }, data, message: { message_id: 1, chat: { id: chat, type: "private" } } } });

async function post(path, body, headers = {}) {
  try {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* sin cuerpo JSON */
    }
    return { status: res.status, json };
  } catch (e) {
    console.error(`✗ No pude conectar con ${base} (¿está corriendo npm run dev?): ${e.message}`);
    process.exit(1);
  }
}

const hook = (update, token = secret) => post("/api/telegram/webhook", update, token ? { "X-Telegram-Bot-Api-Secret-Token": token } : {});

console.log(`Servidor: ${base} · chat simulado: ${chat}\n`);

console.log("— Seguridad —");
check((await hook(message("hola"), "")).status === 401, "webhook SIN secret_token → 401");
check((await hook(message("hola"), "secreto-equivocado-0000000000000000")).status === 401, "webhook con secret_token incorrecto → 401");
check((await post("/api/agent/tick", {})).status === 401, "/api/agent/tick SIN secreto → 401");
check((await post("/api/agent/tick", {}, { Authorization: "Bearer incorrecto-000000000000000000" })).status === 401, "/api/agent/tick con secreto incorrecto → 401");

if (!secret) {
  console.log("\n⚠ Falta TELEGRAM_WEBHOOK_SECRET en el entorno: no se puede seguir con el secret_token correcto.");
  process.exit(failed ? 1 : 0);
}
if (cron) {
  const t = await post("/api/agent/tick", {}, { Authorization: `Bearer ${cron}` });
  check(t.status === 200, `/api/agent/tick con el secreto correcto → 200 ${t.json ? JSON.stringify(t.json) : ""}`);
}

console.log("\n— Flujo con el secret_token correcto —");
const code = opt("--code");
if (code) {
  const r = await hook(message(`/start ${code}`));
  check(r.status === 200, `/start ${code} → ${r.status} (revisa en la app que diga «Vinculado»)`);
}
const msg = message(process.env.SIM_TEXT || "hola, ¿qué puedes hacer?");
const m1 = await hook(msg);
check(m1.status === 200 && m1.json?.ok === true, `mensaje de texto → ${m1.status} ${JSON.stringify(m1.json)}`);
const cbData = opt("--callback") || "p:123e4567-e89b-42d3-a456-426614174000:all";
const c1 = await hook(callback(cbData));
check(c1.status === 200, `botón en línea (${cbData.slice(0, 14)}…) → ${c1.status} ${JSON.stringify(c1.json)}`);

console.log("\n— Deduplicación (Telegram reintenta el mismo update) —");
const again = await hook(msg);
check(again.status === 200, `update repetido → ${again.status} ${JSON.stringify(again.json)}`);
if (again.json?.dup === true) check(true, "el servidor lo reconoció como duplicado y no lo procesó dos veces");
else console.log("⚠ No marcó «dup»: la tabla telegram_updates solo existe tras aplicar la migración 0014 (sin ella no hay deduplicación).");

console.log(failed ? `\n✗ ${failed} comprobación(es) fallaron.` : "\n✓ Todo bien.");
process.exit(failed ? 1 : 0);
