# Integración Hábitos ↔ Gym y colecciones 3D

Dos colecciones de figuras independientes (cada una con 7 etapas por figura y su propio desbloqueo):

| Colección | Figuras (orden de desbloqueo) |
|-----------|-------------------------------|
| `habitos` | Bosque → Castillo → Casa → Molino → Cuarto → **Puente** |
| `gym` | **Esqueleto → BMW M6 → Fórmula 2 → Bomba** |

Etapas de las nuevas: Puente (Base, Terreno, Río y estanque, Puente, Pagoda, Árboles y cerezo, Rocas y linterna) · Esqueleto (Base, Piernas, Pelvis, Columna, Caja torácica, Brazos, Cráneo) · BMW (Base, Chasis, Ruedas, Carrocería, Techo y cristales, Interior, Luces y detalles) · Fórmula 2 (Base, Chasis, Ruedas, Carrocería, Morro y alerón delantero, Trasera y alerón, Cabina y detalles) · Bomba (Base, Dinamita, Cintas, Circuito, Reloj, Cables, Luces).

## Flujo

```
categoría del hábito ──► category-config ──► colección 3D (habitos | gym)  +  fuente por defecto
Gym (agua / calorías / entrenamiento)
   └─ goal-events.ts detecta el cruce ──► bus de progreso (water.goal_reached | calories.goal_reached | workout.completed)
        └─ source-dispatcher.ts: evento → fuente → hábitos vinculados y pendientes hoy ──► acción pendiente (habit-prompts)
             └─ HabitSourceBridge lleva al usuario a /habitos/habito?id=… ──► el check hace un rebote guiado + texto
                  └─ el usuario mantiene presionado el check (NUNCA se marca solo) ──► completeHabit ──► Progress Engine
                       └─ scene.stage.changed ──► figura de SU colección avanza ──► (día 7) celebración + siguiente desbloqueada
```

## Archivos
- `src/lib/3d/scene-registry.ts` — `SCENE_COLLECTIONS`, `sceneFigures(id)`, `figureConfigsFor(id)`; sumar una colección/figura = una entrada.
- `src/lib/habits/category-config.ts` — **tabla** categoría → dominio → colección → fuente por defecto (sin `if (category === …)`).
- `src/lib/habits/progress-sources.ts` — fuentes (`gym.water`, `gym.calories`, `gym.workout`) ↔ evento ↔ texto del aviso.
- `src/lib/habits/habit-links.ts` — `habitSceneCollection(h)`, `habitProgressSource(h)`.
- `src/lib/progress/event-bus.ts` — bus entre módulos (`emitProgressEvent`); tipos en `progress/types.ts`.
- `src/lib/gym/goal-events.ts` — Gym vigila su propio estado y emite (solo entradas nuevas y recientes: la hidratación no dispara).
- `src/lib/habits/source-dispatcher.ts` + `habit-prompts.ts` — Hábitos consume el evento y guarda el pendiente (efímero, solo del día).
- `src/components/habitos/habit-source-bridge.tsx` — montado en el layout del dashboard; navega y (solo en desarrollo) muestra el simulador `sim`.
- `src/components/3d/scene-completion-celebration.tsx` — celebración reutilizable (Hábitos, Gym y futuros módulos).

## Categorías reales → colección
`gym` → Gym (fuente entrenamiento) · `agua` → Gym (agua) · `comida` → Gym (calorías) · `sueno, lectura, meditacion, trabajo, estudio, movilidad, higiene, finanzas` → Hábitos. No existen categorías "deporte" ni "calorías" separadas: se respetó la lista real. Para cambiar una, editar solo `category-config.ts`.

## Compatibilidad con datos antiguos
`Habit.sourceId` es opcional: `undefined` (hábitos anteriores) = la fuente por defecto de su categoría; `null` = el usuario lo desvinculó. Nada se borra ni se reescribe. Un hábito existente de categoría `agua`/`gym`/`comida` pasa a mostrar las figuras de Gym (su total de repeticiones se conserva y se reparte en esa colección).

## Persistencia
- Progreso de hábito, de figura y desbloqueo: **derivados** de `habits.completed_dates` (ya persistido en Supabase). No hay tabla nueva.
- Colección: derivada de `habits.category_id`. No se guarda.
- Fuente: **columna nueva `habits.source_id text`** (migración `supabase/migrations/0005_habit_progress_source.sql`, aditiva e idempotente; `NULL` = por defecto de la categoría, `'none'` = sin vínculo; índice parcial `(user_id, source_id)`). `habits-sync.ts` la envía solo cuando hay valor y, si la BD aún no tiene la columna, reintenta sin ella (no rompe el sync).
- Acciones pendientes: `localStorage` (`vida-total-habit-prompts`, por usuario). Son efímeras a propósito.

## Pruebas
- `node tools/3d/verify/run_ts.mjs tools/3d/verify/integration_test.ts` — 40 comprobaciones: categorías, colecciones independientes, evento → hábito correcto, nunca se completa solo, confirmación, hábito de cantidad, hábito sin relación, detección de cruces de Gym (y que la hidratación no dispara).
- Navegador (harness, `tools/3d/harness`): las 4 figuras de Gym y el Puente cargan y muestran etapas; el evento navega al hábito y el aviso persiste tras recargar. Botón `sim` (solo desarrollo) para simular `calories.goal_reached`, `water.goal_reached`, `workout.completed`.

## Pendiente
Rebote del check verificado solo por código (el panel del navegador de pruebas congela las animaciones); prueba en teléfono real; licencias `UNVERIFIED` de las 5 figuras nuevas (BMW y Esqueleto traen un texto de permiso dentro del archivo, sin verificar; BMW exige atribución); la Bomba no es un tema de gimnasio; ciclo 2 de colecciones; eventos futuros solo reservados (`meal.goal_reached`, `sleep.goal_reached`, `kegel.completed`, `meditation.completed`).
