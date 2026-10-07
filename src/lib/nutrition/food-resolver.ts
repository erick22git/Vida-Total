/**
 * Resolvedor de alimentos — UNA sola fuente de verdad para convertir texto ("arroz", "batido de leche",
 * "fideos 200 g") en un alimento de la base, una receta del usuario o "sin resultado".
 *
 * Lo usan Lista, Escáner (IA), Voz y el selector de ingredientes de Recetas. Es PURO: no toca el store ni la red y
 * NUNCA crea alimentos (crear uno nuevo es una decisión explícita del usuario, no un efecto del resolvedor).
 *
 * Orden de puntaje (0–100): exacto 100 > sinónimo de la propia ficha 98 > alias 94 > prefijo 80 > todos los
 * términos contenidos 70 > parecido tolerante 55 (1 error en palabras de 5–8 letras, 2 en 9+). Luego se resta por
 * palabras sobrantes y por platos compuestos, y se suma por verificado / uso previo. Los alias viven en
 * `food-aliases.json` (editable a mano).
 */
import aliasData from "./food-aliases.json";
import { defaultPortions, parsePorcionGramos, scaleCookedNutrition, scaleNutrition } from "@/lib/food-utils";
import type { CookedState, Food, LoggedFood, Recipe } from "@/lib/types";

// ───────────────────────── Normalización ─────────────────────────

const STOPWORDS = new Set([
  "de", "del", "con", "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "e", "en", "al", "a", "para", "por", "mi", "mis",
]);
const CRUDO = new Set(["crudo", "cruda", "crudos", "crudas"]);
const COCIDO = new Set(["cocido", "cocida", "cocidos", "cocidas"]);

/** minúsculas, sin tildes ni ñ, solo letras/números separados por un espacio. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Singular básico del español ("frijoles"→"frijol", "panqueques"→"panqueque", "nueces"→"nuez", "papas"→"papa"). */
export function stem(word: string): string {
  if (word.length <= 3 || /[0-9]/.test(word)) return word;
  if (word.endsWith("ces")) return `${word.slice(0, -3)}z`;
  if (word.endsWith("es") && /[lrndzjx]es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("is") && !word.endsWith("us")) return word.slice(0, -1);
  return word;
}

/** Palabras con significado: sin palabras vacías, ya en singular. */
function tokenize(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/** Saca cantidades tipo "200 g", "1,5 kg", "250 ml" del texto. Devuelve el texto limpio y los gramos (ml ≈ g). */
export function parseQuantityFromText(text: string): { texto: string; gramos: number | null } {
  const re = /(\d+(?:[.,]\d+)?)\s*(kilos?|kg|gramos?|grs?|g|mililitros?|ml|litros?|l)\b/i;
  const m = re.exec(text);
  if (!m) return { texto: text.trim(), gramos: null };
  let value = parseFloat(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  if (unit.startsWith("kilo") || unit === "kg" || unit.startsWith("litro") || unit === "l") value *= 1000;
  const texto = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  return { texto, gramos: Number.isFinite(value) && value > 0 ? value : null };
}

/** Distancia de edición con transposición (suficiente para errores de tipeo). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > 2) return 3;
  const d: number[][] = Array.from({ length: al + 1 }, (_, i) => [i, ...Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

function fuzzyEqual(a: string, b: string): boolean {
  const len = Math.min(a.length, b.length);
  if (len < 5) return false;
  const max = Math.max(a.length, b.length) >= 9 ? 2 : 1;
  return editDistance(a, b) <= max;
}

// ───────────────────────── Índice (se construye una vez) ─────────────────────────

/** Una forma de nombrar un elemento: tokens "núcleo" (sin crudo/cocido) + qué tan "oficial" es. */
interface Variant {
  core: string[];
  /** 100 = nombre completo, 99 = sin paréntesis, 98 = una de las alternativas "A / B". */
  exactScore: number;
}

interface IndexedEntry {
  kind: "alimento" | "receta";
  id: string;
  nombre: string;
  variants: Variant[];
  categoria?: string;
  verificado: boolean;
  configurado: boolean;
  food?: Food;
  recipe?: Recipe;
}

const COMPOSITE_CATEGORIES = new Set(["Plato preparado", "Comida rápida", "Desayuno", "Snack", "Postre"]);

function isStateToken(t: string): boolean {
  return CRUDO.has(t) || COCIDO.has(t);
}

function coreTokens(normalized: string): string[] {
  return tokenize(normalized).filter((t) => !isStateToken(t));
}

function variantsFor(nombre: string): Variant[] {
  const out: Variant[] = [];
  const seen = new Set<string>();
  const push = (text: string, exactScore: number) => {
    const core = tokenize(normalizeText(text)).filter((t) => !isStateToken(t));
    if (core.length === 0) return;
    const key = core.join(" ");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ core, exactScore });
  };
  push(nombre, 100);
  const sinParentesis = nombre.replace(/\([^)]*\)/g, " ");
  if (sinParentesis !== nombre) push(sinParentesis, 99);
  if (nombre.includes("/")) for (const alt of sinParentesis.split("/")) push(alt, 98);
  return out;
}

export interface ResolverIndex {
  entries: IndexedEntry[];
  byId: Map<string, Food>;
  aliases: Map<string, string[]>;
}

const aliasMap: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [k, v] of Object.entries((aliasData as { alias: Record<string, string[]> }).alias)) {
    m.set(tokenize(normalizeText(k)).join(" "), v);
  }
  return m;
})();

export function buildResolverIndex(foods: Food[], recipes: Recipe[] = []): ResolverIndex {
  const entries: IndexedEntry[] = [];
  const byId = new Map<string, Food>();
  for (const f of foods) {
    byId.set(f.id, f);
    entries.push({
      kind: "alimento", id: f.id, nombre: f.nombre, variants: variantsFor(f.nombre), categoria: f.categoria,
      verificado: !!f.verificado, configurado: f.configurado !== false, food: f,
    });
  }
  for (const r of recipes) {
    entries.push({
      kind: "receta", id: r.id, nombre: r.nombre, variants: variantsFor(r.nombre),
      verificado: !!r.verificado, configurado: true, recipe: r,
    });
  }
  return { entries, byId, aliases: aliasMap };
}

const indexCache = new WeakMap<Food[], WeakMap<Recipe[], ResolverIndex>>();
const NO_RECIPES: Recipe[] = [];

/** Índice cacheado por referencia de los arreglos (el store los reemplaza enteros al cambiar). */
export function getResolverIndex(foods: Food[], recipes: Recipe[] = NO_RECIPES): ResolverIndex {
  let byRecipes = indexCache.get(foods);
  if (!byRecipes) {
    byRecipes = new WeakMap();
    indexCache.set(foods, byRecipes);
  }
  let idx = byRecipes.get(recipes);
  if (!idx) {
    idx = buildResolverIndex(foods, recipes);
    byRecipes.set(recipes, idx);
  }
  return idx;
}

/** foodId → veces que el usuario ya lo registró (para preferir lo que ya usa). */
export function buildUsageMap(logged: LoggedFood[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logged) m.set(l.foodId, (m.get(l.foodId) ?? 0) + 1);
  return m;
}

// ───────────────────────── Puntaje ─────────────────────────

export type MatchSource = "exacto" | "sinonimo" | "alias" | "prefijo" | "contenido" | "tolerante" | "parcial";

export interface Candidate {
  kind: "alimento" | "receta";
  id: string;
  nombre: string;
  /** 0–100 */
  score: number;
  source: MatchSource;
  food?: Food;
  recipe?: Recipe;
}

type TokenMatch = "exacto" | "tolerante" | null;

function tokenMatch(q: string, t: string): TokenMatch {
  if (q === t) return "exacto";
  if (fuzzyEqual(q, t)) return "tolerante";
  return null;
}

/** Puntaje base de `query` (tokens núcleo) contra una variante. */
function scoreVariant(query: string[], v: Variant): { score: number; source: MatchSource; extra: number; coverage: number } {
  const core = v.core;
  if (query.length === core.length && query.every((q, i) => q === core[i])) {
    return { score: v.exactScore, source: v.exactScore === 100 ? "exacto" : "sinonimo", extra: 0, coverage: 1 };
  }
  const used = new Set<number>();
  let matched = 0;
  let fuzzy = 0;
  for (const q of query) {
    let hit = -1;
    let kind: TokenMatch = null;
    for (let i = 0; i < core.length; i++) {
      if (used.has(i)) continue;
      const m = tokenMatch(q, core[i]);
      if (m === "exacto") { hit = i; kind = m; break; }
      if (m === "tolerante" && hit < 0) { hit = i; kind = m; }
    }
    if (hit >= 0) {
      used.add(hit);
      matched++;
      if (kind === "tolerante") fuzzy++;
    }
  }
  const coverage = query.length ? matched / query.length : 0;
  const extra = core.length - used.size;
  if (coverage === 1) {
    const isPrefix = query.every((q, i) => core[i] !== undefined && tokenMatch(q, core[i]) !== null);
    if (fuzzy > 0) return { score: 55, source: "tolerante", extra, coverage };
    if (isPrefix) return { score: 80, source: "prefijo", extra, coverage };
    return { score: 70, source: "contenido", extra, coverage };
  }
  if (coverage >= 0.5) return { score: Math.round(40 * coverage), source: "parcial", extra, coverage };
  return { score: 0, source: "parcial", extra, coverage };
}

function scoreEntry(
  e: IndexedEntry,
  queryTokens: string[],
  aliasTargets: Map<string, number>,
  usage: Map<string, number> | undefined,
): Candidate | null {
  let best = { score: 0, source: "parcial" as MatchSource, extra: 0, coverage: 0 };
  for (const v of e.variants) {
    const s = scoreVariant(queryTokens, v);
    if (s.score > best.score || (s.score === best.score && s.extra < best.extra)) best = s;
  }
  let score = best.score;
  let source = best.source;

  // El alias manda aunque el texto no comparta ninguna palabra con el nombre ("chela" → Cerveza).
  const aliasRank = e.kind === "alimento" ? aliasTargets.get(normalizeText(e.nombre)) : undefined;
  if (aliasRank !== undefined && source !== "exacto" && source !== "sinonimo") {
    const aliasScore = aliasRank === 0 ? 94 : 90;
    if (aliasScore > score) {
      score = aliasScore;
      source = "alias";
    }
  }
  if (score === 0) return null;
  if (source !== "exacto" && source !== "sinonimo" && source !== "alias") {
    score -= Math.min(15, best.extra * 3);
    if (e.categoria && COMPOSITE_CATEGORIES.has(e.categoria)) score -= 10;
  }
  if (e.kind === "alimento") {
    if (!e.configurado) score -= 20;
    if (e.verificado) score += 4;
    const used = usage?.get(e.id) ?? 0;
    if (used > 0) score += Math.min(6, 1 + Math.floor(Math.log2(used + 1)));
  } else if (e.verificado) {
    score += 4;
  }
  score = Math.max(0, Math.min(100, score));
  return { kind: e.kind, id: e.id, nombre: e.nombre, score, source, food: e.food, recipe: e.recipe };
}

// ───────────────────────── Resultado ─────────────────────────

export type ResolveKind = "alimento" | "receta" | "sin_resultado";
export type Confidence = "alta" | "media" | "baja" | "ninguna";

export interface ResolvedIngredient {
  foodId: string;
  nombre: string;
  gramos: number;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  /** El ingrediente se pudo vincular a un alimento de la base/del usuario. */
  resuelto: boolean;
  food?: Food;
}

export interface ResolveResult {
  query: string;
  tipo: ResolveKind;
  candidates: Candidate[];
  chosen: Candidate | null;
  confidence: Confidence;
  /** Gramos pedidos (parámetro o parseados del texto); null si no se indicó. */
  gramosPedidos: number | null;
  /** Gramos efectivos: los pedidos o la porción por defecto (de la ficha / de 1 porción de la receta). */
  gramos: number;
  /** Estado por defecto del alimento (o el que pidió el texto: "crudo"/"cocido"). */
  cookedState?: CookedState;
  /** Solo si `tipo === "receta"`: ingredientes ya escalados a `gramos`. */
  ingredientes?: ResolvedIngredient[];
  recipeId?: string;
}

export interface ResolveOptions {
  gramos?: number | null;
  usage?: Map<string, number>;
  /** Máximo de candidatos devueltos (default 5). */
  maxCandidates?: number;
  /** Ignora las recetas (se usa al resolver los ingredientes de una receta, para no recursar). */
  foodsOnly?: boolean;
}

const FOOD_MIN = 40;
const RECIPE_MIN = 55;
const FOOD_GOOD = 60;

function requestedState(normalized: string): CookedState | undefined {
  const words = normalized.split(" ");
  if (words.some((w) => CRUDO.has(w))) return "crudo";
  if (words.some((w) => COCIDO.has(w))) return "cocido";
  return undefined;
}

function resolveRecipe(
  recipe: Recipe,
  idx: ResolverIndex,
  usage: Map<string, number> | undefined,
  gramosPedidos: number | null,
): { gramos: number; ingredientes: ResolvedIngredient[] } {
  const totalGramos = recipe.ingredientes.reduce((s, i) => s + (i.gramos || 0), 0);
  const porciones = recipe.porciones > 0 ? recipe.porciones : 1;
  const gramos = gramosPedidos ?? (totalGramos > 0 ? totalGramos / porciones : 0);
  const factor = totalGramos > 0 ? gramos / totalGramos : 0;
  const ingredientes = recipe.ingredientes.map((ing): ResolvedIngredient => {
    let food = idx.byId.get(ing.foodId);
    if (!food) {
      const r = resolveFoodText(ing.nombre, idx, { usage, maxCandidates: 1, foodsOnly: true });
      if (r.tipo === "alimento" && r.chosen?.food && r.chosen.score >= FOOD_GOOD) food = r.chosen.food;
    }
    const g = (ing.gramos || 0) * factor;
    // Los macros salen de lo que la receta ya guardó (así el total coincide con el de la receta); si no hay, de la ficha.
    const hasStored = ing.gramos > 0 && (ing.calorias || ing.proteina || ing.carbos || ing.grasas);
    let calorias = ing.calorias * factor;
    let proteina = ing.proteina * factor;
    let carbos = ing.carbos * factor;
    let grasas = ing.grasas * factor;
    if (!hasStored && food) {
      const n = scaleNutrition(food, g);
      calorias = n.calorias; proteina = n.proteina; carbos = n.carbos; grasas = n.grasas;
    }
    return {
      foodId: food?.id ?? ing.foodId,
      nombre: food?.nombre ?? ing.nombre,
      gramos: Math.round(g * 10) / 10,
      calorias: Math.round(calorias),
      proteina: Math.round(proteina * 10) / 10,
      carbos: Math.round(carbos * 10) / 10,
      grasas: Math.round(grasas * 10) / 10,
      resuelto: !!food,
      food,
    };
  });
  return { gramos: Math.round(gramos * 10) / 10, ingredientes };
}

/** Resuelve `text` contra el índice. `text` puede traer la cantidad ("fideos 200 g"). */
export function resolveFoodText(text: string, idx: ResolverIndex, opts: ResolveOptions = {}): ResolveResult {
  const parsed = parseQuantityFromText(text);
  const gramosPedidos = opts.gramos != null && opts.gramos > 0 ? opts.gramos : parsed.gramos;
  const normalized = normalizeText(parsed.texto);
  const queryTokens = coreTokens(normalized);
  const empty: ResolveResult = {
    query: text, tipo: "sin_resultado", candidates: [], chosen: null, confidence: "ninguna", gramosPedidos, gramos: gramosPedidos ?? 0,
  };
  if (queryTokens.length === 0) return empty;

  // Alias: la frase completa (con y sin crudo/cocido) apunta a nombres concretos de la base.
  const aliasKeys = [queryTokens.join(" "), tokenize(normalized).join(" ")];
  const aliasTargets = new Map<string, number>();
  for (const k of aliasKeys) (idx.aliases.get(k) ?? []).forEach((t, rank) => aliasTargets.set(normalizeText(t), rank));

  const scored: Candidate[] = [];
  for (const e of idx.entries) {
    if (opts.foodsOnly && e.kind === "receta") continue;
    const c = scoreEntry(e, queryTokens, aliasTargets, opts.usage);
    if (c) scored.push(c);
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.kind === "alimento") - Number(a.kind === "alimento") ||
      a.nombre.length - b.nombre.length,
  );
  const max = opts.maxCandidates ?? 5;
  const foods = scored.filter((c) => c.kind === "alimento");
  const recipes = scored.filter((c) => c.kind === "receta");

  // Alimento primero; solo si no hay ninguno razonable se usa una receta relacionada.
  let chosen: Candidate | null = null;
  if (foods[0] && foods[0].score >= FOOD_GOOD) chosen = foods[0];
  else if (recipes[0] && recipes[0].score >= RECIPE_MIN) chosen = recipes[0];
  else if (foods[0] && foods[0].score >= FOOD_MIN) chosen = foods[0];

  const candidates = scored.filter((c) => c.score >= FOOD_MIN).slice(0, max);
  if (chosen && !candidates.some((c) => c.id === chosen!.id && c.kind === chosen!.kind)) candidates.unshift(chosen);
  if (!chosen) return { ...empty, candidates };

  const sameKind = chosen.kind === "alimento" ? foods : recipes;
  const second = sameKind.find((c) => c.id !== chosen!.id);
  const margin = chosen.score - (second?.score ?? 0);
  const singleVsMany = queryTokens.length === 1 && chosen.source !== "exacto" && chosen.source !== "sinonimo" && chosen.source !== "alias";
  let confidence: Confidence = "baja";
  if (chosen.score >= 90 && margin >= 6) confidence = "alta";
  else if (chosen.score >= 80 && margin >= 8 && !singleVsMany) confidence = "alta";
  else if (chosen.score >= 65 && !singleVsMany) confidence = "media";

  return finalizeResult(text, normalized, chosen, candidates, confidence, gramosPedidos, idx, opts.usage);
}

function finalizeResult(
  text: string,
  normalized: string,
  chosen: Candidate,
  candidates: Candidate[],
  confidence: Confidence,
  gramosPedidos: number | null,
  idx: ResolverIndex,
  usage: Map<string, number> | undefined,
): ResolveResult {
  const stateAsked = requestedState(normalized);
  if (chosen.kind === "receta" && chosen.recipe) {
    const r = resolveRecipe(chosen.recipe, idx, usage, gramosPedidos);
    return { query: text, tipo: "receta", candidates, chosen, confidence, gramosPedidos, gramos: r.gramos, ingredientes: r.ingredientes, recipeId: chosen.id };
  }
  const food = chosen.food!;
  const base = defaultPortions(food)[0]?.gramos ?? parsePorcionGramos(food);
  // Estado: lo que pidió el texto (si el alimento tiene dato de cocido), si no el de la ficha.
  let cookedState: CookedState = food.estadoDefault ?? "crudo";
  if (stateAsked) cookedState = stateAsked;
  if (cookedState === "cocido" && !food.cocido) cookedState = "crudo";
  return { query: text, tipo: "alimento", candidates, chosen, confidence, gramosPedidos, gramos: gramosPedidos ?? base, cookedState };
}

/** Igual que `resolveFoodText`, pero el usuario ya eligió `candidate` a mano (chip "cambiar"): confianza alta. */
export function resolveCandidate(text: string, candidate: Candidate, candidates: Candidate[], idx: ResolverIndex, opts: ResolveOptions = {}): ResolveResult {
  const parsed = parseQuantityFromText(text);
  const gramosPedidos = opts.gramos != null && opts.gramos > 0 ? opts.gramos : parsed.gramos;
  return finalizeResult(text, normalizeText(parsed.texto), candidate, candidates, "alta", gramosPedidos, idx, opts.usage);
}

/** Atajo: construye (o reutiliza) el índice y resuelve. */
export function resolveFood(
  text: string,
  foods: Food[],
  recipes: Recipe[] = NO_RECIPES,
  opts: ResolveOptions = {},
): ResolveResult {
  return resolveFoodText(text, getResolverIndex(foods, recipes), opts);
}

// ───────────────────────── Nutrición del resultado ─────────────────────────

export interface ResolvedNutrition {
  gramos: number;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

/** Calorías/macros de un resultado a `gramos` (por defecto los del propio resultado). null si es "sin resultado". */
export function nutritionForResult(result: ResolveResult, gramos?: number): ResolvedNutrition | null {
  const g = gramos ?? result.gramos;
  if (result.tipo === "alimento" && result.chosen?.food) {
    const food = result.chosen.food;
    const n = result.cookedState === "cocido" ? scaleCookedNutrition(food, g) ?? scaleNutrition(food, g) : scaleNutrition(food, g);
    return { gramos: g, calorias: n.calorias, proteina: n.proteina, carbos: n.carbos, grasas: n.grasas };
  }
  if (result.tipo === "receta" && result.ingredientes) {
    const sum = result.ingredientes.reduce(
      (a, i) => ({ calorias: a.calorias + i.calorias, proteina: a.proteina + i.proteina, carbos: a.carbos + i.carbos, grasas: a.grasas + i.grasas }),
      { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
    );
    return { gramos: result.gramos, ...sum };
  }
  return null;
}
