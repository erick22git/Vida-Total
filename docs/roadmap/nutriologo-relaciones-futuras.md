# Roadmap: relaciones futuras del nutriólogo (NO implementado)

Este documento es solo una nota de diseño para cuando esos módulos (Piel/Dermatólogo, Sueño) existan.
**No crea pantallas, tablas ni código de ninguno de los dos.** Se retoma recién cuando el usuario lo pida
explícitamente, igual que el roadmap de visión por cámara de Entrenamiento
(`docs/roadmap/vision-entrenador.md`).

## 1. Relación con un futuro módulo de Piel/Dermatólogo

**Qué dato nutricional ya existe hoy y podría compartirse**, sin tocar nada del lado de piel:

- **Hidratación** (`aguaTotal`/`aguaBebidas` en `nutrient-targets.ts`, ya citado en `docs/ciencia-nutricion.md`):
  la piel es uno de los tejidos donde la hidratación insuficiente sostenida es un patrón relevante —
  el nutriólogo ya puede detectar "X de Y días por debajo de la AI de agua" con el mismo motor de
  diagnóstico (`diagnose()`), sin ningún cambio.
- **Omega-3** (`omega3Ala`, `epaDha` en `nutrient-targets.ts`): ya trackeado y diagnosticable igual que
  cualquier otro nutriente de la lista `MICRO_REFS`.
- **Vitamina A** (`vitaminaA`): ya en `MICRO_REFS`, con su RDA y su UL (el exceso de vitamina A preformada
  también es relevante para piel, y el UL ya está cargado — ver nota existente sobre "mcg RAE" en
  `nutrient-reference-data.ts`).
- **Zinc** (`zinc`): ya en `MICRO_REFS`.

**Cómo se compartiría, en teoría, sin inventar nada nuevo:** un futuro módulo de Piel podría leer
`diagnose()` filtrado a esos 4 nutrientes (hidratación, omega-3, vitamina A, zinc) y mostrar "tu nutriólogo
detectó esto" como contexto, en vez de que el módulo de piel reimplemente su propio tracking de estos
mismos nutrientes. Esto es solo una posibilidad de diseño — **no se decidió ninguna interfaz real entre
módulos**, porque el módulo de piel no existe todavía y cualquier contrato que se defina ahora sería
especulativo.

**Qué NO se puede asumir:** un patrón de ingesta bajo en estos nutrientes no implica una relación causal
con ningún problema de piel específico — eso requeriría literatura dermatológica que este trabajo no
revisó (fuera de alcance de una nota de diseño). Cuando el módulo de piel exista, su propia tanda de
trabajo debería traer esa revisión, no asumirla acá.

## 2. Relación con un futuro módulo de Sueño

**Cómo el sueño afectaría la evaluación del nutriólogo** (solo nota de diseño, nada implementado):

- **Adherencia al registro** (`evaluate().adherenciaRegistro`): es conocido informalmente que la falta de
  sueño se asocia con menor consistencia en hábitos de registro en general — si existiera un dato de
  sueño, el nutriólogo podría, en teoría, mostrar esa correlación junto a la adherencia ya calculada, en
  vez de limitarse a reportar el número de días con registro sin contexto.
- **Apetito y patrones de ingesta**: la pantalla de síntomas (Fase 3, `symptom-correlation.ts`) ya tiene el
  mecanismo genérico de correlación de conteo — si en el futuro se registrara "dormí mal" como un dato
  más, en teoría podría alimentar el mismo motor de correlación (`correlateSymptom`) sin cambiar su forma,
  tratando "dormí mal" como un síntoma más de la lista. Esto es una posibilidad de reuso, no una decisión
  tomada: el motor actual está tipado a `SymptomKind` (hinchazón, dolor de estómago, fatiga, dolor de
  cabeza, otro) y habría que decidir si "dormí mal" entra ahí o si el módulo de Sueño necesita su propio
  tipo de evento — esa decisión le corresponde a la tanda de trabajo que cree el módulo de Sueño.
- **Recuperación y entrenamiento**: `hypertrophy-engine.ts` (motor de Entrenamiento) ya tiene su propio
  concepto de meseta/deload; un futuro módulo de Sueño podría, en teoría, alimentar ese motor con datos de
  recuperación real en vez de solo el patrón de 1RM — pero esto es una relación Sueño↔Entrenamiento, no
  Sueño↔Nutriólogo, y se menciona acá solo porque las tres áreas (nutrición, sueño, entrenamiento) suelen
  presentarse juntas en apps de este estilo.

**Qué NO se puede asumir:** no hay ninguna fuente citada en este documento sobre la magnitud de estas
relaciones (sueño→adherencia, sueño→apetito) — son asociaciones de sentido común ampliamente conocidas en
la literatura de salud general, no algo que este trabajo investigó con una fuente primaria. Cuando el
módulo de Sueño se diseñe de verdad, esa tanda de trabajo debería traer sus propias fuentes si quiere
afirmar una relación cuantitativa, no heredar esta nota como si fuera una.

## Qué falta decidir cuando se retome cualquiera de los dos

1. Si el módulo de Piel o el de Sueño leen directamente los motores puros existentes (`nutrition-care-engine.ts`,
   `symptom-correlation.ts`) o si necesitan su propio motor — depende de cuánto se parezca su dominio al de
   nutrición, algo que no se puede decidir sin diseñar ese módulo primero.
2. Si hace falta algún campo nuevo en el store (ej. `skinEntries`, `sleepEntries`) con el mismo patrón de
   array-por-fecha que ya usan `bodyCompositionHistory`/`symptomEntries` — probable, pero no se crea acá.
3. Ninguna tabla de Supabase, ninguna pantalla, ningún tipo nuevo se agrega hasta que el usuario pida
   específicamente retomar alguno de los dos módulos.
