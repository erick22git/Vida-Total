# Reporte de corrección y ampliación nutricional

Este reporte cubre el Bloque 8 (auditoría crudo/cocido) y el Bloque 9 (ampliación de la base) sobre `src/lib/data/foods.json` y el nuevo `src/lib/data/foods-regional.json`. **Ningún cambio de datos fue subido a git todavía** — este archivo es la revisión previa a esa subida, como venimos haciendo.

## Estado actual de la base

- Alimentos totales en `foods.json`: **123** (106 originales + 17 nuevos de USDA)
- Alimentos en `foods-regional.json` (nuevo archivo): **1** (Pan Marraqueta)
- `verificado: true`: **108**
- `verificado: false` (pendiente de revisión manual, sin fuente confiable encontrada): **15**

---

## Bloque 8 — Correcciones de consistencia crudo/cocido

Ya subido en el commit `2ebaab4` (código) y reflejado aquí en los datos:

| Alimento | Problema encontrado | Corrección |
|---|---|---|
| Lomo de cerdo | Coincidía con corte de cerdo **crudo** | Ahora usa fdcId 167842 (cocido/asado) |
| Empanada de carne | Coincidía con "Beans, baked, canned, with beef" (no relacionado) | Ahora usa fdcId 167660 ("Restaurant, Latino, empanadas, beef, prepared") |
| Pan blanco | Coincidía con harina **cruda**, no pan horneado | Ahora usa fdcId 174924 (pan horneado) |
| Arroz blanco cocido | Coincidía con variedad de arroz **glutinoso/pegajoso** | Ahora usa fdcId 169753 (arroz blanco común de grano largo, cocido) |
| Champiñones | Coincidía con shiitake, no el champiñón blanco común | Ahora usa fdcId 168537 (champiñón blanco/button) |
| Manzana | Sin coincidencia genérica sin variedad en USDA | Se documentó: se usa "apples fuji with skin raw" como aproximación (~10% de margen de error), no hay entrada genérica en USDA |

---

## Bloque 9 — Ampliación de la base

### 1. USDA FoodData Central — 17 alimentos nuevos agregados

Todos con `verificado: true`, `configurado: true`, y perfil completo de micronutrientes cuando USDA lo reportaba.

**Proteínas / carnes / huevos:**
- Muslo de pollo asado (179 kcal/100g, fdcId 172388)
- Bife de lomo (sirloin) a la parrilla (238 kcal/100g, fdcId 174704)
- Pierna de cordero horneada (180 kcal/100g, fdcId 172487)
- Pavo molido cocido (203 kcal/100g, fdcId 171506)
- Huevo revuelto (149 kcal/100g, fdcId 172187)
- Huevo frito (196 kcal/100g, fdcId 173423)
- Huevo duro/sancochado (155 kcal/100g, fdcId 173424)

**Lácteos:**
- Queso mozzarella (299 kcal/100g, fdcId 170845)
- Queso parmesano rallado (420 kcal/100g, fdcId 171247)

**Legumbres:**
- Frijoles rojos (kidney) cocidos (127 kcal/100g, fdcId 175242)

**Frutas:**
- Uvas verdes (80.1 kcal/100g, fdcId 2346413)
- Sandía (30 kcal/100g, fdcId 167765)
- Mango (60 kcal/100g, fdcId 169910)
- Piña (60.1 kcal/100g, fdcId 2346398)
- Pera (57 kcal/100g, fdcId 169118)

**Verduras:**
- Vainitas/judías verdes cocidas (35 kcal/100g, fdcId 169321)
- Coliflor cocida (23 kcal/100g, fdcId 168520)

### 2. FatSecret Platform API

**No se hizo.** Según tu propia instrucción, se omitió por completo esta integración. Queda pendiente de tu parte si en algún momento quieres aplicar al plan "Premier" (necesario para datos regionales de Bolivia/Perú — el plan gratuito "Basic" solo cubre EE.UU.).

### 3. Platos regionales (Bolivia/Perú)

**Nuevo archivo `src/lib/data/foods-regional.json`:**
- **Pan Marraqueta**: 272 kcal, 54.85g carbos, 6.03g proteína, 0.77g grasa por 100g — dato exacto que tú proporcionaste, fuente: FatSecret, ficha pública "Marraqueta".

**Platos ya existentes en `foods.json`, actualizados con fuente verificada** (antes `verificado: false`, estimados sin fuente citada):

| Alimento | Antes (estimado) | Ahora (por 100g) | Fuente |
|---|---|---|---|
| Lomo saltado | 520 kcal / plato de 350g (sin fuente) | 147 kcal, 5.1g prot, 19.3g carbos, 5.4g grasa, 0.7g fibra | INS Perú, Tablas Peruanas de Composición de Alimentos (tablasperuanas.ins.gob.pe/node/2506) — "lomo saltado con arroz" |
| Ceviche de pescado | 220 kcal / plato de 250g (sin fuente) | 62 kcal, 10.3g prot, 3.6g carbos, 0.8g grasa | FatSecret México, cruzado con fuente secundaria independiente |
| Anticuchos de corazón | 280 kcal / 4 palitos (sin fuente) | 147 kcal, 18.7g prot, 2g carbos, 6.7g grasa, 0.3g fibra, 0.7g azúcar | NutriScan, ficha pública "Anticuchos" |
| Causa rellena de pollo | 340 kcal / 200g (sin fuente) | 169 kcal, 6.2g prot, 13.8g carbos, 10g grasa | FatSecret Chile, cruzado con dato derivado de MINSA Perú |
| Papa a la huancaína | 380 kcal / 250g (sin fuente) | 121 kcal, 3.7g prot, 17.8g carbos, 4.1g grasa, 1.3g fibra | INS Perú, Tablas Peruanas de Composición de Alimentos (tablasperuanas.ins.gob.pe/node/2057) |

**Nota importante:** salvo los dos casos de INS Perú (fuente oficial), el resto de estos platos usa fuentes secundarias (FatSecret, NutriScan) — son razonablemente confiables pero **no son la tabla oficial peruana**, por eso se documenta la fuente exacta en cada entrada (campo `fuente`) para que quede trazable.

**Platos que siguen `verificado: false` / estimados** (no se encontró fuente confiable, se dejaron sin tocar en vez de inventar valores): merluza, barra-proteina, proteina-whey, ensalada-cesar, tallarines-verdes, cafe-leche, pan-con-palta, pan-con-huevo, quinua-ensalada, wrap-pollo, tamal, choclo-con-queso, jugo-naranja, aceitunas (14 en total; "arroz-con-pollo" ya estaba verificado desde antes).

### 4. Resumen de fuentes por grupo

| Grupo | Cantidad | Fuente |
|---|---|---|
| Alimentos nuevos (carnes, lácteos, legumbres, frutas, verduras, huevos) | 17 | USDA FoodData Central (Foundation/SR Legacy) |
| Plato regional nuevo | 1 | Dato exacto proporcionado por ti (fuente: FatSecret) |
| Platos regionales existentes, re-verificados | 5 | INS Perú (2) + FatSecret/NutriScan (3) |
| FatSecret Platform API (integración) | — | No se hizo (tu instrucción explícita) |

---

## Qué falta de tu parte

- Revisar esta tabla y **confirmarme si apruebas subir estos cambios a `foods.json` y `foods-regional.json`** a git.
- Si en algún momento quieres cobertura regional más amplia vía API, aplicar tú mismo al plan FatSecret "Premier" (requiere formulario propio, no lo puedo hacer yo).
