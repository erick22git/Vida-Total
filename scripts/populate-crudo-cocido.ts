/**
 * Puebla crudo+cocido (con el esquema nuevo de src/lib/types/index.ts) para los 10 alimentos del
 * pedido de verificación, usando fdcId ya elegidos a mano tras inspeccionar candidatos con
 * scripts/inspect-crudo-cocido-candidates.ts (evita los mismos bugs de mal match que
 * scripts/nutrition-query-map.mjs ya documentó: "arroz blanco" glutinoso, "pan blanco" harina cruda).
 *
 * Corre con: npx tsx scripts/populate-crudo-cocido.ts
 * Escribe src/lib/data/foods.json localmente — NO lo commitea (mismo criterio que
 * scripts/correct-nutrition-usda.ts). Revisar el resumen antes de subir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { getUsdaFoodDetail, normalizeUsdaFood, isUsdaConfigured, type NormalizedUsdaNutrition } from "../src/lib/nutrition/usda";

config({ path: ".env.local", quiet: true });

if (!isUsdaConfigured()) {
  console.error("USDA_FDC_API_KEY no configurada");
  process.exit(1);
}

const FOODS_PATH = "src/lib/data/foods.json";

interface Target {
  id: string;
  nombreFinal: string;
  crudoFdcId: number | null;
  cocidoFdcId: number | null;
  /** true si el alimento no tiene sentido en dos estados — el ÚNICO real (el que se haya podido
   * traer) se guarda en los campos de nivel superior ("crudo") y `cocido` queda vacío. */
  unSoloEstado: boolean;
  /** Con qué estado conviene que abra por default un registro nuevo. */
  estadoDefault?: "crudo" | "cocido";
  /** Nota de aproximación/no-match, para el reporte — no toca los datos. */
  nota?: string;
}

const TARGETS: Target[] = [
  {
    id: "platano",
    nombreFinal: "Plátano",
    crudoFdcId: 173944, // Bananas, raw (SR Legacy)
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "Fruta cruda por naturaleza — no hay un 'plátano cocido' genérico en FDC (distinto del plátano/plantain para freír, que es OTRO alimento). Queda como un solo estado.",
  },
  {
    id: "avena",
    nombreFinal: "Avena",
    crudoFdcId: 173904, // Cereals, oats, regular and quick, not fortified, dry (SR Legacy)
    cocidoFdcId: 173905, // ...cooked with water (includes boiling and microwaving), without salt (SR Legacy)
    unSoloEstado: false,
    estadoDefault: "cocido", // se registra casi siempre como avena cocida (con agua/leche), no seca
  },
  {
    id: "cebolla-caramelizada",
    nombreFinal: "Cebolla caramelizada",
    crudoFdcId: null,
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "SIN MATCH en USDA Foundation/SR Legacy: solo hay cebolla cruda, en aros fritos de marca (Denny's), deshidratada o variedades crudas (roja, dulce, welsh) — ninguna es 'cebolla caramelizada/salteada'. No se aproximó (a diferencia de la manzana fuji, acá no hay una variante genérica razonable: caramelizar cambia radicalmente los azúcares por la reducción de agua + Maillard, no es solo 'cebolla cocida'). Queda SIN datos nutricionales hasta que decidas cómo seguir (¿aproximar con 'Onions, cooked, boiled' + ajuste manual? ¿otra fuente?).",
  },
  {
    id: "huevo",
    nombreFinal: "Huevo entero",
    crudoFdcId: 171287, // Egg, whole, raw, fresh (SR Legacy)
    cocidoFdcId: 173424, // Egg, whole, cooked, hard-boiled (SR Legacy)
    unSoloEstado: false,
    estadoDefault: "cocido",
  },
  {
    id: "pollo-apanado",
    nombreFinal: "Pollo apanado",
    // Su único estado real (frito) va en el slot "crudo" (nivel superior) a propósito: son los
    // campos que SIEMPRE tienen valor — si el único dato fuera a `cocido`, el nivel superior
    // quedaría en 0 kcal y el switch crudo/cocido aparecería mostrando ceros del lado "crudo" en
    // vez de no aparecer. Con `unSoloEstado: true` y `cocido` ausente, el switch no se muestra.
    crudoFdcId: 170718, // Fast foods, chicken, breaded and fried, boneless pieces, plain (SR Legacy) — el match genérico (no de marca) más cercano
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "No existe un 'pollo apanado crudo' (no se come así) ni una entrada casera genérica en Foundation/SR Legacy — el match usado es 'Fast foods, chicken, breaded and fried, boneless pieces, plain', la opción NO de marca (se descartaron KFC/Popeye's) más parecida. Puede diferir algo de una receta casera.",
  },
  {
    id: "pechuga-pollo",
    nombreFinal: "Pechuga de pollo",
    crudoFdcId: 2646170, // Chicken, breast, boneless, skinless, raw (Foundation)
    cocidoFdcId: 171534, // Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled (SR Legacy)
    unSoloEstado: false,
    estadoDefault: "cocido", // ya existía como "a la plancha" (cocido) — se mantiene ese default
    nota: "Ya existía en la base SOLO como cocido ('a la plancha', dato aproximado viejo) — se reemplaza por el dato real de FDC y se agrega el crudo. El nombre pasa de 'Pechuga de pollo a la plancha' a 'Pechuga de pollo' porque ahora cubre los dos estados.",
  },
  {
    id: "pan-blanco",
    nombreFinal: "Pan blanco",
    crudoFdcId: 174924, // Bread, white, commercially prepared (includes soft bread crumbs) — ya verificado en Bloque 8
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "Ya horneado — no hay un estado 'crudo' (masa cruda) en FDC para pan comercial. Dato sin cambios respecto al ya verificado en el Bloque 8.",
  },
  {
    id: "pan-integral",
    nombreFinal: "Pan de trigo integral",
    crudoFdcId: 172688, // Bread, whole-wheat, commercially prepared (SR Legacy)
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "Mismo caso que pan blanco — un solo estado (horneado).",
  },
  {
    id: "pan-marraqueta",
    nombreFinal: "Pan Marraqueta",
    crudoFdcId: 172795, // Rolls, french (SR Legacy) — APROXIMACIÓN, ver nota
    cocidoFdcId: null,
    unSoloEstado: true,
    nota: "SIN match exacto: la marraqueta es un pan boliviano regional, FDC no la tiene. Se aproxima con 'Rolls, french' (pan francés crocante, el analogo más cercano en forma/miga), mismo criterio que la manzana fuji del Bloque 8 (variante genérica más parecida, documentada como aproximación, no un dato exacto).",
  },
  {
    id: "arroz-blanco",
    nombreFinal: "Arroz blanco",
    crudoFdcId: 168877, // Rice, white, long-grain, regular, raw, enriched (SR Legacy)
    cocidoFdcId: 169753, // Rice, white, long-grain, regular, cooked, enriched, with salt — ya verificado en Bloque 8
    unSoloEstado: false,
    estadoDefault: "cocido", // ya existía definido como cocido (130kcal/100g) — se mantiene ese default
    nota: "Ya existía en la base definido como el estado COCIDO (130kcal/100g, en los campos de nivel superior). Con el modelo nuevo, ese dato pasa a vivir en 'cocido' (se confirma igual, mismo fdcId 169753) y se agrega el CRUDO real (~365kcal/100g) en los campos de nivel superior. `estadoDefault: 'cocido'` hace que un registro nuevo siga abriendo en el mismo valor de siempre — los LoggedFood ya guardados no cambian (cada uno tiene su propia foto de cuando se registró).",
  },
];

interface FoodEntryRaw {
  id: string;
  nombre: string;
  porcion: string;
  pesoGramos?: number;
  [key: string]: unknown;
}

/**
 * CRÍTICO (mismo bug que ya documentó scripts/correct-nutrition-usda.ts): USDA reporta SIEMPRE por
 * 100g, pero `Food.calorias`/etc. en esta app representan la porción DECLARADA del alimento (p.ej.
 * "1 unidad (118 g)" para el plátano, "40 g" para la avena) — no 100g. Sin este reescalado, un
 * plátano de 118g terminaría guardado con el valor de 100g (bajo en ~15%). `cocido` usa la MISMA
 * base de gramos que crudo (no una propia): así lo esperan `scaleNutrition`/`scaleCookedNutrition`
 * en food-utils.ts (dividen por `parsePorcionGramos(food)` para los dos estados por igual).
 */
function parsePorcionGramos(porcion: string, pesoGramos?: number): number {
  if (pesoGramos) return pesoGramos;
  const match = porcion.match(/\(([\d.]+)\s*g\)/) ?? porcion.match(/^([\d.]+)\s*g/);
  if (match) return parseFloat(match[1]);
  return 100;
}

function applyProfile(target: Record<string, unknown>, n: NormalizedUsdaNutrition, scale: number) {
  const req = (v: number) => Math.round(v * scale * 100) / 100;
  const opt = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * scale * 100) / 100);
  target.calorias = req(n.calorias);
  target.proteina = req(n.proteina);
  target.carbos = req(n.carbos);
  target.grasas = req(n.grasas);
  target.grasasSaturadas = opt(n.grasasSaturadas);
  target.grasasTrans = opt(n.grasasTrans);
  target.grasasMonoinsaturadas = opt(n.grasasMonoinsaturadas);
  target.grasasPoliinsaturadas = opt(n.grasasPoliinsaturadas);
  target.omega3Ala = opt(n.omega3Ala);
  target.omega6Linoleico = opt(n.omega6Linoleico);
  target.colesterol = opt(n.colesterol);
  target.sodio = opt(n.sodio);
  target.fibra = opt(n.fibra);
  target.azucares = opt(n.azucares);
  target.agua = opt(n.agua);
  target.ceniza = opt(n.ceniza);
  const micro: Record<string, number> = {};
  for (const [k, v] of Object.entries(n.micronutrientes)) if (typeof v === "number") micro[k] = Math.round(v * scale * 100) / 100;
  target.micronutrientes = Object.keys(micro).length > 0 ? micro : undefined;
  // Limpia claves undefined (para que el JSON quede prolijo, sin "campo": null/undefined sueltos).
  for (const k of Object.keys(target)) if (target[k] === undefined) delete target[k];
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  grasasSaturadas: "grasas saturadas",
  grasasTrans: "grasas trans",
  grasasMonoinsaturadas: "grasas monoinsaturadas",
  grasasPoliinsaturadas: "grasas poliinsaturadas",
  omega3Ala: "omega-3 (ALA)",
  omega6Linoleico: "omega-6 (linoleico)",
  colesterol: "colesterol",
  sodio: "sodio",
  fibra: "fibra",
  azucares: "azúcares",
  agua: "agua",
  ceniza: "ceniza",
};

function missingFields(n: NormalizedUsdaNutrition): string[] {
  const out: string[] = [];
  for (const [key, label] of Object.entries(MISSING_FIELD_LABELS)) {
    if ((n as unknown as Record<string, number | undefined>)[key] === undefined) out.push(label);
  }
  const microKeys = ["vitaminaA","vitaminaC","vitaminaD","vitaminaE","vitaminaK","vitaminaB1","vitaminaB2","vitaminaB3","vitaminaB5","vitaminaB6","vitaminaB12","folato","colina","calcio","hierro","magnesio","fosforo","potasio","zinc","selenio","cobre","manganeso"];
  for (const k of microKeys) if (n.micronutrientes[k as keyof typeof n.micronutrientes] === undefined) out.push(k);
  return out;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ReportRow {
  id: string;
  nombre: string;
  fdcIdCrudo: number | null;
  fdcIdCocido: number | null;
  kcalCrudo: number | null;
  kcalCocido: number | null;
  porcionGramos: number;
  faltanCrudo: string[];
  faltanCocido: string[];
  nota: string;
}

async function main() {
  const foods = JSON.parse(readFileSync(FOODS_PATH, "utf-8")) as FoodEntryRaw[];
  const report: ReportRow[] = [];

  for (const t of TARGETS) {
    let crudoNorm: NormalizedUsdaNutrition | null = null;
    let cocidoNorm: NormalizedUsdaNutrition | null = null;

    if (t.crudoFdcId) {
      const detail = await getUsdaFoodDetail(t.crudoFdcId);
      crudoNorm = detail ? normalizeUsdaFood(detail) : null;
      await sleep(700);
    }
    if (t.cocidoFdcId) {
      const detail = await getUsdaFoodDetail(t.cocidoFdcId);
      cocidoNorm = detail ? normalizeUsdaFood(detail) : null;
      await sleep(700);
    }

    let entry = foods.find((f) => f.id === t.id);
    if (!entry) {
      entry = {
        id: t.id,
        nombre: t.nombreFinal,
        categoria: "Otros",
        porcion: "100 g",
        pesoGramos: 100,
        calorias: 0,
        proteina: 0,
        carbos: 0,
        grasas: 0,
      };
      foods.push(entry);
      console.log(`+ Alimento nuevo: ${t.id}`);
    } else {
      entry.nombre = t.nombreFinal;
      console.log(`~ Actualizando: ${t.id}`);
    }

    // La porción declarada del alimento (ya existente, o "100 g" recién creada arriba) es la base
    // de gramos para los DOS estados — ver comentario de `applyProfile`.
    const baseGramos = parsePorcionGramos(entry.porcion, entry.pesoGramos);
    const scale = baseGramos / 100;

    if (crudoNorm) {
      applyProfile(entry as Record<string, unknown>, crudoNorm, scale);
      entry.fdcIdCrudo = crudoNorm.fdcId;
    }
    if (cocidoNorm) {
      const cocidoProfile: Record<string, unknown> = {};
      applyProfile(cocidoProfile, cocidoNorm, scale);
      cocidoProfile.fdcId = cocidoNorm.fdcId;
      entry.cocido = cocidoProfile;
    } else {
      delete entry.cocido;
    }
    // Sin match en NINGÚN estado (p.ej. cebolla caramelizada): no inventar un 0kcal silencioso —
    // queda `configurado: false`, igual que cualquier alimento sin datos reales cargados (no se
    // puede registrar en una comida hasta completarlo a mano, ver food-detail-screen.tsx).
    if (!crudoNorm && !cocidoNorm) {
      entry.configurado = false;
    }
    entry.unSoloEstado = t.unSoloEstado;
    if (t.estadoDefault) entry.estadoDefault = t.estadoDefault;
    // Nunca se toca `verificado` acá — ese campo es exclusivamente manual (ver comentario en
    // food-utils.ts / scripts/correct-nutrition-usda.ts). Queda pendiente que lo marques a mano
    // desde "Marcar como verificado" una vez que revises esta tabla.

    report.push({
      id: t.id,
      nombre: t.nombreFinal,
      fdcIdCrudo: crudoNorm?.fdcId ?? null,
      fdcIdCocido: cocidoNorm?.fdcId ?? null,
      // kcal YA reescaladas a la porción declarada del alimento (`baseGramos`), no por 100g — es lo
      // que efectivamente queda guardado en foods.json.
      kcalCrudo: crudoNorm ? Math.round(crudoNorm.calorias * scale) : null,
      kcalCocido: cocidoNorm ? Math.round(cocidoNorm.calorias * scale) : null,
      porcionGramos: baseGramos,
      faltanCrudo: crudoNorm ? missingFields(crudoNorm) : [],
      faltanCocido: cocidoNorm ? missingFields(cocidoNorm) : [],
      nota: t.nota ?? "",
    });
  }

  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf-8");

  console.log("\n\n=== RESUMEN ===\n");
  console.log("| Alimento | fdcId crudo | fdcId cocido | kcal crudo | kcal cocido | porción (g) | notas |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of report) {
    console.log(
      `| ${r.nombre} (\`${r.id}\`) | ${r.fdcIdCrudo ?? "—"} | ${r.fdcIdCocido ?? "—"} | ${r.kcalCrudo ?? "—"} | ${r.kcalCocido ?? "—"} | ${r.porcionGramos} | ${r.nota.replace(/\n/g, " ")} |`,
    );
  }
  console.log("\n=== CAMPOS SIN DATO EN LA FUENTE ===\n");
  for (const r of report) {
    if (r.faltanCrudo.length) console.log(`${r.nombre} (crudo): ${r.faltanCrudo.join(", ")}`);
    if (r.faltanCocido.length) console.log(`${r.nombre} (cocido): ${r.faltanCocido.join(", ")}`);
  }

  writeFileSync("reporte-crudo-cocido.json", JSON.stringify(report, null, 2), "utf-8");
  console.log("\nListo. foods.json actualizado localmente (sin commitear) + reporte-crudo-cocido.json");
}

main();
