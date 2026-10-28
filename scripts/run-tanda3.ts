/**
 * Tanda 3: alimentos que faltaban en categorías flacas (Tubérculo, Legumbre, Cereal, Fruta, Verdura, Postre,
 * Comida rápida, Snack, Lácteo vegetal, Proteína). Datos reales de USDA FoodData Central (los fdcId se eligieron
 * a mano con scripts/search-usda-candidates.ts). Misma forma que run-tanda2.ts. Idempotente: salta ids existentes.
 * Uso: npx tsx scripts/run-tanda3.ts
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
  desc: string;
  estado: Estado;
}

const ITEMS: Item[] = [
  // Tubérculo
  { id: "yuca", nombre: "Yuca (mandioca)", categoria: "Tubérculo", fdcId: 169985, desc: "Cassava, raw", estado: "crudo" },
  { id: "name", nombre: "Ñame", categoria: "Tubérculo", fdcId: 170072, desc: "Yam, cooked, boiled, drained, or baked, without salt", estado: "cocido" },
  { id: "taro", nombre: "Taro (malanga)", categoria: "Tubérculo", fdcId: 168486, desc: "Taro, cooked, without salt", estado: "cocido" },
  // Legumbre
  { id: "frijoles-blancos", nombre: "Frijoles blancos", categoria: "Legumbre", fdcId: 175203, desc: "Beans, white, mature seeds, cooked, boiled, without salt", estado: "cocido" },
  { id: "frijoles-pintos", nombre: "Frijoles pintos", categoria: "Legumbre", fdcId: 175200, desc: "Beans, pinto, mature seeds, cooked, boiled, without salt", estado: "cocido" },
  { id: "arvejas-verdes", nombre: "Arvejas verdes", categoria: "Legumbre", fdcId: 170420, desc: "Peas, green, cooked, boiled, drained, without salt", estado: "cocido" },
  // Cereal
  { id: "amaranto", nombre: "Amaranto", categoria: "Cereal", fdcId: 170683, desc: "Amaranth grain, cooked", estado: "cocido" },
  { id: "trigo-sarraceno", nombre: "Trigo sarraceno", categoria: "Cereal", fdcId: 170686, desc: "Buckwheat groats, roasted, cooked", estado: "cocido" },
  { id: "sorgo", nombre: "Sorgo", categoria: "Cereal", fdcId: 169716, desc: "Sorghum grain", estado: "crudo" },
  { id: "tortilla-trigo", nombre: "Tortilla de trigo", categoria: "Cereal", fdcId: 2758996, desc: "Tortilla, wheat flour, shelf stable", estado: "cocido" },
  { id: "bagel", nombre: "Bagel", categoria: "Cereal", fdcId: 174899, desc: "Bagels, plain, enriched, with calcium propionate", estado: "cocido" },
  // Fruta
  { id: "melon", nombre: "Melón", categoria: "Fruta", fdcId: 169092, desc: "Melons, cantaloupe, raw", estado: "crudo" },
  { id: "frambuesas", nombre: "Frambuesas", categoria: "Fruta", fdcId: 167755, desc: "Raspberries, raw", estado: "crudo" },
  { id: "lichi", nombre: "Lichi", categoria: "Fruta", fdcId: 169086, desc: "Litchis, raw", estado: "crudo" },
  { id: "caqui", nombre: "Caqui", categoria: "Fruta", fdcId: 169941, desc: "Persimmons, japanese, raw", estado: "crudo" },
  { id: "guanabana", nombre: "Guanábana", categoria: "Fruta", fdcId: 167761, desc: "Soursop, raw", estado: "crudo" },
  { id: "tamarindo", nombre: "Tamarindo", categoria: "Fruta", fdcId: 167763, desc: "Tamarinds, raw", estado: "crudo" },
  { id: "aguaymanto", nombre: "Aguaymanto", categoria: "Fruta", fdcId: 173043, desc: "Groundcherries (cape-gooseberries), raw", estado: "crudo" },
  // Verdura
  { id: "chayote", nombre: "Chayote", categoria: "Verdura", fdcId: 170403, desc: "Chayote, fruit, cooked, boiled, drained, without salt", estado: "cocido" },
  { id: "nopal", nombre: "Nopal", categoria: "Verdura", fdcId: 168571, desc: "Nopales, raw", estado: "crudo" },
  { id: "coles-bruselas", nombre: "Coles de Bruselas", categoria: "Verdura", fdcId: 170383, desc: "Brussels sprouts, raw", estado: "crudo" },
  { id: "bok-choy", nombre: "Bok choy", categoria: "Verdura", fdcId: 170391, desc: "Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt", estado: "cocido" },
  { id: "rucula", nombre: "Rúcula", categoria: "Verdura", fdcId: 169387, desc: "Arugula, raw", estado: "crudo" },
  { id: "shiitake", nombre: "Hongos shiitake", categoria: "Verdura", fdcId: 168437, desc: "Mushrooms, shiitake, cooked, without salt", estado: "cocido" },
  // Postre
  { id: "flan", nombre: "Flan", categoria: "Postre", fdcId: 167574, desc: "Desserts, flan, caramel custard, prepared-from-recipe", estado: "cocido" },
  { id: "brownie", nombre: "Brownie", categoria: "Postre", fdcId: 172713, desc: "Cookies, brownies, commercially prepared", estado: "cocido" },
  { id: "arroz-con-leche", nombre: "Arroz con leche", categoria: "Postre", fdcId: 168782, desc: "Puddings, rice, ready-to-eat", estado: "cocido" },
  { id: "cheesecake", nombre: "Cheesecake", categoria: "Postre", fdcId: 172711, desc: "Cake, cheesecake, commercially prepared", estado: "cocido" },
  { id: "dona", nombre: "Dona glaseada", categoria: "Postre", fdcId: 174992, desc: "Doughnuts, cake-type, plain, sugared or glazed", estado: "cocido" },
  // Desayuno
  { id: "waffles", nombre: "Waffles", categoria: "Desayuno", fdcId: 175039, desc: "Waffles, plain, prepared from recipe", estado: "cocido" },
  { id: "croissant", nombre: "Croissant", categoria: "Desayuno", fdcId: 174987, desc: "Croissants, butter", estado: "cocido" },
  // Comida rápida
  { id: "nuggets-pollo", nombre: "Nuggets de pollo", categoria: "Comida rápida", fdcId: 172112, desc: "Chicken, nuggets, white meat, precooked, frozen, not reheated", estado: "cocido" },
  { id: "hot-dog", nombre: "Hot dog (salchicha de res)", categoria: "Comida rápida", fdcId: 174614, desc: "Frankfurter, beef, heated", estado: "cocido" },
  { id: "taco-res", nombre: "Taco de res", categoria: "Comida rápida", fdcId: 170689, desc: "Fast foods, taco with beef, cheese and lettuce, hard shell", estado: "cocido" },
  { id: "burrito-frijoles", nombre: "Burrito de frijoles y queso", categoria: "Comida rápida", fdcId: 172039, desc: "Fast foods, burrito, with beans and cheese", estado: "cocido" },
  // Snack
  { id: "papas-chips", nombre: "Papas chips", categoria: "Snack", fdcId: 169677, desc: "Snacks, potato chips, plain, salted", estado: "cocido" },
  { id: "pretzels", nombre: "Pretzels", categoria: "Snack", fdcId: 167555, desc: "Snacks, pretzels, hard, plain, salted", estado: "cocido" },
  { id: "tortilla-chips", nombre: "Totopos (tortilla chips)", categoria: "Snack", fdcId: 167558, desc: "Snacks, tortilla chips, plain, white corn, salted", estado: "cocido" },
  // Lácteo vegetal
  { id: "yogur-soya", nombre: "Yogur de soya", categoria: "Lácteo vegetal", fdcId: 175227, desc: "SILK Plain soy yogurt", estado: "cocido" },
  { id: "leche-arroz", nombre: "Leche de arroz", categoria: "Lácteo vegetal", fdcId: 171942, desc: "Beverages, rice milk, unsweetened", estado: "cocido" },
  { id: "leche-coco", nombre: "Leche de coco (bebida)", categoria: "Lácteo vegetal", fdcId: 174116, desc: "Beverages, coconut milk, sweetened, fortified", estado: "cocido" },
  // Proteína
  { id: "cerdo-molido", nombre: "Carne molida de cerdo cocida", categoria: "Proteína", fdcId: 167903, desc: "Pork, fresh, ground, cooked", estado: "cocido" },
  { id: "pavo-fiambre", nombre: "Pechuga de pavo (fiambre)", categoria: "Proteína", fdcId: 172941, desc: "Turkey breast, sliced, prepackaged", estado: "cocido" },
  { id: "higado-pollo", nombre: "Hígado de pollo", categoria: "Proteína", fdcId: 171061, desc: "Chicken, liver, all classes, cooked, simmered", estado: "cocido" },
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
    // Control Atwater: kcal declaradas vs 4P+4C+9G (alcohol/fibra explican algo, >35 % y >40 kcal es sospechoso).
    const est = 4 * norm.proteina + 4 * norm.carbos + 9 * norm.grasas;
    const diff = Math.abs(norm.calorias - est);
    const warn = diff > 40 && est > 0 && diff / est > 0.35 ? "  <-- REVISAR (Atwater)" : "";
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
    console.log(`+ ${it.id} (${it.fdcId}) ${Math.round(norm.calorias)} kcal | P${norm.proteina} C${norm.carbos} G${norm.grasas}${warn}`);
  }
  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n");
  console.log(`\nTotal foods: ${foods.length} (agregados ${added})`);
}

main();
