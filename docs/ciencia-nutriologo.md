# Nutriólogo virtual: Nutrition Care Process, límites y fuentes

## Qué es el Nutrition Care Process (NCP)

El motor (`src/lib/nutrition/nutrition-care-engine.ts`) sigue el marco de **4 pasos** publicado por la
**Academy of Nutrition and Dietetics** (antes American Dietetic Association) para el trabajo clínico de
un dietista-nutricionista registrado (RDN):

1. **Nutrition Assessment (Evaluación)** — recolectar y analizar datos (ingesta, antropometría, clínicos).
2. **Nutrition Diagnosis (Diagnóstico nutricional)** — identificar y nombrar un problema que el RDN puede
   tratar, comunicado como una **sentencia PES**: **P**roblema, **E**tiología, **S**ignos/síntomas, con el
   formato "[Problema] relacionado con [Etiología] evidenciado por [Signos/síntomas]".
3. **Nutrition Intervention (Intervención)** — plan de acción dirigido a la causa (etiología) o a los
   signos/síntomas del diagnóstico.
4. **Nutrition Monitoring and Evaluation (Monitoreo y evaluación)** — volver a medir los mismos
   indicadores para ver si el problema mejoró.

**Fuente:** overview de la Academy of Nutrition and Dietetics en eatrightPRO.org, sección "Nutrition Care
Process" y su subpágina "Nutrition Diagnosis" (describe el PES statement con sus 3 partes y el patrón
"relacionado con / evidenciado por"); confirmado también por Skipper AA, *"Nutrition Care Process (Part
2)"*, **Support Line** (boletín de Dietitians in Nutrition Support, Academy of Nutrition and Dietetics),
diciembre de 2007 (hospedado en andeal.org), que describe el mismo PES statement con sus tres partes.
**Consultado 2026-10-14** vía búsqueda (el fetch directo a eatrightpro.org devolvió 404 al reestructurar
el sitio desde que se escribieron las fuentes secundarias que lo citan; el PDF de Skipper 2007 no pudo
abrirse como texto — es un PDF escaneado/comprimido — así que la fecha y el contenido se confirmaron por
los resúmenes de búsqueda, no leyendo el PDF directo). Si en el futuro hace falta la cita exacta palabra
por palabra, conviene revisar si eatrightpro.org movió la página a otra URL.

## Qué SÍ hace este motor y qué NO

- **Evaluación** (`evaluate`): promedio diario de calorías/proteína/carbos/grasas y peso de tendencia de
  una ventana configurable (mínimo 7 días, recomendado 14 — mismo mínimo razonable de consistencia de
  registro que ya usa `calorie-adaptive.ts` para su ventana de 14 días). Si menos del 70 % de los días de
  la ventana tienen algún registro, `datosSuficientes` es `false` y **ningún paso siguiente diagnostica**
  con esos datos — evita forzar un patrón con pocos días.
- **Diagnóstico** (`diagnose`): compara, día por día de la ventana, la ingesta de cada micronutriente
  contra su RDA/AI (`sentido: "meta"`, ya citada en `docs/ciencia-nutricion.md`) y su UL (`ul`, misma
  fuente). Solo diagnostica un **patrón sostenido**: al menos el 60 % de los días con registro por debajo
  (o por encima del UL) — un solo día malo aislado no alcanza, evita un diagnóstico por ruido de un día.
  El resultado reporta el conteo real ("12 de 14 días por debajo de la RDA"), como pide la Fase 1 de este
  trabajo, no solo el promedio. **Nunca nombra una enfermedad**: el `problema` siempre dice "riesgo de
  ingesta inadecuada/exceso de [nutriente]", nunca un diagnóstico médico. Los micronutrientes no vienen en
  `LoggedFood` (solo trae macros) — la pantalla los calcula igual que ya hace el contador de Calorías
  (resolviendo cada alimento contra la base) y le pasa a `diagnose` un array con el total de cada día de
  la ventana (uno por nutriente), no un promedio ya hecho.
- **Intervención** (`buildIntervention`): solo arma el mensaje y la magnitud de la brecha; la pantalla
  decide QUÉ alimentos de la base del usuario subirían ese nutriente (este módulo es puro, no busca en la
  base de alimentos) y siempre se presenta con **Aceptar/Descartar** — nunca cambia la dieta o las metas
  del usuario solo, mismo patrón que `adaptiveDismissed`/`dismissAdaptiveSuggestion` ya usado en Calorías.
- **Monitoreo** (`monitor`): compara el promedio original del diagnóstico contra uno nuevo, con una
  tolerancia del 5 % para no marcar "empeoró" por ruido normal día a día.

## Límite duro (en código y en toda la UI)

Este motor diagnostica **patrones de ingesta** contra referencias de **nutrición poblacional** (DRI/UL),
no enfermedades ni condiciones médicas. Todo lugar donde se muestre debe incluir el texto fijo: *"Esto no
reemplaza una consulta médica ni análisis de laboratorio. Ante síntomas persistentes, consultá a un
profesional de salud."*

## Relación con el ajuste adaptativo de calorías (ya existente)

Fase 0 de este trabajo encontró que el ajuste adaptativo de meta calórica (estilo MacroFactor/Carbon Diet
Coach) **ya está implementado completo**: lógica en `src/lib/gym/calorie-adaptive.ts`
(`evaluateAdaptiveCalories`) y UI con Aceptar/Descartar en `src/components/gym/calorie-settings-sheet.tsx`
(Ajustes de Calorías). La Fase 2 de este trabajo agrega solo un envoltorio de una función,
`calorieGoalIntervention` en `nutrition-care-engine.ts`: toma el `AdaptiveCalorieResult` ya calculado y
decide si corresponde mostrarlo como una intervención más del nutriólogo (cuando `status === "suggestion"`),
sin tocar ni duplicar el cálculo de TDEE real. La pantalla del nutriólogo (Fase 4) llama a
`evaluateAdaptiveCalories` igual que ya hace Ajustes de Calorías y le pasa el resultado a esta función.

**Sobre relacionar el gasto real de entrenamiento con el TDEE** (pedido en la Fase 2 de este trabajo): no
existe ningún módulo de calorías quemadas por entrenamiento en la app (sin MET ni estimación equivalente
confirmado en la Fase 0 de inspección). `evaluateAdaptiveCalories` ya deriva el TDEE **real observado**
(`impliedTDEE`) de la relación entre ingesta y cambio de peso de tendencia — ese TDEE real **ya incluye**
cualquier gasto de entrenamiento, sin necesitar medirlo por separado: si alguien entrena más de lo que la
fórmula asume, su peso bajará más de lo esperado para la misma ingesta y `impliedTDEE` ya lo va a reflejar
como una desviación. Construir una estimación de calorías quemadas por MET hubiera sido una pieza nueva
sin una fuente de MET por ejercicio ya elegida en este proyecto, y hubiera duplicado una señal que el
ajuste adaptativo ya captura indirectamente — se documenta acá como decisión para que la revises, no se
implementó.

## Registro de síntomas y correlación (Fase 3)

`symptomEntries` en el store (`gymStore.ts`): un registro simple ligado a una entrada de comida ya
registrada (`loggedFoodId`), con síntoma de una lista corta (`SymptomKind` en `src/lib/types/index.ts`:
hinchazón, dolor de estómago, fatiga, dolor de cabeza, "otro" con texto libre) y su propio `timestamp` (el
momento en que se REPORTÓ el síntoma, no el de la comida).

La correlación (`src/lib/nutrition/symptom-correlation.ts`, `correlateSymptom`/`correlateAllSymptoms`) es
**estadística simple de conteo**, no un modelo entrenado ni un test de alergia/intolerancia: de las veces
que se reportó un síntoma dado, cuenta en cuántas aparecía cada alimento dentro de las
**`CORRELATION_WINDOW_HOURS` = 4 horas previas al reporte** (convención propia — no hay una fuente clínica
de cuánto tarda cada síntoma en aparecer tras comer algo, varía mucho por persona y por síntoma; se
documenta así, no como un intervalo médico). Un alimento comido varias veces antes del mismo reporte
cuenta una sola vez (lo que importa es en cuántos reportes distintos apareció). Con menos de
**`MIN_SYMPTOM_OCCURRENCES` = 5** reportes de ese síntoma, `datosSuficientes` es `false` y no se muestra
ningún alimento todavía — se le pide al usuario seguir registrando en vez de mostrar un patrón poco
confiable con pocos datos. 12 pruebas (`tools/nutrition/symptom_correlation_test.ts`).

Texto fijo obligatorio en la UI (pantalla del nutriólogo, Fase 4): *"Esto es un patrón detectado en tu
propio registro, no un diagnóstico de alergia o intolerancia. Para confirmar una intolerancia o alergia
real hace falta un profesional y, si corresponde, pruebas clínicas."*

## La pantalla del nutriólogo (Fase 4)

Ruta propia `src/app/(dashboard)/gym/nutriologo/page.tsx` — **NO** dentro de Calorías. Decisión y por qué:
el contenido (evaluación + diagnósticos + intervenciones + síntomas + agente) es denso y no entra como una
sección más sin reformar la pantalla de Calorías, que está explícitamente fuera de los límites de este
trabajo ("no toques Calorías"). Se llega con un tile nuevo en el hub de Gym
(`src/app/(dashboard)/gym/page.tsx`, no es un archivo protegido) — cero diffs en ningún archivo de
Calorías. Mismo patrón visual que el Coach de Entrenamiento: 5 tarjetas con swipe horizontal
(`swipe-carousel.tsx`), reutilizado tal cual, sin inventar un patrón nuevo:

1. **Resumen** (`evaluate()`): ventana, adherencia de registro, peso de tendencia.
2. **Diagnósticos** (`diagnose()`), en lenguaje claro, con un disclosure **"¿Por qué?"** por diagnóstico
   que muestra la etiología y los signos exactos (el conteo real de días) — así el "¿por qué me dijiste
   esto?" del enunciado se responde con el dato real que lo generó, sin construir un chat nuevo.
3. **Intervenciones**: alimentos de la propia base que subirían el nutriente (`topFoodsForNutrient`, solo
   alimentos que ya tienen el dato cargado, nunca inventado) + el ajuste de meta calórica si corresponde
   (`calorieGoalIntervention`), ambos con Aceptar/Descartar — nunca cambian algo solos.
4. **Síntomas**: registrar uno nuevo (comida reciente + tipo) y ver los patrones ya detectados
   (`correlateAllSymptoms`), con el disclaimer de arriba.
5. **Agente**: `Mascot` con el nuevo traje `"nutriologo"` (agregado a `Costume` en `agents.ts` y a
   `mascot.tsx` — un ícono simple de estetoscopio, mismo criterio que los demás trajes) mostrando el
   diagnóstico más relevante como si el agente lo dijera, con el mismo disclaimer médico. **Decisión**: no
   se creó un `AgentDef` de chat nuevo ni se reutilizó el agente "nutricion" existente (que ya usa el
   traje "chef" para registrar comida — cambiarle el traje habría afectado esa pantalla, fuera de los
   límites de este trabajo). Se siguió el mismo precedente que el Coach de Entrenamiento: una Mascota
   estática con un mensaje compuesto por datos reales, no un chat en vivo nuevo.

Verificado en vivo (harness de mock-supabase, datos sembrados) en 375×812, 390×844 y 430×932: las 5
tarjetas renderizan sin errores de consola, el diagnóstico de vitamina C y el patrón de síntomas salen
con el formato "X de Y" pedido en el enunciado.
