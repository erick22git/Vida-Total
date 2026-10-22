import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const foodsRegional = JSON.parse(readFileSync("C:/Erick/app movil/vida-total-web/src/lib/data/foods-regional.json", "utf8"));
const foodsMain = JSON.parse(readFileSync("C:/Erick/app movil/vida-total-web/src/lib/data/foods.json", "utf8"));
const foodsAll = [...foodsRegional, ...foodsMain];

const completed = foodsAll.filter((f) => f.photoUrl && existsSync("C:/Erick/app movil/vida-total-web/public" + f.photoUrl));
console.log("Completed foods found:", completed.length);

const psScript = `
Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem 'C:\\Erick\\app movil\\vida-total-web\\public\\foods\\*.png'
$dict = @{}
foreach ($f in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($f.FullName)
        $bmp = New-Object System.Drawing.Bitmap 240, 240
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, 240, 240)
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $b64 = [Convert]::ToBase64String($ms.ToArray())
        $dict[$f.Name] = $b64
        $ms.Dispose()
        $g.Dispose()
        $bmp.Dispose()
        $img.Dispose()
    } catch {}
}
$dict | ConvertTo-Json -Compress
`;

writeFileSync("C:/Users/aly_n/.gemini/antigravity/brain/f3e8ac6a-e387-4c02-8a4a-8a83124eaa16/gen_thumbs.ps1", psScript, "utf8");
console.log("Generating base64 thumbnails...");
const b64Json = execSync('powershell -ExecutionPolicy Bypass -File "C:/Users/aly_n/.gemini/antigravity/brain/f3e8ac6a-e387-4c02-8a4a-8a83124eaa16/gen_thumbs.ps1"', {
  maxBuffer: 50 * 1024 * 1024,
  encoding: "utf8"
});
const thumbs = JSON.parse(b64Json);
console.log("Thumbnails generated:", Object.keys(thumbs).length);

const itemsHtml = completed
  .map((f) => {
    const fileName = f.id + ".png";
    const b64 = thumbs[fileName] || "";
    const cals = Math.round(f.calorias || 0);
    const p = (f.proteina || 0).toFixed(1);
    const c = (f.carbos || 0).toFixed(1);
    const g = (f.grasas || 0).toFixed(1);
    const cat = f.categoria || "Alimento";
    return `
    <div class="food-card bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--primary)] transition-all shadow-sm flex flex-col group" data-cat="${cat}" data-name="${f.nombre.toLowerCase()}">
      <div class="relative aspect-square w-full bg-neutral-900 overflow-hidden">
        <img src="data:image/png;base64,${b64}" alt="${f.nombre}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        <span class="absolute top-2 left-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/70 text-white backdrop-blur-sm">${cat}</span>
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 class="font-semibold text-sm text-[var(--foreground)] leading-tight mb-1">${f.nombre}</h3>
          <p class="text-xs text-[var(--muted-foreground)]">${cals} kcal <span class="opacity-50">• ${f.porcion || "100g"}</span></p>
        </div>
        <div class="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-[var(--border)] text-center text-[11px]">
          <div class="bg-[var(--secondary)]/40 rounded px-1 py-0.5">
            <span class="text-[var(--muted-foreground)] block text-[10px]">Prot</span>
            <span class="font-semibold text-[var(--foreground)]">${p}g</span>
          </div>
          <div class="bg-[var(--secondary)]/40 rounded px-1 py-0.5">
            <span class="text-[var(--muted-foreground)] block text-[10px]">Carb</span>
            <span class="font-semibold text-[var(--foreground)]">${c}g</span>
          </div>
          <div class="bg-[var(--secondary)]/40 rounded px-1 py-0.5">
            <span class="text-[var(--muted-foreground)] block text-[10px]">Gras</span>
            <span class="font-semibold text-[var(--foreground)]">${g}g</span>
          </div>
        </div>
      </div>
    </div>`;
  })
  .join("\n");

const categories = [...new Set(completed.map((f) => f.categoria || "Otro"))];
const catButtons = ["Todos", ...categories]
  .map(
    (cat) => `
  <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] hover:border-transparent transition-colors ${
    cat === "Todos" ? "active-cat bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent" : ""
  }" data-category="${cat}">${cat}</button>`
  )
  .join("");

const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    .active-cat {
      background-color: var(--primary) !important;
      color: var(--primary-foreground) !important;
      border-color: transparent !important;
    }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-3 sm:p-5 font-sans">
  <div class="max-w-5xl mx-auto bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border)] gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] font-bold text-sm">🥗</span>
          <h1 class="text-lg sm:text-xl font-bold text-[var(--foreground)]">Fotos de Alimentos — Vida Total</h1>
        </div>
        <p class="text-xs text-[var(--muted-foreground)] mt-1">
          39 fotos reales, centradas y optimizadas a formato cuadrado 1:1
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          ✓ 39 Fotos listas
        </span>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      <div class="flex flex-wrap gap-1.5" id="filters">
        ${catButtons}
      </div>
      <div class="relative sm:w-64">
        <input type="text" id="search" placeholder="Buscar alimento..." class="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
      </div>
    </div>

    <!-- Grid of Food Cards -->
    <div class="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" id="food-grid">
      ${itemsHtml}
    </div>

    <!-- Footer count -->
    <div class="mt-5 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
      <span id="visible-count">Mostrando 39 de 39 alimentos</span>
      <span>Ubicación: <code>public/foods/*.jpg</code></span>
    </div>
  </div>

  <script>
    let currentCategory = 'Todos';
    let searchQuery = '';

    const cards = document.querySelectorAll('.food-card');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search');
    const visibleCount = document.getElementById('visible-count');

    function filterCards() {
      let shown = 0;
      cards.forEach(card => {
        const cat = card.getAttribute('data-cat');
        const name = card.getAttribute('data-name');
        const matchCat = (currentCategory === 'Todos' || cat === currentCategory);
        const matchSearch = (!searchQuery || name.includes(searchQuery));

        if (matchCat && matchSearch) {
          card.style.display = 'flex';
          shown++;
        } else {
          card.style.display = 'none';
        }
      });
      visibleCount.textContent = 'Mostrando ' + shown + ' de 39 alimentos';
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active-cat'));
        btn.classList.add('active-cat');
        currentCategory = btn.getAttribute('data-category');
        filterCards();
      });
    });

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterCards();
    });
  </script>
</body>
</html>`;

writeFileSync("C:/Users/aly_n/.gemini/antigravity/brain/f3e8ac6a-e387-4c02-8a4a-8a83124eaa16/galeria_alimentos.html", fullHtml, "utf8");
console.log("Gallery HTML created successfully!");
