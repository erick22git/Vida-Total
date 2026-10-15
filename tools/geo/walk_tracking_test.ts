// Pruebas de distancia/calorías de caminata por GPS. Ejecutar: npx tsx tools/geo/walk_tracking_test.ts
import { haversineDistanceKm, totalDistanceKm, walkingMetForSpeed, summarizeWalk, type GeoPoint } from "../../src/lib/geo/walk-tracking";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// --- Haversine: mismo punto = 0 ---
{
  const p: GeoPoint = { lat: -34.6, lng: -58.4, timestampMs: 0 };
  ok(haversineDistanceKm(p, p) === 0, "distancia de un punto a sí mismo: 0 km");
}

// --- Haversine: distancia conocida (1 grado de latitud ≈ 111 km) ---
{
  const a: GeoPoint = { lat: 0, lng: 0, timestampMs: 0 };
  const b: GeoPoint = { lat: 1, lng: 0, timestampMs: 0 };
  const d = haversineDistanceKm(a, b);
  ok(Math.abs(d - 111.19) < 0.5, `1 grado de latitud ≈ 111 km (dio ${d.toFixed(2)})`);
}

// --- distancia total de una ruta de varios puntos ---
{
  const points: GeoPoint[] = [
    { lat: 0, lng: 0, timestampMs: 0 },
    { lat: 0.001, lng: 0, timestampMs: 1000 },
    { lat: 0.002, lng: 0, timestampMs: 2000 },
  ];
  const total = totalDistanceKm(points);
  const leg = haversineDistanceKm(points[0], points[1]);
  ok(Math.abs(total - leg * 2) < 0.0001, `suma de 2 tramos iguales (dio ${total}, esperado ${leg * 2})`);
  ok(totalDistanceKm([points[0]]) === 0, "un solo punto: 0 km, nunca NaN");
}

// --- MET por velocidad: extremos y interpolación ---
{
  ok(walkingMetForSpeed(1) === 2.8, "por debajo del mínimo medido: usa el valor del extremo lento");
  ok(walkingMetForSpeed(10) === 5.0, "por encima del máximo medido: usa el valor del extremo rápido");
  const metMid = walkingMetForSpeed(4.0); // entre 3.2@2.8 y 4.8@3.3
  ok(metMid > 2.8 && metMid < 3.3, `interpola entre dos puntos medidos (dio ${metMid})`);
  ok(walkingMetForSpeed(4.8) === 3.3, "velocidad exacta de un punto medido: valor exacto");
}

// --- resumen de caminata: menos de 2 puntos ---
{
  const r = summarizeWalk([{ lat: 0, lng: 0, timestampMs: 0 }], 70);
  ok(r.distanceKm === 0 && r.kcal === 0, "con un solo punto no hay recorrido que medir");
}

// --- resumen de caminata: caso real (1km en 12 minutos ≈ 5km/h) ---
{
  const points: GeoPoint[] = [
    { lat: 0, lng: 0, timestampMs: 0 },
    { lat: 0.009, lng: 0, timestampMs: 12 * 60 * 1000 }, // ~1km, 12 min
  ];
  const r = summarizeWalk(points, 70);
  ok(Math.abs(r.distanceKm - 1.0) < 0.05, `~1km de distancia (dio ${r.distanceKm})`);
  ok(r.durationSeconds === 720, `12 minutos = 720s (dio ${r.durationSeconds})`);
  ok(r.kcal > 0, `calorías > 0 con peso válido (dio ${r.kcal})`);
}

// --- sin peso corporal: 0 kcal, nunca NaN ---
{
  const points: GeoPoint[] = [
    { lat: 0, lng: 0, timestampMs: 0 },
    { lat: 0.01, lng: 0, timestampMs: 600000 },
  ];
  ok(summarizeWalk(points, 0).kcal === 0, "sin peso corporal: 0 kcal, nunca NaN");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
