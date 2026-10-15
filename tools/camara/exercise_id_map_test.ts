// Fase D del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.8).
// node tools/3d/verify/run_ts.mjs tools/camara/exercise_id_map_test.ts
import { cameraExerciseIdFor } from "../../src/lib/camara/exercise-id-map";
import exercises from "../../src/lib/data/exercises.json";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

ok(cameraExerciseIdFor("sentadilla-barra") === "sentadilla", "sentadilla-barra mapea a sentadilla");
ok(cameraExerciseIdFor("peso-muerto") === "peso_muerto", "peso-muerto mapea a peso_muerto");
ok(cameraExerciseIdFor("press-banca-barra") === "press_banca", "press-banca-barra mapea a press_banca");
ok(cameraExerciseIdFor("curl-biceps-barra") === "curl_biceps", "curl-biceps-barra mapea a curl_biceps");
ok(cameraExerciseIdFor("sentadilla-bulgara") === null, "sentadilla búlgara NO está mapeada (biomecánica distinta, sin investigar)");
ok(cameraExerciseIdFor("peso-muerto-rumano") === null, "peso muerto rumano NO está mapeado");
ok(cameraExerciseIdFor("algo-que-no-existe") === null, "id desconocido devuelve null, no inventa un match");

// Los 4 ids mapeados tienen que existir de verdad en el catálogo — si alguna vez se renombra un id
// en exercises.json, este test lo detecta en vez de quedar mapeando a un ejercicio que ya no existe.
const catalogIds = new Set((exercises as { id: string }[]).map((e) => e.id));
for (const id of ["sentadilla-barra", "peso-muerto", "press-banca-barra", "curl-biceps-barra"]) {
  ok(catalogIds.has(id), `"${id}" existe de verdad en exercises.json`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
