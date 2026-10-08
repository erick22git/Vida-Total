// Comprobación REAL del bucle completo (modelo + delegación + herramientas simuladas). No imprime la clave.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/live_flow_check.ts "pregunta"
import { readFileSync } from "node:fs";
import { callLlm, type LlmMessage } from "../../src/lib/agent/llm";
import { buildSystemPrompt } from "../../src/lib/agent/prompt";
import { AGENTS, type AgentId } from "../../src/lib/agent/agents";
import { routeAgent } from "../../src/lib/agent/router";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const agenda = { fecha: "2026-10-07", tareas: [{ id: "t1", titulo: "Pagar internet", hecha: false, prioridad: "alta", aviso: "18:00", subtareas: [{ titulo: "Buscar factura", hecha: true }, { titulo: "Transferir", hecha: false }] }], subtareasConFechaHoy: [], vencidasPendientes: [{ titulo: "Renovar carnet", venciaEl: "2026-10-05", subtareasPendientes: 1 }], sinFechaPendientes: [], bloques: [{ titulo: "Universidad", desde: "08:00", hasta: "12:00" }], rutina: Array.from({ length: 12 }, (_, i) => ({ hora: `${String(7 + i).padStart(2, "0")}:00`, paso: `Paso ${i + 1} de la rutina`, rutina: "Mañana" })) };
const tools: Record<string, unknown> = { agenda_today: agenda, task_list: [{ id: "t1", title: "Pagar internet", done: false, priority: "alta", subtasks: [] }], training_today: { dia: "miércoles", ejercicios: ["Press banca", "Remo"] }, day_totals: { calorias: 1200, aguaMl: 1600 } };

async function main() {
  const text = process.argv[2] ?? "que pendientes tengo hoy y cual es mi rutina";
  let agent: AgentId = (await routeAgent({ text }, async () => null)).agent;
  console.log("agente inicial:", agent);
  let messages: LlmMessage[] = [{ role: "user", content: text }];
  for (let it = 0; it < 5; it++) {
    const sys: LlmMessage = { role: "system", content: buildSystemPrompt({ today: "2026-10-07", time: "10:00", weekday: "miércoles", channel: "telegram", agentName: AGENTS[agent].name, agentInstructions: AGENTS[agent].instructions }) };
    const r = await callLlm([sys, ...messages], { agent });
    if (!r.ok) return console.log("error", r.error);
    const calls = r.message.tool_calls ?? [];
    console.log(`iter ${it} [${agent}] llamadas: ${calls.map((c) => c.function.name + c.function.arguments.slice(0, 60)).join(" | ") || "—"} | texto: ${JSON.stringify(r.message.content)?.slice(0, 80)}`);
    const del = calls.find((c) => c.function.name === "delegate");
    if (del) { const a = JSON.parse(del.function.arguments); agent = a.agent; messages = [{ role: "user", content: a.request }]; continue; }
    messages.push({ role: "assistant", content: r.message.content, tool_calls: calls.length ? calls : undefined });
    if (!calls.length) { console.log("---- RESPUESTA FINAL ----\n" + r.message.content); return; }
    for (const c of calls) messages.push({ role: "tool", tool_call_id: c.id, name: c.function.name, content: JSON.stringify({ ok: true, summary: c.function.name === "agenda_today" ? "Agenda del día" : "Tareas", data: tools[c.function.name] }).slice(0, 6000) });
  }
}
main();
