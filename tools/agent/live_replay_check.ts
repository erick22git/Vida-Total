// Comprobación REAL (varias repeticiones): tras una escritura, ¿el modelo responde la pregunta nueva sin repetir la escritura?
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/live_replay_check.ts
import { readFileSync } from "node:fs";
import { callLlm, type LlmMessage } from "../../src/lib/agent/llm";
import { buildSystemPrompt } from "../../src/lib/agent/prompt";
import { AGENTS } from "../../src/lib/agent/agents";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const N = 6;
const WRITES = new Set(["food_log", "water_add"]);
const prior: LlmMessage[] = [
  { role: "user", content: "Comí 200g de arroz blanco" },
  { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "food_log", arguments: '{"items":[{"gramos":200,"texto":"arroz blanco"}],"meal":"cena"}' } }] },
  { role: "tool", tool_call_id: "c1", name: "food_log", content: '{"ok":true,"summary":"Registré 1 alimento(s) en cena (260 kcal)"}' },
  { role: "assistant", content: "✓ Registré 1 alimento(s) en cena (260 kcal)" },
];
const QS = ["Ahora cuantas calorías llevo?", "¿Cuánta agua llevo hoy?"];

async function run(label: string, build: (q: string) => LlmMessage[], model?: string) {
  let replays = 0, total = 0;
  for (const q of QS) for (let i = 0; i < N; i++) {
    const first = await callLlm(build(q), { agent: "nutricion", ...(model ? { model } : {}) });
    await new Promise((r) => setTimeout(r, 2500));
    if (!first.ok) { console.log("  error", first.error); continue; }
    const reads = (first.message.tool_calls ?? []).filter((c) => !WRITES.has(c.function.name));
    const follow: LlmMessage[] = [...build(q), { role: "assistant", content: first.message.content, tool_calls: first.message.tool_calls }];
    for (const c of reads) follow.push({ role: "tool", tool_call_id: c.id, name: c.function.name, content: JSON.stringify({ ok: true, summary: "2278 kcal · 1600 ml de agua", data: { calorias: 2278, aguaMl: 1600, proteina: 90, carbos: 300, grasas: 70, comidas: [{ nombre: "arroz blanco", kcal: 260 }], metas: { calorias: 2400, aguaMl: 3000 } } }) });
    const r = reads.length ? await callLlm(follow, { agent: "nutricion", ...(model ? { model } : {}) }) : first;
    total++;
    if (r.ok && (r.message.tool_calls ?? []).some((c) => WRITES.has(c.function.name))) replays++;
  }
  console.log(`${label}: repite la escritura ${replays}/${total}`);
}
async function main() {
  const sys = (extra = "") => ({ role: "system", content: buildSystemPrompt({ today: "2026-10-07", time: "22:18", weekday: "miércoles", channel: "telegram", agentName: AGENTS.nutricion.name, agentInstructions: AGENTS.nutricion.instructions }) + extra }) as LlmMessage;
  await run("A estructurada (actual)", (q) => [sys(), ...prior, { role: "user", content: q }]);
  const ctx = '\n\nCONTEXTO DE LA CONVERSACIÓN RECIENTE (solo referencia; esas acciones YA SE HICIERON, no las repitas):\n- El usuario dijo «Comí 200g de arroz blanco» → ya registrado: 1 alimento en cena (260 kcal).';
  const SMALL = "openai/gpt-oss-20b";
}
main();
