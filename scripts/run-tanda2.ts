/**
 * Tanda 2: variantes por método de cocción (pollo/res/huevo/papa) + upgrade de verduras y crema de
 * arroz a dato real USDA. Aplica directo a foods.json (conjunto chico, ya verificado manualmente
 * contra la API antes de escribir este script — ver fdcIds documentados en cada `fuente`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { getUsdaFoodDetail, normalizeUsdaFood, type NormalizedUsdaNutrition } from "../src/lib/nutrition/usda";

const FOODS_PATH = "src/lib/data/foods.json";

function toMicros(n: NormalizedUsdaNutrition) {
  const m = n.micronutrientes;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) if (v !== undefined) out[k] = v;
  return out;
}

function toProfile(n: NormalizedUsdaNutrition, fdcId: number) {
  const out: Record<string, unknown> = {
    calorias: n.calorias,
    proteina: n.proteina,
    carbos: n.carbos,
    grasas: n.grasas,
  };
  for (const k of ["grasasSaturadas", "grasasTrans", "grasasMonoinsaturadas", "grasasPoliinsaturadas", "omega3Ala", "omega6Linoleico", "agua", "ceniza", "colesterol", "sodio", "fibra", "azucares", "epa", "dha"] as const) {
    const v = n[k];
    if (v !== undefined) out[k] = v;
  }
  out.micronutrientes = toMicros(n);
  out.fdcId = fdcId;
  return out;
}

async function fetchNorm(fdcId: number): Promise<NormalizedUsdaNutrition> {
  const d = await getUsdaFoodDetail(fdcId);
  if (!d) throw new Error(`No detail for ${fdcId}`);
  return normalizeUsdaFood(d);
}

type FoodRecord = Record<string, unknown> & { id: string; nombre: string };

async function main() {
  const foods: FoodRecord[] = JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  const byId = new Map(foods.map((f) => [f.id, f]));

  // ---- 1) Nuevas entradas: variantes por método de cocción ----
  const newItems: Array<{ id: string; nombre: string; categoria: string; fdcId: number; fuente: string }> = [
    { id: "pollo-hervido", nombre: "Pechuga de pollo hervida/guisada", categoria: "Proteína", fdcId: 171478, fuente: "Match directo: \"Chicken, broilers or fryers, breast, meat only, cooked, stewed\" (SR Legacy #171478). Variante por método de cocción distinta de la pechuga a la plancha/asada ya existente (fdcId cocido 171534)." },
    { id: "pollo-horno", nombre: "Pechuga de pollo al horno", categoria: "Proteína", fdcId: 171477, fuente: "Match directo: \"Chicken, broilers or fryers, breast, meat only, cooked, roasted\" (SR Legacy #171477)." },
    { id: "res-horno", nombre: "Bistec de res al horno", categoria: "Proteína", fdcId: 170224, fuente: "Match directo: \"Beef, round, bottom round, roast, separable lean and fat, trimmed to 0\\\" fat, choice, cooked, roasted\" (SR Legacy #170224)." },
    { id: "res-frito", nombre: "Bistec de res frito (sartén)", categoria: "Proteína", fdcId: 168711, fuente: "Match directo: \"Beef, round, top round, separable lean and fat, trimmed to 1/8\\\" fat, choice, cooked, pan-fried\" (SR Legacy #168711)." },
    { id: "huevo-escalfado", nombre: "Huevo escalfado", categoria: "Proteína", fdcId: 172186, fuente: "Match directo: \"Egg, whole, cooked, poached\" (SR Legacy #172186)." },
    { id: "papa-horno", nombre: "Papa al horno", categoria: "Verdura", fdcId: 170112, fuente: "Match directo: \"Potatoes, baked, flesh, with salt\" (SR Legacy #170112)." },
  ];

  let added = 0;
  for (const item of newItems) {
    if (byId.has(item.id)) {
      console.log(`SKIP (ya existe): ${item.id}`);
      continue;
    }
    const norm = await fetchNorm(item.fdcId);
    const profile = toProfile(norm, item.fdcId);
    const food = {
      id: item.id,
      nombre: item.nombre,
      categoria: item.categoria,
      porcion: "100 g",
      ...profile,
      verificado: false,
      unSoloEstado: true,
      estadoDefault: "cocido",
      fuente: item.fuente,
    };
    foods.push(food);
    byId.set(item.id, food);
    added++;
    console.log(`+ ${item.id} (fdcId ${item.fdcId})`);
  }

  // ---- 2) Upgrade: Zanahoria (crudo+cocido real), Brócoli / Espinaca cocida (crudo+cocido real) ----
  const upgrades: Array<{ id: string; crudoFdcId: number; cocidoFdcId: number; fuenteCrudo: string; fuenteCocido: string; nombre?: string }> = [
    {
      id: "zanahoria",
      crudoFdcId: 2258586,
      cocidoFdcId: 169339,
      fuenteCrudo: "Match directo: \"Carrots, mature, raw\" (Foundation #2258586).",
      fuenteCocido: "Cocido real: \"Carrots, cooked, boiled, drained, with salt\" (SR Legacy #169339).",
    },
    {
      id: "brocoli",
      nombre: "Brócoli",
      crudoFdcId: 747447,
      cocidoFdcId: 168510,
      fuenteCrudo: "Match directo: \"Broccoli, raw\" (Foundation #747447). Renombrado de \"Brócoli cocido\" a \"Brócoli\" porque ahora tiene estado crudo y cocido reales separados (antes era dato genérico sin fdcId, asumido cocido).",
      fuenteCocido: "Cocido real: \"Broccoli, cooked, boiled, drained, with salt\" (SR Legacy #168510).",
    },
    {
      id: "espinaca",
      nombre: "Espinaca",
      crudoFdcId: 1999633,
      cocidoFdcId: 170531,
      fuenteCrudo: "Match directo: \"Spinach, mature\" (Foundation #1999633). Renombrado de \"Espinaca cocida\" a \"Espinaca\" por el mismo motivo que Brócoli.",
      fuenteCocido: "Cocido real: \"Spinach, cooked, boiled, drained, with salt\" (SR Legacy #170531).",
    },
  ];

  let upgraded = 0;
  for (const u of upgrades) {
    const food = byId.get(u.id);
    if (!food) {
      console.log(`SKIP upgrade (no existe): ${u.id}`);
      continue;
    }
    const crudoNorm = await fetchNorm(u.crudoFdcId);
    const cocidoNorm = await fetchNorm(u.cocidoFdcId);
    const crudoProfile = toProfile(crudoNorm, u.crudoFdcId);
    const cocidoProfile = toProfile(cocidoNorm, u.cocidoFdcId);

    if (u.nombre) food.nombre = u.nombre;
    food.calorias = crudoProfile.calorias;
    food.proteina = crudoProfile.proteina;
    food.carbos = crudoProfile.carbos;
    food.grasas = crudoProfile.grasas;
    for (const k of ["grasasSaturadas", "grasasTrans", "grasasMonoinsaturadas", "grasasPoliinsaturadas", "omega3Ala", "omega6Linoleico", "agua", "ceniza", "colesterol", "sodio", "fibra", "azucares", "epa", "dha"]) {
      if (crudoProfile[k] !== undefined) food[k] = crudoProfile[k];
      else delete food[k];
    }
    food.micronutrientes = crudoProfile.micronutrientes;
    food.fdcIdCrudo = u.crudoFdcId;
    food.cocido = {
      ...cocidoProfile,
      fdcId: u.cocidoFdcId,
    };
    delete food.unSoloEstado;
    food.estadoDefault = "cocido";
    food.fuente = `${u.fuenteCrudo} ${u.fuenteCocido}`;
    upgraded++;
    console.log(`~ upgraded ${u.id} -> crudo fdcId ${u.crudoFdcId}, cocido fdcId ${u.cocidoFdcId}`);
  }

  // ---- 3) Upgrade: Crema de arroz (dry=crudo-equivalente, cooked=cocido real) ----
  {
    const food = byId.get("crema-arroz");
    if (food) {
      const dryNorm = await fetchNorm(173900);
      const cookedNorm = await fetchNorm(173914);
      const dryProfile = toProfile(dryNorm, 173900);
      const cookedProfile = toProfile(cookedNorm, 173914);

      food.calorias = dryProfile.calorias;
      food.proteina = dryProfile.proteina;
      food.carbos = dryProfile.carbos;
      food.grasas = dryProfile.grasas;
      for (const k of ["grasasSaturadas", "grasasTrans", "grasasMonoinsaturadas", "grasasPoliinsaturadas", "omega3Ala", "omega6Linoleico", "agua", "ceniza", "colesterol", "sodio", "fibra", "azucares", "epa", "dha"]) {
        if (dryProfile[k] !== undefined) food[k] = dryProfile[k];
        else delete food[k];
      }
      food.micronutrientes = dryProfile.micronutrientes;
      food.fdcIdCrudo = 173900;
      food.cocido = { ...cookedProfile, fdcId: 173914 };
      food.estadoDefault = "cocido";
      food.fuente = "Seco (base de comparación): \"Cereals, CREAM OF RICE, dry\" (SR Legacy #173900). Cocido real: \"Cereals, CREAM OF RICE, cooked with water, with salt\" (SR Legacy #173914).";
      console.log(`~ upgraded crema-arroz -> dry fdcId 173900, cocido fdcId 173914`);
      upgraded++;
    }
  }

  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n");
  console.log(`\nTotal foods: ${foods.length} (added ${added}, upgraded ${upgraded})`);
}

main();
