// Prueba de "Guardar como receta". Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/meal_to_recipe_test.ts
import { BASE_FOODS } from "../../src/lib/food-utils";
import { getResolverIndex } from "../../src/lib/nutrition/food-resolver";
import { buildRecipeFromLogged, findRecipeByName, updatePatchFromLogged } from "../../src/lib/nutrition/meal-to-recipe";
import type { LoggedFood, Recipe } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const idx = getResolverIndex(BASE_FOODS);
const arroz = BASE_FOODS.find((f) => f.nombre === "Arroz blanco")!;
const pollo = BASE_FOODS.find((f) => f.nombre === "Pechuga de pollo")!;
const mk = (p: Partial<LoggedFood>): LoggedFood => ({
  id: "x", foodId: "?", nombre: "?", calorias: 0, proteina: 0, carbos: 0, grasas: 0, meal: "almuerzo", timestamp: 0, ...p,
});

const foods: LoggedFood[] = [
  mk({ id: "1", foodId: arroz.id, nombre: arroz.nombre, calorias: 234, proteina: 4.8, carbos: 50.7, grasas: 0.5, gramos: 180, porcionNombre: "180 g" }),
  mk({ id: "2", foodId: "scan-borrado", nombre: "Pechuga de pollo", calorias: 160, proteina: 30, carbos: 0, grasas: 3.5, gramos: 150 }),
  mk({ id: "3", foodId: pollo.id, nombre: pollo.nombre, calorias: 999, proteina: 99, carbos: 9, grasas: 9, gramos: 100, activo: false }),
  mk({ id: "4", foodId: "desconocido", nombre: "Salsa de la abuela", calorias: 50, proteina: 1, carbos: 5, grasas: 3 }),
];

const r = buildRecipeFromLogged("  Almuerzo fit ", "almuerzo", foods, idx);
ok(r.nombre === "Almuerzo fit", "nombre recortado");
ok(r.verificado === false, "entra con verificado=false");
ok(r.ingredientes.length === 3, "los alimentos desactivados no entran");
ok(r.ingredientes[0].foodId === arroz.id && r.ingredientes[0].gramos === 180, "arroz vinculado, 180 g");
ok(r.ingredientes[1].foodId === pollo.id, "foodId roto se resuelve por nombre (pollo)");
ok(r.ingredientes[2].foodId === "desconocido" && r.ingredientes[2].gramos === 100, "sin equivalente: conserva foodId y asume 100 g");
ok(r.totales.calorias === 444, "total kcal = 234 + 160 + 50");
ok(Math.abs(r.totales.proteina - 35.8) < 0.01, "total proteína");
ok(r.tipos.length === 1 && r.tipos[0] === "almuerzo", "tipo = la comida");

const existing: Recipe = { ...r, id: "rec-1", createdAt: 1, nombre: "almuerzo FIT", tipos: ["cena"], verificado: true };
ok(findRecipeByName([existing], "Almuerzo fit")?.id === "rec-1", "encuentra por nombre sin importar mayúsculas");
ok(findRecipeByName([existing], "Otra") === undefined, "no encuentra otra");
const patch = updatePatchFromLogged(existing, r);
ok(patch.verificado === false, "actualizar → vuelve a sin verificar");
ok(patch.tipos!.includes("cena") && patch.tipos!.includes("almuerzo"), "actualizar suma el tipo de comida");

console.log(`\n${checks - fails}/${checks} comprobaciones OK`);
if (fails) process.exit(1);
