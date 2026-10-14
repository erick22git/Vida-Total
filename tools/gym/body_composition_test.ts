// Pruebas de IMC. Ejecutar: npx tsx tools/gym/body_composition_test.ts
import { imc, imcCategoria, latestMuscleMeasurement, measurementFieldForMuscle } from "../../src/lib/training/body-composition";
import type { BodyMeasurementEntry } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

ok(imc(0, 180) === null, "peso 0 -> null");
ok(imc(80, 0) === null, "altura 0 -> null");
const v = imc(80, 180)!;
ok(Math.abs(v - 24.691) < 0.01, `imc(80,180) ~= 24.69 (obtuvo ${v})`);

ok(imcCategoria(17) === "bajo_peso", "17 -> bajo_peso");
ok(imcCategoria(18.5) === "normal", "18.5 exacto -> normal");
ok(imcCategoria(24.9) === "normal", "24.9 -> normal");
ok(imcCategoria(25) === "sobrepeso", "25 exacto -> sobrepeso");
ok(imcCategoria(29.9) === "sobrepeso", "29.9 -> sobrepeso");
ok(imcCategoria(30) === "obesidad", "30 exacto -> obesidad");

// ---- measurementFieldForMuscle / latestMuscleMeasurement ----
ok(measurementFieldForMuscle("Pecho") === "pechoCm", "Pecho -> pechoCm");
ok(measurementFieldForMuscle("Biceps") === "brazoContraidoCm", "Biceps -> brazoContraidoCm");
ok(measurementFieldForMuscle("Triceps") === "brazoContraidoCm", "Triceps comparte brazoContraidoCm con Biceps");
ok(measurementFieldForMuscle("Hombros") === null, "Hombros sin perímetro propio -> null");

const history: BodyMeasurementEntry[] = [
  { id: "1", date: "2026-09-01", pechoCm: 98 },
  { id: "2", date: "2026-10-01", pechoCm: 100 },
  { id: "3", date: "2026-10-10", cinturaCm: 85 }, // sin pechoCm, no debe contar para Pecho
];
const m = latestMuscleMeasurement("Pecho", history);
ok(m !== null && m.valueCm === 100 && m.date === "2026-10-01", `última medición de Pecho = 100cm 2026-10-01 (obtuvo ${JSON.stringify(m)})`);
ok(m?.deltaCm === 2, `delta vs la anterior (98) = +2 (obtuvo ${m?.deltaCm})`);
ok(latestMuscleMeasurement("Pecho", []) === null, "sin historial -> null");
ok(latestMuscleMeasurement("Hombros", history) === null, "músculo sin perímetro propio -> null aunque haya historial");
const single = latestMuscleMeasurement("Abdomen", history);
ok(single !== null && single.deltaCm === undefined, "una sola medición -> sin delta (no inventa comparación)");

console.log(checks - fails, "/", checks, "OK");
if (fails > 0) {
  console.log(fails, "FALLARON");
  process.exit(1);
}
