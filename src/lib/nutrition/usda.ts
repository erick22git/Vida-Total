/**
 * Capa de servicio para USDA FoodData Central (https://fdc.nal.usda.gov).
 * SOLO server-side (Route Handlers, scripts) — usa `USDA_FDC_API_KEY`, que
 * NUNCA lleva prefijo NEXT_PUBLIC_ a propósito, igual que GEMINI_API_KEY.
 *
 * Por qué Foundation/SR Legacy y no Branded: los alimentos "Branded" (marcas
 * comerciales) reportan sus valores por porción etiquetada (`servingSize`),
 * a veces incompletos en micronutrientes. "Foundation" y "SR Legacy" son
 * los alimentos de referencia genéricos de USDA — sus `foodNutrients`
 * siempre vienen normalizados a 100g del alimento (sin campo `servingSize`
 * en la respuesta, es la convención del dataset) y traen el panel de
 * vitaminas/minerales más completo. Por eso las búsquedas de esta capa
 * filtran `dataType=Foundation,SR Legacy` primero.
 */

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

const PLACEHOLDER_VALUES = new Set(["", "TU_API_KEY_AQUI", "undefined"]);

export function getUsdaApiKey(): string | null {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key || PLACEHOLDER_VALUES.has(key.trim())) return null;
  return key.trim();
}

export function isUsdaConfigured(): boolean {
  return getUsdaApiKey() !== null;
}

// ============================================================================
// Tipos crudos de la API (solo los campos que usamos)
// ============================================================================

export interface UsdaSearchResultItem {
  fdcId: number;
  description: string;
  dataType: string;
}

interface UsdaSearchResponse {
  totalHits: number;
  foods: UsdaSearchResultItem[];
}

interface UsdaNutrientEntry {
  nutrient?: { number?: string; name?: string; unitName?: string };
  amount?: number;
}

interface UsdaFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: UsdaNutrientEntry[];
}

/**
 * Busca alimentos por texto (en inglés — USDA no indexa bien español).
 * Prioriza Foundation/SR Legacy; si no hay resultados, reintenta sin filtro
 * de dataType (para alimentos que solo existen como "Branded" o "Survey").
 */
export async function searchUsdaFoods(query: string, pageSize = 5): Promise<UsdaSearchResultItem[]> {
  const apiKey = getUsdaApiKey();
  if (!apiKey) return [];

  const baseParams = { api_key: apiKey, query, pageSize: String(pageSize) };

  const preferred = new URLSearchParams({ ...baseParams, dataType: "Foundation,SR Legacy" });
  const res1 = await fetch(`${USDA_BASE_URL}/foods/search?${preferred.toString()}`);
  if (res1.ok) {
    const data = (await res1.json()) as UsdaSearchResponse;
    if (data.foods?.length) return data.foods;
  }

  const fallback = new URLSearchParams(baseParams);
  const res2 = await fetch(`${USDA_BASE_URL}/foods/search?${fallback.toString()}`);
  if (!res2.ok) return [];
  const data2 = (await res2.json()) as UsdaSearchResponse;
  return data2.foods ?? [];
}

export async function getUsdaFoodDetail(fdcId: number): Promise<UsdaFoodDetail | null> {
  const apiKey = getUsdaApiKey();
  if (!apiKey) return null;

  const res = await fetch(`${USDA_BASE_URL}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) return null;
  return (await res.json()) as UsdaFoodDetail;
}

// ============================================================================
// Normalización: USDA nutrient "number" (constante, universal en toda la
// API — más confiable que el nombre, que varía de un alimento a otro) ->
// campo interno de la app.
// ============================================================================

const NUTRIENT_NUMBER = {
  calorias: "208", // Energy (kcal) — SR Legacy usa 208; Foundation a veces solo trae 957/958 (Atwater), manejado aparte
  energiaAtwaterGeneral: "957",
  proteina: "203",
  carbos: "205",
  grasas: "204",
  grasasSaturadas: "606",
  colesterol: "601",
  sodio: "307",
  fibra: "291",
  azucares: "269",
  vitaminaA: "320", // Vitamin A, RAE (mcg)
  vitaminaC: "401",
  vitaminaD: "328", // Vitamin D (D2+D3) mcg
  vitaminaE: "323",
  vitaminaK: "430",
  vitaminaB1: "404", // Thiamin
  vitaminaB2: "405", // Riboflavin
  vitaminaB3: "406", // Niacin
  vitaminaB6: "415",
  vitaminaB12: "418",
  folato: "417",
  calcio: "301",
  hierro: "303",
  magnesio: "304",
  fosforo: "305",
  potasio: "306",
  zinc: "309",
  selenio: "317",
  cobre: "312",
  manganeso: "315",
} as const;

export interface NormalizedUsdaNutrition {
  fdcId: number;
  description: string;
  dataType: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  colesterol?: number;
  sodio?: number;
  fibra?: number;
  azucares?: number;
  micronutrientes: {
    vitaminaA?: number;
    vitaminaC?: number;
    vitaminaD?: number;
    vitaminaE?: number;
    vitaminaK?: number;
    vitaminaB1?: number;
    vitaminaB2?: number;
    vitaminaB3?: number;
    vitaminaB6?: number;
    vitaminaB12?: number;
    folato?: number;
    calcio?: number;
    hierro?: number;
    magnesio?: number;
    fosforo?: number;
    potasio?: number;
    zinc?: number;
    selenio?: number;
    cobre?: number;
    manganeso?: number;
  };
}

function findAmount(nutrients: UsdaNutrientEntry[], number: string): number | undefined {
  const entry = nutrients.find((n) => n.nutrient?.number === number);
  return typeof entry?.amount === "number" ? entry.amount : undefined;
}

/**
 * Convierte el detalle crudo de USDA (valores siempre por 100g en
 * Foundation/SR Legacy) al formato interno de nutrición de la app. Nunca
 * lanza — si falta un campo, simplemente no aparece en el resultado (queda
 * `undefined`, tratado como "sin dato" por el resto de la app, igual que
 * hoy con los alimentos base que no tienen micronutrientes).
 */
export function normalizeUsdaFood(detail: UsdaFoodDetail): NormalizedUsdaNutrition {
  const n = detail.foodNutrients;
  const calorias = findAmount(n, NUTRIENT_NUMBER.calorias) ?? findAmount(n, NUTRIENT_NUMBER.energiaAtwaterGeneral) ?? 0;

  return {
    fdcId: detail.fdcId,
    description: detail.description,
    dataType: detail.dataType,
    calorias,
    proteina: findAmount(n, NUTRIENT_NUMBER.proteina) ?? 0,
    carbos: findAmount(n, NUTRIENT_NUMBER.carbos) ?? 0,
    grasas: findAmount(n, NUTRIENT_NUMBER.grasas) ?? 0,
    grasasSaturadas: findAmount(n, NUTRIENT_NUMBER.grasasSaturadas),
    colesterol: findAmount(n, NUTRIENT_NUMBER.colesterol),
    sodio: findAmount(n, NUTRIENT_NUMBER.sodio),
    fibra: findAmount(n, NUTRIENT_NUMBER.fibra),
    azucares: findAmount(n, NUTRIENT_NUMBER.azucares),
    micronutrientes: {
      vitaminaA: findAmount(n, NUTRIENT_NUMBER.vitaminaA),
      vitaminaC: findAmount(n, NUTRIENT_NUMBER.vitaminaC),
      vitaminaD: findAmount(n, NUTRIENT_NUMBER.vitaminaD),
      vitaminaE: findAmount(n, NUTRIENT_NUMBER.vitaminaE),
      vitaminaK: findAmount(n, NUTRIENT_NUMBER.vitaminaK),
      vitaminaB1: findAmount(n, NUTRIENT_NUMBER.vitaminaB1),
      vitaminaB2: findAmount(n, NUTRIENT_NUMBER.vitaminaB2),
      vitaminaB3: findAmount(n, NUTRIENT_NUMBER.vitaminaB3),
      vitaminaB6: findAmount(n, NUTRIENT_NUMBER.vitaminaB6),
      vitaminaB12: findAmount(n, NUTRIENT_NUMBER.vitaminaB12),
      folato: findAmount(n, NUTRIENT_NUMBER.folato),
      calcio: findAmount(n, NUTRIENT_NUMBER.calcio),
      hierro: findAmount(n, NUTRIENT_NUMBER.hierro),
      magnesio: findAmount(n, NUTRIENT_NUMBER.magnesio),
      fosforo: findAmount(n, NUTRIENT_NUMBER.fosforo),
      potasio: findAmount(n, NUTRIENT_NUMBER.potasio),
      zinc: findAmount(n, NUTRIENT_NUMBER.zinc),
      selenio: findAmount(n, NUTRIENT_NUMBER.selenio),
      cobre: findAmount(n, NUTRIENT_NUMBER.cobre),
      manganeso: findAmount(n, NUTRIENT_NUMBER.manganeso),
    },
  };
}

/**
 * Busca el primer resultado y devuelve su nutrición normalizada, o `null`
 * si no hay key configurada, no hay resultados, o falla la consulta.
 * Conveniencia para el caso común "quiero UN alimento representativo".
 */
export async function lookupUsdaNutrition(query: string): Promise<NormalizedUsdaNutrition | null> {
  const results = await searchUsdaFoods(query, 8);
  if (results.length === 0) return null;

  // Si la query pide un estado de preparación específico ("cooked",
  // "raw", "boiled", "roasted", "fried", "baked", "dry"), preferir un
  // resultado cuya descripción lo mencione — Foundation suele tener MENOS
  // variantes "cooked" que SR Legacy, así que preferir Foundation a
  // ciegas puede devolver el valor crudo cuando se pidió cocido (ya pasó
  // con arroz integral: "rice brown cooked" devolvía un Foundation crudo
  // de 365kcal/100g en vez de un SR Legacy cocido de ~112kcal/100g).
  const prepWords = ["cooked", "raw", "boiled", "roasted", "fried", "baked", "dry", "dried"];
  const queryPrep = prepWords.find((w) => query.toLowerCase().includes(w));
  const prepMatch = queryPrep ? results.filter((r) => r.description.toLowerCase().includes(queryPrep)) : [];

  // Orden de candidatos a probar, sin duplicados.
  const seen = new Set<number>();
  const ordered = [
    ...prepMatch,
    ...results.filter((r) => r.dataType === "Foundation"),
    ...results.filter((r) => r.dataType === "SR Legacy"),
    ...results,
  ].filter((r) => (seen.has(r.fdcId) ? false : (seen.add(r.fdcId), true)));

  // Algunos registros de Foundation (p.ej. ciertos aceites) solo reportan
  // el desglose de ácidos grasos y NO tienen "Energy"/proteína/carbos —
  // devolverían 0 kcal, que es peor que no corregir nada. Se prueba cada
  // candidato en orden hasta encontrar uno con datos de energía reales.
  for (const candidate of ordered) {
    const detail = await getUsdaFoodDetail(candidate.fdcId);
    if (!detail) continue;
    const normalized = normalizeUsdaFood(detail);
    if (normalized.calorias > 0) return normalized;
  }

  return null;
}
