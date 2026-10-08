# Ciencia detrás de las metas de nutrición

Valores de referencia generales para adultos y adolescentes sanos; **no son consejo médico**. Todo lo de esta página se consultó el **2026-10-08**. Los números de las tablas están en `src/lib/nutrition/nutrient-reference-data.ts` y los cálculos en `src/lib/nutrition/nutrient-targets.ts`.

## Fuentes

| Qué | Fuente | Enlace | Fecha de la página |
|---|---|---|---|
| RDA / AI / UL de vitaminas | Dietary Reference Intakes (National Academies; EE. UU. y Canadá), tabla de Health Canada | [reference-values-vitamins](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins-dietary-reference-intakes-tables-2005.html) | 2025-11-19 |
| RDA / AI / UL de minerales, AI de potasio y sodio, **CDRR del sodio (2300 mg)** | DRI (misma fuente; sodio y potasio de la edición de 2019 de National Academies) | [reference-values-elements](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html) · informe: [Sodium and Potassium (2019)](https://www.nationalacademies.org/news/sodium-and-potassium-dietary-reference-intake-values-updated-in-new-report) | 2025-11-19 |
| Agua total, fibra (**14 g por 1000 kcal**), ALA, linoleico, proteína (**RDA 0,8 g/kg**) y **AMDR** (carbos 45–65 %, proteína 10–35 %, grasa 20–35 %, n-6 5–10 %, n-3 0,6–1,2 %) | DRI | [reference-values-macronutrients](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html) | 2025-11-19 |
| Saturadas < 10 % de la energía, trans < 1 %, azúcares libres < 10 % (idealmente < 5 %), sodio < 2 g/día, potasio ≥ 3510 mg, fibra ≥ 25 g | OMS, *Healthy diet* | [who.int/…/healthy-diet](https://www.who.int/news-room/fact-sheets/detail/healthy-diet) | 26 enero 2026 |
| Proteína en quien entrena: **1,4–2,0 g/kg/día**; 0,25 g/kg (20–40 g) por comida; 2,3–3,1 g/kg puede hacer falta en déficit calórico para conservar masa magra | ISSN, *Position Stand: protein and exercise* (Jäger et al., J Int Soc Sports Nutr 14:20, 2017) | [PMC5477153](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/) · doi:10.1186/s12970-017-0177-8 | 20 junio 2017 |
| EPA + DHA: **250 mg/día** como ingesta adecuada para adultos sanos; sin UL; hasta 5 g/día en suplementos sin preocupaciones de seguridad | EFSA | [EFSA, 27 julio 2012](https://www.efsa.europa.eu/en/press/news/120727) | 2012-07-27 |
| Piso orientativo: no bajar de **1200 kcal (mujer) / 1500 kcal (hombre)** sin supervisión | Harvard Health (fuente secundaria) | [calorie-counting-made-easy](https://www.health.harvard.edu/staying-healthy/calorie-counting-made-easy) | 2024-04-03 |

### Lo que NO pude comprobar y por qué
- **NIH Office of Dietary Supplements** y **NCBI Bookshelf** (las tablas originales de National Academies) responden con una verificación anti-bot; no la salté. Las tablas DRI las tomé de la reproducción de **Health Canada** (las DRI son un trabajo conjunto de EE. UU. y Canadá). La herramienta de lectura avisó que el diseño de algunas columnas era ambiguo: los 22 micronutrientes y los 5 rangos de edad conviene **contrastarlos una vez** con la tabla original de National Academies antes de darlos por definitivos. Las pruebas (`tools/nutrition/targets_test.ts`) fijan hoy los valores transcritos.
- **EFSA**: el dictamen completo de grasas (EFSA Journal 2010;8(3):1461) devolvió 403; usé la nota oficial de EFSA de 2012 que repite los 250 mg/día. No consulté los demás valores de referencia de EFSA.
- **Fórmulas de la meta calórica:** ya verificadas (sección «Fórmulas de la meta calórica»). Lo que sigue sin poder abrirse está listado allí.
- El **piso de calorías** no sale de una DRI: es un criterio práctico de una fuente secundaria. La app solo lo **informa**, no cambia la meta.

## Preguntas de la auditoría

**¿El cálculo actual estaba respaldado?** En parte.
- Meta calórica (Mifflin-St Jeor × actividad ± %): fórmula conocida y razonable, **sin verificar aquí** y **sin piso de seguridad documentado**. Ahora la calculadora y los ajustes avisan (sin cambiar nada) si la meta queda por debajo del piso.
- Reparto de macros: eran **tres números fijos escritos a mano** (proteína 140 g, carbos 220 g, grasas 60 g = 1980 kcal con 4/4/9) sin relación con el peso. Ahora hay una **sugerencia** que suma la meta, calcula la proteína por kg (RDA 0,8; si entrenas, punto medio del rango ISSN, 1,7 g/kg) y mantiene carbos y grasa dentro del AMDR.
- Fibra: 28 g fijos → ahora 14 g por cada 1000 kcal de tu meta. Saturadas: 20 g fijos → menos del 10 % de tu energía. Azúcares añadidos: 25 g fijos → azúcares libres < 10 % de tu energía (OMS). Sodio: 2300 mg sigue siendo correcto, pero es el **CDRR (límite)**; la AI (mínimo) es 1500 mg.
- Vitaminas y minerales: eran **un valor por nutriente mezclando sexos y edades** (vitamina D 20 mcg es el de 71+; hierro 18 es el de mujer de 19–50; magnesio 420 y B6 1,7 son de hombre mayor; potasio 3400 es de hombre). Ahora salen de las tablas por **sexo y rango de edad** del perfil, o genéricos de adulto marcados como tales.

**¿Qué necesita el cuerpo cada día que faltaba en el contador?** Colina, omega-3 (ALA) y omega-6 (linoleico) — ya están. Siguen **sin poder seguirse**: EPA + DHA (el esquema de alimentos no los tiene) y el agua total (las bebidas se llevan aparte en el registro de agua; la meta está en los datos pero el contador de comida no la muestra). El colesterol no tiene una meta numérica en las DRI, así que se suma pero no se compara.

**¿Qué falta en el formulario de verificación para alimentarlo?** EPA y DHA; (opcional) biotina, yodo, cromo, molibdeno, flúor y cloruro (tienen DRI pero no campo); alcohol (hoy aparece en «Otros» sin forma de capturarlo); y azúcares añadidos que USDA no entrega. Para niacina, la RDA es en equivalentes de niacina (mg NE) y el formulario guarda niacina preformada.

## Cómo se muestra en el contador
- Metas con su tipo: las que son **mínimos** dicen «meta»; los **topes** (sodio, saturadas, trans, azúcares añadidos) dicen «límite». Sin meta recomendada (azúcares totales, carbs netos, alcohol): «sin meta».
- Tono neutro, sin alarmas ni lenguaje de culpa; aviso fijo: «Valores de referencia generales (DRI, OMS), no consejo médico».
- **El UL no se usa para avisar por un alimento**: es un tope del *total del día* y en varias vitaminas y minerales solo de suplementos o fortificados (vitamina E, magnesio, niacina, folato…). Está en los datos como referencia y el contador no lo usa.
- Datos faltantes: «sin dato» / «datos incompletos · n de m» (ver `docs/calorias-flujo-datos.md`).
- Sin sexo y edad (o con edad menor de 14) se usan valores genéricos de adulto (el mayor de hombre/mujer entre 19 y 50 años) y el contador lo dice. Embarazo y lactancia no se contemplan: el perfil no tiene ese dato.
- **La meta calórica y los macros guardados no se tocan solos.** En *Ajustes de calorías → Revisar sugerencia de macros* se ve lo actual contra lo sugerido y solo se aplica si lo confirmas.

## Validación del formulario (avisa, no bloquea)
Calorías vs 4P+4C+9G (tolerancia 15 % o 20 kcal), fibra y azúcares ≤ carbohidratos, saturadas + trans + mono + poli ≤ grasa total, azúcares añadidos ≤ azúcares, omega-3 + omega-6 ≤ poliinsaturadas, ≤ 900 kcal por 100 g, proteína + carbos + grasa ≤ 100 g por 100 g, sodio ≤ 40 000 mg por 100 g y máximos plausibles por 100 g para cada vitamina y mineral (`src/lib/nutrition/food-validation.ts`).

## Fórmulas de la meta calórica (verificadas el 2026-10-08)

Fuentes abiertas vía [Europe PMC](https://europepmc.org) (PubMed devuelve un aviso de cookies que no se salta) y [FAO](https://www.fao.org/4/y5686e/y5686e07.htm). **No se cambió ninguna cifra**: abajo está la diferencia y la decisión queda tuya.

| Pieza | Qué usa la app | Qué dice la fuente | Veredicto |
|---|---|---|---|
| **Mifflin-St Jeor** (gasto basal) | `10·kg + 6,25·cm − 5·años + 5` (hombre) / `− 161` (mujer) | Mifflin MD, St Jeor ST y cols., *Am J Clin Nutr* 1990;51(2):241-7 ([PMID 2305711](https://pubmed.ncbi.nlm.nih.gov/2305711/)): ecuación por sexo **idéntica** (10 / 6,25 / 5 / +5 / −161) y una general `9,99·kg + 6,25·cm − 4,92·años + 166·sexo − 161`. Medida en **498 adultos de 19 a 78 años** con calorimetría indirecta. | ✅ **Coincide.** La versión por sexo difiere de la general en menos de 6 kcal/día (probado). Fuera de 19–78 años es una extrapolación: la calculadora lo avisa. |
| **«Katch-McArdle»** (con % de grasa) | `370 + 21,6 × masa libre de grasa` | La ecuación `REE = 370 + 21,6 × FFM` es de **Cunningham**, *Am J Clin Nutr* 1991;54(6):963-9 ([PMID 1957828](https://pubmed.ncbi.nlm.nih.gov/1957828/)). La anterior de Cunningham (1980, [PMID 7435418](https://pubmed.ncbi.nlm.nih.gov/7435418/)) era otra: `500 + 22 × LBM`. | ✅ **Coincide con Cunningham 1991.** El nombre «Katch-McArdle» es el que le dan los libros de fisiología del ejercicio; **no pude abrir ese libro**, así que la atribución del nombre no está verificada. La interfaz ahora dice «Cunningham / Katch-McArdle». |
| **Factores de actividad** | 1,2 · 1,375 · 1,55 · 1,725 · 1,9 | **No son de la FAO/OMS.** FAO/OMS/UNU, *Human energy requirements* (2001), [Tabla 5.3](https://www.fao.org/4/y5686e/y5686e07.htm): PAL **1,40–1,69** sedentario o ligero · **1,70–1,99** activo · **2,00–2,40** vigoroso. El 1,2 se parece al «1,21» que la FAO sugiere solo para supervivencia a corto plazo de personas totalmente inactivas y dependientes en crisis (y lo considera demasiado bajo; propone 1,40). | ⚠️ **Convención, no norma.** Diferencias abajo. |
| **% de déficit y superávit** | perder −10 / −20 / −25 % · mantener 0 / −5 % · ganar +10 / +15 / +20 % | No hay una norma con esos porcentajes. La postura de la ISSN ([Aragon et al., 2017, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)) cita estudios con un «déficit moderado» de 80 % de los requerimientos (= −20 %) y dice que los superávits grandes sirven más a principiantes y los pequeños a avanzados, **sin dar un porcentaje**. | ⚠️ **Convención.** La interfaz lo dice. |

### Diferencia de los factores de actividad con la FAO/OMS (ejemplo con un gasto basal de 1780 kcal)
| Nivel de la app | Factor | Gasto total con el factor de la app | Rango FAO que le toca | Gasto total con ese rango | Diferencia |
|---|---|---|---|---|---|
| Sedentario | 1,2 | 2136 kcal | sedentario o ligero 1,40–1,69 | 2492–3008 | **−14 % o más** por debajo del mínimo FAO |
| Ligero | 1,375 | 2448 kcal | sedentario o ligero | 2492–3008 | −2 % (casi en el límite inferior) |
| Moderado | 1,55 | 2759 kcal | la FAO lo clasificaría **sedentario o ligero** (1,55 ∈ 1,40–1,69) | 2492–3008 | dentro del rango, pero con otra etiqueta |
| Intenso | 1,725 | 3071 kcal | activo 1,70–1,99 | 3026–3542 | dentro |
| Muy intenso | 1,9 | 3382 kcal | activo 1,70–1,99 | 3026–3542 | dentro; **no hay nivel que llegue al «vigoroso» 2,00–2,40** |

Matices: el PAL de la FAO es gasto total ÷ gasto basal **con las ecuaciones de la FAO** (Schofield), no con Mifflin, y viene de estudios de agua doblemente marcada; la comparación es orientativa. Lo relevante es que, para una persona de oficina que no entrena, el 1,2 de la app **subestima** el gasto respecto de lo que la FAO considera sedentario (≥ 1,40). Cambiarlo cambia la meta calórica de todos los usuarios que usan la calculadora: por eso **no se tocó** y queda como decisión.

### Lo que no pude abrir
- **El libro de Katch y McArdle** (de donde viene el nombre de la fórmula) y su atribución exacta.
- **Guías de práctica clínica sobre ritmo de pérdida de peso** (NHLBI, AHA/ACC/TOS 2013, ACSM): NCBI Bookshelf responde con una verificación anti-bot que no salté y no abrí las otras; por eso los porcentajes de déficit/superávit quedan documentados solo como convención.
- **Tabla S-1 de agua para menores de 19 años** (NAM 2005): la proporción de bebidas (~81 %) se aplica a ellos por extensión.
