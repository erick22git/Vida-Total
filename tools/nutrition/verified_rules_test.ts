// Reglas de "verificado". Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/verified_rules_test.ts
//  1. Ningún script, migración ni archivo de datos pone verificado = true (solo la acción manual de la app).
//  2. Editar valores nutricionales cambia `nutritionChanged`; guardar sin tocar nada no.
import fs from "node:fs";
import path from "node:path";
import { BASE_FOODS, nutritionChanged } from "../../src/lib/food-utils";
import type { Food } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// ── 1. nada marca verificado=true automáticamente ──────────────────
ok(BASE_FOODS.every((f) => f.verificado !== true), "ningún alimento de la base viene verificado");

const root = path.resolve(__dirname, "../..");
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}
const OFFENDING = /verificado\s*(=|:)\s*true/i;
for (const f of [...walk(path.join(root, "scripts"), [".ts", ".mjs", ".js"]), ...walk(path.join(root, "supabase", "migrations"), [".sql"])]) {
  const text = fs.readFileSync(f, "utf8");
  // Se ignoran los comentarios de línea (// y --): ahí se EXPLICA la regla.
  const code = text.split("\n").filter((l) => !/^\s*(\/\/|--|\*|\/\*)/.test(l)).join("\n");
  ok(!OFFENDING.test(code), `${path.relative(root, f)} no pone verificado = true`);
}
for (const f of walk(path.join(root, "src", "lib", "data"), [".json"])) {
  ok(!/"verificado"\s*:\s*true/.test(fs.readFileSync(f, "utf8")), `${path.relative(root, f)} no trae verificado:true`);
}

// ── 2. nutritionChanged ────────────────────────────────────────────
const base: Food = { ...BASE_FOODS.find((f) => f.nombre === "Arroz blanco")!, verificado: true };
ok(!nutritionChanged(base, {}), "sin cambios: no cuenta como cambio");
ok(!nutritionChanged(base, { nombre: "Arroz blanco " }), "cambiar solo el nombre no es cambio nutricional");
ok(!nutritionChanged(base, { fibra: base.fibra ?? 0 }), "mismo valor = no cambio");
ok(nutritionChanged(base, { calorias: base.calorias + 5 }), "cambiar calorías sí");
ok(nutritionChanged(base, { proteina: base.proteina + 1 }), "cambiar proteína sí");
ok(nutritionChanged(base, { micronutrientes: { ...(base.micronutrientes ?? {}), hierro: 99 } }), "cambiar un mineral sí");
ok(nutritionChanged(base, { cocido: undefined }) === !!base.cocido, "quitar el estado cocido sí (si lo tenía)");
if (base.cocido) ok(nutritionChanged(base, { cocido: { ...base.cocido, calorias: base.cocido.calorias + 3 } }), "cambiar calorías del cocido sí");
ok(!nutritionChanged({ ...base, grasasTrans: undefined }, { grasasTrans: 0 }), "faltante y 0 se consideran lo mismo");

console.log(`\n${checks - fails}/${checks} comprobaciones OK`);
if (fails) process.exit(1);
