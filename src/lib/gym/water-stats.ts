import { format, isSameDay, isSameMonth } from "date-fns";
import type { WaterEntry } from "@/lib/types";
import { ALL_DRINKS, applyDrinkOverride, type DrinkOption, type DrinkOverride } from "@/lib/data/drinks";

const AGUA_FALLBACK: DrinkOption = { id: "agua", nombre: "Agua", emoji: "💧", color: "#3b82f6", hidratacion: 100 };

/** Metadata (nombre/emoji/color) de la bebida de un registro — el nombre/emoji
 * usa lo guardado en el propio registro (así conserva el histórico aunque
 * luego se edite el catálogo), pero el COLOR sí se lee en vivo del catálogo +
 * overrides, para que cambiar el color de una bebida se refleje de inmediato
 * en la botella y las estadísticas. Si no tiene bebida (accesos rápidos
 * +150ml, etc.) cae a Agua. */
export function drinkMetaForEntry(
  entry: WaterEntry,
  overrides: Record<string, DrinkOverride> = {},
): { id: string; nombre: string; emoji: string; color: string } {
  const id = entry.drinkId ?? "agua";
  const base = ALL_DRINKS.find((d) => d.id === id) ?? AGUA_FALLBACK;
  return {
    id,
    nombre: entry.drinkNombre ?? base.nombre,
    emoji: entry.drinkEmoji ?? base.emoji,
    color: applyDrinkOverride(base, overrides[id]).color,
  };
}

/** Color "en vivo" de una bebida por id, aplicando overrides del usuario si existen. */
export function drinkColorById(id: string, overrides: Record<string, DrinkOverride>): string {
  const base = ALL_DRINKS.find((d) => d.id === id) ?? AGUA_FALLBACK;
  return applyDrinkOverride(base, overrides[id]).color;
}

export function groupWaterByDay(entries: WaterEntry[]): Map<string, WaterEntry[]> {
  const map = new Map<string, WaterEntry[]>();
  for (const e of entries) {
    const key = format(new Date(e.timestamp), "yyyy-MM-dd");
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

export function totalMl(entries: WaterEntry[]): number {
  return entries.reduce((sum, e) => sum + e.ml, 0);
}

export function totalMlForDay(entries: WaterEntry[], date: Date): number {
  return totalMl(entries.filter((e) => isSameDay(new Date(e.timestamp), date)));
}

export function totalMlForMonth(entries: WaterEntry[], date: Date): number {
  return totalMl(entries.filter((e) => isSameMonth(new Date(e.timestamp), date)));
}

export interface DrinkTotal {
  drinkId: string;
  nombre: string;
  emoji: string;
  color: string;
  ml: number;
}

/** Agrupa un conjunto de registros por bebida, sumando ml de cada una. */
export function totalsByDrink(entries: WaterEntry[], overrides: Record<string, DrinkOverride> = {}): DrinkTotal[] {
  const map = new Map<string, DrinkTotal>();
  for (const e of entries) {
    const meta = drinkMetaForEntry(e, overrides);
    const cur = map.get(meta.id);
    if (cur) cur.ml += e.ml;
    else map.set(meta.id, { drinkId: meta.id, nombre: meta.nombre, emoji: meta.emoji, color: meta.color, ml: e.ml });
  }
  return Array.from(map.values()).sort((a, b) => b.ml - a.ml);
}
