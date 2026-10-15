// Pruebas de la periodización de fases (volumen/mantenimiento/déficit). Ejecutar: npx tsx tools/gym/calorie_periodization_test.ts
import { reviewCaloriePhase, phaseFromObjetivo, VOLUME_RATE_RANGE_PCT, DEFICIT_RATE_RANGE_PCT } from "../../src/lib/gym/calorie-periodization";
import type { WeightTrendResult } from "../../src/lib/gym/calorie-adaptive";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

function trend(pctPerWeek: number | null, enoughData = true): WeightTrendResult {
  return { enoughData, weighInsPerWeek: 5, kgPerWeek: pctPerWeek === null ? null : pctPerWeek, pctPerWeek };
}

// --- fase derivada del objetivo ---
{
  ok(phaseFromObjetivo("ganar") === "volumen", "ganar -> volumen");
  ok(phaseFromObjetivo("perder") === "deficit", "perder -> deficit");
  ok(phaseFromObjetivo("mantener") === "mantenimiento", "mantener -> mantenimiento");
  ok(phaseFromObjetivo(undefined) === "mantenimiento", "sin objetivo -> mantenimiento por defecto");
}

// --- sin datos suficientes ---
{
  const r = reviewCaloriePhase("ganar", trend(null, false));
  ok(r.sinDatosSuficientes === true, "sin historial de peso: sinDatosSuficientes");
  ok(r.ajuste === null, "sin datos: no sugiere ningún ajuste");
}

// --- volumen: dentro del rango, sin ajuste ---
{
  const mid = (VOLUME_RATE_RANGE_PCT.min + VOLUME_RATE_RANGE_PCT.max) / 2;
  const r = reviewCaloriePhase("ganar", trend(mid));
  ok(r.ajuste === null, `volumen dentro de rango (${mid}%/sem): sin ajuste (dio ${r.ajuste})`);
}

// --- volumen: subiendo demasiado rápido -> pasar a mantenimiento ---
{
  const r = reviewCaloriePhase("ganar", trend(VOLUME_RATE_RANGE_PCT.max + 0.3));
  ok(r.ajuste === "pasar_a_mantenimiento", `volumen muy rápido: sugiere mantenimiento (dio ${r.ajuste})`);
}

// --- volumen: subiendo muy lento o bajando -> subir energía ---
{
  const r1 = reviewCaloriePhase("ganar", trend(VOLUME_RATE_RANGE_PCT.min - 0.1));
  ok(r1.ajuste === "subir_energia", `volumen muy lento: sugiere subir energía (dio ${r1.ajuste})`);
  const r2 = reviewCaloriePhase("ganar", trend(-0.1));
  ok(r2.ajuste === "subir_energia", `volumen pero bajando de peso: sugiere subir energía (dio ${r2.ajuste})`);
}

// --- déficit: dentro del rango, sin ajuste ---
{
  const mid = -(DEFICIT_RATE_RANGE_PCT.min + DEFICIT_RATE_RANGE_PCT.max) / 2;
  const r = reviewCaloriePhase("perder", trend(mid));
  ok(r.ajuste === null, `déficit dentro de rango: sin ajuste (dio ${r.ajuste})`);
}

// --- déficit: bajando demasiado rápido -> pasar a mantenimiento ---
{
  const r = reviewCaloriePhase("perder", trend(-(DEFICIT_RATE_RANGE_PCT.max + 0.3)));
  ok(r.ajuste === "pasar_a_mantenimiento", `déficit muy rápido: sugiere mantenimiento (dio ${r.ajuste})`);
}

// --- déficit: bajando muy lento o subiendo -> bajar energía ---
{
  const r1 = reviewCaloriePhase("perder", trend(-(DEFICIT_RATE_RANGE_PCT.min - 0.1)));
  ok(r1.ajuste === "bajar_energia", `déficit muy lento: sugiere bajar energía (dio ${r1.ajuste})`);
  const r2 = reviewCaloriePhase("perder", trend(0.1));
  ok(r2.ajuste === "bajar_energia", `déficit pero subiendo de peso: sugiere bajar energía (dio ${r2.ajuste})`);
}

// --- mantenimiento: nunca sugiere cambio de fase, solo informa ---
{
  const r = reviewCaloriePhase("mantener", trend(1.0));
  ok(r.ajuste === null, "mantenimiento nunca sugiere ajuste de fase automático");
  ok(r.phase === "mantenimiento", "fase correcta");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
