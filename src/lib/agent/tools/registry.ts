/** Registro único de herramientas del agente (metadatos). Cada fase agrega su lista aquí. */
import type { ToolMeta } from "./meta";
import { NOTE_TOOLS } from "./notes";
import { NUTRITION_TOOLS } from "./nutrition";
import { READER_TOOLS } from "./readers";
import { SYSTEM_TOOLS } from "./system";
import { TASK_TOOLS } from "./tasks";

const ALL: ToolMeta[] = [...SYSTEM_TOOLS, ...TASK_TOOLS, ...NOTE_TOOLS, ...NUTRITION_TOOLS, ...READER_TOOLS];

export const TOOLS: Record<string, ToolMeta> = Object.fromEntries(ALL.map((t) => [t.name, t]));

/** Solo para pruebas: agrega una herramienta de mentira al registro. */
export function registerToolForTests(t: ToolMeta) {
  ALL.push(t);
  TOOLS[t.name] = t;
}

export function getTool(name: string): ToolMeta | undefined {
  return Object.prototype.hasOwnProperty.call(TOOLS, name) ? TOOLS[name] : undefined;
}

/** Herramientas que se le ofrecen al modelo. */
export function exposedTools(): ToolMeta[] {
  return ALL.filter((t) => t.exposed);
}

export function toolsByModule(): Map<string, ToolMeta[]> {
  const out = new Map<string, ToolMeta[]>();
  for (const t of ALL) out.set(t.module, [...(out.get(t.module) ?? []), t]);
  return out;
}
