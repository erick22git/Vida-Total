// Pruebas de la sugerencia de progresión de peso. Ejecutar: npx tsx tools/gym/progressive_overload_test.ts
import { suggestNextWeight, progressionStalled } from "../../src/lib/training/progressive-overload";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// --- sin RIR registrado: sin datos, no sugiere nada ---
{
  const r = suggestNextWeight({
    lastSets: [{ peso: 60, reps: 10, completado: true }],
    referenceReps: [8],
  });
  ok(r.sinDatos === true, `sin RIR registrado: sinDatos (dio ${r.sinDatos})`);
  ok(r.suggestedWeightKg === null, `sin RIR registrado: sin peso sugerido (dio ${r.suggestedWeightKg})`);
}

// --- RIR alto + llegó a las reps de referencia: sugiere subir ---
{
  const r = suggestNextWeight({
    lastSets: [
      { peso: 60, reps: 10, rir: 3, completado: true },
      { peso: 60, reps: 10, rir: 4, completado: true },
    ],
    referenceReps: [8, 8],
  });
  ok(r.decision === "subir", `RIR alto + reps superadas: decide subir (dio ${r.decision})`);
  ok(r.suggestedWeightKg === 62.5, `sugiere +2.5kg por defecto (dio ${r.suggestedWeightKg})`);
}

// --- RIR bajo + no llegó a las reps: sugiere bajar ---
{
  const r = suggestNextWeight({
    lastSets: [
      { peso: 60, reps: 6, rir: 0, completado: true },
      { peso: 60, reps: 5, rir: 0, fallo: true, completado: true },
    ],
    referenceReps: [8, 8],
  });
  ok(r.decision === "bajar", `RIR bajo + no llegó a las reps: decide bajar (dio ${r.decision})`);
  ok(r.suggestedWeightKg === 57.5, `sugiere -2.5kg por defecto (dio ${r.suggestedWeightKg})`);
}

// --- RIR bajo nunca sugiere peso negativo ---
{
  const r = suggestNextWeight({
    lastSets: [{ peso: 1, reps: 5, rir: 0, fallo: true, completado: true }],
    referenceReps: [8],
    incrementKg: 2.5,
  });
  ok(r.suggestedWeightKg === 0, `nunca sugiere peso negativo, se clampa a 0 (dio ${r.suggestedWeightKg})`);
}

// --- "al fallo" marcado por tipo (como se marca en la práctica, no por el booleano fallo) ---
{
  const r = suggestNextWeight({
    lastSets: [{ peso: 60, reps: 6, rir: 0, tipo: "fallo", completado: true }],
    referenceReps: [8],
  });
  ok(r.anyFailure === true, `tipo "fallo" cuenta como fallo aunque el booleano fallo no esté seteado (dio ${r.anyFailure})`);
  ok(r.decision === "bajar", `con tipo "fallo" + no llegó a las reps: decide bajar (dio ${r.decision})`);
}

// --- RIR intermedio: mantener ---
{
  const r = suggestNextWeight({
    lastSets: [{ peso: 60, reps: 10, rir: 1, completado: true }],
    referenceReps: [8],
  });
  ok(r.decision === "mantener", `RIR intermedio sin fallo: mantener (dio ${r.decision})`);
  ok(r.suggestedWeightKg === 60, `mismo peso (dio ${r.suggestedWeightKg})`);
}

// --- series de calentamiento (completado=false) no entran en el cálculo ---
{
  const r = suggestNextWeight({
    lastSets: [
      { peso: 20, reps: 15, completado: false },
      { peso: 60, reps: 10, rir: 3, completado: true },
    ],
    referenceReps: [8],
  });
  ok(r.lastWeight === 60, `ignora series no completadas, usa la última completada (dio ${r.lastWeight})`);
}

// --- progressionStalled ---
{
  ok(progressionStalled(["mantener", "mantener"]) === false, "menos de la ventana: no estancado todavía");
  ok(progressionStalled(["mantener", "bajar", "mantener"]) === true, "3 sesiones sin subir: estancado");
  ok(progressionStalled(["bajar", "subir", "mantener"]) === false, "hubo un 'subir' en la ventana: no estancado");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
