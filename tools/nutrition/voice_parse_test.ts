// Prueba del parser de dictado. Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/voice_parse_test.ts
import { BASE_FOODS } from "../../src/lib/food-utils";
import { resolveFood } from "../../src/lib/nutrition/food-resolver";
import { splitSpokenFoods } from "../../src/lib/nutrition/voice-parse";

let fails = 0;
let checks = 0;
function eq(got: unknown, want: unknown, msg: string) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log(`  ✗ ${msg}\n      obtuvo ${JSON.stringify(got)}\n      esperado ${JSON.stringify(want)}`);
  }
}

eq(splitSpokenFoods("hoy comí dos huevos, 200 gramos de arroz y una manzana"), [
  { texto: "huevos", gramos: null, cantidad: 2 },
  { texto: "arroz", gramos: 200, cantidad: null },
  { texto: "manzana", gramos: null, cantidad: 1 },
], "frase típica");
eq(splitSpokenFoods("arroz con pollo y ensalada"), [
  { texto: "arroz con pollo", gramos: null, cantidad: null },
  { texto: "ensalada", gramos: null, cantidad: null },
], "arroz con pollo es un solo alimento");
eq(splitSpokenFoods("desayuné avena 50 g más un plátano"), [
  { texto: "avena", gramos: 50, cantidad: null },
  { texto: "platano", gramos: null, cantidad: 1 },
], "verbo + gramos + más");
eq(splitSpokenFoods("medio aguacate"), [{ texto: "aguacate", gramos: null, cantidad: 0.5 }], "medio");
eq(splitSpokenFoods("250 ml de leche"), [{ texto: "leche", gramos: 250, cantidad: null }], "mililitros");
eq(splitSpokenFoods("   "), [], "vacío");

// De punta a punta con el resolvedor.
const name = (t: string) => resolveFood(t, BASE_FOODS, [], { foodsOnly: true }).chosen?.nombre;
eq(name("huevos"), "Huevo entero", "huevos → Huevo entero");
eq(name("manzana"), "Manzana", "manzana");
eq(name("platano"), "Plátano", "plátano sin tilde");
eq(name("avena"), "Avena", "avena");

console.log(`\n${checks - fails}/${checks} comprobaciones OK`);
if (fails) process.exit(1);
