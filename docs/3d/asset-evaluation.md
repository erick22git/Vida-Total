# Evaluación de los 5 paisajes de la biblioteca

Origen: `biblioteca de assets/HÁBITOS/Paisajes completos/` (130 MB). Los originales **no se modificaron** (sha256 verificado al final de la fase). Los datos salen de abrir cada `.blend` en Blender 5.2 con el MCP y de renderizar cada uno con su cámara (`_trabajo/previews_originales/`).

## Tabla

| Asset | Formato / guardado con | Polígonos | Materiales | Modularidad | Separar piezas | Potencial de animación | Potencial GLB | Potencial móvil | Licencia | Problemas encontrados |
|---|---|---|---|---|---|---|---|---|---|---|
| **Bosque** | `.blend` (Blender 3.3), Cycles, 23 MB | 6 745 (4 615 en mallas únicas); 192 mallas, 71 datos de malla | 16, **procedurales** (ObjectInfo → ColorRamp); 1 HDRI 4K (solo mundo) | **Muy alta**: colecciones por elemento (Pine1-3, Grass, Rocks, Branches, Mushroom, Scene) y 19 árboles = tronco + 5 copas | **Fácil** (ya vienen separadas) | **Muy alto**: piezas pequeñas y variadas para montar | Alto (sin texturas) | **Alto** tras reducir partículas | **NO VERIFICADA** | Pasto, rocas y ramas son 3 sistemas de partículas (7 500 + 1 000 + 1 000 instancias: millones de triángulos si se dejan); materiales procedurales no viajan a GLB; niebla volumétrica y fondo no exportables |
| **castillo abandonado** | `.blend` (Blender 2.92), EEVEE, 8.5 MB | 28 337 (16 389 en un solo `Cube`); **2.3 M evaluados** por un modificador Wireframe | 37, procedurales (sin texturas) | Media: castillo en 6 objetos + rocas + malezas | Media: el castillo es 1–2 mallas grandes; requiere cortar a mano | Medio | Medio (hay que hornear materiales) | Bajo–medio (2.3 M evaluados) | **NO VERIFICADA** | Escena nocturna con 7 luces (emisión); tamaño 165 × 165 m; auto-smooth como Geometry Nodes |
| **casa** | `.blend` (Blender 2.74), EEVEE, 5.9 MB | 5 863 (225 k evaluados por un modificador Ocean) | 13; 9 imágenes, 8 empaquetadas, **77 MB de RAM** (normal 3392²) | Media–alta (paredes, puertas, ventanas, barandas) | Fácil | Ya tiene 10 acciones (puertas) | Medio | Medio (texturas grandes) | **NO VERIFICADA** | **No es un paisaje**: casa moderna sin terreno; en el render salió blanca/plana (materiales que no sobreviven al motor actual); ya trae animación de puertas |
| **cuarto** | `.blend` (Blender 3.0), Cycles, **86.7 MB** | **100 450** (70 050 en un `Text`); 437 k evaluados | 38, 26 imágenes empaquetadas, **307 MB de RAM** | Alta (186 mallas: sofás, TV, escritorio…) | Fácil | Alto (mucho mobiliario) | Bajo sin optimizar | **Bajo** (307 MB de texturas, 29 Subsurf, 14 Bevel) | **NO VERIFICADA** | **No es un paisaje** (interior); el más bonito de los cinco, pero pesa 10× el presupuesto; imagen de 5755 × 1079 |
| **molino** | `.blend` (Blender 2.67), EEVEE, 11 MB | 1 394 en **2 mallas** (cuerpo + aspas) | 2; 5 imágenes 2048² (**84 MB de RAM**) | Baja: dos piezas | Difícil: hay que cortar el cuerpo a mano | Bajo–medio (aspas con armadura) | Medio | Medio | **NO VERIFICADA** | Un solo objeto monolítico; se ve gris (texturas no enlazadas); sin entorno |

## Elegido para la prueba de concepto: **Bosque**

Motivos (no solo estéticos):
1. **Es realmente un paisaje** y ya viene descompuesto: 19 árboles con jerarquía, rocas, hongos, río, pasto y ramitas en colecciones.
2. **El más ligero de los que sí son paisaje**: ~6.7 k polígonos base y ningún archivo de textura (solo el HDRI del mundo, que no viaja). El castillo evalúa 2.3 M triángulos y el cuarto/casa/molino arrastran 77–307 MB de texturas.
3. **Progresión natural**: terreno → agua → rocas → pasto → tres tandas de pinos → detalles → ambiente.
4. **Riesgos conocidos y resueltos en el prototipo**: partículas → instancias reales con conteo reducido; materiales procedurales → variantes planas; niebla y fondo fuera del export.

Descartados **por ahora** (no borrados, no inutilizables):
- `castillo abandonado`: buen segundo candidato, pero pide bajar el Wireframe (2.3 M) y hornear 37 materiales procedurales.
- `cuarto`: la pieza más "premium", útil más adelante para un módulo de interiores/Gym; hoy requiere un pase fuerte de optimización (texto de 70 k polígonos, texturas de 2K–5K).
- `casa` y `molino`: no son paisajes; sirven como *estructuras* dentro de otro paisaje (p. ej. el molino sobre el terreno del bosque) tras separarlos en piezas.

## Criterio visual — franqueza

Se pidió "realista, premium, cinematográfico, no low-poly infantil por defecto". El Bosque es **estilizado de baja poligonalización** (diorama isométrico), coherente con la referencia de progreso visual pero **no fotorrealista**. Lo que sí se logró: iluminación limpia, paleta contenida, montajes con peso (squash & settle) y cero fades. Si se quiere un acabado más realista hay dos caminos: subir el detalle de materiales/luz del mismo asset (bake de sombras/AO, texturas 2K) o construir otro paisaje con assets de Poly Haven (CC0). **Decisión de estilo pendiente del usuario.**

## Licencias

Ninguno de los cinco trae origen ni licencia registrados. Hasta tenerlos, todos quedan `license: "UNVERIFIED"` y **no deben publicarse**. Para cada uno se necesita: `source` (URL), `author`, `license`, y la evidencia (captura de la página de descarga). Los assets de Poly Haven son CC0; los de Sketchfab/BlenderKit dependen de cada modelo.
