# SceneProgression — de progreso a paisaje

Sistema que convierte "progreso" en "qué parte de la escena está construida". **Implementado para Hábitos** (ver `forest-7-days.md`): `src/lib/3d/scene-progression.ts` (puro), `scene-registry.ts`, `progressive-scene.ts` (three.js) y `src/components/3d/ProgressiveScene.tsx`. Es independiente de Hábitos, de React y de three.js en su capa pura. **No hay un `7` fijo en el código**: la cantidad de etapas sale de la configuración (`createSceneConfig`) y funciona igual con 7, 8, 10 o 60.

## 1. Contrato

```ts
// Registro (ver asset-registry.json)
interface SceneAssetDef {
  id: string;                 // "landscape_bosque_001"
  module: "habitos" | "gym" | "paz" | "voz" | "outfit" | "finanzas";
  stageThresholds: number[];  // [0, 1, 5, 10, 20, 30, 40, 50, 60]  → índice = etapa
  clips: Record<number, string | null>; // etapa → clip glTF ("STAGE_4") o null (procedural)
  milestoneStages: number[];  // etapas con animación grande (p. ej. [8])
}

// Estado (lo único que se persiste es `progress`)
interface SceneState { assetId: string; progress: number; stage: number }

// API
stageFor(def, progress): number
sceneProgression.update(assetId, progress): { from: number; to: number; changed: boolean; direction: "up" | "down" | "none" }
```

Ejemplo: `sceneProgression.update("landscape_bosque_001", 24)` → `stage = 4` (24 ≥ 20). (Con otros umbrales, p. ej. 0/8/15/22/30…, daría 3: los umbrales viven en el registro, no en código.)

## 2. Reglas de comportamiento

1. **La etapa se deriva, no se guarda.** Solo se persiste el progreso; `stage = stageFor(progress)`. Nada se desincroniza.
2. **Sube una etapa** → reproducir su clip (0.5–1.5 s). Si `milestoneStages` la incluye → animación grande.
3. **Salta varias etapas a la vez** (p. ej. abrir la app tras editar el historial): las intermedias aparecen ya construidas, sin animación; **solo la última** anima.
4. **Baja el progreso** (desmarcar, editar historial): las piezas de las etapas perdidas se ocultan al instante, sin ceremonia.
5. **`prefers-reduced-motion` / preferencia de la app**: sin clip; se aplica la pose final.
6. **Idempotente**: llamar dos veces con el mismo progreso no repite animaciones.
7. **Agnóstico del origen**: recibe progreso de cualquier módulo (`habit.completed`, `workout.completed`, `calories.goal_reached`, `water.goal_reached`, `kegel.completed`, `achievement.unlocked`); el mapeo evento → (assetId, cuánto suma) vive en el registro/adaptadores.

## 3. Eventos que emite hacia el runtime

| Evento | Cuándo | Tier de animación existente |
|---|---|---|
| `scene.stage.changed { assetId, from, to }` | subió/bajó la etapa | `action` (normal) o `milestone`/`epic` (si es etapa de hito) |
| `scene.completed { assetId }` | llegó a la última etapa | `epic` |

Encajan en el Animation Engine actual (`src/lib/animations/`), que ya distingue `micro / action / milestone / epic`.

## 4. Animación de la etapa (contrato con el GLB)

- Clip por etapa: `STAGE_<k>`, empieza en t = 0. Se reproduce **una vez** y se deja en su pose final (`LoopOnce` + `clampWhenFinished`).
- Piezas sin clip (etapa 3 del bosque; detalle repetitivo de la 7): el runtime las anima con la receta `vt_anim` y `vt_delay_frames` de cada nodo (ondas por distancia, brote con rebote).
- Visibilidad: `node.userData.vt_stage <= currentStage`.

## 5. Técnicas evaluadas (qué usar para qué)

| Técnica | ¿Sirve para revelar? | ¿Viaja a GLB? | Veredicto |
|---|---|---|---|
| **Keyframes + pistas NLA** | Sí, es lo más predecible | **Sí** (un clip por pista) | **Elegida** para piezas "héroe" (agua, rocas, árboles, hongos) |
| **Colecciones por etapa** | Sí, es la estructura | Sí (`vt_stage` en `extras`) | **Elegida** como organización |
| **Instancias / mallas compartidas** | Sí, para el detalle repetitivo | Solo la malla compartida; el exportador de Blender 5.2 **no** generó `EXT_mesh_gpu_instancing` en este caso | Elegida + `InstancedMesh` en runtime |
| **Geometry Nodes** (revelar por índice/distancia/falloff) | Muy bien *dentro de Blender* | **No** (hay que aplicarlos: se pierde lo procedural) | Solo para **generar** (dispersión, ramas) y previsualizar; no para revelar |
| **Atributos / proximidad** (retraso según distancia) | Sí | Como dato | Se calcula en Python y se guarda en `vt_delay_frames` → el runtime repite la misma onda |
| **Shape keys** | Para crecimiento por deformación | Sí, pero como *morph targets* (pesados) | Reservada; no hizo falta aquí |
| **Drivers** | No | No | Descartados para runtime |
| **Fade de opacidad** | — | — | **Prohibido** por diseño (se pidió construcción, no aparición) |

Conclusión: **no se usa Geometry Nodes para todo.** Lo procedural sirve para *crear* el contenido; lo que llega a la app son transformaciones simples (posición/rotación/escala) que un `AnimationMixer` reproduce con coste casi nulo.

## 6. Integración con el Progress Engine

```
Progress Engine (repeticiones acumuladas por hábito)
      └─ suscriptor "scene": habit.completed → sceneProgression.update(assetDelHabito, total)
```

- El asset asociado a cada hábito se guarda **con el hábito** (campo por definir: `sceneAssetId`), o se asigna por categoría desde el registro.
- No hace falta tocar el Progress Engine: `SceneProgression` es otro suscriptor del mismo flujo de eventos.
- Persistencia: el progreso ya vive en `habit_completions`/`completed_dates` (Supabase); la etapa siempre se recalcula.

## 7. Estado de la implementación

Hecho: tipos + `stageFor`/`sceneStateFor`/`stageChange` (puros), registro en runtime, reproductor three.js con instanciación, componente React, adaptador de eventos (`completeHabit` emite `scene.stage.changed` / `scene.completed`) y la integración en la vista FIGURA de Hábitos.

Falta: pruebas automatizadas de la capa pura, otros módulos (Gym, Paz…), decidir R3F vs three.js directo (ver `3d-architecture.md`) y probar en un teléfono real (FPS, memoria, tiempo de carga).
