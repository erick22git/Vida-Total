# Rendimiento 3D (mobile-first)

La app es móvil primero. Ningún asset entra al registro como `mobileReady` sin pasar estas puertas. Las cifras del prototipo son **medidas** (Blender 5.2 + `GLTFLoader` de three.js en Node); lo que necesita GPU real (FPS, memoria, calor) **no está medido** y se prueba en teléfono.

## 1. Presupuesto propuesto (por escena)

| Recurso | Gama media | Gama baja | Cómo se comprueba |
|---|---|---|---|
| Triángulos visibles | ≤ 150 k | ≤ 60 k | `stage_tris.mjs` |
| Draw calls | ≤ 150 | ≤ 80 | `mesh_use.mjs` (estimación) + DevTools en teléfono |
| Materiales | ≤ 32 | ≤ 16 | `inspect_glb.mjs` |
| Texturas | ≤ 2048 px de lado, ≤ 32 MB en GPU en total | ≤ 1024 px, ≤ 12 MB | `inspect_glb.mjs` / análisis del `.blend` |
| Transferencia (GLB) | ≤ 3 MB | ≤ 3 MB | tamaño del archivo con Meshopt |
| Clips de animación | ≤ 100 KB cada uno, 0.5–1.5 s (hito ≤ 2 s) | igual | `inspect_glb.mjs` |

Son propuestas de partida, no límites medidos en dispositivos: se ajustan tras la prueba en teléfono.

## 2. Los 5 originales frente al presupuesto

| Asset | Polígonos base | Triángulos evaluados | Texturas (RAM aprox.) | Materiales | Veredicto |
|---|---|---|---|---|---|
| Bosque | 6 745 | 18 720 (viewport, **sin** partículas) → millones con las 9 500 instancias de partículas | 1 HDRI 4K (34 MB, no viaja) | 16 procedurales | viable tras convertir partículas |
| castillo abandonado | 28 337 | **2 345 810** | 0 (procedural) | 37 | pesado: bajar Wireframe y hornear |
| casa | 5 863 | 224 961 (modificador Ocean) | 77 MB | 13 | quitar Ocean, texturas a 2K |
| cuarto | 100 450 | 436 969 | **307 MB** | 38 | 10× sobre presupuesto |
| molino | 1 394 | 2 722 | 84 MB | 2 | ligero de geometría, pesado de texturas |

## 3. Prototipo `landscape_bosque_001` (medido)

| Métrica | Valor |
|---|---|
| Nodos / mallas / materiales | 1 535 / 418 (27 reutilizadas) / 24 |
| Triángulos únicos | 37 971 |
| **Triángulos renderizados** (todas las instancias) | **125 684** (partió de ~207 k; el pasto era el 83 %) |
| Texturas | 0 |
| GLB crudo / **Meshopt** / Draco | 3.30 MB / **2.02 MB** / 1.35 MB |
| Tamaño de escena | 6 × 2.93 × 6 m, Y arriba |
| Clips | 7 (`STAGE_1…8`, sin el 3), 0.8–1.83 s |
| Draw calls **sin optimizar** | 1 535 (un nodo = una malla) |
| Draw calls **instanciando por malla** | 418 (391 son mallas únicas) |

Triángulos por etapa: E0 384 · E1 44 · E2 832 · **E3 45 102 (pasto)** · E4 4 004 · E5 3 432 · E6 3 432 · **E7 68 134 (pasto, ramitas, guijarros)** · E8 320.
Los 19 árboles suman solo ~11 k; el problema es el **pasto** (1 200 matas) y el **número de nodos**, no los árboles.

### Conclusión honesta
- Triángulos: **dentro** del presupuesto de gama media (126 k ≤ 150 k), **fuera** del de gama baja (60 k).
- Draw calls: **muy por encima** (1 535 vs ≤ 150). Por eso el prototipo está marcado `mobileReady: false`.
- Transferencia: **dentro** (2.02 MB).

## 4. Qué se aplicó y qué falta

Aplicado en el pipeline:
- **Decimación** del pasto (ratio 0.14) y conteo reducido de instancias (7 500 → 1 200 matas; 1 000 → 120 guijarros; 1 000 → 60 ramitas). Bajó de 207 k a 126 k triángulos sin cambio visible en el render.
- **Materiales planos** (0 texturas) → sin coste de memoria de textura.
- **Sin luces, cámaras ni niebla** en el GLB.
- **Compresión**: Meshopt (recomendada: la trae `drei/useGLTF` sin descargar decodificador) y Draco (el más chico, pero necesita su decodificador WASM; **no** se verificó su carga en Node).
- **Animación**: el detalle repetitivo no lleva clip (pasar de 4.5 MB / 11 min de exportación a 3.3 MB / 35 s).

Falta (en este orden de impacto):
1. **Instanciar en runtime** (`InstancedMesh`) las mallas compartidas: 1 535 → ≤ 418 draw calls.
2. **Deduplicar copas y rocas**: los 19 árboles tienen 95 copas con malla propia aunque solo hay 3 variedades de pino; si las copas de una misma variedad comparten malla (3 variedades × 5 capas ≈ 15) los draw calls bajan a **≈ 120**. Requiere modelarlas como *linked duplicates* antes de aplicar Solidify (a verificar: hoy las copas difieren en escala/forma).
3. **Densidad adaptable**: el runtime muestra solo el primer N % del pasto según el dispositivo (gama baja ≈ 50 % → ~80 k triángulos).
4. **Culling por etapa**: las etapas futuras no se renderizan (`visible = false`), así que la escena real en curso siempre pesa menos que el total.
5. **LOD** para los pinos lejanos (no necesario con la cámara fija actual).
6. **Texturas** (cuando un asset las traiga): atlas por familia, 2K, WebP/KTX2.
7. **Medir en teléfono**: FPS, memoria y tiempo de carga.

## 5. Reglas para futuros assets

- Antes de exportar: contar `polys`, `materiales`, `texturas` con `analyze_blend.py` y aplicar el presupuesto de la sección 1.
- Nunca dejar partículas ni Geometry Nodes sin aplicar en lo que se exporta.
- Preferir muchas piezas pequeñas **que compartan malla** a pocas piezas grandes únicas.
- Un asset con texturas > 2K o > 32 MB de RAM se optimiza **antes** de entrar al pipeline de etapas.
