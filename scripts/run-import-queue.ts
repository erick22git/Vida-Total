/**
 * Fase 2: corre la cola de import-queue-tanda1-2.ts contra USDA FDC real, arma cada alimento nuevo
 * (perfil crudo + cocido real cuando exista) y lo deja en un archivo de STAGING para revisar antes de
 * aplicarlo a foods.json — no escribe foods.json directo. Corre con:
 *   npx tsx scripts/run-import-queue.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { searchUsdaFoods, getUsdaFoodDetail, normalizeUsdaFood, isUsdaConfigured, type NormalizedUsdaNutrition } from "../src/lib/nutrition/usda";
import { QUEUE, type QueueItem } from "./import-queue-tanda1-2";

config({ path: ".env.local", quiet: true });

if (!isUsdaConfigured()) {
  console.error("USDA_FDC_API_KEY no configurada");
  process.exit(1);
}

const STAGING_PATH = "scripts/_staging-import-tanda1-2.json";
const SLEEP_MS = 650; // conservador: ~5500 req/hora máx, bien debajo del límite de 3600/hora de la key (y acá van ~500 req en total)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const DATA_TYPE_RANK: Record<string, number> = { Foundation: 0, "SR Legacy": 1, "Survey (FNDDS)": 2 };

/** Elige el mejor candidato: prioriza Foundation > SR Legacy > Survey, nunca Branded. */
async function bestMatch(query: string): Promise<{ normalized: NormalizedUsdaNutrition; candidatesTried: number } | null> {
  const results = await searchUsdaFoods(query, 8);
  const ranked = results
    .filter((r) => r.dataType !== "Branded")
    .sort((a, b) => (DATA_TYPE_RANK[a.dataType] ?? 9) - (DATA_TYPE_RANK[b.dataType] ?? 9));
  let tried = 0;
  for (const candidate of ranked) {
    tried++;
    await sleep(SLEEP_MS);
    const detail = await getUsdaFoodDetail(candidate.fdcId);
    if (!detail) continue;
    const normalized = normalizeUsdaFood(detail);
    if (normalized.calorias > 0 || normalized.proteina > 0) return { normalized, candidatesTried: tried };
  }
  return null;
}

interface StagedFood {
  id: string;
  nombre: string;
  categoria: string;
  porcion: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  grasasTrans?: number;
  grasasMonoinsaturadas?: number;
  grasasPoliinsaturadas?: number;
  omega3Ala?: number;
  omega6Linoleico?: number;
  colesterol?: number;
  sodio?: number;
  fibra?: number;
  azucares?: number;
  alcohol?: number;
  epa?: number;
  dha?: number;
  agua?: number;
  ceniza?: number;
  verificado: boolean;
  fdcIdCrudo?: number;
  cocido?: Record<string, unknown>;
  unSoloEstado?: boolean;
  estadoDefault?: "crudo" | "cocido";
  micronutrientes?: Record<string, number>;
  fuente: string;
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

async function main() {
  const staged: StagedFood[] = [];
  const sinMatch: { id: string; nombre: string; motivo: string }[] = [];
  let n = 0;

  for (const item of QUEUE) {
    n++;
    process.stdout.write(`[${n}/${QUEUE.length}] ${item.id} (${item.nombre}) ... `);
    try {
      const crudoRes = await bestMatch(item.queryCrudo);
      if (!crudoRes) {
        console.log("SIN MATCH (crudo)");
        sinMatch.push({ id: item.id, nombre: item.nombre, motivo: `sin resultados usables para "${item.queryCrudo}"` });
        continue;
      }
      const crudo = crudoRes.normalized;

      let cocidoProfile: Record<string, unknown> | undefined;
      let cocidoNote = "";
      if (item.queryCocido) {
        await sleep(SLEEP_MS);
        const cocidoRes = await bestMatch(item.queryCocido);
        if (cocidoRes) {
          cocidoProfile = { ...toProfile(cocidoRes.normalized), fdcId: cocidoRes.normalized.fdcId };
          cocidoNote = ` · cocido: "${cocidoRes.normalized.description}" (${cocidoRes.normalized.dataType} #${cocidoRes.normalized.fdcId})`;
        } else {
          cocidoNote = ` · SIN match para cocido ("${item.queryCocido}")`;
        }
      }

      const fuente = `Match: "${crudo.description}" (${crudo.dataType} #${crudo.fdcId})${cocidoNote}`;

      staged.push({
        id: item.id,
        nombre: item.nombre,
        categoria: item.categoria,
        porcion: "100 g",
        ...toProfile(crudo),
        verificado: false,
        fdcIdCrudo: crudo.fdcId,
        ...(cocidoProfile ? { cocido: cocidoProfile } : {}),
        ...(item.unSoloEstado ? { unSoloEstado: true } : {}),
        ...(item.estadoDefault ? { estadoDefault: item.estadoDefault } : {}),
        fuente,
      } as StagedFood);
      console.log("ok —", fuente.slice(0, 90));
    } catch (err) {
      console.log("ERROR:", err);
      sinMatch.push({ id: item.id, nombre: item.nombre, motivo: `error: ${String(err)}` });
    }

    if (n % 50 === 0 || n === QUEUE.length) {
      writeFileSync(STAGING_PATH, JSON.stringify({ staged, sinMatch }, null, 1));
      console.log(`--- checkpoint ${n}/${QUEUE.length}: ${staged.length} ok, ${sinMatch.length} sin match. Guardado en ${STAGING_PATH} ---`);
    }
  }

  writeFileSync(STAGING_PATH, JSON.stringify({ staged, sinMatch }, null, 1));
  console.log(`\nTOTAL: ${staged.length} ok, ${sinMatch.length} sin match de ${QUEUE.length}.`);
}

main();
