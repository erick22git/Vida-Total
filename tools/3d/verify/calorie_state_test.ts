// Prueba de calorie-state.ts (umbrales 100 % / 120 %). Se corre con:
//   node tools/3d/verify/run_ts.mjs tools/3d/verify/calorie_state_test.ts
import { ARC_GOAL_POS, arcSegments, calorieSmoothColor, calorieState, calorieStatus, CALORIE_COLORS, celebrationDue, crossedGoal } from "../../../src/lib/gym/calorie-state";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `${JSON.stringify(got)} esperado ${JSON.stringify(want)}`);
}

// 1) Los 5 estados, con dos metas distintas (todo sale de la meta, no de kcal fijas)
for (const goal of [2000, 1500]) {
  const at = (p: number) => Math.round(goal * p);
  eq(`meta ${goal}: 0 = vacío`, calorieStatus(0, goal), "vacio");
  eq(`meta ${goal}: 1 kcal = bajo`, calorieStatus(1, goal), "bajo");
  eq(`meta ${goal}: 99 % = bajo`, calorieStatus(at(0.99), goal), "bajo");
  eq(`meta ${goal}: meta-1 = bajo`, calorieStatus(goal - 1, goal), "bajo");
  eq(`meta ${goal}: 100 % = logrado`, calorieStatus(goal, goal), "logrado");
  eq(`meta ${goal}: meta+1 = excedido (rojo inmediato)`, calorieStatus(goal + 1, goal), "excedido");
  eq(`meta ${goal}: 119 % = excedido`, calorieStatus(at(1.19), goal), "excedido");
  eq(`meta ${goal}: 120 % = excedidoFuerte`, calorieStatus(at(1.2), goal), "excedidoFuerte");
  eq(`meta ${goal}: 200 % = excedidoFuerte`, calorieStatus(at(2), goal), "excedidoFuerte");
}
eq("2001 con meta 2000 es rojo YA", calorieState(2001, 2000).color, CALORIE_COLORS.excedido);
eq("2001: rojo pero quieto (sin vibrar ni brillar)", [calorieState(2001, 2000).over, calorieState(2001, 2000).shake, calorieState(2001, 2000).glow], [true, false, false]);
eq("2399 (119,95 %): sigue quieto", [calorieState(2399, 2000).shake, calorieState(2399, 2000).glow], [false, false]);
eq("2400 (120 %): vibra y brilla", [calorieState(2400, 2000).shake, calorieState(2400, 2000).glow, calorieState(2400, 2000).over], [true, true, true]);
eq("100 %: verde y sin efectos", [calorieState(2000, 2000).color, calorieState(2000, 2000).over, calorieState(2000, 2000).shake], [CALORIE_COLORS.logrado, false, false]);
eq("redondea kcal decimales (1999.6 = logrado)", calorieStatus(1999.6, 2000), "logrado");
eq("meta 0 no rompe", [calorieState(500, 0).level, calorieState(500, 0).status], [0, "excedido"]);

// 2) Nivel del recipiente
eq("nivel 0 / 25 / 50 / 100 % / exceso", [0, 500, 1000, 2000, 3000].map((k) => calorieState(k, 2000).level), [0, 0.25, 0.5, 1, 1]);

// 3) Color amarillo→verde PROGRESIVO hasta el 100 %
eq("0 % plomo", calorieSmoothColor(0, 2000), CALORIE_COLORS.vacio);
const c25 = calorieSmoothColor(500, 2000), c50 = calorieSmoothColor(1000, 2000), c75 = calorieSmoothColor(1500, 2000);
eq("100 % = verde exacto", calorieSmoothColor(2000, 2000), CALORIE_COLORS.logrado);
eq("25/50/75 % son colores distintos entre sí", new Set([c25, c50, c75]).size, 3);
eq("25 % todavía cerca del amarillo", c25 !== CALORIE_COLORS.logrado && c25 !== CALORIE_COLORS.bajo, true);
const green = (h: string) => (parseInt(h.slice(1), 16) >> 8) & 255;
const red = (h: string) => (parseInt(h.slice(1), 16) >> 16) & 255;
eq("el rojo baja y el verde sube al avanzar (transición monótona)", red(c25) > red(c50) && red(c50) > red(c75) && green(c25) < green(c75) + 60, true);
let maxJump = 0;
let prev = calorieSmoothColor(1, 2000);
const dist = (a: string, b: string) => [16, 8, 0].reduce((s, sh) => s + Math.abs(((parseInt(a.slice(1), 16) >> sh) & 255) - ((parseInt(b.slice(1), 16) >> sh) & 255)), 0);
for (let k = 2; k <= 2000; k++) { const c = calorieSmoothColor(k, 2000); maxJump = Math.max(maxJump, dist(prev, c)); prev = c; }
eq("sin saltos bruscos en todo el tramo bajo (<= 2 por kcal)", maxJump <= 2, true);
eq("pasar la meta salta a rojo", calorieSmoothColor(2001, 2000), CALORIE_COLORS.excedido);

// 4) Curva del arco
eq("arco: 0 → vacío", calorieState(0, 2000).arcFraction, 0);
eq("arco: la meta cae en ARC_GOAL_POS", calorieState(2000, 2000).arcFraction, ARC_GOAL_POS);
eq("arco: 120 % cae después de la meta", calorieState(2400, 2000).arcFraction > ARC_GOAL_POS, true);
eq("arco: se topa en 1", calorieState(9000, 2000).arcFraction, 1);
eq("segmentos: bajo la meta no hay rojo", arcSegments(calorieState(1000, 2000).arcFraction).red, 0);
const sg = arcSegments(calorieState(2600, 2000).arcFraction);
eq("segmentos: pasada la meta el progreso se topa y aparece rojo", [sg.progress === ARC_GOAL_POS, sg.red > 0], [true, true]);

// 5) Celebración: una vez por día
eq("cruzar la meta hacia arriba celebra", crossedGoal(1900, 2000, 2000), true);
eq("saltar de 1800 a 2300 también cruza", crossedGoal(1800, 2300, 2000), true);
eq("ya estaba por encima: no vuelve a cruzar", crossedGoal(2100, 2200, 2000), false);
eq("bajar de la meta no celebra", crossedGoal(2100, 1900, 2000), false);
eq("recalcular sin cambios no celebra", crossedGoal(2000, 2000, 2000), false);
eq("primer aviso del día se celebra", celebrationDue("2026-09-26", null), true);
eq("segunda vez el mismo día no", celebrationDue("2026-09-26", "2026-09-26"), false);
eq("al día siguiente sí", celebrationDue("2026-09-27", "2026-09-26"), true);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
