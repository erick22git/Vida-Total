/**
 * Vincula un alimento líquido registrado en Calorías con la meta de agua (pedido: "si pongo agua ahí
 * o algún líquido se registre en gym/agua automáticamente — por si tomo un batido, cuánta agua tenía
 * el batido"). Busca el NOMBRE del alimento logueado contra el catálogo de bebidas que YA existe
 * (`drinks.ts`) — reusa el mismo % de "hidratación" que ya usa la pantalla de Agua para cada bebida
 * (agua/jugo cuentan casi 1:1; alcohol mucho menos por su efecto diurético real), en vez de inventar
 * un criterio aparte. Un batido logueado como receta se expande en sus ingredientes por separado (ver
 * `commitDraftItems`), así que si uno de ellos es "Agua" o "Leche", ESE ingrediente puntual es el que
 * matchea acá — no hace falta tratar la receta entera como una sola bebida.
 *
 * Sin match en el catálogo (nombre no reconocido como bebida) no se vincula nada — mejor no inventar
 * que adivinar mal cuánta agua aporta un alimento sólido cualquiera.
 */
import { normalizeText } from "@/lib/nutrition/food-resolver";
import { ALL_DRINKS, applyDrinkOverride, type DrinkOption, type DrinkOverride } from "@/lib/data/drinks";

/** Catálogo de bebidas indexado por nombre normalizado, ya con los overrides del usuario aplicados
 * (si renombró una bebida, matchea por ese nombre nuevo). Se construye en el momento, no se cachea
 * entre llamadas, porque los overrides pueden cambiar en cualquier momento. */
export function buildDrinkNameIndex(overrides: Record<string, DrinkOverride> = {}): Map<string, DrinkOption> {
  const map = new Map<string, DrinkOption>();
  for (const base of ALL_DRINKS) {
    const merged = applyDrinkOverride(base, overrides[base.id]);
    map.set(normalizeText(merged.nombre), merged);
  }
  return map;
}

export interface WaterLinkResult {
  drink: DrinkOption;
  aguaMl: number;
}

/**
 * `null` si el nombre no matchea ninguna bebida del catálogo, o si no hay gramos registrados (no se
 * puede calcular sin saber cuánto se tomó).
 */
export function waterLinkForLoggedFood(nombre: string, gramos: number | undefined, drinkIndex: Map<string, DrinkOption>): WaterLinkResult | null {
  if (!gramos || gramos <= 0) return null;
  const drink = drinkIndex.get(normalizeText(nombre));
  if (!drink) return null;
  // 1 g de un líquido ≈ 1 ml (densidad ~1, razonable para agua/jugo/leche/gaseosa — no para aceites,
  // pero esos nunca matchean el catálogo de bebidas).
  const aguaMl = Math.round(gramos * (drink.hidratacion / 100));
  if (aguaMl <= 0) return null;
  return { drink, aguaMl };
}
