// Genera fotos de alimentos con Cloudflare Workers AI (FLUX.1-schnell, plan gratis: 10 000 neurons/día, ~100 imágenes de 8 pasos).
// Uso:  node scripts/generate-food-photos-cf.mjs [cantidad=10] [pasos=8]
// - Lee CF_ACCOUNT_ID y CF_API_TOKEN de .env.local (nunca se imprimen).
// - Toma las próximas N entradas de src/lib/data/foods.json (y foods-regional.json) SIN "photoUrl", genera UNA foto del alimento solo
//   (sin otros alimentos ni objetos), la guarda en public/foods/{id}.jpg y agrega únicamente "photoUrl" a esa entrada.
// - Si Cloudflare responde que se acabó el cupo del día, se detiene (lo ya hecho queda guardado): se retoma al día siguiente.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { EN } from "./food-photo-descriptions-en.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] ?? 10);
const STEPS = Math.min(8, Number(process.argv[3] ?? 8));
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const ACC = (env.match(/^CF_ACCOUNT_ID=(.+)$/m) ?? [])[1]?.trim();
const TOK = (env.match(/^CF_API_TOKEN=(.+)$/m) ?? [])[1]?.trim();
if (!ACC || !TOK) throw new Error("Faltan CF_ACCOUNT_ID / CF_API_TOKEN en .env.local");
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/`;
const HEAD = { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" };

const FILES = ["src/lib/data/foods.json", "src/lib/data/foods-regional.json"].map((f) => path.join(ROOT, f));
const raw = FILES.map((f) => fs.readFileSync(f, "utf8"));
const data = raw.map((t) => JSON.parse(t));
if (process.env.REDO === "1") {
  data.forEach((arr) => arr.forEach((e) => {
    if (/\.jpg$/.test(e.photoUrl ?? "")) {
      try { fs.unlinkSync(path.join(ROOT, "public", e.photoUrl)); } catch {}
      delete e.photoUrl;
    }
  }));
}
const pending = [];
data.forEach((arr, fi) => arr.forEach((e) => !e.photoUrl && pending.push({ fi, e })));
console.log(`pendientes: ${pending.length}; esta tanda: ${Math.min(N, pending.length)}`);

const SURFACES = [
  "resting directly on a clean wooden table",
  "on a plain white ceramic plate",
  "on a dark slate board",
  "on a light marble surface",
  "on a simple beige linen cloth",
];

async function translate(name) {
  try {
    const r = await fetch(BASE + "@cf/meta/m2m100-1.2b", { method: "POST", headers: HEAD, body: JSON.stringify({ text: name, source_lang: "spanish", target_lang: "english" }) });
    const j = await r.json();
    return j?.result?.translated_text?.trim() || name;
  } catch {
    return name;
  }
}

function surfaceFor(desc, i) {
  // si la descripción ya trae su recipiente (vaso, bol, frasco, lata…) solo se apoya sobre una mesa limpia
  if (/ in a | in an |bottle|jar|glass|bowl|cup|can|jug|tub/.test(desc)) return "placed on a clean wooden table";
  return SURFACES[i % SURFACES.length];
}

function save() {
  data.forEach((arr, i) => {
    const eol = raw[i].endsWith("\n") ? "\n" : "";
    fs.writeFileSync(FILES[i], JSON.stringify(arr, null, 2) + eol, "utf8");
  });
}

let done = 0;
for (const { e } of pending.slice(0, N)) {
  const en = EN[e.id] ?? (await translate(e.nombre));
  const state = e.estadoDefault === "cocido" && !/cook|boiled|baked|roast|grill|fried|steamed|poached|scrambled/.test(en) ? ", cooked and ready to eat" : "";
  // OJO: schnell no entiende negativos (si se nombra "menta" o "hierbas" las dibuja). Todo el prompt va en positivo.
  const prompt =
    `Close-up food photo of ${en}${state}, centered and filling most of the frame, shot from a slightly elevated three-quarter top-down angle, ` +
    `${surfaceFor(en, done)}. Minimal composition, plain clean background with soft shallow depth of field, soft natural daylight, realistic appetizing colors, sharp focus. ` +
    `Only the ${en} and nothing else in the picture.`;
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    const r = await fetch(BASE + "@cf/black-forest-labs/flux-1-schnell", { method: "POST", headers: HEAD, body: JSON.stringify({ prompt, steps: STEPS }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.result?.image) {
      const buf = await sharp(Buffer.from(j.result.image, "base64")).resize(768, 768).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      fs.writeFileSync(path.join(ROOT, "public", "foods", `${e.id}.jpg`), buf);
      e.photoUrl = `/foods/${e.id}.jpg`;
      save(); // progreso guardado imagen por imagen
      done++;
      ok = true;
      console.log(`OK  ${e.id}  (${en})`);
    } else {
      const msg = JSON.stringify(j?.errors ?? j).slice(0, 220);
      console.log(`ERR ${e.id} intento ${attempt}: HTTP ${r.status} ${msg}`);
      if (/quota|limit|neurons|exceed|capacity|allocation|4006|daily/i.test(msg) || r.status === 429) {
        console.log("Cupo del día agotado: se detiene. Retomar mañana (después de las 00:00 UTC).");
        save();
        process.exit(0);
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}
save();
for (const [i, arr] of data.entries()) JSON.parse(fs.readFileSync(FILES[i], "utf8")); // validación final
console.log(`listo: ${done} imágenes nuevas; JSON válido`);
