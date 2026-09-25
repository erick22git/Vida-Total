# Figuras de Hábitos (colección de 5)

Cinco figuras progresivas, 7 etapas cada una (una por repetición). Arquitectura genérica:
`scene-progression` → `scene-registry` → `Scene` → etapas → completado (`totalStages` no está fijado en el código).

| # | Figura | Etapas | Tris | Draw calls | GLB (meshopt) |
|---|--------|--------|------|-----------|---------------|
| 1 | Bosque | Terreno, Agua, Rocas, Pasto, Primeros árboles, Más árboles y detalles, Escena completa | 125 644 | ~124 | 1.92 MB |
| 2 | Castillo | Base, Muros, Torres, Estructura, Detalles, Vegetación, Castillo completo | 56 262 | 70 | 1.59 MB |
| 3 | Casa | Base, Estructura, Paredes, Techo, Ventanas y puertas, Detalles, Casa completa | 10 387 | 69 | 0.28 MB |
| 4 | Molino | Base, Cimientos, Cuerpo, Techo, Aspas, Detalles, Molino completo | 3 718 | 41 | 0.17 MB |
| 5 | Cuarto | Base, Paredes, Piso, Muebles, Decoración, Iluminación, Cuarto completo | 102 132 | 118 | 1.73 MB |

Medido en escritorio (GTX 750 Ti). **No** medido en teléfono real → `mobileReady: false`.

## Reglas
- Tres progresos separados: hábito (n/60, `computeHabitLevel`), figura (día n/7) y colección (x/5).
- La figura *i* empieza donde termina la *i−1*; se desbloquea al completar la anterior; la actual es la primera desbloqueada sin completar (`src/lib/3d/scene-collection.ts`, probado con `tools/3d/verify/collection_test.ts`).
- Eventos: `scene.stage.changed` (desde `completeHabit`), `scene.completed` y `scene.unlocked` (desde `FigureView` en el momento visual → sonido y háptica por `use-habit-feedback`).

## UI (`figure-view.tsx`, `figure-shelf.tsx`)
Fila de 5 iconos (bloqueadas: toque = sacudida, sin cambiar de escena), contador n/60 + barra fina, 7 puntos de día, título con nombre de figura y etapa.
Panel de depuración (real, F1–F5, días 0–7, celebración, stats) solo con `NODE_ENV !== "production"`.

## Interacción 3D (`progressive-scene.ts`)
Arrastre = rotación con inercia (yaw ±2.6, pitch −0.16..0.3), pellizco/rueda = zoom 0.8–1.6, toque = pulso, retorno lento a la vista inicial tras 2.2 s. Sin autorrotación. `touch-action: none` y `stopPropagation` para no disparar el swipe de la página.

## Celebración día 7
Check → sonido → háptica → última pieza → pausa → confeti/brillo/rebote → “FIGURA COMPLETADA” → “SIGUIENTE DESBLOQUEADA” → vuelta a CHECK.

## Licencias
Los cinco originales: `license: UNVERIFIED`, `source: UNVERIFIED`, `publishable: false`. Los GLB están en `public/models/` (ignorado por git), así que en Vercel se ve el cristal SVG de reserva. Cambiar color/material no los hace propios. Plan: sustituir por assets propios/CC0/comerciales/creados para Vida Total.

## Pendiente
FPS/memoria en teléfono real; densidad adaptable en gama baja; ciclo 2 (tras completar las 5) sin definir; Cuarto sin texturas (colores planos); carga Draco sin verificar; hint visual de arrastre.

## Reproducir
`tools/3d/blender/10–13_*_7day.py` (construcción) → `20–23_export_*.py` (GLB) → `tools/3d/verify/glb_report.mjs`. Ver `tools/3d/README.md`.
