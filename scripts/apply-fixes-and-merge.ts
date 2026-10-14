/**
 * Segunda pasada de Fase 2: corrige los matches equivocados que encontró la auditoría manual
 * (fdcId fijo por id), saca de la tanda los que no tienen match real en USDA (quedan pendientes,
 * documentados, NUNCA inventados), y recién ahí mergea todo en foods.json + agrega alias nuevos.
 * Corre con: npx tsx scripts/apply-fixes-and-merge.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { getUsdaFoodDetail, normalizeUsdaFood, isUsdaConfigured, type NormalizedUsdaNutrition } from "../src/lib/nutrition/usda";

config({ path: ".env.local", quiet: true });
if (!isUsdaConfigured()) {
  console.error("USDA_FDC_API_KEY no configurada");
  process.exit(1);
}

const STAGING_PATH = "scripts/_staging-import-tanda1-2.json";
const FOODS_PATH = "src/lib/data/foods.json";
const ALIASES_PATH = "src/lib/nutrition/food-aliases.json";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// id -> { crudo?: fdcId fijo, cocido?: fdcId fijo } — solo se pisa lo que está mal.
const FIXES: Record<string, { crudo?: number; cocido?: number }> = {
  tocino: { crudo: 168277 },
  "costilla-cerdo": { crudo: 167853 },
  kefir: { crudo: 170904 },
  "trigo-grano": { crudo: 168890 },
  cebada: { crudo: 170284, cocido: 170285 },
  couscous: { crudo: 169699 },
  polenta: { crudo: 171671 },
  acelga: { crudo: 169991 },
  "brotes-soya": { crudo: 169284 },
  limon: { crudo: 167746 },
  chirimoya: { crudo: 168175 },
  "tuna-fruta": { crudo: 167750 },
  pasas: { crudo: 2758980 },
  ghee: { crudo: 171314 },
  sal: { crudo: 746775 },
  laurel: { crudo: 170917 },
  "jengibre-fresco": { crudo: 169231 },
  "jugo-manzana": { crudo: 167771 },
  "jugo-uva": { crudo: 173041 },
  "cafe-capuchino": { crudo: 2710472 },
  stevia: { crudo: 170679 },
  "agua-coco": { crudo: 170174 },
  panela: { crudo: 170674 },
  "rabanito-mix": { crudo: 168451 },
  "atun-aceite": { crudo: 173708 },
  "carne-molida-res": { crudo: 2514744, cocido: 171797 },
  mandarina: { crudo: 2710832 },
  "arroz-basmati": { crudo: 168877, cocido: 168878 },
  "arroz-jazmin": { cocido: 168878 },
  mijo: { cocido: 168871 },
  bulgur: { cocido: 170287 },
  "mantequilla-almendra": { crudo: 168603 },
  "aji-fresco": { crudo: 170497 },
};

// Sin match real en USDA — quedan PENDIENTES, documentados, no se importan con datos inventados.
const PENDING: Record<string, string> = {
  "chicha-morada": "sin match en USDA (bebida de maíz morado) — falta ficha nutricional real (INS Perú u otra fuente) para derivarla, igual que el chuño.",
  seitan: "USDA solo tiene entradas de marca (Branded) para seitán, sin un genérico Foundation/SR Legacy/Survey — se podría aproximar con gluten de trigo vital, pero el perfil nutricional real del seitán (ya cocido/condimentado) difiere bastante del gluten puro seco. Queda pendiente de un dato real.",
  "mate-coca": "no existe en USDA FoodData Central (la búsqueda 'coca tea'/'coca leaf' solo trae bebidas de marca Coca-Cola por coincidencia de texto, nada real). Falta una ficha nutricional real de hoja de coca/infusión para derivarla.",
};

interface StagedFood {
  id: string;
  nombre: string;
  categoria: string;
  porcion: string;
  fdcIdCrudo?: number;
  cocido?: Record<string, unknown>;
  unSoloEstado?: boolean;
  estadoDefault?: "crudo" | "cocido";
  fuente: string;
  [key: string]: unknown;
}

function toProfile(n: NormalizedUsdaNutrition) {
  const { fdcId: _fdcId, description: _description, dataType: _dataType, micronutrientes, ...rest } = n;
  void _fdcId; void _description; void _dataType;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(rest)) if (typeof v === "number") clean[k] = v;
  const microClean: Record<string, number> = {};
  for (const [k, v] of Object.entries(micronutrientes)) if (typeof v === "number") microClean[k] = v;
  return { ...clean, micronutrientes: microClean };
}

async function pinned(fdcId: number): Promise<NormalizedUsdaNutrition> {
  const detail = await getUsdaFoodDetail(fdcId);
  if (!detail) throw new Error(`fdcId fijo ${fdcId} no encontrado`);
  return normalizeUsdaFood(detail);
}

async function main() {
  const { staged } = JSON.parse(readFileSync(STAGING_PATH, "utf8")) as { staged: StagedFood[] };
  const corrected: StagedFood[] = [];
  const dropped: string[] = [];

  for (const food of staged) {
    if (food.id in PENDING) {
      dropped.push(food.id);
      continue;
    }
    const fix = FIXES[food.id];
    if (!fix) {
      corrected.push(food);
      continue;
    }
    let fuenteNote = food.fuente;
    if (fix.crudo) {
      await sleep(400);
      const n = await pinned(fix.crudo);
      const { id: _id, nombre: _nombre, categoria: _categoria, porcion: _porcion, fdcIdCrudo: _old, cocido: _oldCocido, fuente: _f, unSoloEstado: _u, estadoDefault: _e, ...restFields } = food;
      void _id; void _nombre; void _categoria; void _porcion; void _old; void _oldCocido; void _f; void _u; void _e;
      Object.assign(food, toProfile(n));
      food.fdcIdCrudo = n.fdcId;
      fuenteNote = fuenteNote.replace(/Match: "[^"]+" \([^)]+\)/, `CORREGIDO: "${n.description}" (${n.dataType} #${n.fdcId})`);
      console.log(`fix crudo ${food.id} -> ${n.description} (${n.dataType} #${n.fdcId})`);
    }
    if (fix.cocido) {
      await sleep(400);
      const n = await pinned(fix.cocido);
      food.cocido = { ...toProfile(n), fdcId: n.fdcId };
      fuenteNote += ` · CORREGIDO cocido: "${n.description}" (${n.dataType} #${n.fdcId})`;
      console.log(`fix cocido ${food.id} -> ${n.description} (${n.dataType} #${n.fdcId})`);
    }
    food.fuente = fuenteNote;
    corrected.push(food);
  }

  console.log(`\nCorregidos: ${Object.keys(FIXES).length}. Pendientes (no importados): ${dropped.join(", ")}.`);

  // ── Merge en foods.json ──
  const foods = JSON.parse(readFileSync(FOODS_PATH, "utf8")) as { id: string }[];
  const existingIds = new Set(foods.map((f) => f.id));
  const toAdd = corrected.filter((f) => !existingIds.has(f.id));
  const skippedDupe = corrected.filter((f) => existingIds.has(f.id)).map((f) => f.id);
  if (skippedDupe.length) console.log("YA EXISTÍAN (no se duplican):", skippedDupe);

  const merged = [...foods, ...toAdd];
  writeFileSync(FOODS_PATH, JSON.stringify(merged, null, 1) + "\n");
  console.log(`\nfoods.json: ${foods.length} -> ${merged.length} (+${toAdd.length})`);

  writeFileSync(
    "scripts/_fase2-pendientes.json",
    JSON.stringify(
      dropped.map((id) => ({ id, motivo: PENDING[id] })),
      null,
      1,
    ),
  );
}

main();
