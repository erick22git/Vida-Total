/**
 * Downloads a real food photo for every entry in `src/lib/data/foods.json`
 * using the Pexels API, saves it to `public/foods/photos/{id}.jpg`, and
 * writes the resulting `photoUrl` back into the JSON file.
 *
 * Usage:
 *   npx tsx scripts/fetch-food-photos.ts
 *
 * Requires NEXT_PUBLIC_PEXELS_API_KEY to be set in .env.local to a real key.
 * If the key is missing or still the placeholder, this script prints a clear
 * message and exits without making any network calls — that is expected.
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const PLACEHOLDER_VALUES = new Set(["", "TU_API_KEY_AQUI", "YOUR_API_KEY_HERE", "undefined"]);
const API_KEY = (process.env.NEXT_PUBLIC_PEXELS_API_KEY ?? "").trim();

interface Food {
  id: string;
  nombre: string;
  categoria: string;
  photoUrl?: string | null;
  [key: string]: unknown;
}

// Small Spanish -> English map to improve Pexels search hit rate for common
// local dishes/ingredients that would otherwise return generic results.
const TRANSLATIONS: Record<string, string> = {
  "pechuga de pollo a la plancha": "grilled chicken breast",
  "arroz blanco cocido": "cooked white rice",
  "arroz integral cocido": "cooked brown rice",
  "huevo entero": "boiled egg",
  "clara de huevo": "egg white",
  "avena en hojuelas": "oatmeal",
  "plátano": "banana",
  "manzana": "apple",
  "naranja": "orange fruit",
  "fresas": "strawberries",
  "palta / aguacate": "avocado",
  "pan integral": "whole wheat bread",
  "pan blanco": "white bread",
  "tortilla de maíz": "corn tortilla",
  "papa cocida": "boiled potato",
  "camote cocido": "cooked sweet potato",
  "carne molida de res (magra)": "ground beef",
  "lomo de cerdo": "pork loin",
  "salmón": "salmon fillet",
  "atún en lata (al agua)": "canned tuna",
  "merluza al horno": "baked hake fish",
  "tofu firme": "tofu",
  "lentejas cocidas": "cooked lentils",
  "garbanzos cocidos": "cooked chickpeas",
  "frijoles negros cocidos": "black beans",
  "leche entera": "milk glass",
  "leche descremada": "skim milk",
  "yogur griego natural": "greek yogurt",
  "yogur natural": "plain yogurt",
  "queso fresco": "fresh cheese",
  "queso cottage": "cottage cheese",
  "almendras": "almonds",
  "nueces": "walnuts",
  "maní / cacahuate": "peanuts",
  "mantequilla de maní": "peanut butter",
  "aceite de oliva": "olive oil",
  "brócoli cocido": "steamed broccoli",
  "espinaca cocida": "cooked spinach",
  "lechuga": "lettuce",
  "tomate": "tomato",
  "zanahoria": "carrot",
  "pepino": "cucumber",
  "cebolla": "onion",
  "pimiento rojo": "red bell pepper",
  "choclo / elote": "corn on the cob",
  "quinua cocida": "cooked quinoa",
  "pasta cocida": "cooked pasta",
  "pan pita integral": "whole wheat pita bread",
  "granola": "granola",
  "semillas de chía": "chia seeds",
  "semillas de linaza": "flax seeds",
  "chocolate negro (70%)": "dark chocolate",
  "barra de proteína": "protein bar",
  "batido de proteína whey": "protein shake",
  "pizza margarita": "margherita pizza",
  "hamburguesa clásica": "cheeseburger",
  "papas fritas": "french fries",
  "ensalada césar con pollo": "chicken caesar salad",
  "rolls de sushi (california)": "california sushi rolls",
  "lomo saltado": "peruvian lomo saltado",
  "ceviche de pescado": "peruvian ceviche",
  "ají de gallina": "aji de gallina peruvian dish",
  "caldo de gallina": "chicken soup",
  "tallarines verdes con bistec": "green noodles with steak",
  "arroz con pollo": "chicken and rice",
  "pollo a la brasa (1/4)": "roast chicken",
  "jugo de naranja natural": "orange juice",
  "gaseosa regular": "soda drink",
  "cerveza": "beer glass",
  "café negro sin azúcar": "black coffee",
  "café con leche": "latte coffee",
  "pan con palta": "avocado toast",
  "pan con huevo frito": "bread with fried egg",
  "tostadas francesas": "french toast",
  "panqueques con miel": "pancakes with honey",
  "omelette de 2 huevos con queso": "cheese omelette",
  "smoothie de frutas": "fruit smoothie",
  "ensalada de frutas": "fruit salad",
  "palomitas de maíz naturales": "popcorn",
  "galletas integrales": "whole wheat crackers",
  "yogur con frutas": "yogurt with fruit",
  "ensalada de quinua con verduras": "quinoa salad",
  "wrap de pollo": "chicken wrap",
  "sopa de verduras": "vegetable soup",
  "pescado frito": "fried fish",
  "anticuchos de corazón": "beef heart skewers",
  "tamal": "tamale",
  "empanada de carne": "beef empanada",
  "causa rellena de pollo": "peruvian causa",
  "papa a la huancaína": "papa a la huancaina",
  "choclo con queso": "corn with cheese",
  "helado de crema": "ice cream",
  "torta de chocolate": "chocolate cake",
  "gelatina": "jello dessert",
  "miel de abeja": "honey jar",
  "mermelada": "jam jar",
  "leche de almendras": "almond milk",
  "leche de avena": "oat milk",
  "edamame": "edamame",
  "hummus": "hummus",
  "aceitunas": "olives",
  "pepinillo encurtido": "pickles",
  "champiñones salteados": "sauteed mushrooms",
  "berenjena a la plancha": "grilled eggplant",
  "calabaza / zapallo cocido": "cooked pumpkin",
};

function translateQuery(food: Food): string {
  const key = food.nombre.toLowerCase();
  return TRANSLATIONS[key] ?? `${food.nombre} food`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPexelsPhoto(query: string): Promise<string | null> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (res.status === 429) {
    console.warn("  -> rate limited (429), stopping early.");
    return "RATE_LIMITED";
  }
  if (!res.ok) {
    console.warn(`  -> request failed (${res.status})`);
    return null;
  }
  const data = (await res.json()) as { photos?: { src?: { medium?: string } }[] };
  return data.photos?.[0]?.src?.medium ?? null;
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.warn("  -> download failed:", err);
    return false;
  }
}

async function main() {
  if (!API_KEY || PLACEHOLDER_VALUES.has(API_KEY)) {
    console.log(
      "PEXELS_API_KEY no configurada, omitiendo descarga — configura tu key en .env.local (NEXT_PUBLIC_PEXELS_API_KEY) y vuelve a correr este script.",
    );
    process.exit(0);
  }

  const foodsPath = path.resolve(process.cwd(), "src/lib/data/foods.json");
  const photosDir = path.resolve(process.cwd(), "public/foods/photos");
  mkdirSync(photosDir, { recursive: true });

  const foods: Food[] = JSON.parse(readFileSync(foodsPath, "utf-8"));

  let downloaded = 0;
  let skippedExisting = 0;
  let notFound = 0;

  for (const food of foods) {
    const destPath = path.join(photosDir, `${food.id}.jpg`);
    if (existsSync(destPath) && food.photoUrl) {
      skippedExisting++;
      continue;
    }

    const query = translateQuery(food);
    console.log(`Buscando foto para "${food.nombre}" (query: "${query}")...`);
    const photoUrl = await fetchPexelsPhoto(query);

    if (photoUrl === "RATE_LIMITED") {
      console.log("Deteniendo por límite de tasa. Vuelve a correr el script más tarde para continuar.");
      break;
    }

    if (!photoUrl) {
      console.log("  -> sin resultados, dejando photoUrl: null");
      food.photoUrl = null;
      notFound++;
      await sleep(1000);
      continue;
    }

    const ok = await downloadImage(photoUrl, destPath);
    if (ok) {
      food.photoUrl = `/foods/photos/${food.id}.jpg`;
      downloaded++;
      console.log(`  -> guardada en public/foods/photos/${food.id}.jpg`);
    } else {
      food.photoUrl = null;
      notFound++;
    }

    await sleep(1000); // respect ~200 req/hour rate limit
  }

  writeFileSync(foodsPath, JSON.stringify(foods, null, 2) + "\n", "utf-8");

  console.log("\nResumen:");
  console.log(`  Descargadas: ${downloaded}`);
  console.log(`  Ya existían: ${skippedExisting}`);
  console.log(`  Sin resultados: ${notFound}`);
  console.log(`  Total alimentos: ${foods.length}`);
}

main().catch((err) => {
  console.error("Error inesperado ejecutando el script:", err);
  process.exit(1);
});
