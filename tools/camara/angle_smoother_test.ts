// Arreglo del conteo de reps (roadmap sección 3.1/3.6). node tools/3d/verify/run_ts.mjs tools/camara/angle_smoother_test.ts
import { smoothAngle } from "../../src/lib/camara/angle-smoother";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

ok(smoothAngle(null, 170) === 170, "primer frame válido: se inicializa directo con el ángulo crudo");
ok(smoothAngle(100, NaN) === 100, "frame con NaN: se queda en el último valor suavizado, no lo arrastra a NaN");
ok(Number.isNaN(smoothAngle(null, NaN)), "sin valor previo y sin ángulo válido: NaN (no hay nada que mostrar)");

{
  // Un salto de ruido de un solo frame se amortigua, no se sigue 1 a 1.
  const smoothed = smoothAngle(170, 20, 0.35);
  ok(smoothed > 20 && smoothed < 170, `un salto brusco de un frame se amortigua, no salta entero (dio ${smoothed})`);
}

{
  // Pero el movimiento REAL (sostenido varios frames) sí se termina siguiendo.
  let s: number | null = 170;
  for (let i = 0; i < 20; i++) s = smoothAngle(s, 90, 0.35);
  ok(Math.abs((s as number) - 90) < 1, `un cambio sostenido de 20 frames termina siguiendo el ángulo real (dio ${s})`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
