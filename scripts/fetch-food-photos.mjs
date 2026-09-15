// One-time enrichment script (Bloque 5, punto 1): busca una foto real en
// Pexels para cada alimento del dataset base y la guarda en `photoUrl`,
// para que FoodPhoto (src/components/gym/food-photo.tsx) muestre fotos
// reales en vez del emoji/icono de respaldo. Se corre una sola vez con
// `node scripts/fetch-food-photos.mjs` — no se ejecuta en cada build.
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const API_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY;
if (!API_KEY) {
  console.error("NEXT_PUBLIC_PEXELS_API_KEY no está configurada en .env.local");
  process.exit(1);
}

const FOODS_PATH = "src/lib/data/foods.json";
const foods = JSON.parse(readFileSync(FOODS_PATH, "utf-8"));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// El nombre completo suele incluir método de preparación ("a la plancha",
// "al vapor") que no ayuda a la búsqueda de imagen y a veces la empeora —
// se usa solo hasta la primera preposición para la query.
function searchQuery(nombre) {
  const cut = nombre.split(/\s+(a la|al|con|en)\s+/i)[0];
  return `${cut} food`;
}

// INTENTO ANTERIOR FALLÓ POR ESTO — dejar constancia para la próxima vez:
// a partir de cierto volumen de requests en poco tiempo, Pexels (detrás de
// Cloudflare) empieza a responder 401 "Invalid API key" con la MISMA key
// que segundos antes daba 200 — esos 401 no traen headers x-ratelimit-*
// (a diferencia de los 200), o sea que Cloudflare los corta ANTES de que
// lleguen al backend real de Pexels. La primera versión de este script
// reintentaba cada 401 hasta 4 veces con backoff corto, lo que en la
// práctica MULTIPLICABA por ~8 el volumen de requests y empeoró el
// bloqueo hasta dejar el 100% de las queries en 401. NO reintroducir esos
// reintentos agresivos — si vuelve a pasar, la solución es espaciar más
// (DELAY_MS más alto), no reintentar más rápido.
const DELAY_MS = 2500;

async function fetchPhoto(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (res.status === 429) {
    console.warn("  rate limit real (429), esperando 60s...");
    await sleep(60_000);
    return fetchPhoto(query);
  }
  if (!res.ok) {
    console.warn(`  status ${res.status} para "${query}"`);
    return null;
  }
  const data = await res.json();
  return data.photos?.[0]?.src?.medium ?? null;
}

let updated = 0;
let skipped = 0;
let failed = 0;

for (const food of foods) {
  if (food.photoUrl) {
    skipped++;
    continue;
  }
  const query = searchQuery(food.nombre);
  process.stdout.write(`"${food.nombre}" -> query "${query}" ... `);
  const url = await fetchPhoto(query);
  if (url) {
    food.photoUrl = url;
    updated++;
    console.log("OK");
  } else {
    failed++;
    console.log("SIN RESULTADO");
  }
  // Guarda progreso incremental — si el proceso se corta a mitad de
  // camino (rate limit, Ctrl+C, etc.) no se pierde lo ya conseguido.
  writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf-8");
  await sleep(DELAY_MS);
}

writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf-8");
console.log(`\nListo. Actualizados: ${updated}, ya tenían foto: ${skipped}, sin resultado: ${failed}.`);
