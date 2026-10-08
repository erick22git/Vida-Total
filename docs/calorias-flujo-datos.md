# Calorías: de dónde sale cada número del contador

Auditoría del flujo **formulario de verificación → alimento → entrada del día → contador** (estado del código al 2026-10-08).

```
crear-alimento (formulario)  →  Food (crudo + cocido opcional)  →  LoggedFood (solo kcal y 3 macros)  →  contador
   buildProfileFromForm          customFoods / BASE_FOODS            guarda gramos + cookedState          nutrientDayReport()
```

- `LoggedFood` **solo guarda calorías, proteína, carbos y grasas**. Todo lo demás (fibra, sodio, vitaminas…) se recalcula al mostrar el contador desde el alimento del catálogo, escalado por los gramos y el estado (crudo/cocido) de la entrada. Consecuencia: si editas un alimento después, el día pasado cambia con él (ver «Dudosos»).
- Una entrada sin alimento en el catálogo (`scan-…`, `manual-…`, alimento borrado) o con un alimento «sin configurar» no aporta ningún nutriente de detalle: ahora cuenta como **sin dato**.

## Tabla campo → contador

Leyenda: ✅ sí · ❌ no. «Sync» = viaja a Supabase (columna propia, o `perfil_extra` / `micronutrientes` jsonb; ver migración 0016). Todo lo opcional sale como **«sin dato»** cuando falta, nunca como 0.

| Campo (unidad) | ¿Lo pide el formulario? | ¿Se guarda? | Sync | ¿Escala por gramos? | ¿Crudo/cocido por entrada? | ¿Suma al día? | ¿Se ve en el contador? | ¿Meta / rango? |
|---|---|---|---|---|---|---|---|---|
| Calorías, proteína, carbos, grasas (kcal, g) | ✅ | ✅ (también en cada `LoggedFood`) | ✅ columna | ✅ | ✅ (se guardan ya con el estado elegido) | ✅ | ✅ | meta de kcal y de macros del usuario; **«Revisar sugerencia»** (proteína por kg, AMDR) |
| Grasas saturadas / trans (g) | ✅ | ✅ | ✅ columna | ✅ | ✅ | ✅ | ✅ A limitar | **límite**: < 10 % / < 1 % de la energía (OMS) |
| Grasas mono / poliinsaturadas (g) | ✅ | ✅ | ✅ `perfil_extra` | ✅ | ✅ | ✅ | ❌ (sí en la pantalla del alimento) | sin meta |
| Omega-3 ALA, omega-6 linoleico (g) | ✅ | ✅ | ✅ `perfil_extra` | ✅ | ✅ | ✅ | ✅ Otros | AI por sexo y edad (DRI) |
| **EPA, DHA, EPA+DHA (mg)** | ✅ *(nuevo)* | ✅ | ✅ `perfil_extra` | ✅ | ✅ | ✅ (el total sale de EPA + DHA solo si están los dos) | ✅ Otros (EPA + DHA) | 250 mg (**EFSA**; no hay DRI de EE. UU. para EPA+DHA) |
| Colesterol (mg) | ✅ | ✅ | ✅ columna | ✅ | ✅ | ✅ | ❌ | sin meta (la DRI no da un número) |
| Sodio (mg) | ✅ | ✅ | ✅ columna | ✅ | ✅ | ✅ | ✅ A limitar | **límite** CDRR 2300 mg (AI 1500) |
| Fibra (g) | ✅ | ✅ | ✅ columna | ✅ | ✅ | ✅ | ✅ Principales | 14 g por 1000 kcal |
| Azúcares / azúcares añadidos (g) | ✅ | ✅ | ✅ columna | ✅ | ✅ | ✅ | ✅ Otros / A limitar | totales: sin meta · añadidos: **límite** < 10 % de la energía (OMS, azúcares libres) |
| Agua del alimento (g ≈ ml) | ✅ | ✅ | ✅ `perfil_extra` | ✅ | ✅ | ✅ | ✅ **Agua total** (con las bebidas del módulo Agua) | agua total AI 3,7 / 2,7 L (DRI); meta de bebidas sugerida ~81 % |
| Ceniza (g) | ✅ | ✅ | ✅ `perfil_extra` | ✅ | ✅ | — | ❌ | — |
| **Alcohol (g)** | ✅ *(nuevo)* | ✅ | ✅ `perfil_extra` | ✅ | ✅ | ✅ | ✅ Otros | sin meta; entra a la validación kcal (7 kcal/g) |
| Carbs netos (g) | derivado: carbos − fibra | — | — | ✅ | ✅ | ✅ | ✅ Otros | sin meta |
| Vitaminas A, B1, B2, B3, B5, B6, B12, C, D, E, K, folato, colina | ✅ | ✅ (`micronutrientes`) | ✅ jsonb | ✅ | ✅ | ✅ | ✅ Micronutrientes | RDA/AI por **sexo y edad** (DRI) |
| **Biotina (mcg)** | ✅ *(nuevo)* | ✅ | ✅ jsonb | ✅ | ✅ | ✅ | ✅ Micronutrientes | AI 25–30 mcg |
| Minerales: calcio, hierro, magnesio, fósforo, potasio, zinc, selenio, cobre, manganeso | ✅ | ✅ | ✅ jsonb | ✅ | ✅ | ✅ | ✅ Micronutrientes | RDA/AI por sexo y edad |
| **Yodo, cromo, molibdeno, flúor (mcg), cloruro (mg)** | ✅ *(nuevo)* | ✅ | ✅ jsonb | ✅ | ✅ | ✅ | ✅ Micronutrientes | RDA/AI por sexo y edad (flúor en mcg; la tabla DRI lo da en mg) |
| **Perfil «cocido» completo** | ✅ (segundo paso) | ✅ | ✅ `perfil_extra` | ✅ | — | — | — | — |

Notas: **FoodData Central no trae cloruro** (no hay número de nutriente): solo cuenta lo que se escriba a mano. EPA y DHA llegan de USDA en gramos y se convierten a mg al importar. Los números de nutriente usados salen de `nutrient.csv` de FoodData Central (Foundation Foods, 2026-04-30): alcohol 221 · EPA 629 · DHA 621 · biotina 416 · yodo 314 · cromo 310 · molibdeno 316 · flúor 313.

## Errores corregidos en esta fase

1. **Los totales ignoraban crudo/cocido.** Los macros de cada entrada ya salían del perfil elegido, pero fibra, sodio, vitaminas y minerales se sumaban *siempre* con el perfil crudo. Ahora cada entrada usa el perfil con que se registró (`cookedState`); si el alimento no tiene perfil cocido real, usa el crudo, como en la pantalla de detalle.
2. **Faltante contaba como 0 en silencio** (`if (!v) return`). Ahora un valor que falta no se suma ni se muestra como 0: el informe trae una **cobertura por nutriente** («n de m alimentos de hoy con dato»). El contador muestra **«sin dato»** si ningún alimento lo trae y **«datos incompletos · n de m»** (barra atenuada) si solo algunos. Un 0 real (p. ej. 0 g de trans) sí es un dato.
3. **El formulario convertía un 0 real en «sin dato»** al volver a abrir un alimento (`n ? String(n) : ""`), y al guardar ese campo desaparecía. Ahora solo `undefined` queda vacío.
4. **Folato de USDA en la unidad equivocada.** Se pedía el nutriente 417 («folato total»); la RDA está en **DFE** (equivalentes de folato dietético, nutriente 435). Ahora se usa el 435 con respaldo al 417. Afecta a los alimentos que se carguen de USDA desde ahora; los ya guardados no se tocan.
5. **Alimentos sin catálogo** (escáner IA, manual, borrados) y **alimentos «sin configurar»** se sumaban como 0 sin avisar; ahora cuentan como «sin dato».
6. Se suman también colesterol, grasas mono/poliinsaturadas, omega-3 ALA, omega-6 y agua (están en el informe, listos para el contador de la Fase 2).

## Unidades revisadas

| Nutriente | En la app | Estado |
|---|---|---|
| Vitamina A | mcg, USDA 320 = **RAE** | ✅ correcto |
| Folato | mcg, ahora USDA 435 = **DFE** | ✅ corregido (antes folato total) |
| Vitamina D | mcg, USDA 328 (D2+D3); 1 mcg = 40 UI | ✅ correcto (la meta de 20 mcg es de otra franja de edad: ver Fase 2) |
| Vitamina E | mg, USDA 323 = α-tocoferol | ✅ correcto (es lo que cuenta la RDA) |
| Niacina (B3) | mg, USDA 406 = niacina preformada | ⚠️ la RDA es en equivalentes de niacina (mg NE) |
| Sodio, potasio, minerales | mg; selenio, B12, K en mcg | ✅ |

## Dudosos (solo se reportan)

- **Sincronización de alimentos: corregida en el código; falta aplicar la migración 0016.** Antes, si un alimento existía en los dos lados, ganaba el remoto **entero** (`mergeById`) y se perdían el perfil cocido, `verificado`, grasas mono/poliinsaturadas, omega, agua, ceniza, etc. Ahora la fusión es **campo por campo** (`src/lib/sync/food-sync-map.ts`): un dato que solo está de un lado se conserva, nunca se pisa uno local con uno remoto vacío, en un conflicto gana el lado con `actualizadoEn` más nuevo, un 0 es un dato y la fusión sube lo que el servidor no tenía. Si las columnas aún no existen, la escritura se reintenta sin ellas (aviso solo en desarrollo) y no se pierde nada local. Nada en el código pone `verificado` en verdadero. Los alimentos base editados (override con id de texto, no uuid) **siguen siendo solo locales**.
- **Editar un alimento cambia el pasado.** Como `LoggedFood` no guarda micronutrientes, corregir un alimento recalcula también los días ya registrados.
- **Ingredientes de receta sin estado crudo/cocido.** Al registrar una receta, cada ingrediente entra con los macros de la receta pero sin `cookedState`: los micronutrientes se calculan como crudo aunque los macros vengan de un cocido.
- **Redondeos.** Cada entrada se redondea a 2 decimales y las kcal a enteros antes de sumar; la suma del día puede diferir en ±1–2 kcal de calcular todo junto. Sin impacto práctico.
- **Doble conteo.** No se encontró: las recetas se registran como sus ingredientes (con `recipeId`), no como un plato más sus ingredientes.
- **Azúcares añadidos.** USDA no los trae en SR Legacy/Foundation; solo existen si se escriben a mano.
