// Pruebas del motor de permisos del agente. Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/permissions_test.ts
// Matriz modo × herramienta × canal × origen del contenido, y que la lista "nunca automático" no se salte en ningún modo.
import { decide, applyAnswer, neverAutoCodes } from "../../src/lib/agent/permissions";
import { defaultAgentConfig, sanitizeConfig, isAutoTotalActive, effectiveMode, isQuietMinute, writeLimitHit, HOUR_MS } from "../../src/lib/agent/config";
import { registerToolForTests } from "../../src/lib/agent/tools/registry";
import { asArgs, optNumber, isErr, type ToolMeta } from "../../src/lib/agent/tools/meta";
import { buildPlan, planNeedsReview, approveAll, skipStep, editStep, isPlanFinished } from "../../src/lib/agent/plan";
import { mergeHistory } from "../../src/lib/agent/history";
import type { AgentConfig, Origin, PermissionContext } from "../../src/lib/agent/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const NOW = new Date(2026, 9, 7, 12, 0).getTime();
const mk = (extra: Partial<ToolMeta> & Pick<ToolMeta, "name" | "kind">): ToolMeta => ({
  module: "agua",
  label: extra.name,
  description: "",
  exposed: true,
  parameters: { type: "object", properties: {} },
  validate: (raw) => {
    const a = asArgs(raw);
    if (!a) return { ok: false, error: "args" };
    const ml = optNumber(a, "ml", 1, 100000);
    if (isErr(ml)) return { ok: false, error: ml.error };
    return { ok: true, args: a };
  },
  ...extra,
});
registerToolForTests(mk({ name: "t_read", kind: "read" }));
registerToolForTests(
  mk({
    name: "t_write",
    kind: "write",
    limitCheck: (a, l) => ((a.ml as number) > l.waterMaxMl ? "supera el límite de agua" : null),
    batchSize: (a) => (Array.isArray(a.items) ? a.items.length : 1),
  }),
);
registerToolForTests(mk({ name: "t_task", kind: "write", module: "tareas" }));

function ctx(over: Partial<PermissionContext> = {}): PermissionContext {
  return { channel: "app", origin: "user", config: defaultAgentConfig(), now: NOW, recentWrites: [], sessionId: "s1", ...over };
}
function cfgWith(f: (c: AgentConfig) => void): AgentConfig {
  const c = defaultAgentConfig();
  f(c);
  return c;
}
const activeAuto = (c: AgentConfig) => {
  c.autoTotal = { duration: "until_off", startedAt: NOW, sessionId: "s1" };
};
const ALL_MODULES: AgentConfig["allowedModules"] = ["agua", "tareas", "notas", "comidas", "habitos", "sistema"];

// ── 1. valores por defecto: todo pregunta ──────────────────────────
ok(decide("t_write", { ml: 200 }, ctx()).action === "ask", "por defecto una escritura pregunta");
ok(decide("t_read", {}, ctx()).action === "ask", "por defecto (preguntar siempre) hasta la lectura pregunta");
ok(decide("nope", {}, ctx()).action === "deny", "herramienta desconocida se deniega");
ok(decide("toString", {}, ctx()).action === "deny", "nombres del prototipo no cuentan como herramientas");

// ── 2. modos ───────────────────────────────────────────────────────
const safe = cfgWith((c) => {
  c.mode = "auto_safe";
});
ok(decide("t_read", {}, ctx({ config: safe })).action === "allow", "auto_safe: lectura pasa sola");
ok(decide("t_write", { ml: 200 }, ctx({ config: safe })).action === "ask", "auto_safe: escritura sin permitir pregunta");
const safeAllow = cfgWith((c) => {
  c.mode = "auto_safe";
  c.levels.app.t_write = "allow";
});
ok(decide("t_write", { ml: 200 }, ctx({ config: safeAllow })).action === "allow", "auto_safe: escritura marcada permitida pasa sola");
const askAllow = cfgWith((c) => {
  c.levels.app.t_write = "allow";
});
ok(decide("t_write", { ml: 200 }, ctx({ config: askAllow })).action === "allow", "ask_always: lo marcado 'permitir siempre' pasa");
const blocked = cfgWith((c) => {
  c.mode = "auto_safe";
  c.levels.app.t_read = "block";
});
ok(decide("t_read", {}, ctx({ config: blocked })).action === "deny", "bloqueada se deniega aun en auto_safe");
const total = cfgWith(activeAuto);
ok(decide("t_write", { ml: 200 }, ctx({ config: total })).action === "allow", "auto_total permite escrituras");
ok(decide("t_read", {}, ctx({ config: total })).action === "allow", "auto_total permite lecturas");
ok(
  decide("t_write", { ml: 200 }, ctx({ config: cfgWith((c) => { activeAuto(c); c.levels.app.t_write = "block"; }) })).action === "deny",
  "auto_total respeta 'bloquear'",
);

// ── 3. Auto total: caducidad y sesión ──────────────────────────────
const hour = cfgWith((c) => {
  c.autoTotal = { duration: "hour", startedAt: NOW - HOUR_MS + 1000, sessionId: "s1" };
});
ok(isAutoTotalActive(hour, NOW), "auto_total 1 hora: vigente justo antes de caducar");
ok(!isAutoTotalActive(hour, NOW + 2000), "auto_total 1 hora: caduca");
const sess = cfgWith((c) => {
  c.autoTotal = { duration: "session", startedAt: NOW, sessionId: "s1" };
});
ok(isAutoTotalActive(sess, NOW, "s1"), "auto_total sesión: misma sesión vigente");
ok(!isAutoTotalActive(sess, NOW, "otra"), "auto_total sesión: otra sesión no");
ok(!isAutoTotalActive(sess, NOW), "auto_total sesión: sin sesión no");
ok(effectiveMode(total, "telegram", NOW, "s1") !== "auto_total", "auto_total NUNCA aplica en Telegram");
ok(
  decide("t_write", { ml: 200 }, ctx({ config: cfgWith((c) => { activeAuto(c); c.channels.telegram.enabled = true; }), channel: "telegram" })).action === "ask",
  "Telegram con auto_total activo en la app sigue preguntando",
);

// ── 4. canales ─────────────────────────────────────────────────────
ok(decide("t_write", { ml: 200 }, ctx({ channel: "telegram" })).action === "deny", "Telegram desactivado por defecto → deniega");
const tg = cfgWith((c) => {
  c.channels.telegram.enabled = true;
  c.mode = "auto_safe";
});
ok(decide("t_read", {}, ctx({ config: tg, channel: "telegram" })).action === "ask", "Telegram es más estricto: lectura pregunta (techo ask_always)");
const tg2 = cfgWith((c) => {
  c.channels.telegram.enabled = true;
  c.channels.telegram.maxMode = "auto_safe";
  c.mode = "auto_safe";
});
ok(decide("t_read", {}, ctx({ config: tg2, channel: "telegram" })).action === "allow", "Telegram con techo auto_safe: lectura pasa");
const tg3 = cfgWith((c) => {
  c.channels.telegram.enabled = true;
  c.channels.telegram.readOnly = true;
});
ok(decide("t_write", { ml: 200 }, ctx({ config: tg3, channel: "telegram" })).action === "deny", "Telegram solo lectura deniega escrituras");
ok(decide("t_read", {}, ctx({ config: tg3, channel: "telegram" })).action !== "deny", "Telegram solo lectura permite lecturas");
ok(decide("t_write", { ml: 200 }, ctx({ config: cfgWith((c) => { c.channels.app.readOnly = true; }) })).action === "deny", "app solo lectura deniega escrituras");

// ── 5. restricciones ───────────────────────────────────────────────
ok(decide("t_write", { ml: 200 }, ctx({ config: cfgWith((c) => { c.killSwitch = true; }) })).action === "deny", "apagado total deniega");
ok(decide("t_read", {}, ctx({ config: cfgWith((c) => { c.killSwitch = true; }) })).action === "deny", "apagado total deniega hasta lecturas");
ok(decide("t_write", { ml: 200 }, ctx({ config: cfgWith((c) => { c.readOnly = true; }) })).action === "deny", "solo lectura global deniega escrituras");
ok(decide("t_task", {}, ctx({ config: cfgWith((c) => { c.allowedModules = ["agua"]; }) })).action === "deny", "módulo no permitido");
ok(decide("t_write", { ml: 99999 }, ctx()).action === "deny", "supera límite de agua");
ok(decide("t_write", { ml: "x" }, ctx()).action === "deny", "argumentos inválidos");
const many = Array.from({ length: 40 }, (_, i) => NOW - i * 1000);
ok(decide("t_write", { ml: 100 }, ctx({ recentWrites: many })).action === "deny", "tope por hora");
ok(
  writeLimitHit(defaultAgentConfig(), Array.from({ length: 150 }, (_, i) => NOW - 2 * HOUR_MS - i * 1000), NOW) === "day",
  "tope por día",
);
ok(decide("t_read", {}, ctx({ recentWrites: many })).action !== "deny", "los topes de escritura no frenan lecturas");
ok(isQuietMinute(defaultAgentConfig(), 23 * 60), "silencio 23:00");
ok(isQuietMinute(defaultAgentConfig(), 3 * 60), "silencio 03:00 (cruza medianoche)");
ok(!isQuietMinute(defaultAgentConfig(), 12 * 60), "no hay silencio a las 12:00");

// ── 6. NUNCA AUTOMÁTICO: ningún modo lo salta ──────────────────────
const never = ["habit_complete", "data_delete", "permissions_change", "agent_config_change", "telegram_link"];
const modes: Array<[string, AgentConfig]> = [
  ["ask_always", cfgWith((c) => { c.allowedModules = ALL_MODULES; })],
  ["auto_safe", cfgWith((c) => { c.mode = "auto_safe"; c.allowedModules = ALL_MODULES; })],
  ["auto_total", cfgWith((c) => { activeAuto(c); c.allowedModules = ALL_MODULES; })],
  [
    "permitido siempre",
    cfgWith((c) => {
      c.mode = "auto_safe";
      c.allowedModules = ALL_MODULES;
      for (const n of never) c.levels.app[n] = "allow";
    }),
  ],
];
for (const [mname, cfg] of modes) {
  for (const n of never) {
    const d = decide(n, {}, ctx({ config: cfg }));
    ok(d.action !== "allow", `nunca automático: ${n} no pasa solo en ${mname}`);
    ok(d.action === "ask" && !d.canAlways, `nunca automático: ${n} pregunta y no ofrece "siempre" en ${mname}`);
  }
}
for (const n of ["permissions_change", "agent_config_change", "telegram_link"]) {
  const c = cfgWith((x) => {
    x.channels.telegram.enabled = true;
    x.allowedModules = ALL_MODULES;
  });
  ok(decide(n, {}, ctx({ config: c, channel: "telegram" })).action === "deny", `${n} no se puede hacer desde Telegram`);
}
// lotes
const batchCfg = cfgWith(activeAuto);
ok(decide("t_write", { ml: 100, items: [1, 2, 3] }, ctx({ config: batchCfg })).action === "allow", "lote de 3 (N=3) pasa en auto_total");
ok(decide("t_write", { ml: 100, items: [1, 2, 3, 4] }, ctx({ config: batchCfg })).action === "ask", "lote de 4 (>N) pregunta aun en auto_total");
ok(neverAutoCodes("t_write", { items: [1, 2, 3, 4] }, ctx({ config: batchCfg })).includes("batch"), "código 'batch'");
const n1 = cfgWith((c) => {
  activeAuto(c);
  c.limits.maxBatch = 1;
});
ok(decide("t_write", { ml: 100, items: [1, 2] }, ctx({ config: n1 })).action === "ask", "maxBatch configurable a la baja");
ok(sanitizeConfig({ limits: { maxBatch: 99 } }).limits.maxBatch === 5, "maxBatch no sube del tope duro (5)");
ok(decide("t_write", { ml: 100 }, ctx({ config: batchCfg, batchSize: 9 })).action === "ask", "tamaño de propuesta (batchSize) también cuenta");
// origen no confiable
for (const [mname, cfg] of modes) {
  ok(decide("t_write", { ml: 100 }, ctx({ config: cfg, origin: "untrusted" as Origin })).action === "ask", `origen no confiable: escritura pregunta en ${mname}`);
}
ok(decide("t_read", {}, ctx({ config: safe, origin: "untrusted" })).action === "allow", "origen no confiable: la lectura no se frena");
ok(
  decide("t_write", { ml: 100 }, ctx({ config: cfgWith((c) => { activeAuto(c); c.levels.app.t_write = "block"; }), origin: "untrusted" })).action === "deny",
  "no confiable + bloqueada = denegar",
);

// ── 7. saneamiento (el servidor no confía en el cliente) ───────────
const s = sanitizeConfig({
  mode: "auto_total",
  autoTotal: { duration: "x" },
  writesPerHour: 99999,
  limits: { waterMaxMl: -5 },
  channels: { telegram: { maxMode: "auto_total", enabled: true } },
  levels: { app: { t_write: "allow", t_x: "root" } },
  allowedModules: ["agua", "hack"],
});
ok(s.mode === "ask_always", "sanea: modo inválido → ask_always");
ok(s.autoTotal === null, "sanea: autoTotal inválido → null");
ok(s.writesPerHour === 120, "sanea: tope duro de escrituras");
ok(s.limits.waterMaxMl === 50, "sanea: mínimo de agua");
ok(s.channels.telegram.maxMode === "ask_always", "sanea: Telegram no puede subir a auto_total");
ok(s.levels.app.t_write === "allow" && s.levels.app.t_x === undefined, "sanea: niveles válidos sí, basura no");
ok(s.allowedModules.length === 1 && s.allowedModules[0] === "agua", "sanea: módulos desconocidos fuera");
ok(sanitizeConfig(null).mode === "ask_always" && sanitizeConfig("x").version === 1, "sanea: basura → valores por defecto");

// ── 8. responder a un permiso ──────────────────────────────────────
const dAsk = decide("t_write", { ml: 100 }, ctx());
const r1 = applyAnswer(defaultAgentConfig(), "t_write", "app", "allow_always", dAsk);
ok(r1.execute && r1.config.levels.app.t_write === "allow", "permitir siempre guarda el nivel");
const r2 = applyAnswer(defaultAgentConfig(), "t_write", "app", "allow_once", dAsk);
ok(r2.execute && r2.config.levels.app.t_write === undefined, "permitir esta vez no guarda nada");
const r3 = applyAnswer(defaultAgentConfig(), "t_write", "app", "deny", dAsk);
ok(!r3.execute, "denegar no ejecuta");
const dNever = decide("habit_complete", {}, ctx({ config: cfgWith((c) => { c.allowedModules = ["habitos"]; }) }));
const r4 = applyAnswer(defaultAgentConfig(), "habit_complete", "app", "allow_always", dNever);
ok(r4.execute && r4.config.levels.app.habit_complete === undefined, "permitir siempre NO se guarda para la lista fija");

// ── 9. plan paso a paso ────────────────────────────────────────────
const plan = buildPlan(
  "p1",
  [
    { id: "a", tool: "t_write", args: { ml: 100 } },
    { id: "b", tool: "t_write", args: { ml: 200 } },
    { id: "c", tool: "t_read", args: {} },
  ],
  ctx({ config: safeAllow }),
);
ok(planNeedsReview(plan), "dos escrituras → se revisa el plan");
ok(plan.steps[0].decision.action === "allow", "paso permitido");
const onePlan = buildPlan("p2", [{ id: "a", tool: "t_write", args: { ml: 100 } }], ctx({ config: safeAllow }));
ok(!planNeedsReview(onePlan), "una sola escritura permitida no pide revisión");
const askPlan = buildPlan("p3", [{ id: "a", tool: "t_write", args: { ml: 100 } }], ctx());
ok(planNeedsReview(askPlan), "un paso que pide permiso → se revisa");
const approved = approveAll(askPlan);
ok(approved.steps[0].status === "approved", "aprobar todo");
const skipped = skipStep(approved, "a");
ok(skipped.steps[0].status === "skipped" && isPlanFinished(skipped), "saltar paso");
const bad = buildPlan("p4", [{ id: "a", tool: "t_write", args: { ml: 99999 } }], ctx());
ok(bad.steps[0].status === "denied" && approveAll(bad).steps[0].status === "denied", "un paso denegado por política no se puede aprobar");
const edited = editStep(bad, "a", { ml: 100 }, ctx());
ok(edited.steps[0].status === "pending" && edited.steps[0].decision.action === "ask", "editar y reevaluar un paso");
const manyPlan = buildPlan("p5", [1, 2, 3, 4].map((i) => ({ id: String(i), tool: "t_write", args: { ml: 10 } })), ctx({ config: cfgWith(activeAuto) }));
ok(manyPlan.steps.every((x) => x.decision.action === "ask"), "plan con 4 escrituras (>N) pide confirmación aun en auto_total");

// ── 10. historial ──────────────────────────────────────────────────
const h = mergeHistory(
  [{ id: "1", at: 1, channel: "app", tool: "t", args: {}, summary: "a", ok: true }],
  [
    { id: "1", at: 1, channel: "app", tool: "t", args: {}, summary: "a", ok: true, undone: true },
    { id: "2", at: 5, channel: "telegram", tool: "t", args: {}, summary: "b", ok: true },
  ],
);
ok(h.length === 2 && h[0].id === "2" && h.find((x) => x.id === "1")?.undone === true, "merge de historial: une, ordena y conserva 'deshecho'");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
