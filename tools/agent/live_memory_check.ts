// Comprobación REAL: tras registrar agua, ¿el modelo responde a la pregunta nueva en vez de repetir? (usa GROQ_API_KEY de .env.local; no la imprime)
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/live_memory_check.ts
import { readFileSync } from "node:fs";
import { callLlm, type LlmMessage } from "../../src/lib/agent/llm";
import { buildSystemPrompt } from "../../src/lib/agent/prompt";
import { AGENTS } from "../../src/lib/agent/agents";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const agent = "nutricion" as const;
const system: LlmMessage = { role: "system", content: buildSystemPrompt({ today: "2026-10-07", time: "21:54", weekday: "miércoles", channel: "telegram", agentName: AGENTS[agent].name, agentInstructions: AGENTS[agent].instructions }) };

const structured: LlmMessage[] = [
  { role: "user", content: "Registra 250 ml de agua" },
  { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "water_add", arguments: '{"ml":250}' } }] },
  { role: "tool", tool_call_id: "c1", name: "water_add", content: '{"ok":true,"summary":"Agua +250 ml"}' },
  { role: "assistant", content: "✓ Agua +250 ml" },
];
const flat: LlmMessage[] = [structured[0], structured[3]];

async function main() {
for (const [label, hist] of [["memoria plana (antes)", flat], ["memoria estructurada (ahora)", structured]] as const) {
  for (const q of ["¿Cuántas calorías llevo?", "Comí 200 g de arroz"]) {
    const r = await callLlm([system, ...hist, { role: "user", content: q }], { agent });
    if (!r.ok) { console.log(label, q, "→ error", r.error); continue; }
    const calls = (r.message.tool_calls ?? []).map((c) => `${c.function.name}(${c.function.arguments.slice(0, 60)})`);
    console.log(`${label} | "${q}" → ${calls.join(" | ") || "texto: " + JSON.stringify(r.message.content)?.slice(0, 80)}`);
  }
}
}
main();
