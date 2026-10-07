// Comprobación REAL del modelo y de los agentes (usa GROQ_API_KEY de .env.local; no imprime la clave).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/live_llm_check.ts
import { readFileSync } from "node:fs";
import { callLlm, classifyShort, parseArgs, type LlmMessage } from "../../src/lib/agent/llm";
import { decide } from "../../src/lib/agent/permissions";
import { defaultAgentConfig } from "../../src/lib/agent/config";
import { buildSystemPrompt } from "../../src/lib/agent/prompt";
import { AGENTS, type AgentId } from "../../src/lib/agent/agents";
import { classifierPrompt, parseClassification, routeAgent } from "../../src/lib/agent/router";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
console.log("GROQ_API_KEY presente:", !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "TU_API_KEY_AQUI");

const cfg = defaultAgentConfig();
let totalCalls = 0;

async function ask(agent: AgentId, text: string) {
  const system: LlmMessage = {
    role: "system",
    content: buildSystemPrompt({ today: "2026-10-07", time: "10:30", weekday: "miércoles", channel: "app", agentName: AGENTS[agent].name, agentInstructions: AGENTS[agent].instructions }),
  };
  const res = await callLlm([system, { role: "user", content: text }], { agent });
  totalCalls += res.meta.calls;
  if (!res.ok) {
    console.log(`  ✗ [${agent}] "${text}" → error: ${res.error} (llamadas ${res.meta.calls}, 429: ${res.meta.rateLimited})`);
    return [];
  }
  const calls = res.message.tool_calls ?? [];
  const desc = calls.map((c) => {
    const p = parseArgs(c.function.arguments);
    const d = c.function.name === "delegate" ? "delegación" : decide(c.function.name, p.ok ? p.args : {}, { channel: "app", origin: "user", config: cfg, now: Date.now(), recentWrites: [], agent }).action;
    return `${c.function.name}(${c.function.arguments.slice(0, 70)}) → ${d}`;
  });
  console.log(`  [${agent}] "${text}" → ${desc.join(" | ") || `texto: ${JSON.stringify(res.message.content)?.slice(0, 70)}`}  (llamadas ${res.meta.calls}${res.meta.fallback ? ", con modelo de respaldo" : ""})`);
  return calls;
}

async function main() {
  console.log("1) LECTURA (Organización):");
  await ask("organizacion", "¿Qué tareas tengo pendientes?");
  console.log("2) ESCRITURA con confirmación (Nutrición):");
  await ask("nutricion", "Registra 250 ml de agua");
  console.log("3) Límite (Nutrición, 3 litros):");
  await ask("nutricion", "Registra 3 litros de agua de una vez");
  console.log("4) General delega:");
  const g = await ask("general", "Registra 250 ml de agua");
  console.log("   ¿delegó a nutrición?", g.some((c) => c.function.name === "delegate" && c.function.arguments.includes("nutricion")));
  console.log("5) Mínimo privilegio: Organización NO ofrece herramientas de agua:");
  const o = await ask("organizacion", "Registra 250 ml de agua");
  console.log("   ¿llamó water_add?", o.some((c) => c.function.name === "water_add"), "(debe ser false)");
  console.log("6) Entrenamiento (lectura):");
  await ask("entrenamiento", "¿Qué entreno hoy?");
  console.log("7) Clasificación corta de una petición ambigua:");
  const t0 = "Necesito acordarme de pagar el internet el viernes";
  const c = await classifyShort(classifierPrompt(t0));
  totalCalls += c.meta.calls;
  console.log(`   "${t0}" → ${JSON.stringify(c.text)} → ${parseClassification(c.text)}`);
  const r = await routeAgent({ text: "hola, ¿qué tal?" }, async (t) => (await classifyShort(classifierPrompt(t))).text);
  console.log("   saludo →", r.agent, `(${r.reason})`);
  console.log(`Total de llamadas al proveedor en esta prueba: ${totalCalls}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
