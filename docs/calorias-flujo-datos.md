# Calorías: de dónde sale cada número del contador

Auditoría del flujo **formulario de verificación → alimento → entrada del día → contador** (estado del código al 2026-10-08).

```
crear-alimento (formulario)  →  Food (crudo + cocido opcional)  →  LoggedFood (solo kcal y 3 macros)  →  contador
   buildProfileFromForm          customFoods / BASE_FOODS            guarda gramos + cookedState          nutrientDayReport()
```

- `LoggedFood` **solo guarda calorías, proteína, carbos y grasas**. Todo lo demás (fibra, sodio, vitaminas…) se recalcula al mostrar el contador desde el alimento del catálogo, escalado por los gramos y el estado (crudo/cocido) de la entrada. Consecuencia: si editas un alimento después, el día pasado cambia con él (ver «Dudosos»).
- Una entrada sin alimento en el catálogo (`scan-…`, `manual-…`, alimento borrado) o con un alimento «sin configurar» no aporta ningún nutriente de detalle: ahora cuenta como **sin dato**.

## Tabla campo → contador

Leyenda: ✅ sí · ❌ no · ⚠️ parcial. «Sync» = columna en la tabla `custom_foods` de Supabase.

| Campo (unidad) | ¿Lo pide el formulario? | ¿Se guarda? | Sync | ¿Escala por gramos? | ¿Crudo/cocido por entrada? | ¿Suma al día? | ¿Se ve en el contador? | ¿Meta / rango? |
|---|---|---|---|---|---|---|---|---|
| Calorías, proteína, carbos, grasas (kcal, g) | ✅ | ✅ (también en cada `LoggedFood`) | ✅ | ✅ | ✅ (se guardan ya con el estado elegido) | ✅ | ✅ | meta de kcal y de macros del usuario |
| Grasas saturadas (g) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido: antes siempre crudo)* | ✅ | ✅ A limitar | 20 g fijo |
| Grasas trans (g) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido)* | ✅ | ✅ A limitar | 2 g fijo |
| Grasas mono / poliinsaturadas (g) | ✅ | ✅ | ❌ **no se sincroniza** | ✅ | ✅ | ✅ *(antes no)* | ❌ | — |
| Omega-3 ALA, omega-6 linoleico (g) | ✅ | ✅ | ❌ **no se sincroniza** | ✅ | ✅ | ✅ *(antes no)* | ❌ | — |
| Colesterol (mg) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ *(antes no)* | ❌ | — |
| Sodio (mg) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido)* | ✅ | ✅ A limitar | 2300 mg fijo |
| Fibra (g) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido)* | ✅ | ✅ Principales | 28 g fijo |
| Azúcares (g) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido)* | ✅ | ✅ Otros | 50 g fijo |
| Azúcares añadidos (g) | ✅ | ✅ | ✅ | ✅ | ✅ *(corregido)* | ✅ | ✅ A limitar | 25 g fijo |
| Agua (g) | ✅ | ✅ | ❌ **no se sincroniza** | ✅ | ✅ | ✅ *(antes no)* | ❌ | — |
| Ceniza (g) | ✅ | ✅ | ❌ **no se sincroniza** | ✅ | ✅ | — (no es un nutriente que sumar) | ❌ | — |
| Carbs netos (g) | derivado: carbos − fibra | — | — | ✅ | ✅ | ✅ | ✅ Otros | 150 g fijo |
| Vitaminas A, B1, B2, B3, B5, B6, B12, C, D, E, K, folato | ✅ | ✅ (`micronutrientes`) | ✅ (JSON) | ✅ | ✅ *(corregido)* | ✅ | ✅ Micronutrientes | un valor adulto fijo, sin sexo ni edad |
| Colina (mg) | ✅ | ✅ | ✅ (JSON) | ✅ | ✅ | ✅ | ❌ | — |
| Minerales: calcio, hierro, magnesio, fósforo, potasio, zinc, selenio, cobre, manganeso | ✅ | ✅ | ✅ (JSON) | ✅ | ✅ *(corregido)* | ✅ | ✅ Micronutrientes | un valor adulto fijo, sin sexo ni edad |
| Alcohol (g) | ❌ **no existe en el esquema** | — | — | — | — | — | ✅ aparece en «Otros» | 0 |
| **Perfil «cocido» completo** | ✅ (segundo paso) | ✅ | ❌ **no se sincroniza** | ✅ | — | — | — | — |

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

- **Sincronización de alimentos incompleta.** La tabla `custom_foods` solo tiene columnas para parte del perfil: **no viajan** grasas mono/poliinsaturadas, omega-3/6, agua, ceniza, el perfil **cocido** completo, `verificado`, `configurado`, `estadoDefault`, `unSoloEstado` ni `fdcIdCrudo`. Al iniciar sesión en otro dispositivo un alimento verificado pierde su cocido. Arreglarlo exige una migración (borrador: `supabase/migrations/0016_custom_foods_full_profile.sql`, **no aplicada**) y cambiar `foodToRow`/`rowToFood`; si el código escribiera la columna antes de aplicarla, los inserts fallarían en silencio, así que no se cambió el código.
- **Editar un alimento cambia el pasado.** Como `LoggedFood` no guarda micronutrientes, corregir un alimento recalcula también los días ya registrados.
- **Ingredientes de receta sin estado crudo/cocido.** Al registrar una receta, cada ingrediente entra con los macros de la receta pero sin `cookedState`: los micronutrientes se calculan como crudo aunque los macros vengan de un cocido.
- **Redondeos.** Cada entrada se redondea a 2 decimales y las kcal a enteros antes de sumar; la suma del día puede diferir en ±1–2 kcal de calcular todo junto. Sin impacto práctico.
- **Doble conteo.** No se encontró: las recetas se registran como sus ingredientes (con `recipeId`), no como un plato más sus ingredientes.
- **Azúcares añadidos.** USDA no los trae en SR Legacy/Foundation; solo existen si se escriben a mano.
