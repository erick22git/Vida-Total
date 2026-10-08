// Pruebas del canal Telegram: lectura segura de updates, comandos, botones, código de vinculación, plan pendiente y zonas horarias.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/telegram_test.ts
import { renderTelegramHtml, chunkMessage, decodeCallback, encodeCallback, isWellFormedCode, normalizeCode, parseCommand, parseUpdate, LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from "../../src/lib/telegram/update";
import { generateLinkCode, hashLinkCode, safeEqual } from "../../src/lib/telegram/link-code";
import { answerStep, approveAllPending, nextToConfirm, renderPlan, runnableSteps, stepButtons, type PendingPlan } from "../../src/lib/telegram/pending";
import { addDays, localParts, zonedTimeToMs } from "../../src/lib/agent/tz";
import { sanitizeConfig } from "../../src/lib/agent/config";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// ── updates ────────────────────────────────────────────────────────
const msg = (extra: Record<string, unknown>, chatType = "private") => ({ update_id: 10, message: { message_id: 1, from: { id: 55, is_bot: false, username: "yo" }, chat: { id: 55, type: chatType }, ...extra } });
const t = parseUpdate(msg({ text: "hola" }));
ok(t?.kind === "text" && t.text === "hola" && t.chatId === 55 && t.isPrivate && !t.forwarded, "texto simple");
ok(parseUpdate(msg({ text: "x".repeat(5000) }))?.kind === "text" && (parseUpdate(msg({ text: "x".repeat(5000) })) as { text: string }).text.length === 2000, "texto recortado a 2000");
ok(parseUpdate(msg({ text: "x" }, "group"))?.isPrivate === false, "grupo no es privado");
ok((parseUpdate(msg({ text: "x", forward_origin: { type: "user" } })) as { forwarded: boolean }).forwarded === true, "reenviado detectado");
ok(parseUpdate({ update_id: 1, message: { from: { id: 1, is_bot: true }, chat: { id: 1, type: "private" }, text: "x" } }) === null, "mensajes de bots se ignoran");
ok(parseUpdate({ message: { text: "x" } }) === null && parseUpdate(null) === null && parseUpdate("x") === null && parseUpdate([]) === null, "basura → null");
ok(parseUpdate({ update_id: "1", message: {} }) === null, "update_id no numérico");
const v = parseUpdate(msg({ voice: { file_id: "abc", duration: 5, file_size: 1000 } }));
ok(v?.kind === "voice" && v.fileId === "abc" && v.durationSec === 5, "nota de voz");
const d = parseUpdate(msg({ document: { file_id: "d1", file_name: "n.txt", mime_type: "text/plain", file_size: 10 }, caption: "mira" }));
ok(d?.kind === "document" && d.mime === "text/plain" && d.caption === "mira", "documento");
ok(parseUpdate(msg({ photo: [{ file_id: "p" }], caption: "c" }))?.kind === "photo", "foto");
ok(parseUpdate(msg({ sticker: {} }))?.kind === "unsupported", "sticker no soportado");
const cb = parseUpdate({ update_id: 3, callback_query: { id: "cq1", from: { id: 55 }, data: "p:x:all", message: { message_id: 9, chat: { id: 55, type: "private" } } } });
ok(cb?.kind === "callback" && cb.messageId === 9 && cb.data === "p:x:all", "callback");
ok(parseUpdate({ update_id: 3, callback_query: { id: "cq1", from: { id: 55 } } }) === null, "callback sin mensaje → null");

// ── comandos y botones ─────────────────────────────────────────────
ok(JSON.stringify(parseCommand("/start ABCD2345")) === JSON.stringify({ cmd: "start", arg: "ABCD2345" }), "/start CÓDIGO");
ok(parseCommand("/Start@MiBot  xx")?.cmd === "start" && parseCommand("/ayuda")?.arg === "", "comando con @bot y sin argumento");
ok(parseCommand("hola /start") === null && parseCommand("registra agua") === null, "texto normal no es comando");
const id = "123e4567-e89b-42d3-a456-426614174000";
for (const c of [
  { type: "plan", id, action: "all" },
  { type: "plan", id, action: "step" },
  { type: "plan", id, action: "cancel" },
  { type: "step", id, index: 3, action: "always" },
] as const) {
  const enc = encodeCallback(c);
  ok(enc.length <= 64, `callback_data ≤ 64 bytes (${enc.length})`);
  ok(JSON.stringify(decodeCallback(enc)) === JSON.stringify(c), `ida y vuelta ${enc}`);
}
ok(decodeCallback("p:no-es-uuid:all") === null && decodeCallback("p:" + id + ":borrar") === null && decodeCallback("s:" + id + ":x:ok") === null && decodeCallback("zzz") === null, "callbacks inválidos");

// ── código de vinculación ──────────────────────────────────────────
const codes = new Set<string>();
for (let i = 0; i < 200; i++) codes.add(generateLinkCode());
ok(codes.size === 200, "códigos distintos");
ok([...codes].every((c) => c.length === LINK_CODE_LENGTH && [...c].every((ch) => LINK_CODE_ALPHABET.includes(ch))), "alfabeto sin caracteres ambiguos");
ok(!LINK_CODE_ALPHABET.includes("0") && !LINK_CODE_ALPHABET.includes("O") && !LINK_CODE_ALPHABET.includes("1") && !LINK_CODE_ALPHABET.includes("I"), "sin 0/O/1/I");
const c0 = [...codes][0];
ok(hashLinkCode(c0) === hashLinkCode(c0) && hashLinkCode(c0) !== c0 && hashLinkCode(c0).length === 64, "hash estable y distinto del código");
ok(hashLinkCode("ABCDEFGH") !== hashLinkCode("ABCDEFGJ"), "hash distinto por código");
ok(isWellFormedCode(c0) && !isWellFormedCode("abc") && !isWellFormedCode("ABCDEFG0"), "forma del código");
ok(normalizeCode(" abcd-efgh ") === "ABCDEFGH", "normaliza minúsculas, espacios y guion");
ok(safeEqual("secreto-largo", "secreto-largo") && !safeEqual("secreto-largo", "secreto-larga") && !safeEqual("a", "ab"), "comparación del secret_token");

// ── mensajes largos ────────────────────────────────────────────────
const long = Array.from({ length: 200 }, (_, i) => `línea ${i} ${"x".repeat(40)}`).join("\n");
const chunks = chunkMessage(long);
ok(chunks.length > 1 && chunks.every((c) => c.length <= 3800) && chunks.join("\n").replace(/\n/g, "") === long.replace(/\n/g, ""), "mensaje largo se parte sin perder texto");

// ── plan pendiente (máquina de estados) ────────────────────────────
const ask = { action: "ask", reasons: ["Necesita tu permiso."], canAlways: true } as const;
const never = { action: "ask", reasons: ["Marcar hábitos"], canAlways: false } as const;
const allow = { action: "allow", reasons: [] } as const;
const deny = { action: "deny", reasons: ["límite"] } as const;
const plan: PendingPlan = {
  mode: "all",
  untrusted: false,
  steps: [
    { id: "a", tool: "water_add", args: { ml: 250 }, label: "Registrar agua", decision: ask, status: "pending" },
    { id: "b", tool: "task_create", args: { title: "x" }, label: "Crear tarea", decision: allow, status: "pending" },
    { id: "c", tool: "habit_complete", args: {}, label: "Hábito", decision: never, status: "pending" },
    { id: "d", tool: "water_add", args: { ml: 9999 }, label: "Agua", decision: deny, status: "denied" },
  ],
};
ok(nextToConfirm(plan) === 0, "primer paso a confirmar");
const a1 = answerStep(plan, 0, "ok");
ok(a1.plan.steps[0].status === "approved" && a1.alwaysTool === null && nextToConfirm(a1.plan) === 2, "responder ok avanza al siguiente que pide permiso");
const a2 = answerStep(plan, 0, "always");
ok(a2.alwaysTool === "water_add", "«siempre» devuelve la herramienta");
const a3 = answerStep(plan, 2, "always");
ok(a3.alwaysTool === null && a3.plan.steps[2].status === "approved", "«siempre» NO aplica a la lista fija (canAlways=false)");
const a4 = answerStep(plan, 0, "skip");
ok(a4.plan.steps[0].status === "skipped", "denegar = omitir");
ok(answerStep(plan, 3, "ok").plan.steps[3].status === "denied", "un paso denegado por política no se aprueba");
ok(answerStep(a1.plan, 0, "ok").plan.steps[0].status === "approved" && answerStep(a1.plan, 0, "skip").plan.steps[0].status === "approved", "no se puede responder dos veces el mismo paso");
const all = approveAllPending(plan);
ok(all.steps[0].status === "approved" && all.steps[2].status === "approved" && all.steps[3].status === "denied", "aprobar todo no aprueba lo denegado");
ok(runnableSteps(plan).join() === "1", "pendiente + permitido corre solo; el que pide permiso no");
ok(runnableSteps(all).join() === "0,1,2", "tras aprobar todo corren los aprobados");
ok(renderPlan(plan).includes("Plan (4 pasos)") && renderPlan({ ...plan, untrusted: true }).includes("no escribiste"), "texto del plan y aviso de contenido no confiable");
ok(stepButtons(id, 0, true).flat().length === 3 && stepButtons(id, 0, false).flat().length === 2, "botones: «siempre» solo si se puede");

// ── tablas en Telegram ─────────────────────────────────────────────
const FENCE = "```";
const html = renderTelegramHtml(["Hoy <b>:", FENCE, "HORA  | ACTIVIDAD", "07:00 | Gym & pesas", FENCE, "⬜ Pagar"].join("\n"));
ok(html.includes("<pre>HORA  | ACTIVIDAD\n07:00 | Gym &amp; pesas</pre>"), "bloque ``` → <pre> con HTML escapado");
ok(html.includes("&lt;b&gt;") && !html.includes("<b>"), "etiquetas del modelo escapadas (no inyecta HTML)");
ok(renderTelegramHtml("sin bloques") === "sin bloques", "texto sin bloques intacto");

// ── zona horaria ───────────────────────────────────────────────────
const noon = Date.UTC(2026, 9, 7, 3, 30); // 03:30 UTC
ok(localParts(noon, "UTC").date === "2026-10-07" && localParts(noon, "UTC").hour === 3, "UTC");
const lp = localParts(noon, "America/La_Paz"); // UTC-4 → 23:30 del día anterior
ok(lp.date === "2026-10-06" && lp.hour === 23 && lp.minute === 30, "La Paz (UTC-4): el servidor y el usuario no están en el mismo día");
ok(addDays("2026-10-31", 1) === "2026-11-01" && addDays("2026-03-01", -1) === "2026-02-28", "addDays");
const ms = zonedTimeToMs("2026-10-07", "09:00", "America/La_Paz");
ok(ms === Date.UTC(2026, 9, 7, 13, 0), "09:00 en La Paz = 13:00 UTC");
const ms2 = zonedTimeToMs("2026-10-07", "09:00", "America/Santiago"); // UTC-3 en octubre (verano)
ok(localParts(ms2, "America/Santiago").hour === 9 && localParts(ms2, "America/Santiago").date === "2026-10-07", "zonedTimeToMs ida y vuelta con horario de verano");
ok(sanitizeConfig({ timezone: "Mars/Olympus" }).timezone === "UTC" && sanitizeConfig({ timezone: "America/La_Paz" }).timezone === "America/La_Paz", "zona horaria inválida → UTC");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
