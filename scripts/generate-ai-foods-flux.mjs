import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const FOODS_PATH = "C:/Erick/app movil/vida-total-web/src/lib/data/foods.json";
const PUBLIC_FOODS_DIR = "C:/Erick/app movil/vida-total-web/public/foods";
const PS_SCRIPT = "C:/Erick/app movil/vida-total-web/scripts/process-food-image.ps1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FOOD_DESCRIPTIONS = {
  "platano": "a single ripe yellow banana",
  "manzana": "a single fresh whole red apple",
  "naranja": "a single fresh juicy whole orange fruit",
  "fresas": "fresh ripe red strawberries on a small clean white plate",
  "mora": "fresh ripe blackberries on a small clean white plate",
  "palta": "a fresh ripe avocado cut in half showing the pit",
  "pan-integral": "two neat slices of whole wheat bread",
  "pan-blanco": "two neat slices of plain white bread",
  "tortilla-maiz": "a small stack of Mexican corn tortillas",
  "papa-cocida": "plain boiled peeled potatoes on a clean plate",
  "camote": "cooked sliced sweet potato",
  "carne-molida": "cooked lean ground beef in a simple bowl",
  "lomo-cerdo": "a roasted pork loin steak slice",
  "salmon": "a grilled salmon fillet on a plain plate",
  "atun-lata": "canned chunk light tuna drained on a small plate",
  "merluza": "baked white hake fish fillet",
  "tofu": "fresh firm tofu cubes on a simple plate",
  "lentejas": "cooked brown lentils in a white bowl",
  "garbanzos": "cooked chickpeas in a white bowl",
  "frijoles-negros": "cooked black beans in a white bowl",
  "leche-entera": "a clear glass of fresh whole milk",
  "leche-descremada": "a clear glass of fresh skim milk",
  "yogur-griego": "plain greek yogurt in a clean white bowl",
  "yogur-natural": "plain whole yogurt in a clean white bowl",
  "queso-fresco": "sliced fresh white cheese on a plate",
  "queso-cottage": "fresh cottage cheese in a clean white bowl",
  "almendras": "raw whole almonds on a small white plate",
  "nueces": "raw walnut halves on a small white plate",
  "mani": "roasted unsalted peanuts on a small white plate",
  "mantequilla-mani": "smooth peanut butter in a small ramekin bowl",
  "aceite-oliva": "extra virgin olive oil in a small clear glass cruet",
  "brocoli": "steamed fresh green broccoli florets",
  "espinaca": "cooked steamed spinach leaves in a white bowl",
  "lechuga": "fresh crisp green lettuce leaves",
  "tomate": "a single fresh ripe red tomato",
  "zanahoria": "cooked carrot slices on a white plate",
  "pepino": "fresh green cucumber slices on a plate",
  "cebolla": "a fresh peeled whole onion",
  "pimiento": "a single whole fresh red bell pepper",
  "choclo": "cooked yellow corn on the cob on a plate",
  "quinua": "cooked fluffy white quinoa in a white bowl",
  "pasta": "plain cooked pasta noodles in a white bowl",
  "pan-pita": "whole wheat pita flatbread on a plate",
  "granola": "healthy oat granola in a small bowl",
  "chia": "chia seeds in a small white ceramic spoon",
  "linaza": "flax seeds in a small white ceramic spoon",
  "chocolate-negro": "square pieces of 70% dark chocolate",
  "barra-proteina": "an unwrapped single protein bar",
  "proteina-whey": "a whey protein shake in a shaker bottle",
  "pizza": "a single slice of margherita cheese pizza on a plate",
  "hamburguesa": "a classic beef burger on a plain plate",
  "papas-fritas": "crispy golden french fries on a plate",
  "ensalada-cesar": "chicken caesar salad with lettuce and croutons",
  "sushi-rolls": "California sushi rolls with avocado and crab",
  "lomo-saltado": "Peruvian lomo saltado beef stir fry with onion and tomato",
  "ceviche": "fresh Peruvian fish ceviche in a white bowl",
  "pollo-a-la-brasa": "Peruvian roasted chicken portion on a plate",
  "jugo-naranja": "a glass of freshly squeezed pure orange juice"
};

function buildPrompt(food) {
  const desc = FOOD_DESCRIPTIONS[food.id] || (food.nombre + (food.estadoDefault === "cocido" ? " cooked" : " raw"));
  // Strict prompt: ONLY the specified food, clean light/neutral background, nutrition app style
  return `Professional clean food photography for a nutrition app like MyFitnessPal or Fitia. A single single-item portion of: ${desc}. Centered and occupying most of the frame, small margin around for circular crop. Shot from elevated 3/4 angle, soft natural lighting, vibrant natural colors. Clean minimalist light neutral background, plain white plate or ceramic bowl. ONLY ${desc}, absolutely NO other food, NO side dishes, NO extra ingredients, NO hands, NO people, NO text, NO watermarks. Clean isolated aesthetic, square 1:1 format.`;
}

async function generateFoodImage(food, targetPngPath) {
  const promptText = buildPrompt(food);
  const encodedPrompt = encodeURIComponent(promptText);
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&nologo=true&model=flux&seed=${seed}`;

  console.log(`  Generando con Flux IA para [${food.id}]: "${food.nombre}"...`);

  // Usar process-food-image.ps1 para descargar, recortar 1:1 si fuese necesario y guardar como PNG
  const cmd = `powershell -ExecutionPolicy Bypass -File "${PS_SCRIPT}" -Url "${url}" -OutputFile "${targetPngPath}"`;
  
  try {
    const out = execSync(cmd, { encoding: "utf8", timeout: 45000 });
    return out.includes("SUCCESS") && existsSync(targetPngPath);
  } catch (err) {
    console.error(`  Error generando imagen para ${food.id}:`, err.message);
    return false;
  }
}

async function runBatch(limit = 10) {
  const foods = JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  let count = 0;

  console.log(`=== Iniciando tanda de ${limit} fotos IA en formato PNG ===\n`);

  for (let i = 0; i < foods.length; i++) {
    if (count >= limit) break;

    const food = foods[i];
    const targetPng = path.join(PUBLIC_FOODS_DIR, `${food.id}.png`);

    // Saltar si ya tiene photoUrl y el archivo PNG existe
    if (food.photoUrl && existsSync(targetPng)) {
      continue;
    }

    console.log(`[${count + 1}/${limit}] Procesando: ${food.nombre} (${food.id})...`);

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      success = await generateFoodImage(food, targetPng);
      if (success) break;
      console.warn(`  Reintentando (${attempt}/3)...`);
      await sleep(2000);
    }

    if (success) {
      food.photoUrl = `/foods/${food.id}.png`;
      count++;
      // Guardar progreso inmediatamente para que cada foto quede registrada
      writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf8");
      console.log(`  ✓ Foto PNG generada con éxito y vinculada en foods.json: ${food.id}.png`);
    } else {
      console.error(`  ✗ Falló la generación para ${food.id}`);
    }

    await sleep(1500);
  }

  // Validación final del archivo JSON
  JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  console.log(`\n=== Tanda completada: ${count} fotos generadas con IA en formato PNG. foods.json es 100% válido. ===`);
}

const batchSize = parseInt(process.argv[2] || "10", 10);
runBatch(batchSize);
