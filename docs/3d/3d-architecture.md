# Arquitectura 3D de Vida Total

Estado: **primera fase completada** (infraestructura de producción + 1 prototipo verificado).
Nada de esto toca todavía la UI de la app: es taller (Blender), contrato (GLB + metadatos) y diseño de integración.

## 1. Principios

1. **Blender es el taller, no el runtime.** Blender prepara, modulariza, anima, optimiza y exporta. La app solo ve GLB + metadatos.
2. **La infraestructura es global.** Hábitos es el primer consumidor, pero el sistema no conoce "hábitos": recibe *progreso* y *eventos*.
3. **Escenas progresivas, no modelos estáticos.** Un asset = una escena con **etapas**; el progreso decide cuántas etapas están construidas.
4. **Construcción, no aparición.** Cada pieza entra con una animación de montaje (caer y asentarse, crecer desde el suelo, encajar por fragmentos), nunca con un fade de opacidad.
5. **Mobile-first.** Cada asset pasa por un presupuesto de rendimiento antes de entrar al registro (ver `performance.md`).
6. **Licencia registrada o no entra.** Todo asset guarda `source`, `license`, `author`, `originalFile`.

## 2. Capas

```
APP (módulos: Hábitos, Gym, Paz, Voz, Outfit, Finanzas)
   │  emiten eventos de dominio
   ▼
Progress Engine            src/lib/progress/        (ya existe: rachas, hitos, niveles)
   │  eventos + progreso acumulado
   ▼
Achievement / Event System (nuevo, global)          "habit.completed", "workout.completed"…
   │  achievement.unlocked, scene.progress
   ▼
3D Scene State             SceneProgression         (nuevo, sin dependencias de React/three)
   │  { assetId, progress → stage, transición }
   ▼
React Three Fiber          <SceneStage/>            (nuevo, solo cliente, carga perezosa)
   │  carga y reproduce
   ▼
GLB                        landscape_bosque_001.glb (+ metadatos vt_* en `extras`)
```

Regla de capas (la misma que ya sigue Hábitos): **la UI no decide progreso, el Progress Engine no conoce animaciones, el Animation Engine solo emite eventos.** La escena 3D es *otro suscriptor* del mismo flujo.

Hoy existe: `src/lib/progress/` (Progress Engine), `src/lib/animations/` (Animation Engine con eventos `habit.completed`, `habit.milestone`, `habit.levelUp`…), `src/components/animations/CrystalScene.tsx` + `Crystal3D.tsx` (cristal en three.js, con respaldo SVG).
Falta (y **no** se creó en esta fase): el Achievement/Event System global, `SceneProgression`, el cargador de GLB y el instanciador de runtime.

## 3. Eventos globales

| Evento | Origen | Hoy existe | Experiencia 3D asociada |
|---|---|---|---|
| `habit.completed` | Hábitos | sí (Animation Engine) | `progress++` → posible nueva etapa del paisaje |
| `habit.milestone` (10…50) | Progress Engine | sí | etapa + animación de hito |
| `habit.levelUp` (60) | Progress Engine | sí | etapa final + celebración |
| `workout.completed` | Gym | reservado en `ProgressEventType` | figura de Gym: +1 pieza |
| `calories.goal_reached` | Gym | reservado | logro: escena de "Lo lograste" |
| `water.goal_reached` | Gym | reservado | logro |
| `kegel.completed` | Gym | por crear | logro |
| `achievement.unlocked` | Achievement System | por crear | abre la experiencia de logro (sección 5) |

Los tipos `workout.completed`, `water.goal_reached`, `meal.logged`, `sleep.goal_reached`, `calories.goal_reached` ya están declarados (sin handler) en `src/lib/progress/types.ts`: la infraestructura fue pensada para esto.

## 4. Flujo base (Hábitos)

```
habit.completed
  → Progress Engine: total de repeticiones += 1 (y racha, hitos)
  → SceneProgression.update("landscape_bosque_001", progress = total)
  → stage = stageFor(progress)            (umbrales del asset)
  → si stage subió: emite scene.stage.changed { from, to }
  → R3F reproduce el clip STAGE_<to> (0.5–1.5 s) y hace visibles las piezas de esa etapa
```

Detalle de `SceneProgression` en `scene-progression.md`.

## 5. Experiencia de logro (diseño; sin código todavía)

```
OBJETIVO COMPLETADO (p. ej. calories.goal_reached)
  → Achievement System crea achievement.unlocked { id, module, assetId, stageReward }
  → feedback inmediato (sonido/háptico existentes)
  → transición contextual (la pantalla se transforma)
  → escena 3D del asset (figura o paisaje) montada en un overlay
  → animación de construcción de la pieza ganada
  → mensaje: "Lo lograste"
  → [ CHECK ]  ← el usuario confirma
  → achievement.claimed → Progress Engine (progress++ del asset asociado)
```

El **CHECK** es lo único que vuelve a escribir en el Progress Engine: así el logro es una ceremonia, pero el dato sigue teniendo una sola fuente de verdad.

### Gym (solo documentado)
No se modificó nada del Gym. Cuando se conecte:
- El Gym seguirá emitiendo sus eventos actuales; un adaptador fino los traduce a eventos globales (`calories.goal_reached`, `workout.completed`, `water.goal_reached`, `kegel.completed`).
- Cada objetivo puede mapear a un asset "figura" (cuerpo, escultura, atleta, auto, bicicleta, moto, pesas, máquinas…) con su propio set de etapas.
- La lógica existente del Gym no cambia: solo se suscribe un adaptador al flujo global.

## 6. Un solo sistema para todos los módulos

| Módulo | Familias de asset | Progreso que las construye |
|---|---|---|
| Hábitos | paisajes, lugares, casas, puentes, montañas, ciudades, monumentos | repeticiones acumuladas (0–60) |
| Gym | cuerpos, esculturas, atletas, autos, bicicletas, pesas, máquinas | entrenos / metas cumplidas |
| Paz | lagos, bosques, montañas, jardines | sesiones de meditación / respiración |
| Voz | micrófonos, auriculares, equipos, escenarios | prácticas completadas |
| Outfit | maniquíes, ropa, zapatillas, accesorios | outfits registrados |
| Finanzas | edificios, bancos, bóvedas, monedas, ciudades | metas de ahorro |

Lo que cambia entre módulos es **solo el registro de assets y el mapeo evento → asset**. El motor de etapas, el contrato del GLB y el reproductor son los mismos.

## 7. Contrato del GLB (resumen)

- Una **etapa** = un `extras.vt_stage` (0…N) en cada nodo. Etapa 0 = siempre visible.
- Cada nodo lleva `vt_unlock_at` (progreso a partir del cual aparece), `vt_anim` (tipo de montaje) y `vt_delay_frames`.
- Un **clip glTF por etapa** (`STAGE_1` … `STAGE_N`) con las animaciones "héroe", normalizado para empezar en t = 0.
- El detalle repetitivo (pasto, guijarros, ramitas) **no** trae clip: el runtime lo anima proceduralmente según `vt_anim` y `vt_delay_frames` (ver `performance.md`).
- Iluminación, niebla, fondo y cámara los pone el runtime; el GLB no lleva luces ni cámaras.

Más detalle en `asset-pipeline.md`.

## 8. Decisiones y hallazgos de esta fase

- **three.js directo vs `@react-three/fiber`.** Al instalar `@react-three/fiber` v9 el chequeo de tipos de la app falló en ~10 archivos ajenos (`<Icon size={…}/>` daba `Type 'number' is not assignable to type 'never'`), porque fiber amplía los tipos JSX globales y los componentes tipados como `React.ElementType` reciben una unión con los elementos de three. Se desinstaló y el cristal usa three.js directo. **Antes de adoptar R3F** hay que cambiar esos tipos (`React.ElementType` → `LucideIcon`/`ComponentType<{ size?: number }>`) en los archivos afectados; es un cambio de tipos, no de comportamiento, y queda fuera de esta fase porque toca UI.
- **Los nombres de nodo cambian al cargar en three.js** (`Pine3.001` → `Pine3001`). El runtime debe usar `userData.vt_*` (los `extras`), nunca nombres.
- **`extras` con ruido:** aparece `ant_landscape: {}` (propiedad de un addon en el archivo original). El runtime ignora todo lo que no empiece con `vt_`.
