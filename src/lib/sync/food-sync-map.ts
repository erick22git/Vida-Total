/**
 * Mapeo alimento ↔ fila de `custom_foods` y fusión local/remoto SIN pérdida. Módulo PURO (no importa el cliente de Supabase)
 * para poder probarlo.
 *
 * Reglas:
 *  - Cada campo viaja: los que tienen columna propia y todo lo demás (grasas mono/poliinsaturadas, omega-3/6, agua, ceniza,
 *    alcohol, EPA/DHA, perfil COCIDO completo, verificado, configurado, estadoDefault, unSoloEstado, fdcIdCrudo) en
 *    `perfil_extra` (jsonb). Un 0 se guarda como 0; solo `undefined` es «sin dato» (se omite / queda en null).
 *  - Fusión: un campo que solo existe de un lado se conserva (nunca se reemplaza un dato local por uno remoto vacío); si
 *    existe en los dos y difieren, gana el lado con `actualizadoEn` más nuevo (empate: el local).
 *  - Retrocompatible: si las columnas nuevas aún no existen en el servidor, se reintenta sin ellas y el alimento local
 *    queda intacto.
 *  - Nada aquí pone `verificado` en verdadero: solo se copia lo que ya estaba guardado.
 */
import type { CookedNutritionProfile, CookedState, Food, FoodPortion } from "@/lib/types";

export interface FoodExtra {
  grasasMonoinsaturadas?: number;
  grasasPoliinsaturadas?: number;
  omega3Ala?: number;
  omega6Linoleico?: number;
  agua?: number;
  ceniza?: number;
  alcohol?: number;
  epa?: number;
  dha?: number;
  epaDha?: number;
  cocido?: CookedNutritionProfile;
  verificado?: boolean;
  configurado?: boolean;
  estadoDefault?: CookedState;
  unSoloEstado?: boolean;
  fdcIdCrudo?: number;
}

export interface CustomFoodRow {
  id: string;
  user_id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  porcion: string;
  peso_gramos: number | null;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasas_saturadas: number | null;
  grasas_trans: number | null;
  colesterol: number | null;
  sodio: number | null;
  fibra: number | null;
  azucares: number | null;
  azucares_anadidos: number | null;
  micronutrientes: Food["micronutrientes"] | null;
  photo_url: string | null;
  barcode: string | null;
  porciones: FoodPortion[] | null;
  /** Migración 0016. Si el servidor aún no la tiene, la columna no existe. */
  perfil_extra?: FoodExtra | null;
  updated_at?: string | null;
}

/** Columnas que agrega la migración 0016. */
export const EXTRA_COLUMNS = ["perfil_extra", "updated_at"] as const;

const EXTRA_KEYS = [
  "grasasMonoinsaturadas",
  "grasasPoliinsaturadas",
  "omega3Ala",
  "omega6Linoleico",
  "agua",
  "ceniza",
  "alcohol",
  "epa",
  "dha",
  "epaDha",
  "cocido",
  "verificado",
  "configurado",
  "estadoDefault",
  "unSoloEstado",
  "fdcIdCrudo",
] as const satisfies readonly (keyof FoodExtra & keyof Food)[];

/** Todo lo que no tiene columna propia; `undefined` se omite (los 0 y los `false` se conservan). `null` si no hay nada. */
export function packExtra(f: Food): FoodExtra | null {
  const out: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) if (f[k] !== undefined) out[k] = f[k];
  return Object.keys(out).length > 0 ? (out as FoodExtra) : null;
}

export function foodToRow(f: Food, userId: string): CustomFoodRow {
  return {
    id: f.id,
    user_id: userId,
    nombre: f.nombre,
    marca: f.marca ?? null,
    categoria: f.categoria,
    porcion: f.porcion,
    peso_gramos: f.pesoGramos ?? null,
    calorias: f.calorias,
    proteina: f.proteina,
    carbos: f.carbos,
    grasas: f.grasas,
    grasas_saturadas: f.grasasSaturadas ?? null,
    grasas_trans: f.grasasTrans ?? null,
    colesterol: f.colesterol ?? null,
    sodio: f.sodio ?? null,
    fibra: f.fibra ?? null,
    azucares: f.azucares ?? null,
    azucares_anadidos: f.azucaresAnadidos ?? null,
    micronutrientes: f.micronutrientes ?? null,
    photo_url: f.photoUrl ?? null,
    barcode: f.barcode ?? null,
    porciones: f.porciones ?? null,
    perfil_extra: packExtra(f),
    updated_at: new Date(f.actualizadoEn ?? Date.now()).toISOString(),
  };
}

export function rowToFood(row: CustomFoodRow): Food {
  const extra = (row.perfil_extra ?? {}) as FoodExtra;
  const ts = row.updated_at ? Date.parse(row.updated_at) : NaN;
  const food: Food = {
    id: row.id,
    nombre: row.nombre,
    marca: row.marca ?? undefined,
    categoria: row.categoria,
    porcion: row.porcion,
    pesoGramos: row.peso_gramos ?? undefined,
    calorias: row.calorias,
    proteina: row.proteina,
    carbos: row.carbos,
    grasas: row.grasas,
    grasasSaturadas: row.grasas_saturadas ?? undefined,
    grasasTrans: row.grasas_trans ?? undefined,
    colesterol: row.colesterol ?? undefined,
    sodio: row.sodio ?? undefined,
    fibra: row.fibra ?? undefined,
    azucares: row.azucares ?? undefined,
    azucaresAnadidos: row.azucares_anadidos ?? undefined,
    micronutrientes: row.micronutrientes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    barcode: row.barcode ?? undefined,
    porciones: row.porciones ?? undefined,
    creadoPorUsuario: true,
  };
  for (const k of EXTRA_KEYS) if (extra[k] !== undefined && extra[k] !== null) (food as unknown as Record<string, unknown>)[k] = extra[k];
  if (Number.isFinite(ts)) food.actualizadoEn = ts;
  return food;
}

/** Patch parcial para `update`: solo los campos tocados; un campo borrado a propósito (`undefined` en el patch) se manda como null. */
export function patchToRow(patch: Partial<Food>, full?: Food): Record<string, unknown> {
  // Con el alimento ya fusionado se manda la fila completa (un campo borrado queda en null y el perfil extra viaja entero).
  if (full) {
    const { id: _id, user_id: _uid, ...rest } = foodToRow(full, "");
    void _id;
    void _uid;
    return rest as unknown as Record<string, unknown>;
  }
  const row: Record<string, unknown> = {};
  const map: Array<[keyof Food, string]> = [
    ["nombre", "nombre"],
    ["marca", "marca"],
    ["categoria", "categoria"],
    ["porcion", "porcion"],
    ["pesoGramos", "peso_gramos"],
    ["calorias", "calorias"],
    ["proteina", "proteina"],
    ["carbos", "carbos"],
    ["grasas", "grasas"],
    ["grasasSaturadas", "grasas_saturadas"],
    ["grasasTrans", "grasas_trans"],
    ["colesterol", "colesterol"],
    ["sodio", "sodio"],
    ["fibra", "fibra"],
    ["azucares", "azucares"],
    ["azucaresAnadidos", "azucares_anadidos"],
    ["micronutrientes", "micronutrientes"],
    ["photoUrl", "photo_url"],
    ["barcode", "barcode"],
    ["porciones", "porciones"],
  ];
  const requiredNotNull = new Set(["nombre", "categoria", "porcion", "calorias", "proteina", "carbos", "grasas"]);
  for (const [key, col] of map) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v === undefined) {
      if (!requiredNotNull.has(col)) row[col] = null;
    } else row[col] = v;
  }
  return row;
}

/** Quita las columnas de la migración 0016 (para reintentar contra un servidor que aún no las tiene). */
export function stripExtraColumns<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const c of EXTRA_COLUMNS) delete out[c];
  return out as T;
}

/** ¿El error dice que falta una de las columnas de 0016? (PostgREST: «Could not find the 'perfil_extra' column…» / Postgres 42703). */
export function isMissingExtraColumnError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /perfil_extra|updated_at/i.test(message) && /column|schema cache|does not exist|no existe/i.test(message);
}

export interface ExtrasState {
  /** `null` = todavía no se sabe; `false` = el servidor no tiene las columnas (no se vuelven a mandar). */
  supported: boolean | null;
}

type Exec = (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;

/**
 * Ejecuta una escritura con las columnas nuevas y, si el servidor aún no las tiene, la repite sin ellas. Devuelve el error
 * final (si lo hay). Nunca lanza ni toca datos locales. `warn` solo se llama en desarrollo.
 */
export async function writeWithColumnFallback(
  exec: Exec,
  row: Record<string, unknown>,
  state: ExtrasState,
  warn: (msg: string) => void = () => {},
): Promise<{ error: { message: string } | null; usedFallback: boolean }> {
  if (state.supported === false) {
    const r = await exec(stripExtraColumns(row));
    return { error: r.error, usedFallback: true };
  }
  const first = await exec(row);
  if (!first.error) {
    if (state.supported === null) state.supported = true;
    return { error: null, usedFallback: false };
  }
  if (isMissingExtraColumnError(first.error.message)) {
    state.supported = false;
    warn("custom_foods no tiene las columnas de la migración 0016 (perfil_extra, updated_at): se guarda sin ellas. Aplica supabase/aplicar-0016.sql.");
    const second = await exec(stripExtraColumns(row));
    return { error: second.error, usedFallback: true };
  }
  return { error: first.error, usedFallback: false };
}

// ───────────────────────── fusión ─────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (isPlainObject(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function mergeValue(remote: unknown, local: unknown, localWins: boolean): unknown {
  if (remote === undefined) return local;
  if (local === undefined) return remote;
  if (isPlainObject(remote) && isPlainObject(local)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) out[k] = mergeValue(remote[k], local[k], localWins);
    return out;
  }
  if (sameJson(remote, local)) return local;
  return localWins ? local : remote;
}

/** Fusiona un alimento remoto y el local, campo por campo, sin perder ningún dato de ninguno de los dos lados. */
export function mergeFood(remote: Food, local: Food): Food {
  const localWins = (local.actualizadoEn ?? 0) >= (remote.actualizadoEn ?? 0);
  const out: Record<string, unknown> = {};
  const r = remote as unknown as Record<string, unknown>;
  const l = local as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) out[k] = mergeValue(r[k], l[k], localWins);
  out.id = remote.id;
  const ts = Math.max(remote.actualizadoEn ?? 0, local.actualizadoEn ?? 0);
  if (ts > 0) out.actualizadoEn = ts;
  else delete out.actualizadoEn;
  return out as unknown as Food;
}

export interface FoodMergeResult {
  merged: Food[];
  /** Solo en este dispositivo: hay que subirlos (insert). */
  localOnly: Food[];
  /** Existían en los dos lados y la fusión trae algo que el servidor no tiene: hay que subir la versión fusionada (update). */
  needsPush: Food[];
}

export function mergeFoodLists(remote: Food[], local: Food[]): FoodMergeResult {
  const remoteById = new Map(remote.map((f) => [f.id, f]));
  const localById = new Map(local.map((f) => [f.id, f]));
  const merged: Food[] = [];
  const needsPush: Food[] = [];
  for (const rf of remote) {
    const lf = localById.get(rf.id);
    if (!lf) {
      merged.push(rf);
      continue;
    }
    const m = mergeFood(rf, lf);
    merged.push(m);
    const { actualizadoEn: _a, ...mNoTs } = m;
    const { actualizadoEn: _b, ...rNoTs } = rf;
    void _a;
    void _b;
    if (!sameJson(mNoTs, rNoTs)) needsPush.push(m);
  }
  const localOnly = local.filter((l) => !remoteById.has(l.id));
  return { merged: [...merged, ...localOnly], localOnly, needsPush };
}
