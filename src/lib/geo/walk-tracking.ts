/**
 * Caminata con GPS (pedido: registrar de dónde a dónde caminaste, como un reloj deportivo — apretar
 * empezar/parar y calcular distancia y calorías). Funciones puras: distancia por Haversine entre
 * puntos GPS, y calorías por el mismo método MET que `exercise-calorie-burn.ts`
 * (kcal ≈ MET × peso corporal (kg) × tiempo (horas)).
 *
 * MET por velocidad de caminata — Ainsworth et al., "2011 Compendium of Physical Activities" (Med Sci
 * Sports Exerc, 2011), códigos de caminata a paso llano:
 *   - código 17151, ~3.2 km/h (2.0 mph): 2.8 MET — paso lento.
 *   - código 17170, ~4.8 km/h (3.0 mph): 3.3 MET — paso normal.
 *   - código 17190, ~5.6 km/h (3.5 mph): 4.3 MET — paso rápido.
 *   - código 17200, ~6.4 km/h (4.0 mph): 5.0 MET — paso muy rápido.
 * Entre esos puntos medidos se interpola linealmente (la velocidad real casi nunca cae justo en uno
 * de ellos) — interpolación propia, documentada, no un dato adicional de la fuente.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  timestampMs: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distancia entre dos puntos GPS (fórmula de Haversine, estándar para distancias cortas en la
 * superficie terrestre). */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distancia total de una ruta: suma de los tramos entre puntos consecutivos. */
export function totalDistanceKm(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineDistanceKm(points[i - 1], points[i]);
  return total;
}

const WALK_MET_TABLE: { kmh: number; met: number }[] = [
  { kmh: 3.2, met: 2.8 },
  { kmh: 4.8, met: 3.3 },
  { kmh: 5.6, met: 4.3 },
  { kmh: 6.4, met: 5.0 },
];

/** MET de caminar a una velocidad dada (km/h), interpolando entre los puntos medidos del Compendium.
 * Por debajo del punto más lento o por encima del más rápido medido, se usa el valor del extremo más
 * cercano (no se extrapola fuera del rango con datos reales). */
export function walkingMetForSpeed(kmh: number): number {
  if (kmh <= WALK_MET_TABLE[0].kmh) return WALK_MET_TABLE[0].met;
  const last = WALK_MET_TABLE[WALK_MET_TABLE.length - 1];
  if (kmh >= last.kmh) return last.met;
  for (let i = 1; i < WALK_MET_TABLE.length; i++) {
    const prev = WALK_MET_TABLE[i - 1];
    const cur = WALK_MET_TABLE[i];
    if (kmh <= cur.kmh) {
      const t = (kmh - prev.kmh) / (cur.kmh - prev.kmh);
      return prev.met + t * (cur.met - prev.met);
    }
  }
  return last.met;
}

export interface WalkSummary {
  distanceKm: number;
  durationSeconds: number;
  avgKmh: number;
  met: number;
  kcal: number;
}

/** Resumen de una caminata ya terminada: distancia total, duración (del primer al último punto
 * registrado), velocidad promedio y calorías estimadas por el método MET. Con menos de 2 puntos no
 * hay recorrido que medir. */
export function summarizeWalk(points: GeoPoint[], pesoCorporalKg: number): WalkSummary {
  if (points.length < 2) {
    return { distanceKm: 0, durationSeconds: 0, avgKmh: 0, met: WALK_MET_TABLE[0].met, kcal: 0 };
  }
  const distanceKm = totalDistanceKm(points);
  const durationSeconds = (points[points.length - 1].timestampMs - points[0].timestampMs) / 1000;
  const hours = durationSeconds / 3600;
  const avgKmh = hours > 0 ? distanceKm / hours : 0;
  const met = walkingMetForSpeed(avgKmh);
  const kcal = pesoCorporalKg > 0 ? met * pesoCorporalKg * hours : 0;
  return {
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    durationSeconds: Math.round(durationSeconds),
    avgKmh: Math.round(avgKmh * 10) / 10,
    met: Math.round(met * 10) / 10,
    kcal: Math.round(kcal),
  };
}

// ─────────────────────────────────────────────────────────
// Quedarse quieto y puntos poco fiables
// ─────────────────────────────────────────────────────────

/** Si en los últimos `STILL_MS` no te moviste más de `STILL_RADIUS_M` (o ya no llegan puntos), la caminata se cierra sola. */
export const STILL_MS = 5 * 60 * 1000;
export const STILL_RADIUS_M = 30;
/** Un punto con precisión peor que esto (metros) se descarta: el GPS "salta" y suma distancia falsa. */
export const MAX_ACCURACY_M = 60;

/**
 * ¿Lleva quieto todo el tiempo de `STILL_MS`? Solo se evalúa cuando la caminata ya duró al menos eso.
 * Sin puntos recientes (se perdió la señal o se cerró la app) también cuenta como quieto: lo guardado hasta
 * el último punto se conserva igual al cerrar la caminata.
 */
export function isStationary(points: GeoPoint[], nowMs: number): boolean {
  if (points.length === 0) return false;
  const startedMs = points[0].timestampMs;
  if (nowMs - startedMs < STILL_MS) return false;
  const recent = points.filter((p) => nowMs - p.timestampMs <= STILL_MS);
  if (recent.length === 0) return true;
  const anchor = recent[recent.length - 1];
  return recent.every((p) => haversineDistanceKm(p, anchor) * 1000 <= STILL_RADIUS_M);
}
