/**
 * Tanda 6: más platos nacionales bolivianos (picante de pollo, sajta de pollo, chicharrón, falso
 * conejo, humintas, llajua). Misma convención DERIVADO que tanda5.ts: cada receta combina ingredientes
 * YA cargados en esta base, documentando la receta exacta en `fuente`. Donde la receta real usa chuño
 * (sajta, falso conejo), se omite a propósito — su ficha en esta base sigue en 0 (dato pendiente) y
 * sumarlo en 0 subestimaría las calorías en vez de omitir honestamente ese componente (mismo criterio
 * que "Plato paceño"). Idempotente. Uso: npx tsx scripts/run-tanda6.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE_FOODS, parsePorcionGramos } from "../src/lib/food-utils";

const FOODS_REGIONAL_PATH = "src/lib/data/foods-regional.json";

interface Ing {
  id: string;
  gramos: number;
}
interface Dish {
  id: string;
  nombre: string;
  categoria: string;
  ingredientes: Ing[];
  recetaTexto: string;
  notaOmision?: string;
}

function rate(id: string) {
  const f = BASE_FOODS.find((x) => x.id === id);
  if (!f) throw new Error(`Falta el ingrediente base "${id}" — agregalo antes de correr esta tanda.`);
  const g = parsePorcionGramos(f);
  return { kcal: f.calorias / g, p: f.proteina / g, c: f.carbos / g, gr: f.grasas / g };
}

function computeDish(d: Dish) {
  let kcal = 0, p = 0, c = 0, gr = 0, totalG = 0;
  for (const ing of d.ingredientes) {
    const r = rate(ing.id);
    kcal += r.kcal * ing.gramos;
    p += r.p * ing.gramos;
    c += r.c * ing.gramos;
    gr += r.gr * ing.gramos;
    totalG += ing.gramos;
  }
  const f = 100 / totalG;
  const round = (n: number, dec: number) => Math.round(n * 10 ** dec) / 10 ** dec;
  return { calorias: round(kcal * f, 1), proteina: round(p * f, 2), carbos: round(c * f, 2), grasas: round(gr * f, 2), totalG };
}

const DISHES: Dish[] = [
  {
    id: "picante-de-pollo",
    nombre: "Picante de pollo",
    categoria: "Plato preparado",
    ingredientes: [
      { id: "muslo-pollo-asado", gramos: 150 },
      { id: "papa-cocida", gramos: 100 },
      { id: "cebolla", gramos: 20 },
      { id: "tomate", gramos: 20 },
      { id: "aji-fresco", gramos: 15 },
    ],
    recetaTexto: "150g muslo de pollo asado + 100g papa cocida + 20g cebolla + 20g tomate + 15g ají fresco (porción típica, 305g totales)",
  },
  {
    id: "sajta-de-pollo",
    nombre: "Sajta de pollo",
    categoria: "Plato preparado",
    ingredientes: [
      { id: "pollo-frito-presa", gramos: 150 },
      { id: "papas-fritas", gramos: 100 },
      { id: "cebolla", gramos: 20 },
      { id: "aji-fresco", gramos: 20 },
    ],
    recetaTexto: "150g pollo frito + 100g papas fritas (en reemplazo del chuño frito de la receta tradicional) + 20g cebolla + 20g ají amarillo (ají fresco, caldo picante), 290g totales",
    notaOmision: "La receta tradicional lleva chuño frito, no papa — se usó papa frita porque la ficha de Chuño en esta base todavía está en 0 (dato pendiente, ver \"Chuño\"), y sumarlo en 0 habría subestimado las calorías en vez de omitir honestamente ese componente. Si se carga un dato real de chuño después, se puede ajustar esta receta.",
  },
  {
    id: "chicharron-cerdo",
    nombre: "Chicharrón de cerdo",
    categoria: "Plato preparado",
    ingredientes: [
      { id: "costilla-cerdo", gramos: 200 },
      { id: "choclo", gramos: 60 },
      { id: "manteca-cerdo", gramos: 10 },
    ],
    recetaTexto: "200g costilla de cerdo fritas en su propia grasa + 60g choclo (mote) + 10g de grasa de cocción, 270g totales",
  },
  {
    id: "falso-conejo",
    nombre: "Falso conejo",
    categoria: "Plato preparado",
    ingredientes: [
      { id: "chuleta-cerdo", gramos: 150 },
      { id: "arroz-blanco", gramos: 100 },
      { id: "papas-fritas", gramos: 80 },
      { id: "cebolla", gramos: 15 },
      { id: "tomate", gramos: 15 },
    ],
    recetaTexto: "150g chuleta de cerdo apanada y frita (aproximada con el dato de chuleta de cerdo de esta base, por no haber todavía una ficha de carne apanada con pan rallado) + 100g arroz cocido + 80g papas fritas (en reemplazo del chuño frito tradicional) + 15g cebolla + 15g tomate, 360g totales",
    notaOmision: "Igual que en Sajta de pollo: se usó papa frita en vez de chuño frito porque la ficha de Chuño en esta base sigue en 0 (dato pendiente).",
  },
  {
    id: "humintas",
    nombre: "Humintas (al horno)",
    categoria: "Plato preparado",
    ingredientes: [
      { id: "choclo", gramos: 200 },
      { id: "queso-fresco", gramos: 30 },
      { id: "azucar-blanca", gramos: 15 },
      { id: "manteca-cerdo", gramos: 10 },
    ],
    recetaTexto: "200g choclo (molido, la masa de la huminta) + 30g queso fresco + 15g azúcar + 10g grasa (manteca, para la masa), 255g totales",
  },
  {
    id: "llajua",
    nombre: "Llajua",
    categoria: "Condimento",
    ingredientes: [
      { id: "tomate", gramos: 60 },
      { id: "aji-fresco", gramos: 30 },
    ],
    recetaTexto: "60g tomate + 30g ají fresco (locoto/ají picante), machacados — la salsa boliviana de mesa, 90g totales. No incluye quirquiña (hierba de condimento) por no tener ficha propia en esta base; su aporte calórico es prácticamente nulo así que no cambia el resultado de forma relevante",
  },
];

function main() {
  const regional: Array<Record<string, unknown> & { id: string }> = JSON.parse(readFileSync(FOODS_REGIONAL_PATH, "utf8"));
  const ids = new Set(regional.map((f) => f.id));
  let added = 0;
  for (const dish of DISHES) {
    if (ids.has(dish.id)) {
      console.log(`SKIP (ya existe): ${dish.id}`);
      continue;
    }
    const { calorias, proteina, carbos, grasas, totalG } = computeDish(dish);
    regional.push({
      id: dish.id,
      nombre: dish.nombre,
      categoria: dish.categoria,
      porcion: "100 g",
      calorias,
      proteina,
      carbos,
      grasas,
      verificado: false,
      configurado: true,
      unSoloEstado: true,
      fuente:
        `DERIVADO, no un fdcId único de FDC (es un plato compuesto, no un alimento). ${dish.recetaTexto}, escalado a 100g del resultado. Cada ingrediente usa el dato YA cargado de su propia ficha en esta base.` +
        (dish.notaOmision ? ` ${dish.notaOmision}` : "") +
        ` La receta real varía según la familia/puesto — si tenés una receta/porción específica, decímela y la ajusto.`,
    });
    ids.add(dish.id);
    added++;
    console.log(`+ ${dish.id}  ${calorias} kcal | P${proteina} C${carbos} G${grasas}  (total receta ${totalG}g)`);
  }
  writeFileSync(FOODS_REGIONAL_PATH, JSON.stringify(regional, null, 2) + "\n");
  console.log(`\nTotal foods-regional: ${regional.length} (agregados ${added})`);
}

main();
