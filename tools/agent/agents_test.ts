// Pruebas de agentes: enrutamiento y mínimo privilegio (ningún especialista llama herramientas ajenas).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/agents_test.ts
import { AGENTS, AGENT_IDS, CHAT_AGENTS, SPECIALISTS, agentAllowsTool } from "../../src/lib/agent/agents";
import { agentForCommand, classifierPrompt, keywordScores, parseClassification, routeAgent, routeByRules, screenKey } from "../../src/lib/agent/router";
import { decide } from "../../src/lib/agent/permissions";
import { defaultAgentConfig } from "../../src/lib/agent/config";
import { toolSchemas } from "../../src/lib/agent/llm";
import { TOOLS, getTool } from "../../src/lib/agent/tools/registry";
import { NEVER_AUTO } from "../../src/lib/agent/never-auto";
import { AGENT_MODULES } from "../../src/lib/agent/types";
import type { AgentConfig } from "../../src/lib/agent/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// ── estructura ─────────────────────────────────────────────────────
ok(AGENT_IDS.join() === "general,nutricion,entrenamiento,organizacion,recordatorios", "los 5 agentes");
ok(!AGENTS.recordatorios.chat && AGENTS.recordatorios.tools.length === 0, "Recordatorios: sin chat y sin herramientas");
ok(CHAT_AGENTS.length === 4 && SPECIALISTS.length === 3, "4 agentes de chat, 3 especialistas");
for (const id of AGENT_IDS) for (const t of AGENTS[id].tools) ok(!!getTool(t), `${id}: la herramienta ${t} existe`);
ok(AGENT_IDS.every((id) => Object.values(AGENTS[id].defaultLevels).every((l) => l !== "allow")), "ningún agente trae permisos por defecto más amplios que «preguntar»");
ok(AGENTS.general.canDelegate && SPECIALISTS.every((id) => !AGENTS[id].canDelegate), "solo General delega (profundidad máxima 1)");
ok(AGENTS.entrenamiento.tools.every((t) => getTool(t)!.kind === "read"), "Entrenamiento es solo lectura");
ok(AGENTS.general.tools.every((t) => getTool(t)!.kind === "read"), "General solo tiene lecturas (para cambiar algo delega)");
ok(AGENTS.organizacion.tools.filter((t) => getTool(t)!.kind !== "read").every((t) => /^(task|subtask|note)_/.test(t)), "Organización escribe solo tareas y notas");
ok(!AGENTS.organizacion.tools.includes("water_add") && !AGENTS.nutricion.tools.includes("task_create"), "ámbitos separados");

// ── toolSchemas: cada agente ve solo lo suyo ───────────────────────
const names = (a: (typeof AGENT_IDS)[number]) => toolSchemas(a).map((t) => t.function.name).sort().join();
ok(names("nutricion") === [...AGENTS.nutricion.tools].sort().join(), "Nutrición ve solo sus herramientas");
ok(names("organizacion") === [...AGENTS.organizacion.tools].sort().join(), "Organización ve solo las suyas");
ok(toolSchemas("general").some((t) => t.function.name === "delegate") && !toolSchemas("nutricion").some((t) => t.function.name === "delegate"), "`delegate` solo lo ve General");
ok(toolSchemas("recordatorios").length === 0, "Recordatorios no ve herramientas");
ok(toolSchemas().length === 0, "sin agente no se ofrece nada");

// ── MÍNIMO PRIVILEGIO en el motor de permisos ──────────────────────
const wide: AgentConfig = { ...defaultAgentConfig(), mode: "auto_safe", allowedModules: [...AGENT_MODULES], autoTotal: { duration: "until_off", startedAt: Date.now(), sessionId: "s" } };
const ctx = (agent?: string) => ({ channel: "app" as const, origin: "user" as const, config: wide, now: Date.now(), recentWrites: [], agent });
const sample: Record<string, unknown> = {
  task_list: {}, note_list: {}, day_totals: {}, agenda_today: {}, training_today: {}, ranks_summary: {},
  water_add: { ml: 250 }, food_log: { items: [{ texto: "arroz" }] },
  task_create: { title: "x" }, task_update: { id: "t", title: "y" }, task_complete: { id: "t" },
  subtask_add: { taskId: "t", title: "s" }, subtask_complete: { taskId: "t", subtaskId: "s" },
  note_create: { title: "n" }, note_update: { id: "n", title: "m" },
};
let foreign = 0;
for (const id of AGENT_IDS) {
  for (const name of Object.keys(TOOLS)) {
    if (!(name in sample)) continue;
    const own = AGENTS[id].tools.includes(name);
    const d = decide(name, sample[name], ctx(id));
    if (!own) {
      foreign++;
      ok(d.action === "deny", `${id} NO puede llamar ${name} (ajena)`);
    } else {
      ok(!(d.action === "deny" && d.reasons.some((r) => r.includes("no es de este agente"))), `${id} sí puede llamar ${name} (propia)`);
    }
  }
}
ok(foreign > 20, `se probaron ${foreign} combinaciones agente × herramienta ajena`);
ok(decide("delegate", { agent: "nutricion", request: "x" }, ctx("general")).action === "deny", "`delegate` no es una herramienta de datos: el motor de permisos no la acepta");
for (const n of ["habit_complete", "data_delete", "permissions_change", "agent_config_change", "telegram_link"]) {
  for (const id of AGENT_IDS) ok(decide(n, {}, ctx(id)).action === "deny", `${id} no puede ni intentar ${n}`);
}
ok(decide("water_add", { ml: 250 }, ctx(undefined)).action !== "deny", "sin agente (código propio) no se aplica el filtro");
ok(!agentAllowsTool("inventado", "task_list") && agentAllowsTool(undefined, "task_list"), "agente desconocido = sin herramientas");
ok(decide("water_add", { ml: 250 }, { ...ctx("nutricion"), origin: "untrusted" }).action === "ask", "la regla de contenido no confiable sigue aplicando a los especialistas");
ok(decide("food_log", { items: [1, 2, 3, 4].map((i) => ({ texto: `a${i}` })) }, ctx("nutricion")).action === "ask", "«por lotes» sigue aplicando");
ok(NEVER_AUTO.length === 7, "la lista «nunca automático» no cambió");

// ── enrutamiento ───────────────────────────────────────────────────
const r = (text: string, screen?: string, command?: string) => routeByRules({ text, screen, command });
ok(r("registra 250 ml de agua").agent === "nutricion", "agua → Nutrición");
ok(r("comí arroz con pollo al almuerzo").agent === "nutricion", "comida → Nutrición");
ok(r("¿cuántas calorías llevo?").agent === "nutricion", "calorías → Nutrición");
ok(r("crea una tarea para mañana").agent === "organizacion", "tarea → Organización");
ok(r("anota en una nota que compre pan").agent === "organizacion", "nota → Organización");
ok(r("¿qué entreno hoy?").agent === "entrenamiento", "entreno → Entrenamiento");
ok(r("¿cuál es mi rango en pecho?").agent === "entrenamiento", "rango → Entrenamiento");
ok(r("hola").agent === null, "saludo sin pantalla → ambiguo");
ok(r("hola", "gym:calorias").agent === "nutricion" && r("hola", "gym:calorias").reason === "screen", "sin pistas, manda la pantalla (Calorías)");
ok(r("hola", "habitos").agent === "organizacion", "sin pistas, Hábitos → Organización");
ok(r("hola", "gym:entrenamiento").agent === "entrenamiento", "sin pistas, Entrenamiento");
ok(r("hola", "finanzas").agent === null, "pantalla sin agente → ambiguo");
ok(r("crea una tarea", "gym:calorias").agent === "organizacion", "las palabras clave ganan a la pantalla");
const mixed = r("anota una tarea y registra agua");
ok(mixed.agent === null && mixed.reason === "ambiguous" && mixed.candidates.length === 2, "dos áreas empatadas → ambiguo (a clasificar)");
ok(r("registra agua, vaso, ml y comida; anota una tarea").agent === "nutricion", "una área gana por ≥ 2 pistas");
ok(r("250ml").agent === "nutricion" && r("tomé 300 ml").agent === "nutricion", "«ml» pegado a un número");
ok(r("yoga facial").agent === null, "«ml» corta no coincide dentro de otras palabras");
ok(r("x", undefined, "comida").agent === "nutricion" && r("x", undefined, "tareas").agent === "organizacion" && r("x", undefined, "entreno").agent === "entrenamiento", "comandos de Telegram");
ok(agentForCommand("nope") === null && agentForCommand("start") === null, "comando desconocido");
ok(screenKey("/gym/calorias/lista") === "gym:calorias" && screenKey("/habitos/agenda") === "habitos" && screenKey("/") === "", "screenKey");
ok(Object.keys(keywordScores("agua y tarea")).length === 2, "keywordScores cuenta por agente");
ok(parseClassification("Nutrición") === "nutricion" && parseClassification("organizacion.") === "organizacion" && parseClassification("quizás") === null && parseClassification(null) === null, "parseClassification");
ok(classifierPrompt("hola").includes("hola"), "classifierPrompt");

// ── enrutamiento asíncrono con clasificador inyectado ──────────────
async function main() {
  let called = 0;
  const cls = async (out: string | null) => async () => {
    called++;
    return out;
  };
  const a1 = await routeAgent({ text: "registra agua" }, await cls("organizacion"));
  ok(a1.agent === "nutricion" && called === 0, "si las reglas deciden NO se llama al clasificador");
  const a2 = await routeAgent({ text: "hola qué tal" }, await cls("entrenamiento"));
  ok(a2.agent === "entrenamiento" && a2.reason === "classifier" && called === 1, "ambiguo → clasificación corta");
  const a3 = await routeAgent({ text: "hola qué tal" }, await cls("no sé"));
  ok(a3.agent === "general" && a3.reason === "fallback", "clasificación sin sentido → General (que pregunta)");
  const a4 = await routeAgent({ text: "hola qué tal" }, async () => {
    throw new Error("429");
  });
  ok(a4.agent === "general", "si el proveedor falla → General");
  const a5 = await routeAgent({ text: "hola qué tal" });
  ok(a5.agent === "general", "sin clasificador → General");
  const a6 = await routeAgent({ text: "cualquier cosa", screen: "habitos" }, await cls("nutricion"));
  ok(a6.agent === "organizacion" && a6.reason === "screen", "la pantalla evita la llamada al clasificador");

  console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
  process.exit(fails === 0 ? 0 : 1);
}
main();
