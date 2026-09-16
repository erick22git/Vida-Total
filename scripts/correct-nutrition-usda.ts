/**
 * Bloque 3 paso 3: compara cada alimento de src/lib/data/foods.json contra
 * USDA FoodData Central y, si la diferencia de calorías supera ~15%,
 * reemplaza sus macros/micronutrientes y lo deja registrado en
 * reporte-correccion-nutricional.md para que Erick lo revise ANTES de que
 * esto se commitee — este script solo escribe en el árbol de trabajo local.
 *
 * Corre con: npx tsx scripts/correct-nutrition-usda.ts
 *
 * Nota sobre BEDCA (paso 4 del pedido original): se evaluó agregarla como
 * respaldo para los platos que USDA no tiene (mayormente platos peruanos/
 * bolivianos compuestos: ceviche, lomo saltado, ají de gallina, causa
 * rellena, papa a la huancaína, anticuchos, tamal). BEDCA no expone una
 * REST API — su único acceso programático es un endpoint que recibe XML
 * con un esquema propio (bedca:query) sin documentación pública clara, y
 * aun si se integrara, es una base de composición ESPAÑOLA — no tiene
 * platos peruanos/bolivianos regionales tampoco. Forzar una coincidencia
 * ahí habría sido tan inventado como el dato actual. Estos alimentos se
 * dejan explícitamente como "no verificado / requiere revisión manual" en
 * el reporte en vez de fabricar una fuente para ellos.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { lookupUsdaNutrition, isUsdaConfigured, getUsdaFoodDetail, normalizeUsdaFood } from "../src/lib/nutrition/usda";
import { USDA_QUERY_MAP } from "./nutrition-query-map.mjs";

config({ path: ".env.local", quiet: true });

if (!isUsdaConfigured()) {
  console.error("USDA_FDC_API_KEY no está configurada en .env.local");
  process.exit(1);
}

const FOODS_PATH = "src/lib/data/foods.json";
const REPORT_PATH = "reporte-correccion-nutricional.md";
const DIFF_THRESHOLD = 0.15;

interface FoodEntry {
  id: string;
  nombre: string;
  categoria: string;
  porcion: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  colesterol?: number;
  sodio?: number;
  fibra?: number;
  azucares?: number;
  micronutrientes?: Record<string, number>;
  [key: string]: unknown;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), 1);
  return Math.abs(a - b) / base;
}

/**
 * CRÍTICO: los alimentos de foods.json reportan sus valores para la
 * porción DECLARADA en `porcion` (que casi nunca es 100g — puede ser
 * "1 unidad (50 g)", "40 g", "1 rebanada (25 g)", etc.), mientras que USDA
 * (Foundation/SR Legacy) siempre reporta por 100g. Sin esta conversión, la
 * primera versión de este script comparó peras con manzanas: "huevo"
 * (78 kcal / 50g) contra USDA huevo crudo (143 kcal / 100g) se veía como
 * "83% de diferencia" cuando en realidad 143 * 50/100 = 71.5 kcal, a solo
 * 8% del valor actual — casi ninguna corrección real, todo era el mismo
 * problema de unidades repetido en decenas de alimentos. Misma lógica que
 * `parsePorcionGramos` en src/lib/food-utils.ts (copiada, no importada,
 * para no depender de la resolución de path aliases de Next.js en un
 * script standalone).
 */
function parsePorcionGramos(porcion: string): number {
  const match = porcion.match(/\(([\d.]+)\s*g\)/) ?? porcion.match(/^([\d.]+)\s*g/);
  if (match) return parseFloat(match[1]);
  const ml = porcion.match(/([\d.]+)\s*ml/);
  if (ml) return parseFloat(ml[1]);
  return 100;
}

async function main() {
  const foods = JSON.parse(readFileSync(FOODS_PATH, "utf-8")) as FoodEntry[];

  const corrected: { id: string; nombre: string; campo: string; antes: number; despues: number; fuente: string }[] = [];
  const noVerificado: { id: string; nombre: string; motivo: string }[] = [];
  const sinCorreccion: string[] = [];

  for (const food of foods) {
    const entry = (USDA_QUERY_MAP as Record<string, string | { fdcId: number } | null | undefined>)[food.id];

    if (entry === undefined) {
      noVerificado.push({ id: food.id, nombre: food.nombre, motivo: "sin entrada en el mapa de queries (revisar scripts/nutrition-query-map.mjs)" });
      food.verificado = false;
      continue;
    }
    if (entry === null) {
      noVerificado.push({ id: food.id, nombre: food.nombre, motivo: "plato compuesto/regional sin equivalente genérico en USDA (ver nota BEDCA en este script)" });
      food.verificado = false;
      continue;
    }

    const isFdcPin = typeof entry === "object";
    process.stdout.write(
      isFdcPin ? `${food.id} (${food.nombre}) -> fdcId fijo ${entry.fdcId} ... ` : `${food.id} (${food.nombre}) -> "${entry}" ... `,
    );
    let result;
    try {
      if (isFdcPin) {
        const detail = await getUsdaFoodDetail(entry.fdcId);
        result = detail ? normalizeUsdaFood(detail) : null;
      } else {
        result = await lookupUsdaNutrition(entry);
      }
    } catch (err) {
      console.log("ERROR:", err);
      noVerificado.push({ id: food.id, nombre: food.nombre, motivo: `error de red/API: ${String(err)}` });
      food.verificado = false;
      await sleep(1200);
      continue;
    }

    if (!result) {
      console.log("SIN RESULTADO");
      const motivo = isFdcPin ? `fdcId fijo ${entry.fdcId} no encontrado o sin datos de energía` : `sin resultados en USDA para "${entry}"`;
      noVerificado.push({ id: food.id, nombre: food.nombre, motivo });
      food.verificado = false;
      await sleep(1200);
      continue;
    }

    const fuente = `USDA FDC #${result.fdcId} (${result.dataType}) — "${result.description}"`;

    // USDA viene por 100g; escalamos a la porción real declarada por el
    // alimento (ver parsePorcionGramos arriba) antes de comparar o
    // reemplazar nada — comparar/reemplazar directo por 100g sin esto
    // fue el bug de la primera versión de este script.
    const gramos = parsePorcionGramos(food.porcion);
    const scale = gramos / 100;
    const caloriasScaled = result.calorias * scale;
    const caloriasDiff = pctDiff(food.calorias, caloriasScaled);
    // Para porciones casi sin calorías (café negro, etc.) un % grande no
    // significa nada en términos absolutos — exige también una diferencia
    // real de al menos 5 kcal para considerarla una corrección.
    const caloriasAbsDiff = Math.abs(food.calorias - caloriasScaled);

    if (caloriasDiff <= DIFF_THRESHOLD || caloriasAbsDiff < 5) {
      console.log(`OK (diferencia ${(caloriasDiff * 100).toFixed(0)}%, dentro de tolerancia)`);
      sinCorreccion.push(food.id);
      food.verificado = true;
      await sleep(1200);
      continue;
    }

    console.log(
      `CORRIGIENDO (${food.calorias} -> ${Math.round(caloriasScaled)} kcal para ${gramos}g, ${(caloriasDiff * 100).toFixed(0)}% de diferencia)`,
    );

    const fields: [string, number | undefined, number][] = [
      ["calorias", result.calorias, food.calorias],
      ["proteina", result.proteina, food.proteina],
      ["carbos", result.carbos, food.carbos],
      ["grasas", result.grasas, food.grasas],
      ["grasasSaturadas", result.grasasSaturadas, food.grasasSaturadas ?? 0],
      ["colesterol", result.colesterol, food.colesterol ?? 0],
      ["sodio", result.sodio, food.sodio ?? 0],
      ["fibra", result.fibra, food.fibra ?? 0],
      ["azucares", result.azucares, food.azucares ?? 0],
    ];

    for (const [campo, nuevoPer100g, viejo] of fields) {
      if (nuevoPer100g === undefined) continue;
      const rounded = Math.round(nuevoPer100g * scale * 100) / 100;
      if (rounded !== viejo) {
        corrected.push({ id: food.id, nombre: food.nombre, campo, antes: viejo, despues: rounded, fuente });
      }
      (food as Record<string, unknown>)[campo] = rounded;
    }

    const microEntries = Object.entries(result.micronutrientes).filter(([, v]) => v !== undefined);
    if (microEntries.length > 0) {
      food.micronutrientes = { ...(food.micronutrientes ?? {}) };
      for (const [k, v] of microEntries) {
        (food.micronutrientes as Record<string, number>)[k] = Math.round((v as number) * scale * 100) / 100;
      }
    }

    food.verificado = true;
    await sleep(1200);
  }

  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf-8");

  const lines: string[] = [];
  lines.push("# Reporte de corrección nutricional (USDA FoodData Central)");
  lines.push("");
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Alimentos corregidos: ${new Set(corrected.map((c) => c.id)).size} de ${foods.length}`);
  lines.push(`Alimentos sin corrección (dentro de ${DIFF_THRESHOLD * 100}% de tolerancia): ${sinCorreccion.length}`);
  lines.push(`Alimentos no verificados (revisión manual): ${noVerificado.length}`);
  lines.push("");
  lines.push("**IMPORTANTE: `src/lib/data/foods.json` ya fue modificado localmente con estas correcciones. NO se subió a git — revisa esta tabla primero y avisa si quieres que se suba tal cual, o que se ajuste algo.**");
  lines.push("");
  lines.push("## Alimentos corregidos");
  lines.push("");
  lines.push("| Alimento | Campo | Valor anterior | Valor nuevo | Fuente |");
  lines.push("|---|---|---|---|---|");
  for (const c of corrected) {
    lines.push(`| ${c.nombre} (\`${c.id}\`) | ${c.campo} | ${c.antes} | ${c.despues} | ${c.fuente} |`);
  }
  lines.push("");
  lines.push("## No verificados (requieren revisión manual)");
  lines.push("");
  lines.push("| Alimento | Motivo |");
  lines.push("|---|---|");
  for (const nv of noVerificado) {
    lines.push(`| ${nv.nombre} (\`${nv.id}\`) | ${nv.motivo} |`);
  }
  lines.push("");
  writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");

  console.log(`\nListo. Reporte en ${REPORT_PATH}`);
}

main();
