/**
 * Estándares de fuerza para los rangos — ARCHIVO DE DATOS EDITABLE.
 *
 * Fuente de los números: tablas de estándares de Strength Level (https://strengthlevel.com/strength-standards),
 * consultadas el 4-oct-2026. Se construyen con millones de levantamientos reales de usuarios (p. ej. press de
 * banca: 9.9 M de resultados masculinos y 1.0 M femeninos, 2015–2026) y definen cada nivel por percentil de
 * levantadores: Principiante = más fuerte que el 5 %, Novato 20 %, Intermedio 50 %, Avanzado 80 %, Élite 95 %.
 * De cada tabla se guardan SOLO 3 pesos corporales por sexo (hombres 60/80/100 kg, mujeres 50/65/80 kg); entre
 * esos puntos se interpola el cociente levantado/peso corporal. No es una copia de las tablas completas.
 * Detalle, método y límites: docs/rangos-fuentes.md.
 *
 * Cada estándar trae 5 valores [P5, P20, P50, P80, P95] por peso corporal. `kind`:
 *  - "kg": 1RM en kg (en mancuernas, POR mancuerna; la app registra el peso de una mancuerna).
 *  - "reps": repeticiones máximas con peso corporal (dominadas, fondos, flexiones…).
 *
 * Ejercicios sin estándar propio se derivan de uno de referencia con un factor (`DERIVED`): el valor levantado
 * se divide por el factor antes de compararlo. Los factores son SUPUESTOS (editables) y esos ejercicios se
 * muestran como "estimado". Los ejercicios que no aparecen ni acá ni en `DIRECT` no tienen rango (gris).
 */

export type Five = [number, number, number, number, number];
export type Sex = "hombre" | "mujer";
export type StandardKind = "kg" | "reps";

export interface Standard {
  id: string;
  name: string;
  kind: StandardKind;
  /** [pesoCorporalKg, [P5, P20, P50, P80, P95]] */
  hombre: [number, Five][];
  mujer: [number, Five][];
}

const M = (a: Five, b: Five, c: Five): [number, Five][] => [[60, a], [80, b], [100, c]];
const F = (a: Five, b: Five, c: Five): [number, Five][] => [[50, a], [65, b], [80, c]];

export const STANDARDS: Record<string, Standard> = {
  bench: {
    id: "bench", name: "Press de banca con barra", kind: "kg",
    hombre: M([37, 53, 72, 95, 119], [56, 75, 98, 124, 151], [73, 95, 120, 149, 179]),
    mujer: F([14, 25, 40, 58, 79], [21, 33, 50, 70, 92], [26, 40, 59, 80, 104]),
  },
  "db-bench": {
    id: "db-bench", name: "Press de banca con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([13, 20, 30, 42, 55], [19, 28, 40, 53, 68], [25, 36, 48, 63, 79]),
    mujer: F([5, 10, 16, 25, 34], [7, 13, 20, 29, 39], [9, 15, 23, 33, 44]),
  },
  "incline-bench": {
    id: "incline-bench", name: "Press inclinado con barra", kind: "kg",
    hombre: M([32, 45, 62, 82, 103], [50, 66, 87, 109, 134], [66, 86, 108, 134, 160]),
    mujer: F([11, 20, 33, 49, 67], [16, 27, 42, 60, 80], [21, 34, 50, 69, 91]),
  },
  squat: {
    id: "squat", name: "Sentadilla con barra", kind: "kg",
    hombre: M([49, 71, 98, 129, 162], [75, 101, 132, 168, 206], [98, 128, 163, 203, 244]),
    mujer: F([26, 42, 63, 88, 116], [35, 53, 76, 104, 134], [42, 62, 88, 117, 149]),
  },
  "front-squat": {
    id: "front-squat", name: "Sentadilla frontal", kind: "kg",
    hombre: M([40, 57, 79, 104, 130], [59, 79, 104, 133, 163], [76, 99, 127, 158, 190]),
    mujer: F([26, 39, 54, 72, 91], [33, 46, 63, 82, 102], [38, 53, 70, 90, 112]),
  },
  deadlift: {
    id: "deadlift", name: "Peso muerto convencional", kind: "kg",
    hombre: M([61, 86, 117, 153, 191], [89, 119, 155, 196, 239], [114, 148, 188, 232, 279]),
    mujer: F([34, 52, 76, 105, 136], [43, 64, 90, 121, 155], [52, 74, 102, 135, 170]),
  },
  rdl: {
    id: "rdl", name: "Peso muerto rumano", kind: "kg",
    hombre: M([43, 65, 93, 127, 163], [65, 92, 125, 163, 203], [85, 115, 152, 194, 238]),
    mujer: F([27, 42, 61, 84, 109], [32, 49, 69, 93, 119], [37, 54, 75, 100, 128]),
  },
  "shoulder-press": {
    id: "shoulder-press", name: "Press militar con barra", kind: "kg",
    hombre: M([21, 32, 45, 62, 79], [33, 46, 62, 81, 101], [44, 59, 77, 98, 120]),
    mujer: F([10, 17, 27, 38, 51], [14, 22, 32, 45, 59], [17, 26, 37, 51, 66]),
  },
  "db-shoulder-press": {
    id: "db-shoulder-press", name: "Press militar con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([10, 15, 23, 32, 43], [15, 22, 31, 42, 54], [20, 28, 39, 50, 63]),
    mujer: F([5, 8, 13, 18, 25], [6, 10, 15, 21, 28], [8, 12, 17, 24, 31]),
  },
  "lateral-raise": {
    id: "lateral-raise", name: "Elevaciones laterales (por mancuerna)", kind: "kg",
    hombre: M([3, 7, 13, 20, 29], [5, 10, 16, 25, 34], [7, 12, 19, 28, 39]),
    mujer: F([3, 5, 8, 12, 16], [3, 6, 9, 13, 18], [4, 6, 10, 14, 19]),
  },
  "rear-delt-fly": {
    id: "rear-delt-fly", name: "Pájaros con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([2, 6, 13, 23, 35], [3, 9, 17, 29, 42], [5, 12, 21, 34, 48]),
    mujer: F([2, 5, 9, 14, 20], [3, 6, 10, 15, 22], [3, 6, 11, 17, 23]),
  },
  "face-pull": {
    id: "face-pull", name: "Face pull", kind: "kg",
    hombre: M([10, 21, 37, 57, 80], [15, 29, 47, 69, 95], [21, 35, 55, 80, 107]),
    mujer: F([9, 17, 28, 43, 60], [11, 21, 33, 49, 67], [14, 24, 38, 54, 73]),
  },
  shrug: {
    id: "shrug", name: "Encogimientos con barra", kind: "kg",
    hombre: M([30, 55, 89, 130, 178], [53, 85, 126, 175, 230], [76, 113, 159, 214, 274]),
    mujer: F([12, 28, 51, 82, 119], [19, 39, 66, 101, 141], [27, 49, 79, 117, 159]),
  },
  row: {
    id: "row", name: "Remo con barra", kind: "kg",
    hombre: M([31, 46, 65, 87, 111], [48, 66, 88, 114, 141], [63, 84, 108, 136, 166]),
    mujer: F([15, 25, 38, 54, 72], [19, 30, 44, 62, 80], [23, 35, 50, 68, 87]),
  },
  "db-row": {
    id: "db-row", name: "Remo con mancuerna (por mancuerna)", kind: "kg",
    hombre: M([12, 21, 32, 46, 61], [19, 30, 43, 59, 76], [26, 38, 53, 70, 89]),
    mujer: F([8, 12, 19, 27, 36], [9, 15, 22, 30, 40], [11, 17, 24, 33, 43]),
  },
  "cable-row": {
    id: "cable-row", name: "Remo sentado en polea", kind: "kg",
    hombre: M([33, 49, 68, 90, 115], [47, 65, 87, 112, 140], [59, 79, 104, 131, 160]),
    mujer: F([18, 28, 41, 56, 73], [22, 34, 48, 64, 82], [26, 38, 53, 71, 89]),
  },
  "lat-pulldown": {
    id: "lat-pulldown", name: "Jalón al pecho", kind: "kg",
    hombre: M([35, 50, 69, 90, 113], [47, 64, 85, 108, 133], [57, 76, 98, 123, 150]),
    mujer: F([20, 30, 42, 56, 72], [24, 35, 47, 62, 79], [27, 38, 52, 68, 85]),
  },
  "pull-ups": {
    id: "pull-ups", name: "Dominadas", kind: "reps",
    hombre: M([0, 7, 14, 23, 33], [1, 7, 13, 21, 29], [0, 6, 11, 18, 25]),
    mujer: F([0, 0, 6, 13, 22], [0, 0, 6, 11, 19], [0, 0, 5, 10, 16]),
  },
  "back-extension": {
    id: "back-extension", name: "Hiperextensiones", kind: "reps",
    hombre: M([1, 13, 30, 48, 69], [5, 15, 29, 46, 63], [6, 15, 28, 42, 57]),
    mujer: F([4, 13, 26, 39, 54], [6, 13, 24, 36, 48], [6, 13, 22, 32, 43]),
  },
  "db-fly": {
    id: "db-fly", name: "Aperturas con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([5, 10, 18, 28, 39], [8, 15, 24, 35, 47], [11, 19, 29, 41, 54]),
    mujer: F([3, 6, 10, 16, 22], [4, 7, 12, 17, 24], [5, 8, 13, 19, 26]),
  },
  "cable-fly": {
    id: "cable-fly", name: "Cruces en polea", kind: "kg",
    hombre: M([4, 12, 26, 46, 69], [8, 19, 36, 58, 84], [13, 26, 45, 69, 98]),
    mujer: F([2, 7, 15, 26, 39], [4, 10, 19, 30, 44], [5, 12, 21, 34, 48]),
  },
  dips: {
    id: "dips", name: "Fondos en paralelas", kind: "reps",
    hombre: M([1, 10, 20, 33, 46], [3, 10, 20, 31, 42], [4, 10, 19, 28, 38]),
    mujer: F([0, 0, 9, 20, 31], [0, 2, 9, 18, 28], [0, 1, 9, 16, 25]),
  },
  "push-ups": {
    id: "push-ups", name: "Flexiones", kind: "reps",
    hombre: M([4, 19, 41, 67, 95], [6, 20, 38, 60, 84], [6, 19, 35, 54, 74]),
    mujer: F([0, 7, 19, 34, 51], [0, 7, 18, 31, 45], [0, 7, 16, 28, 40]),
  },
  "barbell-curl": {
    id: "barbell-curl", name: "Curl de bíceps con barra", kind: "kg",
    hombre: M([15, 24, 36, 50, 66], [22, 33, 46, 63, 80], [28, 40, 55, 73, 92]),
    mujer: F([6, 12, 20, 31, 43], [8, 14, 23, 34, 47], [11, 18, 28, 40, 54]),
  },
  "db-curl": {
    id: "db-curl", name: "Curl con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([6, 11, 18, 26, 36], [8, 14, 22, 32, 42], [11, 17, 26, 36, 48]),
    mujer: F([3, 6, 11, 16, 22], [4, 8, 12, 18, 25], [5, 9, 14, 20, 27]),
  },
  "hammer-curl": {
    id: "hammer-curl", name: "Curl martillo (por mancuerna)", kind: "kg",
    hombre: M([7, 12, 18, 26, 34], [11, 16, 24, 33, 42], [14, 21, 29, 39, 49]),
    mujer: F([4, 7, 11, 15, 20], [5, 8, 13, 18, 23], [6, 10, 14, 19, 25]),
  },
  "preacher-curl": {
    id: "preacher-curl", name: "Curl en banco predicador", kind: "kg",
    hombre: M([14, 23, 35, 50, 66], [20, 31, 45, 61, 78], [26, 38, 53, 70, 89]),
    mujer: F([7, 12, 20, 30, 41], [9, 16, 25, 36, 48], [12, 19, 29, 41, 54]),
  },
  pushdown: {
    id: "pushdown", name: "Extensión de tríceps en polea", kind: "kg",
    hombre: M([14, 26, 43, 64, 89], [22, 36, 56, 80, 107], [29, 46, 67, 93, 122]),
    mujer: F([7, 14, 24, 38, 53], [10, 18, 30, 44, 61], [12, 22, 34, 50, 67]),
  },
  "leg-press": {
    id: "leg-press", name: "Prensa de piernas", kind: "kg",
    hombre: M([71, 115, 173, 242, 319], [109, 162, 230, 309, 395], [144, 205, 280, 366, 460]),
    mujer: F([39, 73, 122, 183, 252], [54, 94, 148, 214, 288], [67, 111, 170, 240, 319]),
  },
  "leg-extension": {
    id: "leg-extension", name: "Extensión de cuádriceps", kind: "kg",
    hombre: M([36, 57, 85, 119, 156], [48, 72, 103, 140, 180], [58, 85, 119, 158, 201]),
    mujer: F([19, 34, 55, 80, 109], [23, 40, 62, 88, 118], [27, 44, 67, 95, 126]),
  },
  "leg-curl": {
    id: "leg-curl", name: "Curl femoral tumbado", kind: "kg",
    hombre: M([21, 34, 52, 73, 96], [30, 46, 66, 90, 116], [39, 57, 79, 105, 133]),
    mujer: F([13, 21, 32, 46, 62], [16, 26, 38, 53, 69], [19, 29, 43, 58, 75]),
  },
  "db-lunge": {
    id: "db-lunge", name: "Zancadas con mancuernas (por mancuerna)", kind: "kg",
    hombre: M([6, 13, 23, 37, 52], [10, 18, 30, 45, 62], [13, 23, 36, 52, 70]),
    mujer: F([5, 10, 17, 26, 37], [6, 11, 19, 29, 40], [7, 12, 20, 30, 42]),
  },
  "hip-thrust": {
    id: "hip-thrust", name: "Hip thrust con barra", kind: "kg",
    hombre: M([32, 63, 107, 163, 227], [56, 96, 149, 213, 285], [80, 126, 186, 257, 335]),
    mujer: F([30, 56, 92, 137, 187], [37, 66, 104, 151, 204], [43, 74, 114, 163, 218]),
  },
  "calf-raise": {
    id: "calf-raise", name: "Elevación de talones sentado", kind: "kg",
    hombre: M([20, 41, 73, 112, 158], [31, 57, 93, 138, 188], [42, 71, 111, 159, 213]),
    mujer: F([11, 29, 56, 93, 137], [15, 36, 66, 106, 152], [20, 42, 74, 116, 164]),
  },
  "hip-adduction": {
    id: "hip-adduction", name: "Aducción de cadera en máquina", kind: "kg",
    hombre: M([32, 55, 87, 126, 171], [41, 67, 102, 145, 192], [49, 78, 115, 159, 209]),
    mujer: F([19, 36, 59, 87, 120], [24, 42, 66, 96, 130], [27, 47, 73, 104, 139]),
  },
  "hip-abduction": {
    id: "hip-abduction", name: "Abducción de cadera en máquina", kind: "kg",
    hombre: M([28, 50, 79, 115, 156], [38, 63, 95, 135, 179], [47, 74, 109, 151, 197]),
    mujer: F([23, 41, 65, 93, 126], [27, 46, 71, 101, 135], [31, 50, 76, 107, 142]),
  },
  "cable-crunch": {
    id: "cable-crunch", name: "Crunch en polea alta", kind: "kg",
    hombre: M([19, 34, 56, 83, 113], [26, 44, 68, 97, 130], [32, 51, 77, 108, 143]),
    mujer: F([13, 25, 43, 64, 89], [16, 30, 49, 72, 98], [19, 34, 54, 78, 105]),
  },
  "hanging-leg-raise": {
    id: "hanging-leg-raise", name: "Elevación de piernas colgado", kind: "reps",
    hombre: M([0, 7, 17, 29, 42], [1, 9, 17, 28, 39], [2, 9, 16, 25, 35]),
    mujer: F([0, 6, 13, 24, 35], [0, 7, 14, 23, 33], [1, 7, 14, 22, 30]),
  },
};

/** Ejercicios de la app con estándar propio (id del dataset -> id del estándar). */
export const DIRECT: Record<string, string> = {
  "press-banca-barra": "bench",
  "press-banca-mancuernas": "db-bench",
  "press-inclinado-barra": "incline-bench",
  "aperturas-mancuernas": "db-fly",
  "cruces-polea": "cable-fly",
  "fondos-paralelas": "dips",
  "fondos-pecho": "dips",
  flexiones: "push-ups",
  dominadas: "pull-ups",
  "remo-barra": "row",
  "remo-mancuerna": "db-row",
  "jalon-polea": "lat-pulldown",
  "remo-sentado-polea": "cable-row",
  "peso-muerto": "deadlift",
  "peso-muerto-rumano": "rdl",
  hiperextensiones: "back-extension",
  "press-militar-barra": "shoulder-press",
  "press-militar-mancuernas": "db-shoulder-press",
  "elevaciones-laterales": "lateral-raise",
  pajaros: "rear-delt-fly",
  "face-pull": "face-pull",
  "curl-biceps-barra": "barbell-curl",
  "curl-biceps-mancuernas": "db-curl",
  "curl-martillo": "hammer-curl",
  "curl-predicador": "preacher-curl",
  "extension-triceps-polea": "pushdown",
  "sentadilla-barra": "squat",
  "sentadilla-frontal": "front-squat",
  "prensa-piernas": "leg-press",
  "extension-cuadriceps": "leg-extension",
  "curl-femoral": "leg-curl",
  zancadas: "db-lunge",
  "hip-thrust": "hip-thrust",
  "elevacion-talones-sentado": "calf-raise",
  "aduccion-cadera-maquina": "hip-adduction",
  "abduccion-cadera": "hip-abduction",
  "crunch-polea": "cable-crunch",
  "elevacion-piernas": "hanging-leg-raise",
};

/**
 * Ejercicios SIN estándar propio, derivados de uno de referencia: `factor` = cuánto de la referencia suele
 * levantarse en este ejercicio (valor_equivalente = valor_levantado / factor). SUPUESTOS editables; se muestran
 * como "estimado". El 0.89 de las mancuernas inclinadas sale de las propias tablas (inclinado/plano, hombres
 * 80 kg, nivel intermedio: 87/98).
 */
export const DERIVED: Record<string, { base: string; factor: number }> = {
  "press-inclinado-mancuernas": { base: "db-bench", factor: 0.89 },
  "press-declinado-barra": { base: "bench", factor: 1.0 },
  "press-declinado-mancuernas": { base: "db-bench", factor: 1.0 },
  "press-banca-multipower": { base: "bench", factor: 0.95 },
  "press-banca-maquina": { base: "bench", factor: 0.9 },
  "press-inclinado-multipower": { base: "incline-bench", factor: 0.95 },
  "press-banca-agarre-ancho": { base: "bench", factor: 0.95 },
  "press-cerrado": { base: "bench", factor: 0.85 },
  "flexiones-abiertas": { base: "push-ups", factor: 1.0 },
  "dominadas-supinas": { base: "pull-ups", factor: 1.0 },
  "remo-en-t": { base: "row", factor: 0.9 },
  "jalon-agarre-ancho": { base: "lat-pulldown", factor: 1.0 },
  "jalon-agarre-cerrado": { base: "lat-pulldown", factor: 1.0 },
  "jalon-agarre-v": { base: "lat-pulldown", factor: 1.0 },
  "peso-muerto-sumo": { base: "deadlift", factor: 1.0 },
  "jalones-desde-rack": { base: "deadlift", factor: 1.1 },
  "peso-muerto-piernas-rigidas": { base: "rdl", factor: 1.0 },
  "encogimientos-trapecio": { base: "shrug", factor: 0.5 },
  "press-militar-maquina": { base: "shoulder-press", factor: 0.9 },
  "press-arnold": { base: "db-shoulder-press", factor: 0.9 },
  "press-empuje": { base: "shoulder-press", factor: 1.2 },
  "press-tras-nuca": { base: "shoulder-press", factor: 0.8 },
  "elevacion-lateral-polea": { base: "lateral-raise", factor: 1.0 },
  "pajaros-polea": { base: "rear-delt-fly", factor: 1.0 },
  "curl-barra-z": { base: "barbell-curl", factor: 1.0 },
  "curl-concentrado": { base: "db-curl", factor: 0.8 },
  "curl-inclinado-mancuerna": { base: "db-curl", factor: 0.85 },
  "curl-zottman": { base: "db-curl", factor: 0.8 },
  "curl-martillo-polea": { base: "hammer-curl", factor: 1.0 },
  "curl-polea": { base: "barbell-curl", factor: 0.8 },
  "curl-arana": { base: "preacher-curl", factor: 0.8 },
  "extension-triceps-polea-cuerda": { base: "pushdown", factor: 0.9 },
  "extension-triceps-agarre-invertido": { base: "pushdown", factor: 0.7 },
  "sentadilla-hack-barra": { base: "squat", factor: 0.9 },
  "sentadilla-hack": { base: "squat", factor: 0.9 },
  "sentadilla-multipower": { base: "squat", factor: 0.9 },
  "sentadilla-al-cajon": { base: "squat", factor: 0.9 },
  "sentadilla-bulgara": { base: "db-lunge", factor: 1.0 },
  "zancada-estatica-mancuernas": { base: "db-lunge", factor: 1.0 },
  "curl-femoral-sentado": { base: "leg-curl", factor: 1.0 },
  "curl-femoral-de-pie": { base: "leg-curl", factor: 1.0 },
  "puente-gluteo-barra": { base: "hip-thrust", factor: 0.9 },
  "elevacion-talones": { base: "calf-raise", factor: 1.0 },
  "elevacion-talones-burro": { base: "calf-raise", factor: 1.0 },
};
