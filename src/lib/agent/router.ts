/**
 * Enrutamiento a agentes. PURO salvo por la función `classify` que se inyecta (una llamada corta al modelo).
 * Orden: 1) comando de Telegram (/comida /tareas /entreno) · 2) palabras clave · 3) módulo de la pantalla actual ·
 * 4) solo si es ambiguo o no hay pista: clasificación corta · 5) si sigue sin estar claro: General (que pregunta).
 */
import { AGENTS, SPECIALISTS, isAgentId, type AgentId } from "./agents";

export const normalizeText = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();

/** "/gym/calorias/lista" → "gym:calorias"; "/habitos/agenda" → "habitos"; "/" → "". */
export function screenKey(pathname: string): string {
  const seg = pathname.split("?")[0].split("/").filter(Boolean);
  if (seg.length === 0) return "";
  return seg[0] === "gym" && seg[1] ? `gym:${seg[1]}` : seg[0];
}

export function agentForScreen(screen: string | undefined): AgentId | null {
  if (!screen) return null;
  return SPECIALISTS.find((id) => AGENTS[id].screens.includes(screen)) ?? null;
}

export function agentForCommand(cmd: string): AgentId | null {
  const c = cmd.toLowerCase();
  return SPECIALISTS.find((id) => AGENTS[id].commands.includes(c)) ?? null;
}

/** Cuántas palabras clave de cada especialista aparecen en el texto (coincidencia por inicio de palabra). */
export function keywordScores(text: string): Record<string, number> {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const out: Record<string, number> = {};
  for (const id of SPECIALISTS) {
    let n = 0;
    for (const kw of AGENTS[id].keywords) {
      // "ml" / "kcal" son cortas: exigen la palabra entera (o número pegado: "250ml").
      const short = kw.length <= 3;
      if (words.some((w) => (short ? w === kw || /^\d+$/.test(w.slice(0, -kw.length)) && w.endsWith(kw) : w.startsWith(kw)))) n++;
    }
    if (n > 0) out[id] = n;
  }
  return out;
}

export type RouteDecision =
  | { agent: AgentId; reason: "command" | "keywords" | "screen" | "classifier" | "fallback" }
  | { agent: null; reason: "ambiguous"; candidates: AgentId[] };

export function routeByRules(input: { text: string; screen?: string; command?: string }): RouteDecision {
  if (input.command) {
    const a = agentForCommand(input.command);
    if (a) return { agent: a, reason: "command" };
  }
  const scores = keywordScores(input.text);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[AgentId, number]>;
  if (ranked.length === 1) return { agent: ranked[0][0], reason: "keywords" };
  if (ranked.length > 1) {
    if (ranked[0][1] - ranked[1][1] >= 2) return { agent: ranked[0][0], reason: "keywords" };
    return { agent: null, reason: "ambiguous", candidates: ranked.map(([id]) => id) };
  }
  const byScreen = agentForScreen(input.screen);
  if (byScreen) return { agent: byScreen, reason: "screen" };
  return { agent: null, reason: "ambiguous", candidates: [] };
}

export function classifierPrompt(text: string): string {
  return [
    "Clasifica la petición de un usuario de una app personal. Responde SOLO con una palabra:",
    "nutricion (comidas, agua, calorías) · entrenamiento (gym, ejercicios, rangos) · organizacion (tareas, notas, agenda, rutinas) · general (saludo, duda, o no está claro).",
    `Petición: """${text.slice(0, 400)}"""`,
  ].join("\n");
}

export function parseClassification(out: string | null | undefined): AgentId | null {
  const w = normalizeText(out ?? "").split(" ")[0];
  const map: Record<string, AgentId> = { nutricion: "nutricion", entrenamiento: "entrenamiento", organizacion: "organizacion", general: "general" };
  return map[w] ?? null;
}

/** Decide el agente. `classify` hace la llamada corta al modelo; si falla o no está, queda General. */
export async function routeAgent(input: { text: string; screen?: string; command?: string }, classify?: (text: string) => Promise<string | null>): Promise<{ agent: AgentId; reason: string }> {
  const r = routeByRules(input);
  if (r.agent) return { agent: r.agent, reason: r.reason };
  if (classify) {
    try {
      const a = parseClassification(await classify(input.text));
      if (a) return { agent: a, reason: "classifier" };
    } catch {
      /* sin clasificación: General */
    }
  }
  return { agent: "general", reason: "fallback" };
}

export { isAgentId };
