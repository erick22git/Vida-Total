# Plan: relación entre módulos

Estado: **solo documento** (no hay código de app en este paso). Lo marcado con **[Decisión mía]** lo decidí yo al redactar, sin consultarlo: se puede revertir sin costo.
Fuente: lectura del código al 2026-10-06 (stores, tipos, sync y migraciones). Los números de línea pueden moverse.

## 1. Inventario: qué guarda cada módulo

Todas las stores usan `userScopedLocalStorage` (clave por usuario) y espejan a Supabase solo lo que se indica.

| Módulo | Store / clave local | Qué guarda (lo relevante) | Espejo en Supabase |
|---|---|---|---|
| Gym · Calorías | `useGymStore` (`vida-total-gym-store`, v6) | `calorieGoal/proteinGoal/carbsGoal/fatGoal`, `loggedFoods`, `customFoods`, `recipes`, plantillas, favoritos | `gym_settings` (metas), `logged_foods`, `custom_foods`, `recipes`, etc. |
| Gym · Agua | misma store | `waterGoalMl` (default 2500), `waterEntries` | `gym_settings.water_goal_ml` (default SQL **2000**), `water_entries` |
| Gym · Entrenamiento | misma store | `sessions`, `routines`, `plans`, racha. **Ninguna sesión guarda calorías gastadas.** | `workout_sessions`, `routines`, `training_plans`, `gym_workout_state` |
| Gym · Peso | misma store | `weightEntries` `{id, kg, date}` | `weight_entries` |
| Gym · Perfil | misma store | `gymProfile`: `pesoKg`, `alturaCm`, `sexo`, `edad`, `nivelActividad`, `objetivoCalorico`, modo PRO (grasa %, medidas), perfil de entrenamiento (días, minutos, equipo…) | **Ninguno** (solo local) |
| Gym · Kegel | misma store + `kegelPlanStore` + `kegelSettingsStore` | nivel/racha/total; sesiones por día; opciones de sonido/vibración | racha vía `gym_workout_state`; el log por sesión (`kegel_session_log`, migración 0006) existe pero **nada lo llama** |
| Hábitos | `useHabitsStore` (`vida-total-habits-store`, sin versión) | hábitos (`sourceId`, `goal`, `unit`), rutinas, tareas, bloques, páginas | `habits`, `habit_completions`, `habit_routines`, … |
| Finanzas | `useFinanceStore` | transacciones, presupuestos, metas de ahorro | sí |
| Outfit | `useOutfitStore` | prendas, outfits, planes semanales | sí |
| Paz mental | `usePazMentalStore` | meditación, ánimo, diario, ira, piel, yoga | casi todo (yoga facial / sesiones de yoga: sin confirmar) |
| Voz | `useVoiceStore` | lecciones, grabaciones, lenguaje corporal | parcial (sin confirmar `practiceDays`) |
| Preferencias | `usePreferencesStore` | sonido, reducir movimiento | no |
| Cuenta | tabla `profiles` | email, nombre, rol, acceso. **Sin datos corporales.** | — |

## 2. Datos duplicados o desconectados (hallazgos)

1. **Peso en dos lugares sin vínculo**: `gymProfile.pesoKg` y `weightEntries`. Quien lee elige distinto: `use-rank.ts` prefiere el perfil; `calorie-settings-sheet.tsx` usa el perfil para el TDEE y las entradas para la tendencia; `perfil/peso/page.tsx` usa la última entrada (default 70). `addWeightEntry` **no** toca el perfil y viceversa.
2. **`calorieGoal` se calcula desde el perfil pero se guarda aparte**: pueden desalinearse. Proteína/carbos/grasas son solo manuales.
3. **`waterGoalMl` no se deriva de nada**: ninguna pantalla lo edita después del default, y el default difiere entre app (2500) y SQL (2000).
4. **Nada se recalcula al cambiar el peso**: `calorie-adaptive.ts` solo sugiere (el usuario acepta o descarta).
5. **El perfil corporal no se sincroniza**: se pierde al cambiar de dispositivo o limpiar el navegador.
6. **`saveGymProfile` reemplaza todo el perfil** (y fuerza `onboardingCompleted`). Solo lo usa el onboarding de entrenamiento con 4 campos: repetirlo borraría sexo, edad, actividad, objetivo calórico, modo PRO y medidas. `updateGymProfileFields` (merge) es el camino seguro y ya lo usan Calorías, el perfil de entrenamiento y la calculadora de rango. Ojo: un patch con `undefined` pisa la clave existente.
7. **Metas de hábito duplicadas**: `Habit.goal/unit` (p. ej. 8 vasos) son independientes de `waterGoalMl`.
8. **Evento `kegel.completed`** se emite pero no hay fuente que lo escuche; `meal.logged`, `sleep.goal_reached`, `meal.goal_reached`, `meditation.completed` están declarados y sin emisor ni consumidor.

## 3. Propuesta: perfil compartido como única fuente de verdad

**Qué es**: `gymProfile` (que ya concentra sexo, edad, peso, altura, actividad, objetivo) pasa a ser *el* perfil corporal del usuario para todos los módulos, y se sincroniza. No se crea un perfil paralelo.

Campos canónicos: `sexo`, `edad`, `pesoKg`, `alturaCm`, `nivelActividad`, `objetivoCalorico` (+ `intensidadObjetivo`), y los opcionales ya existentes (grasa corporal, medidas).

Reglas:
- **Peso**: el peso vigente = la **última `weightEntries`** (es el historial real); `gymProfile.pesoKg` pasa a ser un reflejo derivado que se actualiza al registrar un peso. Una sola función `currentWeightKg()` para todos los lectores. **[Decisión mía]**: gana la entrada más reciente porque es la que el usuario registra a propósito; el perfil es lo que quedó de configurar.
- **Escritura**: todo cambio al perfil pasa por `updateGymProfileFields` con un patch que **omite** las claves `undefined` (nunca `saveGymProfile`). El onboarding deja de llamar `saveGymProfile` y usa merge + marca `onboardingCompleted` aparte.
- **Metas**: `calorieGoal` sigue guardado (el usuario puede fijarlo a mano), pero se registra *de dónde viene* (`calorieGoalSource: "calculada" | "manual"`) para saber cuándo recalcularlo sin pisar una decisión manual.

### Ruta de migración que no pisa datos

1. **Sin cambios de forma primero**: añadir campos nuevos como opcionales (`calorieGoalSource`, `pesoActualizadoEn`); `version` 6 → 7 con `migrate` que solo agrega defaults y no borra nada.
2. **Sincronizar el perfil**: tabla nueva `gym_profile` (una fila por usuario, columnas opcionales). La primera sincronización usa el patrón existente `mergeById`: el remoto manda **solo si ya tiene valor**; lo local que falta en remoto se sube. Nunca se reemplaza un campo local con vacío.
3. **Reconciliar el peso una sola vez** al migrar: si hay `weightEntries`, `pesoKg` = última entrada; si no hay entradas pero hay `pesoKg`, se crea **una** entrada con la fecha de hoy. No se borra nada.
4. **Cambiar los lectores** a `currentWeightKg()` uno por uno (rank, ajustes de calorías, perfil de peso), cada uno en su commit.
5. **Retirar `saveGymProfile`** del onboarding al final, cuando ya nadie dependa de él.
6. **Alinear el default de agua** (2500 vs 2000) en una migración SQL **[Decisión mía: usar 2500, como la app]**; no se aplica sola.

Cada paso es reversible por separado y ninguno requiere que los demás estén listos.

## 4. Flujos entre módulos

### 4.1 Peso → metas de calorías y agua
- Al registrar un peso, se **sugiere** (no se aplica) recalcular `calorieGoal` si su origen es `"calculada"`; si es `"manual"`, no se toca. Reutiliza `calorie-adaptive.ts` y su tarjeta de aceptar/descartar.
- **Agua**: meta sugerida = peso × 35 ml (rango habitual 30–40 ml/kg) con piso 1500 y techo 4500, redondeada a 50 ml, mostrada como sugerencia en ajustes de agua. **[Decisión mía]**: factor 35 ml/kg y que sea solo sugerencia, porque hoy ninguna pantalla edita la meta y no quiero cambiarla en silencio.
- Añadir la pantalla/acción que falta para editar `waterGoalMl` (hoy no hay ninguna).

### 4.2 Entrenamiento → gasto calórico y ajuste de metas
- Hoy no existe gasto por sesión. Propuesta: estimar **kcal por sesión** = MET × peso × horas, con MET por intensidad (`intensidadEntrenamiento`: ligera 3.5 / moderada 5 / alta 6.5) y la duración real (`durationSeconds`). **[Decisión mía]**: tabla de MET simple y global; un MET por ejercicio sería falsa precisión.
- Guardar `kcalEstimadas` en la sesión (campo opcional, sin migración destructiva).
- Efecto en metas: **no** sumar el gasto automáticamente a `calorieGoal` (doble conteo con `nivelActividad`, que ya incluye el entrenamiento habitual). Mostrarlo como dato informativo en Calorías ("entrenaste: ~X kcal") y dejar el ajuste como opción manual. **[Decisión mía]**.

### 4.3 Calorías y agua → eventos hacia Hábitos (reutilizando lo que ya existe)
Ya funcionan `calories.goal_reached`, `water.goal_reached` y `workout.completed` (Gym emite, Hábitos deja un aviso pendiente y el usuario confirma con el check; nunca se completa solo). Propuesta, sin tocar ese mecanismo:
- Reutilizar `meal.logged` (ya declarado, sin emisor) para "registraste una comida" cuando se confirma Lista/Escáner/Voz.
- Registrar la fuente `gym.kegel` en `PROGRESS_SOURCES` para que `kegel.completed` (que ya se emite) tenga consumidor.
- Dejar `sleep.*`, `meal.goal_reached` y `meditation.completed` fuera hasta que exista su emisor.
- Un hábito se vincula con `Habit.sourceId`; solo hay que agregar ids de fuente nuevos y su evento, no un mecanismo nuevo.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Perder el perfil al migrar o sincronizar | `mergeById` con regla "nunca reemplazar con vacío"; `migrate` solo agrega; exportar un respaldo local antes del paso 2 |
| Doble peso mal reconciliado | Un solo punto (`currentWeightKg`) y una reconciliación única, probada con datos reales exportados |
| Sugerir metas "raras" (agua/calorías) | Siempre sugerencia con aceptar/descartar; nunca escritura silenciosa |
| Doble conteo de gasto calórico | No sumar el gasto a la meta; solo mostrarlo |
| Una migración SQL rompe el sync si no está aplicada | Mismo patrón que `recipes.verificado`: escritura propia que falla sola y se registra |
| Eventos nuevos que "completan" hábitos solos | Se mantiene la regla actual: solo dejan un aviso, el usuario confirma |
| Patches con `undefined` que borran campos | Helper que descarta `undefined` antes del merge |

## 6. Orden de implementación (fases chicas)

1. **Cimientos sin riesgo**: `currentWeightKg()`, helper de patch sin `undefined`, tests. *(sin cambio visible)*
2. **Onboarding sin `saveGymProfile`** (merge + flag aparte). Cierra el único riesgo de pérdida de datos.
3. **`calorieGoalSource`** + `migrate` v7 aditivo.
4. **Lectores de peso** unificados (rank, ajustes, perfil de peso), uno por commit.
5. **Sync del perfil** (`gym_profile`, migración creada y **no aplicada**), con respaldo local previo.
6. **Meta de agua**: pantalla de edición + sugerencia por peso; alinear default SQL.
7. **Sugerencia de calorías al registrar peso** (reutiliza el sistema adaptativo).
8. **Gasto por sesión** (MET) solo informativo.
9. **Eventos**: `meal.logged` y fuente `gym.kegel`.

## 7. Resumen de lo que decidí yo

- El peso vigente es la última `weightEntries`; `pesoKg` del perfil es reflejo.
- Meta de agua = 35 ml/kg, solo como sugerencia (piso 1500, techo 4500).
- Default de agua alineado a 2500 ml.
- Gasto por sesión con MET simple por intensidad, informativo; no se suma a la meta.
- `calorieGoalSource` para no recalcular lo fijado a mano.
- El perfil compartido es `gymProfile` ampliado, no una estructura nueva.
- Fuente `gym.kegel` y evento `meal.logged` como únicos eventos nuevos.
