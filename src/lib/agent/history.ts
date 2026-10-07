/**
 * Historial de acciones del agente, con "deshacer" cuando se puede. Solo tipos y ayudantes puros: guardarlo y aplicar el
 * deshacer es trabajo del store (cliente) y de la tabla `agent_action_log` (acciones hechas desde Telegram).
 */
import type { Args } from "./tools/meta";
import type { Channel } from "./types";

/** Cómo revertir una acción. Siempre usa las acciones normales de la app (no un borrado directo). */
export type UndoSpec =
  | { kind: "remove_water"; id: string }
  | { kind: "remove_food"; id: string }
  | { kind: "remove_foods"; ids: string[] }
  | { kind: "remove_task"; id: string }
  | { kind: "restore_task"; id: string; patch: Record<string, unknown> }
  | { kind: "remove_note"; id: string }
  | { kind: "restore_note"; id: string; patch: Record<string, unknown> };

export interface ActionRecord {
  id: string;
  at: number;
  channel: Channel;
  tool: string;
  args: Args;
  /** Frase para el historial: "Agua +250 ml". */
  summary: string;
  ok: boolean;
  undo?: UndoSpec;
  undone?: boolean;
}

export const MAX_HISTORY = 200;

/** Agrega un registro al principio y recorta. */
export function pushRecord(list: ActionRecord[], rec: ActionRecord): ActionRecord[] {
  return [rec, ...list].slice(0, MAX_HISTORY);
}

/** Merge seguro de dos historiales (local + remoto): une por id, conserva `undone` si alguno lo tiene, ordena por fecha. */
export function mergeHistory(a: ActionRecord[], b: ActionRecord[]): ActionRecord[] {
  const map = new Map<string, ActionRecord>();
  for (const r of [...a, ...b]) {
    const prev = map.get(r.id);
    map.set(r.id, prev ? { ...prev, ...r, undone: prev.undone || r.undone } : r);
  }
  return [...map.values()].sort((x, y) => y.at - x.at).slice(0, MAX_HISTORY);
}

/** Marcas de tiempo de las escrituras exitosas (para los topes por hora y por día). */
export function writeTimestamps(list: ActionRecord[], readTools: ReadonlySet<string>): number[] {
  return list.filter((r) => r.ok && !readTools.has(r.tool)).map((r) => r.at);
}
