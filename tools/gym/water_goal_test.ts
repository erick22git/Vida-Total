// Pruebas de la meta de agua sugerida (base AI + extra por entrenamiento). Ejecutar: npx tsx tools/gym/water_goal_test.ts
import { suggestWaterGoal, EXERCISE_WATER_ML_PER_MIN } from "../../src/lib/gym/water-goal";
import { getNutrientTargets } from "../../src/lib/nutrition/nutrient-targets";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// --- sin entrenamiento hoy: total = base, sin ajuste ---
{
  const r = suggestWaterGoal("hombre", 30, 0);
  const expectedBase = getNutrientTargets({ sexo: "hombre", edad: 30 }).targets.aguaBebidas.objetivo;
  ok(r.baseMl === expectedBase, `base igual a la que ya usa Ajustes de Calorías (dio ${r.baseMl}, esperado ${expectedBase})`);
  ok(r.exercicioMl === 0 && r.totalMl === r.baseMl, "sin entrenamiento hoy: 0 ml extra, total = base");
}

// --- con entrenamiento: suma el estimado, redondeado a 50ml ---
{
  const r = suggestWaterGoal("mujer", 28, 45); // 45 min
  const esperadoExtra = Math.round((45 * EXERCISE_WATER_ML_PER_MIN) / 50) * 50;
  ok(r.exerciseMinutesToday === 45, "guarda los minutos tal cual");
  ok(r.exercicioMl === esperadoExtra, `extra redondeado a 50ml (dio ${r.exercicioMl}, esperado ${esperadoExtra})`);
  ok(r.totalMl === r.baseMl + r.exercicioMl, "total = base + extra");
}

// --- nunca negativo ni raro con minutos negativos (no debería pasar, pero no debe romper) ---
{
  const r = suggestWaterGoal("hombre", 30, -10);
  ok(r.exerciseMinutesToday === 0 && r.exercicioMl === 0, "minutos negativos se tratan como 0, nunca un extra negativo");
}

// --- sin sexo/edad: genérico, igual que el resto de la app en ese caso ---
{
  const r = suggestWaterGoal(undefined, undefined, 0);
  ok(r.genericoBase === true, "sin perfil completo: marca genericoBase true, igual que el resto de metas de nutrientes");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
