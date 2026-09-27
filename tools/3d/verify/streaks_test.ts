// Racha «día perfecto»: historial viejo (±10 %) intacto antes del corte; desde el corte, llegar a la meta (incl. excedido) cuenta.
import { computePerfectDaysStreak, GOAL_RULE_FROM } from "../../../src/lib/gym/streaks";
let bad = 0;
const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) { bad++; console.log("FALLA", m, "→", a, "esperado", b); } };
const day = (off: number) => { const t = new Date(GOAL_RULE_FROM + "T12:00:00"); t.setDate(t.getDate() + off); return t; };
const best = (days: [number, number][], goal = 2000) =>
  computePerfectDaysStreak(days.map(([o, k]) => ({ id: `${o}`, timestamp: day(o).toISOString(), calorias: k, activo: true }) as never), goal).best;
eq(best([[-1, 1900]]), 1, "antes del corte 95 % cuenta (regla vieja)");
eq(best([[-1, 2300]]), 0, "antes del corte 115 % NO cuenta (regla vieja)");
eq(best([[-1, 1700]]), 0, "antes del corte 85 % no cuenta");
eq(best([[0, 1900]]), 0, "desde el corte 95 % ya NO cuenta");
eq(best([[0, 2000]]), 1, "desde el corte 100 % cuenta");
eq(best([[0, 2600]]), 1, "desde el corte excedido cuenta");
eq(best([[-2, 1900], [-1, 2100], [0, 2600], [1, 2000]]), 4, "racha mixta vieja+nueva continua");
eq(best([[-1, 1900], [0, 1900], [1, 2000]]), 1, "95 % tras el corte rompe la racha");
console.log(bad ? "FALLAS" : "TODO OK");
