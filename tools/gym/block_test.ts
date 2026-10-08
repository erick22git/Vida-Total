// Pruebas del orden dentro de un bloque (superserie / serie compuesta). Ejecutar: node tools/3d/verify/run_ts.mjs tools/gym/block_test.ts
import { blockRoundCount, nextAfterSet, type BlockMember } from "../../src/lib/gym-utils";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const sets = (n: number, done = 0) => Array.from({ length: n }, (_, k) => ({ completado: k < done }));
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Superserie clásica A-B, 3 rondas.
const ab = (a: number, b: number): BlockMember[] => [{ i: 0, sets: sets(3, a) }, { i: 1, sets: sets(3, b) }];
ok(eq(nextAfterSet(ab(0, 0), 0, 0, false), { kind: "partner", index: 1 }), "A1 → sigue B1");
ok(eq(nextAfterSet(ab(1, 0), 1, 0, false), { kind: "round", index: 0, rest: true }), "B1 cierra la ronda → descanso y vuelve a A");
ok(eq(nextAfterSet(ab(3, 2), 1, 2, false), { kind: "end" }), "última serie → fin del bloque");

// Serie compuesta del usuario: extensión (solo inicio, 1 serie), zancadas y sentadilla en 3 rondas, serieUnica.
const ext = { i: 0, sets: sets(1) };
const zan = { i: 1, sets: sets(3) };
const sen = { i: 2, sets: sets(3) };
const m = (e: number, z: number, s: number): BlockMember[] => [{ ...ext, sets: sets(1, e) }, { ...zan, sets: sets(3, z) }, { ...sen, sets: sets(3, s) }];
ok(eq(nextAfterSet(m(0, 0, 0), 0, 0, true), { kind: "partner", index: 1 }), "extensión → zancadas (misma ronda)");
ok(eq(nextAfterSet(m(1, 0, 0), 1, 0, true), { kind: "partner", index: 2 }), "zancadas → sentadilla");
ok(eq(nextAfterSet(m(1, 1, 0), 2, 0, true), { kind: "round", index: 1, rest: false }), "ronda 1 lista: sigue en ZANCADAS (no la extensión) y SIN descanso");
ok(eq(nextAfterSet(m(1, 2, 1), 2, 1, true), { kind: "round", index: 1, rest: false }), "ronda 2 lista: sin descanso");
ok(eq(nextAfterSet(m(1, 3, 2), 2, 2, true), { kind: "end" }), "ronda 3 lista: fin → ahora sí se descansa");
ok(eq(nextAfterSet(m(1, 1, 0), 2, 0, false), { kind: "round", index: 1, rest: true }), "sin serieUnica sí descansa entre rondas");

// Ejercicio suelto.
ok(eq(nextAfterSet([{ i: 3, sets: sets(3, 0) }], 3, 0, false), { kind: "round", index: 3, rest: true }), "suelto: descansa y sigue en el mismo");
ok(eq(nextAfterSet([{ i: 3, sets: sets(3, 2) }], 3, 2, false), { kind: "end" }), "suelto: última serie → fin");

// Rondas.
ok(blockRoundCount([{ soloInicio: true, sets: [1] }, { sets: [1, 2, 3] }, { sets: [1, 2, 3] }]) === 3, "rondas ignoran al «solo al inicio»");
ok(blockRoundCount([{ sets: [1, 2] }, { sets: [1, 2] }]) === 2, "rondas de una superserie");
ok(blockRoundCount([{ soloInicio: true, sets: [1] }]) === 1, "solo hay uno «solo al inicio»");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
