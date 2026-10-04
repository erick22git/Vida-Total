# Rangos de entrenamiento — fuentes, método y límites

Archivos: `src/lib/gym/rank-config.ts` (nombres, orden, colores, grupos), `rank-standards.ts` (datos editables),
`rank-engine.ts` (cálculo puro), `use-rank.ts` (hooks). Prueba: `node tools/3d/verify/run_ts.mjs tools/3d/verify/rank_engine_test.ts`.

## Fuente de los estándares

**Strength Level** — <https://strengthlevel.com/strength-standards> (tablas por ejercicio, consultadas el 4-oct-2026).
Son estándares empíricos construidos con levantamientos reales de usuarios (p. ej. press de banca: 9 906 475
resultados masculinos y 1 017 062 femeninos entre 2015 y 2026). Cada nivel se define por percentil de levantadores:

| Nivel | Significado |
|---|---|
| Principiante | más fuerte que el 5 % |
| Novato | 20 % |
| Intermedio | 50 % |
| Avanzado | 80 % |
| Élite | 95 % |

Ejercicios con tabla propia usados (≈ 40): press de banca (barra y mancuernas), press inclinado, sentadilla (trasera y
frontal), peso muerto (convencional y rumano), press militar (barra y mancuernas), remo (barra, mancuerna, polea),
jalón, dominadas, fondos, flexiones, curls (barra, mancuernas, martillo, predicador), tríceps en polea, prensa,
extensión de cuádriceps, curl femoral, zancadas, hip thrust, elevación de talones sentado, aducción/abducción de cadera,
crunch en polea, elevación de piernas colgado, hiperextensiones, aperturas, cruces, face pull, elevaciones laterales,
pájaros y encogimientos.

**Qué se guardó de cada tabla:** solo 3 pesos corporales por sexo (hombres 60 / 80 / 100 kg; mujeres 50 / 65 / 80 kg) con
los cinco percentiles. Entre esos puntos se interpola el cociente levantado / peso corporal; fuera de ellos se mantiene el
cociente del extremo. No es una copia de las tablas completas.

**Contraste (fuentes secundarias consultadas, no usadas como datos):** [Arvo — strength standards](https://arvo.guru/resources/strength-standards),
[FitnessVolt — bodyweight ratio](https://fitnessvolt.com/strength-standards/bodyweight-ratio/) y
[Symmetric Strength — about](https://symmetricstrength.com/about) coinciden en el enfoque (relación 1RM / peso corporal con niveles
de Principiante a Élite). Symmetric Strength basa sus tablas en récords de powerlifting, por eso es más exigente que Strength Level;
no se usó para los números porque sus tablas no se pudieron leer en el sitio.

## 1RM y límite de repeticiones

Epley: `1RM = peso × (1 + reps / 30)`; con 1 repetición el 1RM es el peso. Epley es más exacto con 1–6 repeticiones y
sobreestima un 10–15 % por encima de 10 ([FitnessVolt — fórmulas de e1RM](https://fitnessvolt.com/rpe-training/compare/e1rm-formulas/)).
Por eso las repeticiones se **topan en 12** (`REPS_CAP`) y la app avisa cuando una serie pasa de ese tope.
Los ejercicios de peso corporal (dominadas, fondos, flexiones, hiperextensiones, elevación de piernas) comparan las repeticiones máximas
de una serie. Las series de calentamiento y las no completadas no cuentan.

## De percentil a rango

El valor se convierte a percentil asumiendo una distribución normal entre los cinco puntos del estándar (interpolación
lineal en la escala z; fuera de P5–P95 se extrapola con la pendiente del tramo extremo, con tope de z = ±3).
Los rangos son los 9 de la pirámide original (`topPct`), con el percentil de inicio = 100 − topPct:

Hierro 0 · Cobre 21 · Plata 40 · Oro 56 · Platino 69 · Esmeralda 80 · Diamante 89 · Campeón 95 · Simétrico 99.

Cada rango se divide en tres niveles iguales (I, II, III); Simétrico no tiene niveles. Puntaje numérico: `tier × 3 + nivel`
(Hierro I = 0 … Campeón III = 23, Simétrico = 24). *Cobre reemplaza a Bronce* por decisión del usuario.

## Agregación

- **Músculo** (categoría del dataset) = promedio del puntaje de sus **3 mejores** ejercicios con rango. Así un ejercicio flojo no
  te castiga y no hace falta haberlos hecho todos.
- **Grupo** (Brazos, Piernas, Espalda, Pecho, Glúteos, Abdomen, Hombros y cuello) = promedio de los músculos con datos.
- **General** = promedio de los grupos con datos.
- Sin datos = sin rango (gris); nunca se inventa. El usuario puede sacar un ejercicio del rango global (sigue teniendo su rango,
  pero no suma a músculo/grupo/general). Cardio no cuenta.

## Ejercicios estimados (sin tabla propia)

`DERIVED` en `rank-standards.ts` lista ~45 ejercicios que se derivan de uno de referencia con un factor
(`valor_equivalente = valor_levantado / factor`). Los factores son **supuestos editables** (p. ej. press cerrado 0.85 del press
de banca); solo el 0.89 de las mancuernas inclinadas sale de las propias tablas (inclinado / plano, hombres 80 kg, nivel
intermedio: 87 / 98). En la app se marcan como «estimado».

## Límites conocidos

- Los estándares son de usuarios de una app (más fuertes que el promedio de la población, pero menos que atletas de competencia).
- Antebrazo y varios ejercicios de abdomen y glúteos de peso corporal no tienen estándar: esos músculos pueden quedar sin rango.
- Mancuernas: se asume que la app registra el peso de **una** mancuerna (así está la tabla).
- Prueba de calibración con datos reales del usuario (press de pecho 60 kg × 10 → Esmeralda II; peso muerto 100 kg × 10 →
  Diamante I en otra app): **pendiente** — faltan su peso corporal y el ejercicio exacto. Está como TODO comentado en
  `tools/3d/verify/rank_engine_test.ts`. Servirá solo como chequeo de orden de magnitud, no para clonar otras tablas.
