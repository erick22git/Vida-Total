// Pruebas de IMC. Ejecutar: npx tsx tools/gym/body_composition_test.ts
import { imc, imcCategoria } from "../../src/lib/training/body-composition";

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

console.log(checks - fails, "/", checks, "OK");
if (fails > 0) {
  console.log(fails, "FALLARON");
  process.exit(1);
}
