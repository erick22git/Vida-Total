/**
 * Tanda 4: refuerza las categorías más flacas que usa el plan de comidas del nutriólogo (Legumbre, Fruto
 * seco, Grasa/Lácteo vegetal, Tubérculo) con más variedad, datos reales de USDA. Misma forma que
 * run-tanda3.ts. Idempotente: salta ids existentes. Uso: npx tsx scripts/run-tanda4.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { getUsdaFoodDetail, normalizeUsdaFood, type NormalizedUsdaNutrition } from "../src/lib/nutrition/usda";

const FOODS_PATH = "src/lib/data/foods.json";

type Estado = "crudo" | "cocido";
interface Item {
  id: string;
  nombre: string;
  categoria: string;
  fdcId: number;
  estado: Estado;
}

const ITEMS: Item[] = [
  // Legumbre
  { id: "lentejas-rojas", nombre: "Lentejas rojas", categoria: "Legumbre", fdcId: 172421, estado: "cocido" },
  { id: "arvejas-partidas", nombre: "Arvejas partidas", categoria: "Legumbre", fdcId: 172429, estado: "cocido" },
  { id: "habas", nombre: "Habas", categoria: "Legumbre", fdcId: 173753, estado: "cocido" },
  { id: "frijoles-lima", nombre: "Frijoles lima", categoria: "Legumbre", fdcId: 173802, estado: "cocido" },
  { id: "hummus", nombre: "Hummus", categoria: "Legumbre", fdcId: 174289, estado: "cocido" },
  // Fruto seco
  { id: "castañas-cajú", nombre: "Castañas de cajú (anacardo)", categoria: "Fruto seco", fdcId: 170162, estado: "crudo" },
  { id: "nuez-pecana", nombre: "Nuez pecana", categoria: "Fruto seco", fdcId: 170182, estado: "crudo" },
  // Semilla
  { id: "semillas-canamo", nombre: "Semillas de cáñamo", categoria: "Semilla", fdcId: 170148, estado: "crudo" },
  { id: "semillas-amapola", nombre: "Semillas de amapola", categoria: "Semilla", fdcId: 171330, estado: "crudo" },
  // Lácteo
  { id: "queso-ricotta", nombre: "Queso ricotta (descremado)", categoria: "Lácteo", fdcId: 171248, estado: "cocido" },
  // Lácteo vegetal
  { id: "leche-avena-sin-azucar", nombre: "Leche de avena sin azúcar", categoria: "Lácteo vegetal", fdcId: 2257046, estado: "cocido" },
  { id: "leche-almendras-sin-azucar", nombre: "Leche de almendras sin azúcar", categoria: "Lácteo vegetal", fdcId: 2257045, estado: "cocido" },
  // Tubérculo
  { id: "chirivia", nombre: "Chirivía", categoria: "Tubérculo", fdcId: 170508, estado: "cocido" },
  { id: "topinambur", nombre: "Topinambur (alcachofa de Jerusalén)", categoria: "Tubérculo", fdcId: 169236, estado: "crudo" },
];

function toProfile(n: NormalizedUsdaNutrition, fdcId: number) {
  const out: Record<string, unknown> = { calorias: n.calorias, proteina: n.proteina, carbos: n.carbos, grasas: n.grasas };
  for (const k of ["grasasSaturadas", "grasasTrans", "grasasMonoinsaturadas", "grasasPoliinsaturadas", "omega3Ala", "omega6Linoleico", "agua", "ceniza", "colesterol", "sodio", "fibra", "azucares", "epa", "dha"] as const) {
    const v = n[k];
    if (v !== undefined) out[k] = v;
  }
  const micros: Record<string, number> = {};
  for (const [k, v] of Object.entries(n.micronutrientes)) if (v !== undefined) micros[k] = v;
  out.micronutrientes = micros;
  out.fdcId = fdcId;
  return out;
}

async function main() {
  const foods: Array<Record<string, unknown> & { id: string }> = JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  const ids = new Set(foods.map((f) => f.id));
  let added = 0;
  for (const it of ITEMS) {
    if (ids.has(it.id)) {
      console.log(`SKIP (ya existe): ${it.id}`);
      continue;
    }
    const d = await getUsdaFoodDetail(it.fdcId);
    if (!d) {
      console.log(`FALLO sin detalle: ${it.id} (${it.fdcId})`);
      continue;
    }
    const norm = normalizeUsdaFood(d);
    foods.push({
      id: it.id,
      nombre: it.nombre,
      categoria: it.categoria,
      porcion: "100 g",
      ...toProfile(norm, it.fdcId),
      verificado: false,
      unSoloEstado: true,
      estadoDefault: it.estado,
      fuente: `Match directo: "${d.description}" (USDA FoodData Central ${d.dataType} #${it.fdcId}).`,
    });
    ids.add(it.id);
    added++;
    console.log(`+ ${it.id} (${it.fdcId}) ${Math.round(norm.calorias)} kcal | P${norm.proteina} C${norm.carbos} G${norm.grasas}`);
  }
  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n");
  console.log(`\nTotal foods: ${foods.length} (agregados ${added})`);
}

main();
