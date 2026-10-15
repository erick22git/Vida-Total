// Mejora visual del esqueleto por tamaño corporal. node tools/3d/verify/run_ts.mjs tools/camara/body_scale_test.ts
import { bodyLineWidthScale, MIN_LINE_SCALE, MAX_LINE_SCALE } from "../../src/lib/camara/body-scale";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

ok(bodyLineWidthScale(undefined, undefined) === 1, "sin altura ni peso: escala neutra (1), igual que antes");
ok(bodyLineWidthScale(170, 70) === 1, "altura y peso exactamente de referencia: escala neutra (1)");

{
  const bigger = bodyLineWidthScale(190, 95);
  ok(bigger > 1, `persona más alta y pesada que la referencia: escala > 1 (dio ${bigger})`);
}
{
  const smaller = bodyLineWidthScale(155, 50);
  ok(smaller < 1, `persona más baja y liviana que la referencia: escala < 1 (dio ${smaller})`);
}
{
  // Un valor extremo no debe disparar la escala fuera de un rango razonable.
  const extreme = bodyLineWidthScale(220, 200);
  ok(extreme <= MAX_LINE_SCALE, `valor extremo no supera el máximo acotado (dio ${extreme}, tope ${MAX_LINE_SCALE})`);
}
{
  const extreme = bodyLineWidthScale(120, 30);
  ok(extreme >= MIN_LINE_SCALE, `valor extremo bajo no cae debajo del mínimo acotado (dio ${extreme}, piso ${MIN_LINE_SCALE})`);
}
{
  // El peso pesa más que la altura en el resultado (criterio documentado en el módulo).
  const heavier = bodyLineWidthScale(170, 90);
  const taller = bodyLineWidthScale(190, 70);
  ok(heavier > taller, `mismo desvío relativo, pero peso pesa más que altura en la escala (pesado=${heavier}, alto=${taller})`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
