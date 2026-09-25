# Bosque de 7 días — primera escena real

Cada hábito dura una semana: la figura 3D tiene **7 etapas principales, una por día**. Este documento describe cómo está construida, cómo se conecta con el completado del hábito y cómo probarla.

## 1. Las 7 etapas

| Día | Se construye | Cómo (animación) |
|---|---|---|
| 1 | Terreno + primera zona de pasto | la baldosa emerge girando y se asienta (clip); unas matas brotan |
| 2 | Agua (río y laguna) | sube y se expande (clip) |
| 3 | Rocas y guijarros | caen, golpean y se asientan (clip para las rocas; guijarros en runtime) |
| 4 | Pasto | brota en onda desde el centro (runtime, con rebote) |
| 5 | Primeros árboles (13) | el tronco crece y cada copa cae, gira y encaja de abajo hacia arriba (clip) |
| 6 | Árboles grandes (6) + hongos, ramitas, troncos caídos | árboles con clip; detalles en runtime |
| 7 | Escena completa: última vegetación + luciérnagas + celebración | clip de luciérnagas y pulso de la baldosa; partículas cálidas y pulso de la escena (runtime) |

Reglas de animación: 1.0–1.33 s por día (día 7: 1.83 s), ease in/out, overshoot, rebote, giro, caída y asentamiento. **Nunca** un fade de opacidad: lo que no está construido tiene escala 0 hasta su turno.

## 2. Figura aislada y fondo transparente

- El GLB **no lleva** cielo, fondo azul, plano de fondo, niebla, luces ni cámara (en Blender esas piezas están en `_NOT_EXPORTED` y no se renderizan).
- Comprobado en dos lugares:
  1. Renders de Blender en RGBA (`previews_7dias/day_0..7.png`): el día 0 es 100 % transparente y los días 1–7 tienen 72–78 % de píxeles con alpha 0, con alpha 0 en las cuatro esquinas. Hoja de comparación sobre fondo claro y oscuro: `sheet_light_dark.png`.
  2. En la app real (canvas WebGL con `alpha: true`, `setClearColor(0, 0)`, sin `scene.background`): la figura se ve directamente sobre el gris de Hábitos y, en la prueba aparte, sobre un fondo claro y otro oscuro.
- La luz la pone el runtime (hemisférica + sol cálido + relleno frío) y solo acompaña al objeto.

## 3. Dónde vive cada cosa

| Capa | Archivo | Qué hace |
|---|---|---|
| Progreso → etapa (puro) | `src/lib/3d/scene-progression.ts` | `createSceneConfig`, `stageFor`, `sceneStateFor`, `stageChange`. **No hay un 7 fijo**: `totalStages` sale de la configuración |
| Registro en runtime | `src/lib/3d/scene-registry.ts` | `FOREST_SCENE` (7 etapas, clips, cámara, licencia `UNVERIFIED`), `getSceneAsset()` |
| Reproductor | `src/lib/3d/progressive-scene.ts` | carga el GLB, instancia el detalle, reproduce clips, celebra |
| React | `src/components/3d/ProgressiveScene.tsx` | monta el reproductor; solo recibe `stage` |
| Vista FIGURA | `src/components/habitos/figure-view.tsx` | lee las repeticiones del hábito, pide la etapa y se la pasa a la escena; panel de depuración |
| Completado | `src/lib/habits/complete-habit.ts` | tras el completado emite `scene.stage.changed` / `scene.completed` |
| Feedback | `src/components/habitos/use-habit-feedback.ts` | `scene.completed` → sonido `level-up` + háptico de hito (los sistemas existentes) |
| Pantalla | `src/app/(dashboard)/habitos/habito/page.tsx` | secuencia de completado (abre la vista FIGURA y vuelve) |

## 4. Del completado a la figura (sin duplicar lógica)

```
HOLD 100 %  →  completeHabit(id)            (business action, ya existente)
             → store + Progress Engine       (racha, hitos, completedDates)  ← única fuente de verdad
             → habit.completed               (sonido + háptico existentes)
             → +250 ms: scene.stage.changed  { stageFrom, stageTo }   (solo si esa repetición desbloquea un día)
                        scene.completed      (si además completa la figura)
página de Hábitos:
             → +900 ms: abre la vista FIGURA mostrando la etapa ANTERIOR
             → +450 ms: FigureView pasa la etapa NUEVA a <ProgressiveScene stage=…/>
             → la escena construye la parte nueva (clip + runtime); día 7: pulso + partículas
             → +3.4 s: vuelve a la vista CHECK (se cancela si el usuario navega a mano)
```

- La escena **no calcula progreso**: recibe `stage`. El progreso (`completedDates.length`) lo cuenta el store; `stageChange()` (puro) decide si hubo día nuevo.
- Si la repetición completa la figura y a la vez alcanza una racha de 7, la celebración de la figura reemplaza a la de la racha (no se apilan).
- La figura no es un botón.
- Hábitos de cantidad/tiempo cuentan como un día cuando llegan a su meta.
- Mientras el hábito exista, `progreso = repeticiones acumuladas`; tras 7 la figura queda completa. Un ciclo nuevo (semana 2) requiere definir cuándo se reinicia el progreso: **pendiente de producto**.

## 5. Depuración de los 7 días

En la vista FIGURA aparece un panel `DEBUG 3D · DÍA` **solo** en desarrollo o con `?debug3d=1` en la URL (el parámetro se conserva al cambiar de hábito). Botones: `real`, `0…7` y `↻` (repetir la construcción de la etapa actual); muestra draw calls y triángulos reales. No modifica ningún dato del hábito. En producción normal no se ve.

## 6. Licencia y publicación (importante)

El Bosque es un asset **sin licencia ni origen verificados** (`UNVERIFIED`). Por eso:
- El GLB **no se sube al repositorio ni se publica**: `public/models/*.glb` está en `.gitignore`.
- Sin el archivo (p. ej. en Vercel), `ProgressiveScene` cae al cristal SVG de antes y la app sigue funcionando.
- Para probarlo en el teléfono hay que servir la app desde tu equipo (`npm run dev` en la misma red) o decidir conscientemente publicar el GLB (quitando esa línea del `.gitignore`), asumiendo el riesgo de licencia.

## 7. Cómo se regenera

```
01_prepare_landscape.py  →  02_build_7_day_stages.py  →  03_export_forest_glb.py
```
(ver `tools/3d/README.md`). El GLB se copia a `public/models/forest_progression_001_meshopt.glb`.

## 8. Verificación realizada

| Comprobación | Resultado |
|---|---|
| `npm run lint` / `npm run build` | sin errores |
| GLB con `GLTFLoader` (Node) | carga crudo y con Meshopt; 6 clips, todos desde t = 0 |
| Escena en Chromium con WebGL2 | carga, construye y muestra los 7 días |
| Página real de Hábitos (empaquetada con esbuild, sin login/Supabase) | mantener presionado completa el hábito → abre la vista FIGURA → construye → vuelve al check; día 7 sin solaparse con la racha |
| Transparencia | ver sección 2 |

Límites de esa prueba: usó la página real de Hábitos pero con `next/navigation` simulado y sin Supabase (no se inició sesión); GPU de escritorio; **no** se probó en un teléfono ni se midió FPS.
