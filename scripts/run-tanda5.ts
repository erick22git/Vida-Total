/**
 * Tanda 5: platos preparados bolivianos clásicos que faltaban (mondongo, parrillada, fricasé, pique
 * macho, sopa de maní, silpancho, majadito). No existen como entrada única en USDA FoodData Central (son
 * platos compuestos, no un alimento), así que cada uno se DERIVA de una receta típica combinando
 * ingredientes que YA tienen ficha propia en esta base (misma convención que "Plato paceño"/"Salchipapa"
 * en foods-regional.json) — nunca se inventa un valor, se documenta la receta exacta en `fuente`.
 * Idempotente: salta ids existentes. Uso: npx tsx scripts/run-tanda5.ts
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
  ingredientes: Ing[];
  aguaGramos?: number;
  recetaTexto: string;
}

function rate(id: string) {
  const f = BASE_FOODS.find((x) => x.id === id);
  if (!f) throw new Error(`Falta el ingrediente base "${id}" — agregalo antes de correr esta tanda.`);
  const g = parsePorcionGramos(f);
  return { kcal: f.calorias / g, p: f.proteina / g, c: f.carbos / g, gr: f.grasas / g };
}

function computeDish(d: Dish) {
  let kcal = 0, p = 0, c = 0, gr = 0;
  let totalG = d.aguaGramos ?? 0;
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
  return {
    calorias: round(kcal * f, 1),
    proteina: round(p * f, 2),
    carbos: round(c * f, 2),
    grasas: round(gr * f, 2),
    totalG,
  };
}

const DISHES: Dish[] = [
  {
    id: "mondongo",
    nombre: "Mondongo",
    ingredientes: [
      { id: "lomo-cerdo", gramos: 150 },
      { id: "papa-cocida", gramos: 100 },
      { id: "cebolla", gramos: 20 },
      { id: "tomate", gramos: 20 },
      { id: "aji-fresco", gramos: 10 },
    ],
    recetaTexto: "150g lomo de cerdo cocido + 100g papa cocida + 20g cebolla + 20g tomate + 10g ají fresco (porción típica de un plato casero, 300g totales)",
  },
  {
    id: "parrillada",
    nombre: "Parrillada (mixta)",
    ingredientes: [
      { id: "bistec-res", gramos: 100 },
      { id: "pechuga-pollo", gramos: 80 },
      { id: "chorizo", gramos: 60 },
      { id: "salchicha", gramos: 60 },
    ],
    recetaTexto: "100g bistec de res + 80g pechuga de pollo + 60g chorizo + 60g salchicha, todo a la parrilla (porción típica de un plato para compartir, 300g totales)",
  },
  {
    id: "fricase",
    nombre: "Fricasé",
    ingredientes: [
      { id: "chuleta-cerdo", gramos: 150 },
      { id: "papa-cocida", gramos: 100 },
      { id: "cebolla", gramos: 20 },
      { id: "aji-fresco", gramos: 15 },
      { id: "tomate", gramos: 15 },
    ],
    recetaTexto: "150g chuleta de cerdo cocida + 100g papa cocida + 20g cebolla + 15g ají fresco (caldo picante) + 15g tomate (porción típica, 300g totales)",
  },
  {
    id: "pique-macho",
    nombre: "Pique macho",
    ingredientes: [
      { id: "res-frito", gramos: 100 },
      { id: "salchicha", gramos: 60 },
      { id: "papas-fritas", gramos: 150 },
      { id: "huevo-frito", gramos: 40 },
      { id: "cebolla", gramos: 25 },
      { id: "tomate", gramos: 25 },
    ],
    recetaTexto: "100g res frita en trozos + 60g salchicha + 150g papas fritas + 40g huevo frito + 25g cebolla + 25g tomate (porción típica para compartir, 400g totales)",
  },
  {
    id: "sopa-de-mani",
    nombre: "Sopa de maní",
    ingredientes: [
      { id: "mantequilla-mani", gramos: 25 },
      { id: "carne-molida-res", gramos: 60 },
      { id: "papa-cocida", gramos: 60 },
      { id: "zanahoria", gramos: 30 },
      { id: "arvejas-verdes", gramos: 20 },
      { id: "arroz-blanco", gramos: 40 },
      { id: "papas-fritas", gramos: 15 },
    ],
    aguaGramos: 250,
    recetaTexto: "25g maní molido + 60g carne molida de res + 60g papa cocida + 30g zanahoria + 20g arvejas verdes + 40g arroz cocido + 15g papas fritas (de guarnición) + 250g de caldo/agua (una sopa, no un guiso — de ahí su menor densidad calórica), 500g totales",
  },
  {
    id: "silpancho",
    nombre: "Silpancho",
    ingredientes: [
      { id: "res-frito", gramos: 120 },
      { id: "arroz-blanco", gramos: 100 },
      { id: "huevo-frito", gramos: 50 },
      { id: "tomate", gramos: 20 },
      { id: "cebolla", gramos: 15 },
    ],
    recetaTexto: "120g de carne de res apanada y frita (aproximada con el dato de res frita de esta base, por no haber todavía una ficha de carne apanada con pan rallado) + 100g arroz cocido + 50g huevo frito + 20g tomate + 15g cebolla (porción típica, 305g totales)",
  },
  {
    id: "majadito",
    nombre: "Majadito",
    ingredientes: [
      { id: "arroz-blanco", gramos: 150 },
      { id: "charque", gramos: 50 },
      { id: "huevo-frito", gramos: 50 },
      { id: "platano", gramos: 30 },
      { id: "aceite-oliva", gramos: 10 },
    ],
    recetaTexto: "150g arroz cocido (tipo risotto, con el charque deshilachado mezclado) + 50g charque + 50g huevo frito + 30g plátano frito + 10g aceite para freír (porción típica, 290g totales)",
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
      categoria: "Plato preparado",
      porcion: "100 g",
      calorias,
      proteina,
      carbos,
      grasas,
      verificado: false,
      configurado: true,
      unSoloEstado: true,
      fuente: `DERIVADO, no un fdcId único de FDC (es un plato compuesto, no un alimento). ${dish.recetaTexto}, escalado a 100g del resultado. Cada ingrediente usa el dato YA cargado de su propia ficha en esta base. La receta real varía según la familia/puesto — si tenés una receta/porción específica, decímela y la ajusto.`,
    });
    ids.add(dish.id);
    added++;
    console.log(`+ ${dish.id}  ${calorias} kcal | P${proteina} C${carbos} G${grasas}  (total receta ${totalG}g)`);
  }
  writeFileSync(FOODS_REGIONAL_PATH, JSON.stringify(regional, null, 2) + "\n");
  console.log(`\nTotal foods-regional: ${regional.length} (agregados ${added})`);
}

main();
