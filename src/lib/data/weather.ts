import type { WeatherCondition, WeatherDay } from "@/lib/types/outfit";

/**
 * MOCK DE CLIMA — reemplazar por una llamada a una API real (ej. OpenWeather)
 * cuando el backend esté disponible. Mientras tanto genera un pronóstico
 * determinístico por fecha usando un PRNG con seed derivado del día,
 * así el resultado no cambia entre renders ni recargas.
 */

// PRNG mulberry32: rápido, determinístico, suficiente para un mock.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDate(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

const CONDITIONS: { condition: WeatherCondition; icon: string }[] = [
  { condition: "soleado", icon: "Sun" },
  { condition: "nublado", icon: "Cloud" },
  { condition: "lluvioso", icon: "CloudRain" },
  { condition: "nevado", icon: "Snowflake" },
  { condition: "ventoso", icon: "Wind" },
];

/**
 * Devuelve un rango de temperatura y pesos de condición coherentes con la
 * temporada del hemisferio sur (donde diciembre-marzo es verano) según el mes.
 */
function seasonProfile(month: number): { min: number; max: number; weights: number[] } {
  // month: 0-11
  const isSummer = month === 11 || month <= 1; // dic, ene, feb
  const isWinter = month >= 5 && month <= 7; // jun, jul, ago

  if (isSummer) {
    // cálido, mayormente soleado
    return { min: 20, max: 28, weights: [0.55, 0.2, 0.1, 0, 0.15] };
  }
  if (isWinter) {
    // frío, más nublado/lluvioso
    return { min: 10, max: 17, weights: [0.15, 0.3, 0.3, 0.05, 0.2] };
  }
  // otoño/primavera: templado
  return { min: 14, max: 23, weights: [0.3, 0.3, 0.2, 0, 0.2] };
}

function pickWeighted(rand: number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let target = rand * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i];
    if (target <= 0) return i;
  }
  return weights.length - 1;
}

export function getWeatherForDate(date: Date): WeatherDay {
  const seed = seedFromDate(date);
  const rand = mulberry32(seed);
  const { min, max, weights } = seasonProfile(date.getMonth());

  const tempRand = rand();
  const temp = Math.round(min + tempRand * (max - min));

  const conditionIndex = pickWeighted(rand(), weights);
  const { condition, icon } = CONDITIONS[conditionIndex];

  return {
    date: date.toISOString().slice(0, 10),
    temp,
    condition,
    icon,
  };
}

export function getWeeklyForecast(startDate: Date): WeatherDay[] {
  const days: WeatherDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(getWeatherForDate(d));
  }
  return days;
}
