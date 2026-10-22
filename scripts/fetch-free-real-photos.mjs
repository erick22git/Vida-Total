import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const FOODS_PATH = "C:/Erick/app movil/vida-total-web/src/lib/data/foods.json";
const PUBLIC_FOODS_DIR = "C:/Erick/app movil/vida-total-web/public/foods";
const PS_SCRIPT = "C:/Erick/app movil/vida-total-web/scripts/process-food-image.ps1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FORBIDDEN_WORDS = [
  "shutterstock", "alamy", "getty", "depositphotos", "dreamstime", "istock",
  "watermark", "marca", "logo", "hand", "mano", "persona", "person", "woman",
  "mujer", "hombre", "man", "chef", "eating", "comiendo", "family", "familia",
  "receta paso a paso", "banner", "vector", "dibujo", "illustration"
];

async function searchImages(query) {
  try {
    const tokenRes = await fetch("https://duckduckgo.com/?q=" + encodeURIComponent(query) + "&iax=images&ia=images");
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([\d-]+)/);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];
    const apiUrl = `https://duckduckgo.com/i.js?l=es-es&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,type:photo,&p=1`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const data = await res.json();
    return (data.results || []).filter((r) => {
      const u = (r.image || "").toLowerCase();
      const t = (r.title || "").toLowerCase();
      if (!u.startsWith("http")) return false;
      for (const word of FORBIDDEN_WORDS) {
        if (u.includes(word) || t.includes(word)) return false;
      }
      return (r.width || 0) >= 400 && (r.height || 0) >= 400;
    });
  } catch (err) {
    console.error("  Error searching:", err.message);
    return [];
  }
}

function processAndSave(url, outputFile) {
  try {
    const cmd = `powershell -ExecutionPolicy Bypass -File "${PS_SCRIPT}" -Url "${url}" -OutputFile "${outputFile}"`;
    const out = execSync(cmd, { encoding: "utf8", timeout: 20000 });
    return out.includes("SUCCESS") && existsSync(outputFile);
  } catch (e) {
    return false;
  }
}

async function runBatch(limit = 25) {
  const foods = JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  let processed = 0;

  for (let i = 0; i < foods.length; i++) {
    if (processed >= limit) break;

    const food = foods[i];
    const targetFile = path.join(PUBLIC_FOODS_DIR, `${food.id}.jpg`);

    if (food.photoUrl && existsSync(targetFile)) {
      continue;
    }

    console.log(`[${i + 1}/${foods.length}] Buscando foto limpia para: ${food.nombre} (${food.id})...`);

    let cleanName = food.nombre.trim();
    // Limpiar paréntesis o aclaraciones secundarias para la query principal
    const baseName = cleanName.split(/[/(),]/)[0].trim();

    let prepTerm = "";
    if (food.estadoDefault === "cocido" && !/cocid|plancha|horno|prepar|asado|frito|bowl|saltead/i.test(baseName)) {
      prepTerm = "cocido al vapor";
    }

    // Queries diseñadas para capturar SOLO el alimento, aislado o sobre fondo simple/blanco
    const searchQueries = [
      `"${baseName} ${prepTerm}".trim() fondo blanco aislado`,
      `"${baseName}" ${prepTerm} plato minimalista fondo blanco`,
      `${baseName} ${prepTerm} isolated white background food photography`,
      `"${baseName}" porcion solo plato comida fondo blanco`
    ].filter(Boolean);

    let downloaded = false;
    for (const q of searchQueries) {
      if (downloaded) break;
      const results = await searchImages(q);
      for (const res of results.slice(0, 5)) {
        console.log(`  Intentando: ${res.image.slice(0, 85)}...`);
        const ok = processAndSave(res.image, targetFile);
        if (ok) {
          console.log(`  ✓ Foto guardada y centrada: ${food.id}.jpg`);
          food.photoUrl = `/foods/${food.id}.jpg`;
          downloaded = true;
          break;
        }
      }
      await sleep(800);
    }

    if (downloaded) {
      processed++;
      writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + "\n", "utf8");
      console.log(`  -> Actualizado foods.json (${processed}/${limit} de este lote)`);
    } else {
      console.warn(`  ✗ No se encontró foto adecuada para ${food.nombre}`);
    }

    await sleep(1200);
  }

  // Validación final del JSON
  JSON.parse(readFileSync(FOODS_PATH, "utf8"));
  console.log(`\nLote completado: ${processed} alimentos procesados. foods.json es 100% válido.`);
}

const batchSize = parseInt(process.argv[2] || "25", 10);
runBatch(batchSize);
