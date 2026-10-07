// Prueba del resolvedor de alimentos. Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/food_resolver_test.ts
// Sin Next.js ni vitest (igual que el resto de pruebas del repo). Sale con código 1 si algo falla.
import aliasData from "../../src/lib/nutrition/food-aliases.json";
import { BASE_FOODS } from "../../src/lib/food-utils";
import {
  normalizeText, stem, parseQuantityFromText, resolveFood, nutritionForResult, buildUsageMap,
} from "../../src/lib/nutrition/food-resolver";
import type { Recipe } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const foods = BASE_FOODS;

// ── 1. normalización ─────────────────────────────────────────────
ok(normalizeText("  Piña  Colada!! ") === "pina colada", "normalizeText quita tildes/ñ/símbolos");
ok(stem("frijoles") === "frijol", "stem frijoles");
ok(stem("panqueques") === "panqueque", "stem panqueques");
ok(stem("nueces") === "nuez", "stem nueces");
ok(stem("papas") === "papa", "stem papas");
ok(stem("hummus") === "hummus", "stem hummus (no toca -us)");
ok(parseQuantityFromText("fideos 200 g").gramos === 200, "cantidad 200 g");
ok(parseQuantityFromText("fideos 200 g").texto === "fideos", "texto sin cantidad");
ok(parseQuantityFromText("1,5 kg de papa").gramos === 1500, "1,5 kg = 1500 g");
ok(parseQuantityFromText("leche 250ml").gramos === 250, "250ml");
ok(parseQuantityFromText("arroz").gramos === null, "sin cantidad");

// ── 2. todos los alias apuntan a alimentos que existen ────────────
const names = new Set(foods.map((f) => normalizeText(f.nombre)));
for (const [k, targets] of Object.entries((aliasData as { alias: Record<string, string[]> }).alias)) {
  for (const t of targets) ok(names.has(normalizeText(t)), `alias "${k}" → "${t}" existe en la base`);
}

// ── 3. ~100 términos comunes ──────────────────────────────────────
// [texto, nombre esperado en la base | null si la base NO tiene ese alimento (se espera "sin resultado" o algo no relacionado)]
const CASES: [string, string | null][] = [
  ["arroz", "Arroz blanco"], ["arroz blanco", "Arroz blanco"], ["arroz integral", "Arroz integral cocido"], ["arroz con pollo", "Arroz con pollo"],
  ["fideo", "Fideo / Pasta"], ["fideos", "Fideo / Pasta"], ["espagueti", "Fideo / Pasta"], ["tallarines", "Fideo / Pasta"], ["pasta", "Fideo / Pasta"], ["macarrones", "Fideo / Pasta"],
  ["papa", "Papa cocida / hervida"], ["papas", "Papa cocida / hervida"], ["patata", "Papa cocida / hervida"], ["papas fritas", "Papas fritas"], ["camote", "Camote cocido"],
  ["palta", "Palta / aguacate"], ["aguacate", "Palta / aguacate"], ["choclo", "Choclo / elote"], ["maíz", "Choclo / elote"],
  ["frejol", "Frijoles negros"], ["frijol", "Frijoles negros"], ["frijoles rojos", "Frijoles rojos (kidney)"], ["poroto", "Frijoles negros"],
  ["lentejas", "Lentejas cocidas"], ["garbanzos", "Garbanzos cocidos"], ["quinoa", "Quinua cocida"], ["quinua", "Quinua cocida"],
  ["plátano", "Plátano"], ["banana", "Plátano"], ["manzana", "Manzana"], ["naranja", "Naranja"], ["fresa", "Fresas"], ["frutillas", "Fresas"], ["uvas", "Uvas verdes"],
  ["sandía", "Sandía"], ["mango", "Mango"], ["piña", "Piña"], ["pera", "Pera"],
  ["pollo", "Pechuga de pollo"], ["pechuga de pollo", "Pechuga de pollo"], ["pollo cocido", "Pechuga de pollo"], ["pollo a la brasa", "Pollo a la brasa (1/4)"], ["milanesa", "Milanesa de pollo"],
  ["huevo", "Huevo entero"], ["huevos", "Huevo entero"], ["huevo frito", "Huevo frito"], ["huevo duro", "Huevo duro (sancochado)"], ["huevo revuelto", "Huevo revuelto"], ["clara de huevo", "Clara de huevo"],
  ["carne", "Carne molida de res (magra)"], ["carne molida", "Carne molida de res (magra)"], ["cerdo", "Lomo de cerdo"], ["bistec", "Bife de lomo (sirloin) a la parrilla"],
  ["salmón", "Salmón"], ["atún", "Atún en lata (al agua)"], ["merluza", "Merluza al horno"], ["pescado frito", "Pescado frito"], ["tofu", "Tofu firme"], ["cordero", "Pierna de cordero horneada"], ["pavo", "Pavo molido cocido"],
  ["leche", "Leche entera"], ["leche descremada", "Leche descremada"], ["yogur", "Yogur natural"], ["yogurt griego", "Yogur griego natural"], ["queso", "Queso fresco"], ["queso cottage", "Queso cottage"], ["mozzarella", "Queso mozzarella"],
  ["pan", "Pan blanco"], ["pan integral", "Pan de trigo integral"], ["marraqueta", "Pan Marraqueta"], ["pan con palta", "Pan con palta"], ["tortilla de maíz", "Tortilla de maíz"], ["avena", "Avena"], ["granola", "Granola"],
  ["brócoli", "Brócoli cocido"], ["espinaca", "Espinaca cocida"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["zanahoria", "Zanahoria"], ["pepino", "Pepino"], ["cebolla", "Cebolla"], ["pimiento", "Pimiento rojo"], ["zapallo", "Calabaza / zapallo cocido"], ["vainitas", "Vainitas / judías verdes cocidas"], ["coliflor", "Coliflor cocida"],
  ["almendras", "Almendras"], ["nueces", "Nueces"], ["maní", "Maní / cacahuate"], ["chía", "Semillas de chía"], ["aceite de oliva", "Aceite de oliva"], ["miel", "Miel de abeja"], ["mermelada", "Mermelada"],
  ["café", "Café negro sin azúcar"], ["café con leche", "Café con leche"], ["gaseosa", "Gaseosa regular"], ["cerveza", "Cerveza"], ["jugo de naranja", "Jugo de naranja natural"], ["whey", "Batido de proteína whey"],
  ["pizza", "Pizza margarita"], ["hamburguesa", "Hamburguesa clásica"], ["lomo saltado", "Lomo saltado"], ["ceviche", "Ceviche de pescado"], ["ají de gallina", "Ají de gallina"], ["helado", "Helado de crema"], ["chocolate", "Chocolate negro (70%)"],
  // La base todavía NO tiene estos alimentos (se reportan; no se amplía la base en esta fase):
  ["mantequilla", null], ["azúcar", null], ["sal", null], ["jamón", null], ["tocino", null], ["salchicha", null], ["atún en aceite", null], ["pollo frito kfc", null],
  ["arándanos", null], ["kiwi", null], ["durazno", null], ["limón", null], ["cereal de caja", null], ["leche de soya", null], ["gaseosa light", null], ["vino", null],
];

const missing: string[] = [];
const wrong: string[] = [];
for (const [text, expected] of CASES) {
  const r = resolveFood(text, foods);
  const got = r.tipo === "alimento" ? r.chosen!.nombre : null;
  if (expected === null) {
    if (got) missing.push(`${text} → (sin equivalente; sugiere "${got}", confianza ${r.confidence})`);
    else missing.push(`${text} → sin resultado`);
    continue;
  }
  if (got !== expected) wrong.push(`"${text}": esperado "${expected}", obtuvo "${got ?? "sin resultado"}" (${r.chosen?.score ?? 0}, ${r.confidence})`);
  ok(got === expected, `"${text}" → "${expected}" (obtuvo "${got ?? "sin resultado"}", ${r.chosen?.score ?? 0}, ${r.confidence})`);
}
console.log(`\nTérminos con respuesta esperada: ${CASES.filter((c) => c[1]).length - wrong.length}/${CASES.filter((c) => c[1]).length} correctos`);
console.log(`Términos que la base no cubre (${missing.length}):`);
for (const m of missing) console.log(`  · ${m}`);

// ── 4. reglas específicas ─────────────────────────────────────────
{
  const r = resolveFood("arroz", foods);
  ok(r.chosen?.nombre === "Arroz blanco" && r.confidence === "alta", "arroz → Arroz blanco con confianza alta (no arroz con pollo)");
  ok(r.cookedState === "cocido", "arroz usa el estado por defecto del alimento (cocido)");
  ok(resolveFood("arroz crudo", foods).cookedState === "crudo", "'arroz crudo' fuerza crudo");
  ok(resolveFood("tomate", foods).cookedState === "crudo", "tomate: estado por defecto crudo");
  const g = resolveFood("fideos 200 g", foods);
  ok(g.gramosPedidos === 200 && g.gramos === 200, "cantidad en el texto");
  ok(resolveFood("fideos", foods, [], { gramos: 150 }).gramos === 150, "cantidad por parámetro");
  const n100 = nutritionForResult(resolveFood("pechuga de pollo", foods, [], { gramos: 100 }))!;
  const n200 = nutritionForResult(resolveFood("pechuga de pollo", foods, [], { gramos: 200 }))!;
  ok(Math.abs(n200.calorias - 2 * n100.calorias) <= 2, "doble de gramos = doble de calorías");
  ok(resolveFood("", foods).tipo === "sin_resultado", "texto vacío → sin resultado");
  ok(resolveFood("200 g", foods).tipo === "sin_resultado", "solo cantidad → sin resultado");
  ok(resolveFood("xyzqw", foods).tipo === "sin_resultado", "basura → sin resultado");
  ok(resolveFood("platno", foods).chosen?.nombre === "Plátano", "tolerancia a 1 error: platno → Plátano");
  ok(resolveFood("brocoli", foods).chosen?.nombre === "Brócoli cocido", "sin tildes");
  ok(resolveFood("ARROZ   Blanco", foods).chosen?.nombre === "Arroz blanco", "mayúsculas y espacios");
  // uso previo desempata entre parecidos
  const queso = resolveFood("queso", foods, [], { usage: buildUsageMap([{ id: "x", foodId: foods.find((f) => f.nombre === "Queso mozzarella")!.id } as never]) });
  ok(queso.chosen?.nombre === "Queso fresco", "alias manda sobre el uso previo");
  // alimento sin configurar no gana
  const placeholder = { ...foods[0], id: "custom-arroz", nombre: "Arroz", configurado: false, calorias: 0 };
  ok(resolveFood("arroz", [placeholder, ...foods]).chosen?.nombre === "Arroz blanco", "un 'sin configurar' no le gana a la base");
}

ok(resolveFood("mantequilla", foods).confidence === "baja", "una palabra que solo coincide por prefijo no es confianza alta/media");
ok(resolveFood("pescado", foods).confidence === "baja", "pescado → solo sugerencia (confianza baja)");

// ── 5. recetas ────────────────────────────────────────────────────
{
  const leche = foods.find((f) => f.nombre === "Leche entera")!;
  const platano = foods.find((f) => f.nombre === "Plátano")!;
  const batido: Recipe = {
    id: "rec-batido", nombre: "Batido de leche con plátano", porciones: 2, tiempoPrepMin: 5, tipos: ["desayuno"],
    ingredientes: [
      { foodId: leche.id, nombre: leche.nombre, cantidad: 1, porcionNombre: "300 g", gramos: 300, calorias: 180, proteina: 9, carbos: 14, grasas: 10 },
      { foodId: "ya-no-existe", nombre: "Plátano", cantidad: 1, porcionNombre: "100 g", gramos: 100, calorias: 89, proteina: 1, carbos: 23, grasas: 0.3 },
    ],
    instrucciones: [], totales: { calorias: 269, proteina: 10, carbos: 37, grasas: 10.3 }, createdAt: 0,
  };
  const r = resolveFood("batido de leche", foods, [batido]);
  ok(r.tipo === "receta" && r.recipeId === "rec-batido", "batido de leche → receta del usuario");
  ok(r.gramos === 200, "sin cantidad: 1 porción = peso total / porciones (200 g)");
  ok(r.ingredientes?.length === 2 && r.ingredientes[0].foodId === leche.id, "ingredientes expandidos y vinculados");
  ok(r.ingredientes?.[1].foodId === platano.id && r.ingredientes[1].resuelto, "ingrediente con foodId roto se resuelve por nombre");
  const r2 = resolveFood("batido de leche 400 g", foods, [batido]);
  ok(r2.gramos === 400 && r2.ingredientes![0].gramos === 300 && r2.ingredientes![1].gramos === 100, "400 g = receta completa (peso total 400 g)");
  const r3 = resolveFood("batido de leche", foods, [batido], { gramos: 100 });
  ok(r3.ingredientes![0].gramos === 75 && r3.ingredientes![1].gramos === 25, "escala por gramos pedidos / peso total");
  const nut = nutritionForResult(r3)!;
  ok(Math.abs(nut.calorias - 67) <= 2, "kcal de la receta escalada (269 × 100/400)");
  ok(resolveFood("leche", foods, [batido]).tipo === "alimento", "si hay alimento razonable NO usa la receta");
  const cyc: Recipe = { ...batido, id: "cic", nombre: "Mi cosa", ingredientes: [{ ...batido.ingredientes[0], foodId: "x", nombre: "Mi cosa" }] };
  ok(resolveFood("mi cosa", foods, [cyc]).tipo === "receta", "receta que se menciona a sí misma no recursa");
}

console.log(`\n${checks - fails}/${checks} comprobaciones OK`);
if (fails) {
  console.log(`\n${fails} FALLARON`);
  process.exit(1);
}
