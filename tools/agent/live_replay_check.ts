// Comprobación REAL: pedido que pidió permiso y luego se aprobó. ¿Una pregunta nueva repite la escritura?
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
const sys: LlmMessage = { role: "system", content: buildSystemPrompt({ today: "2026-10-07", time: "22:30", weekday: "miércoles", channel: "telegram", agentName: AGENTS.nutricion.name, agentInstructions: AGENTS.nutricion.instructions }) };
const USER: LlmMessage = { role: "user", content: "Comí 200g de papa" };
const scenarios: Array<[string, LlmMessage[]]> = [
  ["ANTES: pedido sin respuesta en la memoria", [USER]],
  ["AHORA: permiso pedido + resultado anotado", [USER, { role: "assistant", content: "Le pedí permiso al usuario para: Registrar comida. Aún no se ejecuta; su resultado llegará en el siguiente aviso. No lo repitas.\nEl usuario respondió a la confirmación. Resultado ya aplicado, no lo repitas:\n✓ Registré 1 alimento(s) en cena (150 kcal)" }]],
];
async function main() {
  for (const [label, mem] of scenarios) {
    let replays = 0, total = 0;
    for (let i = 0; i < N; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const r = await callLlm([sys, ...mem, { role: "user", content: "Ahora cuantas calorías llevo?" }], { agent: "nutricion" });
      if (!r.ok) continue;
      total++;
      if ((r.message.tool_calls ?? []).some((c) => WRITES.has(c.function.name))) replays++;
    }
    console.log(`${label}: propone escribir ${replays}/${total}`);
  }
}
main();
