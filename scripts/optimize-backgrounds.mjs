// Bloque 7: convierte los fondos de página (PNG pesados, ~1.5-2.5MB cada
// uno) a WebP comprimido para que un fondo de pantalla completa no arruine
// el tiempo de carga. Corre una sola vez con `node scripts/optimize-backgrounds.mjs`.
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";

const SRC_DIR = "img vida toal";
const OUT_DIR = "public/backgrounds";
const MAX_WIDTH = 1200; // ya son fotos verticales tipo mobile (852x1846) — de sobra para fondo de pantalla
const QUALITY = 68;

// Nombre de archivo fuente -> nombre normalizado de salida.
const NAME_MAP = {
  "home.png": "home",
  "gym.png": "gym",
  "calorias.png": "calorias",
  "entrenamiento.png": "entrenamiento",
  "agua.png": "agua",
  "kegel.png": "kegel",
  "habitos.png": "habitos",
  "oufit.png": "outfit",
  "paz.png": "paz-mental",
  "finanzas.png": "finanzas",
  "voz.png": "voz",
};

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR);
for (const file of files) {
  const outName = NAME_MAP[file];
  if (!outName) {
    console.warn(`Sin mapeo para "${file}", se omite.`);
    continue;
  }
  const srcPath = path.join(SRC_DIR, file);
  const outPath = path.join(OUT_DIR, `${outName}.webp`);
  const info = await sharp(srcPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outPath);
  console.log(`${file} -> ${outPath} (${(info.size / 1024).toFixed(0)} KB)`);
}
