# Ciencia detrás del motor de hipertrofia (Entrenamiento)

Valores de referencia para adultos sanos que entrenan con pesas; **no es asesoría médica ni de un entrenador certificado**. Consultado el **2026-10-14**. Los números están en `src/lib/training/hypertrophy-engine.ts`, las pruebas en `tools/gym/hypertrophy_engine_test.ts`.

## Fuentes

| Qué | Fuente | Enlace | Fecha de consulta |
|---|---|---|---|
| Marco general MEV/MAV/MRV (landmarks de volumen) | Renaissance Periodization (Dr. Mike Israetel), *Training Volume Landmarks for Muscle Growth* | [rpstrength.com/training-volume-landmarks-muscle-growth](https://rpstrength.com/training-volume-landmarks-muscle-growth/) | 2026-10-14 |
| Pecho: MV ≈ 4, rango semanal 6–16 sets, mínimo 6 para intermedios/avanzados | RP, guía de pecho | [rpstrength.com/chest-training-tips-hypertrophy](https://rpstrength.com/chest-training-tips-hypertrophy/) | 2026-10-14 |
| Antebrazo: MV 0–4, MEV 0–8, MAV 8–24, MRV 24–30 (calibrado para intermedios "serios") | RP, guía de antebrazo | [rpstrength.com/expert-advice/forearm-growth-training-tips](https://rpstrength.com/expert-advice/forearm-growth-training-tips) | 2026-10-14 |
| Abdomen: MEV ≈ 0 sets directos (los compuestos ya estimulan el core); se necesita trabajo directo para crecimiento más rápido | RP, centro de ayuda + guía de abdomen | [help.rpstrength.com/.../Abs](https://help.rpstrength.com/hc/en-us/articles/32433381453463-Abs) · [rpstrength.com/ab-training](https://rpstrength.com/ab-training/) | 2026-10-14 |
| Glúteos: MEV ≈ 0 de trabajo directo (reciben estímulo indirecto de cuádriceps/femoral); problemas de recuperación reportados por encima de ~12 sets/semana directos | RP, centro de ayuda de glúteos | [help.rpstrength.com/.../Glutes](https://help.rpstrength.com/hc/en-us/articles/32433132961431-Glutes) | 2026-10-14 |
| Tríceps: MRV ≈ 18 sets/semana (solo trabajo directo) | RP, artículo de landmarks (ejemplo citado en el texto) | [rpstrength.com/training-volume-landmarks-muscle-growth](https://rpstrength.com/training-volume-landmarks-muscle-growth/) | 2026-10-14 |
| Estimación de 1RM a partir de peso × reps | Epley, B. (1985), fórmula de uso extendido en programación de fuerza: `1RM ≈ peso × (1 + reps/30)` | fórmula estándar, sin DOI/enlace accesible de la publicación original de 1985 — se usa tal como aparece en todos los textos de programación de fuerza modernos | — |
| Validez del RIR (repeticiones en reserva) para autorregular la intensidad | Helms, E. R. et al. (2016), *Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training*, Strength Cond J 38(4) | [doi:10.1519/SSC.0000000000000218](https://doi.org/10.1519/SSC.0000000000000218) | 2026-10-14 |
| Método de conteo de series fraccionadas (directo ×1, indirecto ×0.5) para volumen por grupo muscular | Pelland et al., *Sports Medicine* | doi:10.1007/s40279-025-02344-w (ya citado en `muscle-participation.ts`, reutilizado acá sin cambios) | ya citado en el repo |

### Lo que NO pude confirmar en la fuente primaria de RP

RP **no publica una tabla única con los 4 landmarks (MV/MEV/MAV/MRV) de los 14 grupos musculares en una sola página** — cada músculo tiene su propia guía larga en prosa, y varias de esas páginas (sobre todo la landing "Training Volume Landmarks") están renderizadas con JavaScript y no entregaron el cuerpo completo al intentar leerlas. Para los músculos donde no encontré la cifra exacta de RP citada arriba, usé la tabla de **arvo.guru** (`arvo.guru/resources/volume-landmarks`, consultado 2026-10-14), que se autodescribe como **"population averages based on research and coaching data from Renaissance Periodization"** — es decir, es un resumen de tercero, no la tabla oficial palabra por palabra de RP. La marco explícitamente como **convención de la industria derivada de RP, no la cifra exacta publicada por RP**, tal como se pidió. Los valores de tríceps (MRV ~14–18 en esa tabla) son coherentes con el MRV 18 que sí confirmé en la fuente primaria, lo que da algo de confianza cruzada, pero no es una verificación exhaustiva músculo por músculo.

## Tabla de landmarks (sets/semana, trabajo DIRECTO solamente — no cuenta el estímulo indirecto de `muscleParticipation`)

Calibrada para nivel **intermedio** (así la documenta RP para antebrazo: "landmarks para levantadores serios e intermedios... los principiantes tienen landmarks sustancialmente más bajos"). Los multiplicadores de principiante/avanzado están en la sección siguiente.

| `MuscleGroup` de la app | MEV | MAV | MRV | Fuente |
|---|---|---|---|---|
| Pecho | 6 | 12–18 | 22 | RP (rango semanal 6–16 de la guía propia) + arvo.guru para MAV/MRV — **mixta, ver nota** |
| Espalda | 8 | 14–20 | 24 | arvo.guru (convención, no tabla oficial de RP) |
| Hombros | 6 | 12–16 | 21 | arvo.guru (convención) |
| Biceps | 5 | 10–14 | 18 | arvo.guru (convención) |
| Triceps | 5 | 10–12 | 18 | arvo.guru (convención) + MRV 18 confirmado en fuente primaria RP |
| Antebrazo | 0 | 8–24 | 27 | **RP, fuente primaria** (rango real 0–4 / 0–8 / 8–24 / 24–30; se usa el punto medio de cada rango) |
| Cuadriceps | 7 | 12–18 | 22 | arvo.guru (convención) |
| Femoral | 5 | 10–14 | 18 | arvo.guru (convención) |
| Pantorrilla | 7 | 12–16 | 22 | arvo.guru (convención) |
| Abdomen | 0 | 8–16 | 20 | RP (MEV≈0 confirmado en fuente primaria); MAV/MRV sin cifra oficial exacta — estimación propia conservadora a partir del texto ("16-20 sets/semana una vez acostumbrado", de una copia secundaria no verificable — **flag: menos confiable que el resto de la tabla**) |
| Gluteos | 0 | 6–12 | 14 | RP (MEV≈0 de trabajo directo, "problemas de recuperación por encima de ~12" — fuente primaria); MAV estimación propia entre MEV y el techo de recuperación reportado |
| Abductores | — | — | — | **Sin landmarks publicados por RP ni por fuentes secundarias revisadas** — no es un grupo que la literatura de hipertrofia trate como objetivo de volumen directo propio (el estímulo es indirecto, vía compuestos de cadera/pierna). El motor **no compara este grupo contra MEV/MAV/MRV**; solo reporta el conteo de series si se quiere ver, sin semáforo. |
| Aductores | — | — | — | Mismo caso que Abductores. |
| Cardio | — | — | — | No es un grupo de hipertrofia — el motor lo excluye explícitamente. |

**Por qué Pecho es "mixta":** la guía propia de pecho de RP da un rango semanal total de 6–16 sets (no landmarks separados), mientras que el artículo general de landmarks no da cifras de pecho. Para no inventar, se usó el **MEV 6** y el **techo superior 16** directamente de la fuente primaria de RP, y se tomó el MAV/MRV de la tabla de arvo.guru solo para tener un punto medio y techo razonable — es la única fila de la tabla que mezcla ambas fuentes; se documenta acá para que quede claro, no se oculta en el código.

## Ajuste por experiencia (convención propia — ninguna fuente da un multiplicador numérico)

RP dice cualitativamente que el MEV sube con la experiencia mientras el MV se mantiene parecido, y que los avanzados toleran (y necesitan) más volumen antes de rendimientos decrecientes — pero **no publica un factor numérico**. Para no dejar la tabla de intermedios aplicada tal cual a principiantes y avanzados, se definió esta escala, explícita como convención:

| Nivel | MEV | MAV | MRV |
|---|---|---|---|
| Principiante | × 0.7 | × 0.7 | × 0.75 |
| Intermedio | × 1.0 (tabla base) | × 1.0 | × 1.0 |
| Avanzado | × 1.0 | × 1.1 | × 1.2 |

**Mapeo de `GymProfile.experiencia` (4 buckets ya existentes en el perfil) a estos 3 niveles** (decisión propia, documentada por si se quiere ajustar): `menos_6m` y `6m_2a` → **principiante** (menos de 2 años); `2_5a` → **intermedio**; `mas_5a` → **avanzado**. Es el corte más común en programación de fuerza (principiante < 2 años, intermedio 2-5, avanzado 5+), pero no hay una fuente DRI-equivalente para esto — es convención.

## Estado semanal de volumen por grupo muscular (semáforo)

Mismo patrón que `calorie-state.ts`: un estado discreto + mapa de colores + una función pura, un solo lugar decide.

- **`bajo`** (series/semana < MEV): amarillo — por debajo del mínimo para progreso medible.
- **`enRango`** (MEV ≤ series < MAV): verde — rango de mejor retorno.
- **`cercaLimite`** (MAV ≤ series < MRV): naranja — sigue produciendo pero acercándose al techo de recuperación.
- **`excedido`** (series ≥ MRV): rojo — por encima del máximo recuperable estimado.

## RIR y decisión de peso (convención propia, usando RIR como herramienta de autorregulación ya validada en la literatura — ver Helms et al. arriba)

No hay una norma única de "a tal RIR promedio, subí X kg" — es una decisión de programación. Convención usada acá, documentada para que se pueda ajustar:

- RIR promedio de la serie ≥ 3 (y se completaron las reps objetivo): **subir peso** la próxima sesión — se dejó demasiado en el tanque.
- RIR promedio 1–2 (y se completaron las reps objetivo): **mantener** — en el rango de esfuerzo esperado.
- RIR 0 y se completaron las reps objetivo: **mantener** — al borde pero sin fallar, es la zona de esfuerzo alto esperado en RP (0-4 RIR en la mayoría de los sets).
- RIR 0 (o `tipo: "fallo"`) y NO se completaron las reps objetivo: **bajar peso** — la carga superó la capacidad real ese día.

## Progresión de mesociclo y detección de meseta

- **Arranca en MEV**, suma series semana a semana (convención: **+1 serie por grupo muscular por semana**, sin fuente numérica específica más allá del principio general de RP de progresión gradual) hacia MAV.
- **Deload** (vuelve a MV, aproximado acá como MEV ya que la tabla no tiene MV separado para todos los grupos) cuando: el volumen de la semana alcanza o supera el MRV del grupo, **o** se detecta meseta.
- **Meseta**: el 1RM estimado (Epley) de un ejercicio no sube en **3 sesiones consecutivas** de ese ejercicio (umbral propio, no de una fuente — documentado como tal en el código).

## Tipo de serie real y su efecto en el motor (sesión de "tipo de serie")

**Dropset y volumen semanal** (`DROPSET_VOLUME_MULTIPLIER = 1.5` en `hypertrophy-engine.ts`): no encontré
una cifra exacta de Israetel/RP ni de Schoenfeld para cuánto "vale" un dropset en el conteo de volumen.
Lo que sí hay: la revisión sistemática de Brookbush Institute sobre dropsets
([brookbushinstitute.com/articles/drop-sets-comprehensive-systematic-review-and-training-recommendations](https://brookbushinstitute.com/articles/drop-sets-comprehensive-systematic-review-and-training-recommendations),
consultado 2026-10-14) describe el estímulo de un dropset como equivalente a **~2-3 series
convencionales**, pero señala que convencionalmente se cuenta como **una sola serie** porque no hay
descanso entre bajadas. Dos meta-análisis con volumen equiparado — Coleman et al. 2022 (co-autor
Schoenfeld) y Sødal et al. 2023 — encontraron hipertrofia similar entre dropsets y series tradicionales
cuando el volumen total se iguala, lo que sugiere que contar cada bajada como una serie completa aparte
inflaría el volumen sin evidencia que lo respalde. **1.5 es un punto medio razonado** entre "cuenta como
1" (la convención más conservadora, sin descanso entre bajadas) y "cuenta como 2-3" (el estímulo
observado) — **no es un número de la literatura**, es la decisión de este proyecto ante la falta de una
cifra exacta.

**Series al fallo y autorregulación** (`HIGH_FAILURE_RATIO_THRESHOLD = 0.4` en `weeklyFailureLoad`):
convención propia, sin una cifra de la literatura para este umbral específico. La idea general — que
demasiadas series al fallo acumulan más fatiga de la que compensa el estímulo extra — está bien
establecida en la literatura de autorregulación (de ahí viene el uso de RIR en primer lugar, Helms et
al. 2016, ya citado arriba), pero el corte exacto de "40% de las series de la semana" es una decisión de
este proyecto, no una cifra publicada. El Coach usa esto para sugerir adelantar el deload además de
(no en vez de) la detección de meseta por 1RM estancado, que tarda varias sesiones en notarse.

**Notas de "mala técnica"** (`TECHNIQUE_WARNING_MIN_NOTES = 2` en `recentTechniqueWarnings`): convención
propia — 2 o más notas en las últimas 5 sesiones de ESE ejercicio (no de cualquier sesión) cuentan como
"técnica irregular" y generan un aviso en el Coach. Es un conteo preparado a propósito para conectarse
con la visión por cámara cuando se implemente (`docs/roadmap/vision-entrenador.md`) — ese roadmap ya
señala que la detección automática de errores de forma es lo que más impacto tendría, y este conteo
manual es el mismo dato, solo que anotado a mano por ahora.

## Qué queda fuera (no implementado, documentado para revisión futura)

- Landmarks de Abductores/Aductores: no hay fuente — el motor no inventa un número, reporta "sin referencia".
- El ajuste por experiencia es una escala propia, no validada contra ningún estudio de dosis-respuesta por nivel de entrenamiento.
- El incremento de +1 serie/semana es una convención de programación común, no una cifra de un paper específico.
