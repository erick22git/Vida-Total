// Genera los íconos de rango de la app a partir de la carpeta de originales. Reutilizable: cuando agregues
// más imágenes a `img vida toal/RANGOS` (p. ej. "PLATINO I.png"), corre de nuevo:
//
//   node tools/ranks/build_rank_icons.mjs
//
// - NUNCA modifica los originales: lee `img vida toal/RANGOS/*.png` y escribe SOLO en `public/ranks/`
//   (WebP con transparencia en 2 tamaños + `manifest.json`, que es lo que lee la app).
// - Convención de nombres: "<RANGO> <I|II|III>.png" ("COBRE II.png"); sin nivel para rangos sin niveles
//   ("SIMETRICO.png"). Se ignoran tildes y mayúsculas. Los rangos válidos salen de `rank-config.ts`.
// - Algunos PNG traen el "fondo transparente" dibujado (cuadriculado blanco/gris) en vez de transparencia
//   real. Si la imagen no tiene alfa, se intenta quitar ese fondo con un relleno desde los bordes; si el
//   resultado no es confiable (bordes con halo, o el relleno se metió al ícono) NO se publica y queda en
//   `rejected` del manifest: la app usa entonces el ícono genérico teñido para ese nivel.
// - Si falta la imagen de un rango/nivel, no hace falta tocar código: la app usa el genérico hasta que exista.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("img vida toal", "RANGOS");
const OUT = path.resolve("public", "ranks");
const SIZES = [128, 384];
const ROMAN = { I: 1, II: 2, III: 3 };
const ASYM_MAX = 0.03; // diferencia máxima de silueta izquierda/derecha permitida

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// Rangos válidos y cuáles tienen niveles, leídos de rank-config.ts (única fuente de verdad).
const cfg = fs.readFileSync(path.resolve("src", "lib", "gym", "rank-config.ts"), "utf8");
const tiers = [...cfg.matchAll(/key: "(\w+)".*?levels: (true|false), iconName: "(\w+)"/g)].map((m) => ({
  key: m[1],
  levels: m[2] === "true",
  iconName: m[3],
}));
if (tiers.length === 0) throw new Error("No se pudieron leer los rangos de rank-config.ts");

/** ¿Tiene transparencia real? (esquinas con alfa < 250) */
function hasRealAlpha(data, w, h) {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  return corners.some((p) => data[p * 4 + 3] < 250);
}

/** Quita el cuadriculado de fondo con relleno desde los bordes. Devuelve null si no es confiable. */
function removeCheckerboard(data, w, h) {
  const N = w * h;
  const candidate = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const lum = (r + g + b) / 3;
    // gris/blanco neutro y claro: los dos tonos del cuadriculado (varían de 232 a 255 según la zona)
    if (Math.abs(r - g) < 7 && Math.abs(g - b) < 7 && lum >= 205) candidate[p] = 1;
  }
  const bg = new Uint8Array(N);
  const stack = [];
  const push = (p) => {
    if (candidate[p] && !bg[p]) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < N - w) push(p + w);
  }
  let bgCount = 0;
  for (let p = 0; p < N; p++) bgCount += bg[p];
  const frac = bgCount / N;
  // El fondo de estos íconos ocupa aprox. entre 35 % y 80 % de la imagen.
  if (frac < 0.3 || frac > 0.85) return { ok: false, reason: `fondo detectado ${(frac * 100).toFixed(0)} % (fuera de rango)` };

  // Agranda el fondo 2 px hacia el ícono para comerse el borde mezclado con el blanco del cuadriculado.
  let cur = bg;
  for (let it = 0; it < 2; it++) {
    const nxt = Uint8Array.from(cur);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (!cur[p] && (cur[p - 1] || cur[p + 1] || cur[p - w] || cur[p + w])) nxt[p] = 1;
      }
    }
    cur = nxt;
  }

  // Calidad del borde: entre los píxeles de ícono que tocan el fondo, ¿cuántos siguen siendo "casi blancos"?
  let edge = 0, bright = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (cur[p]) continue;
      if (cur[p - 1] || cur[p + 1] || cur[p - w] || cur[p + w]) {
        edge++;
        const lum = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
        if (lum > 215) bright++;
      }
    }
  }
  const haloRatio = edge ? bright / edge : 1;
  if (haloRatio > 0.22) return { ok: false, reason: `borde con halo claro (${(haloRatio * 100).toFixed(0)} %)` };

  // Simetría: estos íconos son simétricos de izquierda a derecha. Si la silueta que quedó NO lo es, el relleno
  // se comió una parte del ícono (p. ej. un brillo blanco de un ala conectado con el fondo) y no se publica.
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cur[y * w + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cx = (minX + maxX) / 2;
  let solid = 0, mismatch = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const mx = Math.round(2 * cx - x);
      const here = !cur[y * w + x];
      const there = mx >= 0 && mx < w ? !cur[y * w + mx] : false;
      if (here) solid++;
      if (here !== there) mismatch++;
    }
  }
  const asym = solid ? mismatch / solid : 1;
  console.log("   simetría de la silueta:", (asym * 100).toFixed(2), "% de diferencia");
  if (asym > ASYM_MAX) return { ok: false, reason: `silueta asimétrica (${(asym * 100).toFixed(1)} %): el fondo se comió parte del ícono` };

  // Alfa suave: 1 px de transición para que el borde no quede dentado.
  const alpha = new Uint8Array(N).fill(255);
  for (let p = 0; p < N; p++) if (cur[p]) alpha[p] = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alpha[p] === 255 && (cur[p - 1] || cur[p + 1] || cur[p - w] || cur[p + w])) alpha[p] = 150;
    }
  }
  const out = Buffer.from(data);
  for (let p = 0; p < N; p++) {
    out[p * 4 + 3] = alpha[p];
    if (alpha[p] === 0) {
      out[p * 4] = 0;
      out[p * 4 + 1] = 0;
      out[p * 4 + 2] = 0;
    }
  }
  return { ok: true, data: out, frac, haloRatio };
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".webp")) fs.unlinkSync(path.join(OUT, f));

const manifest = { generatedAt: new Date().toISOString(), sizes: SIZES, icons: {}, rejected: [], unknownFiles: [], missing: [] };

for (const file of fs.readdirSync(SRC).sort()) {
  if (!/\.png$/i.test(file)) continue;
  const base = norm(file.replace(/\.png$/i, ""));
  const m = base.match(/^([A-Z]+)(?:\s+(I{1,3}))?$/);
  const tier = m && tiers.find((t) => norm(t.iconName) === m[1]);
  if (!tier || (tier.levels && !m[2]) || (!tier.levels && m[2])) {
    manifest.unknownFiles.push(file);
    continue;
  }
  const level = tier.levels ? ROMAN[m[2]] : 0;
  const id = `${tier.key}-${level}`;

  const { data, info } = await sharp(path.join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let rgba = data;
  let source = "alfa";
  if (!hasRealAlpha(data, info.width, info.height)) {
    const res = removeCheckerboard(data, info.width, info.height);
    if (!res.ok) {
      manifest.rejected.push({ file, id, reason: res.reason });
      console.log("RECHAZADO", file, "-", res.reason);
      continue;
    }
    rgba = res.data;
    source = "limpiado";
  }
  const img = () => sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 });
  // Recorta el espacio vacío y deja el ícono centrado en un cuadrado.
  const trimmed = await img().png().toBuffer({ resolveWithObject: true });
  const side = Math.max(trimmed.info.width, trimmed.info.height);
  for (const size of SIZES) {
    await sharp(trimmed.data)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88, alphaQuality: 95 })
      .toFile(path.join(OUT, `${tier.key}-${level}-${size}.webp`));
  }
  manifest.icons[id] = { source, from: file, aspect: +(trimmed.info.width / trimmed.info.height).toFixed(3), side };
  console.log("ok       ", file, "->", id, `(${source})`);
}

// Qué rangos/niveles todavía no tienen imagen (la app usa el genérico teñido).
for (const t of tiers) {
  const levels = t.levels ? [1, 2, 3] : [0];
  for (const l of levels) if (!manifest.icons[`${t.key}-${l}`]) manifest.missing.push(`${t.key}-${l}`);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${Object.keys(manifest.icons).length} íconos, ${manifest.rejected.length} rechazados, ${manifest.missing.length} sin imagen (genérico).`);
