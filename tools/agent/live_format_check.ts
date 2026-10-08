// Comprobación REAL del formato de horario/pendientes en Telegram (usa GROQ_API_KEY de .env.local; no la imprime).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/live_format_check.ts
import { readFileSync } from "node:fs";
import { callLlm, type LlmMessage } from "../../src/lib/agent/llm";
import { buildSystemPrompt } from "../../src/lib/agent/prompt";
import { AGENTS } from "../../src/lib/agent/agents";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const data = { fecha: "2026-10-07", tareas: [{ id: "t1", titulo: "Pagar internet", hecha: false }, { id: "t2", titulo: "Llamar al dentista", hecha: true }], bloques: [{ titulo: "Universidad", desde: "08:00", hasta: "12:00" }], rutina: [{ hora: "07:00", paso: "Tomar agua", rutina: "Mañana" }, { hora: "07:30", paso: "Estirar", rutina: "Mañana" }] };
async function main() {
  const system: LlmMessage = { role: "system", content: buildSystemPrompt({ today: "2026-10-07", time: "10:00", weekday: "miércoles", channel: "telegram", agentName: AGENTS.general.name, agentInstructions: AGENTS.general.instructions }) };
  const msgs: LlmMessage[] = [system, { role: "user", content: "pasame mi horario de hoy" }, { role: "assistant", content: null, tool_calls: [{ id: "a", type: "function", function: { name: "agenda_today", arguments: "{}" } }] }, { role: "tool", tool_call_id: "a", name: "agenda_today", content: JSON.stringify({ ok: true, summary: "Agenda del día", data }) }];
  const r = await callLlm(msgs, { agent: "general" });
  console.log(r.ok ? r.message.content : `error ${r.error}`);
}
main();
