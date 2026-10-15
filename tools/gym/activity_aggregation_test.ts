// Pruebas de agregación de actividad día/semana/mes. Ejecutar: npx tsx tools/gym/activity_aggregation_test.ts
import { dailyActivityTotals, weeklyActivityTotals, monthlyActivityTotals, weekKeyOf, monthKeyOf } from "../../src/lib/gym/activity-aggregation";
import type { WorkoutSession, WalkSession, WorkoutSet } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

function setOf(peso: number, reps: number): WorkoutSet {
  return { id: `s${Math.random()}`, peso, reps, completado: true, fallo: false };
}

const sessionDay1: WorkoutSession = {
  id: "s1",
  date: "2026-10-05T10:00:00.000Z",
  grupoMuscular: "Pecho",
  completado: true,
  ejercicios: [{ exerciseId: "press-banca", restSeconds: 90, sets: [setOf(60, 10), setOf(60, 10)] }],
};
const sessionDay1NotDone: WorkoutSession = { ...sessionDay1, id: "s1b", completado: false };
const walkDay1: WalkSession = { id: "w1", startedAt: "2026-10-05T18:00:00.000Z", points: [], kcal: 150, distanceKm: 2, durationSeconds: 1500 };
const walkDay2: WalkSession = { id: "w2", startedAt: "2026-10-06T08:00:00.000Z", points: [], kcal: 200, distanceKm: 3, durationSeconds: 2000 };

// --- totales por día ---
{
  const daily = dailyActivityTotals([sessionDay1, sessionDay1NotDone], [walkDay1, walkDay2], 80);
  const d1 = daily.get("2026-10-05")!;
  ok(d1.entrenoKcal > 0, `día 1 tiene kcal de entrenamiento (dio ${d1.entrenoKcal})`);
  ok(d1.caminataKcal === 150, `día 1 suma la caminata (dio ${d1.caminataKcal})`);
  ok(Math.abs(d1.totalKcal - (d1.entrenoKcal + 150)) < 0.001, "total = entreno + caminata");
  const d2 = daily.get("2026-10-06")!;
  ok(d2.entrenoKcal === 0 && d2.caminataKcal === 200, `día 2 solo caminata (dio ${JSON.stringify(d2)})`);
  ok(daily.size === 2, `solo 2 días con actividad (dio ${daily.size})`);
}

// --- sesión no completada no suma ---
{
  const daily = dailyActivityTotals([sessionDay1NotDone], [], 80);
  ok(daily.size === 0, "sesión no completada: no aparece en la agregación diaria");
}

// --- caminata sin resumen (en curso) no suma ---
{
  const walkEnCurso: WalkSession = { id: "w3", startedAt: "2026-10-05T12:00:00.000Z", points: [] };
  const daily = dailyActivityTotals([], [walkEnCurso], 80);
  ok(daily.size === 0, "caminata sin kcal calculado todavía (en curso): no suma nada");
}

// --- agregación semanal y mensual ---
{
  const daily = dailyActivityTotals([sessionDay1], [walkDay1, walkDay2], 80);
  const weekly = weeklyActivityTotals(daily);
  ok(weekly.size === 1, `misma semana ISO para días consecutivos cercanos (dio ${weekly.size} claves)`);
  const monthly = monthlyActivityTotals(daily);
  ok(monthly.size === 1 && monthly.has("2026-10"), `misma clave de mes "2026-10" (dio ${[...monthly.keys()]})`);
}

// --- claves de semana/mes con formato esperado ---
{
  ok(/^\d{4}-W\d{2}$/.test(weekKeyOf("2026-10-05")), `formato de semana ISO (dio ${weekKeyOf("2026-10-05")})`);
  ok(monthKeyOf("2026-10-05") === "2026-10", `formato de mes (dio ${monthKeyOf("2026-10-05")})`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
