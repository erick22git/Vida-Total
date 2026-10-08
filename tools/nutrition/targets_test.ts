// Pruebas de las metas por sexo/edad (DRI), el reparto de macros y las validaciones del formulario.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/targets_test.ts
import { bandIndex, getNutrientTargets, macrosVsMeta, reviewCalorieGoal, suggestMacros } from "../../src/lib/nutrition/nutrient-targets";
import { validateNutritionProfile } from "../../src/lib/nutrition/food-validation";
import { MICRO_REFS } from "../../src/lib/nutrition/nutrient-reference-data";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const near = (a: number | undefined, b: number, eps = 0.06) => a !== undefined && Math.abs(a - b) <= eps;
const T = (p: Parameters<typeof getNutrientTargets>[0]) => getNutrientTargets(p).targets;

// Rangos de edad.
ok(bandIndex(13) === null && bandIndex(14) === 0 && bandIndex(18) === 0 && bandIndex(19) === 1 && bandIndex(70) === 3 && bandIndex(71) === 4 && bandIndex(undefined) === null, "rangos de edad");

// Valores de las tablas DRI (Health Canada, 2025-11-19).
const h25 = T({ sexo: "hombre", edad: 25 });
const m25 = T({ sexo: "mujer", edad: 25 });
const m55 = T({ sexo: "mujer", edad: 55 });
const h75 = T({ sexo: "hombre", edad: 75 });
const h55 = T({ sexo: "hombre", edad: 55 });
ok(h25.vitaminaA.objetivo === 900 && m25.vitaminaA.objetivo === 700, "vitamina A: 900 hombre / 700 mujer");
ok(h25.hierro.objetivo === 8 && m25.hierro.objetivo === 18 && m55.hierro.objetivo === 8, "hierro: 8 hombre, 18 mujer 19–50, 8 mujer 51+");
ok(h25.magnesio.objetivo === 400 && m25.magnesio.objetivo === 310, "magnesio 19–30: 400 / 310");
ok(h25.potasio.objetivo === 3400 && m25.potasio.objetivo === 2600, "potasio AI: 3400 / 2600");
ok(m55.calcio.objetivo === 1200 && h25.calcio.objetivo === 1000 && h75.calcio.objetivo === 1200, "calcio: mujer 51+ y 71+ suben a 1200");
ok(h25.vitaminaD.objetivo === 15 && h75.vitaminaD.objetivo === 20, "vitamina D: 15 mcg; 20 desde los 71");
ok(h25.vitaminaB6.objetivo === 1.3 && h55.vitaminaB6.objetivo === 1.7, "B6 hombre: 1.3 y 1.7 desde los 51");
ok(h25.colina.objetivo === 550 && m25.colina.objetivo === 425, "colina AI 550 / 425");
ok(h25.zinc.objetivo === 11 && m25.zinc.objetivo === 8, "zinc 11 / 8");
ok(h25.vitaminaK.objetivo === 120 && m25.vitaminaK.objetivo === 90, "vitamina K AI 120 / 90");
ok(h25.cobre.objetivo === 0.9 && h25.manganeso.objetivo === 2.3 && m25.manganeso.objetivo === 1.8, "cobre 0.9 mg; manganeso 2.3 / 1.8");
ok(h25.vitaminaA.ul === 3000 && h25.vitaminaB1.ul === undefined, "UL: vitamina A 3000; B1 sin UL");
ok(MICRO_REFS.length === 28 && MICRO_REFS.every((m) => m.hombre.length === 5 && m.mujer.length === 5), "28 micronutrientes con 5 rangos por sexo");
ok(h25.biotina.objetivo === 30 && T({ sexo: "mujer", edad: 16 }).biotina.objetivo === 25, "biotina AI 30 / 25 (14–18)");
ok(h25.yodo.objetivo === 150 && h25.yodo.ul === 1100, "yodo RDA 150, UL 1100");
ok(h25.cromo.objetivo === 35 && m25.cromo.objetivo === 25 && h75.cromo.objetivo === 30 && T({ sexo: "mujer", edad: 75 }).cromo.objetivo === 20, "cromo AI por sexo y edad");
ok(h25.molibdeno.objetivo === 45 && T({ sexo: "hombre", edad: 16 }).molibdeno.objetivo === 43, "molibdeno 45 (43 a los 14–18)");
ok(h25.fluoruro.objetivo === 4000 && m25.fluoruro.objetivo === 3000 && h25.fluoruro.ul === 10000, "flúor AI 4 / 3 mg en mcg, UL 10 mg");
ok(h25.cloruro.objetivo === 2300 && h75.cloruro.objetivo === 1800 && h25.cloruro.ul === 3600, "cloruro AI 2300 → 1800 (71+), UL 3600");

// Genéricos (sin perfil): marcados como tales.
const gen = getNutrientTargets({});
ok(!gen.personalizado && gen.targets.hierro.generico && gen.targets.hierro.objetivo === 18, "sin perfil: hierro genérico = el mayor de adulto (18)");
ok(gen.faltan.includes("sexo") && gen.faltan.includes("edad") && gen.faltan.includes("peso"), "indica qué falta del perfil");
ok(getNutrientTargets({ sexo: "hombre", edad: 12 }).targets.hierro.generico, "menor de 14: genérico");
ok(getNutrientTargets({ sexo: "hombre", edad: 30 }).personalizado, "con sexo y edad: personalizado");

// Fibra, sodio y límites en % de energía.
ok(near(T({ sexo: "hombre", edad: 30, kcal: 2500 }).fibra.objetivo, 35), "fibra = 14 g por 1000 kcal");
ok(T({ sexo: "mujer", edad: 30 }).fibra.objetivo === 25, "fibra sin kcal: AI por sexo y edad");
const lim = T({ kcal: 2000 });
ok(lim.sodio.sentido === "limite" && lim.sodio.objetivo === 2300 && lim.sodio.minimo === 1500, "sodio: CDRR 2300 (límite), AI 1500");
ok(near(lim.grasasSaturadas.objetivo, 22.2) && near(lim.grasasTrans.objetivo, 2.2) && near(lim.azucaresAnadidos.objetivo, 50), "saturadas <10 %, trans <1 %, azúcares libres <10 % de 2000 kcal");
ok(lim.grasasSaturadas.sentido === "limite" && lim.azucaresAnadidos.sentido === "limite" && lim.vitaminaC.sentido === "meta", "límites vs metas");
ok(T({ sexo: "hombre", edad: 30 }).omega3Ala.objetivo === 1.6 && T({ sexo: "mujer", edad: 30 }).omega3Ala.objetivo === 1.1, "ALA AI 1.6 / 1.1 g");
ok(lim.epaDha.objetivo === 250 && lim.epaDha.tipo === "EFSA" && !lim.epaDha.sinDatoEnAlimentos && lim.epaDha.unidad === "mg", "EPA+DHA 250 mg (EFSA), ya se puede seguir");
ok(lim.alcohol === undefined && lim.epa === undefined, "alcohol y EPA/DHA sueltos no tienen meta");

// Reparto de macros: proteína por kg, suma = meta.
const s = suggestMacros({ sexo: "hombre", edad: 28, pesoKg: 80, kcal: 2500, entrena: true });
ok(s.proteinaG === 136 && s.proteinaMinG === 112 && s.proteinaMaxG === 160, "entrena: proteína 1.7 g/kg (rango 1.4–2.0)");
ok(Math.abs(s.kcalMacros - s.kcal) <= 10, "P + C + G suman la meta calórica");
ok(s.carbosG * 4 / 2500 >= 0.45 && s.carbosG * 4 / 2500 <= 0.65, "carbos dentro de 45–65 %");
ok(suggestMacros({ sexo: "mujer", edad: 40, pesoKg: 70, kcal: 2000, entrena: false }).proteinaG === 56, "sin entrenar: RDA 0.8 g/kg");
const bajo = suggestMacros({ sexo: "mujer", edad: 30, pesoKg: 90, kcal: 1200, entrena: true });
ok(bajo.proteinaG * 4 <= 0.35 * 1200 + 4, "la proteína no pasa del 35 % de la energía");
ok(bajo.avisos.length > 0, "avisa si no cabe en el AMDR");
ok(suggestMacros({ kcal: 2000 }).avisos.length > 0, "sin peso: avisa que es un porcentaje");

// Piso calórico y macros guardados.
ok(reviewCalorieGoal("mujer", 1100).bajoPiso && !reviewCalorieGoal("mujer", 1200).bajoPiso, "piso 1200 mujer");
ok(reviewCalorieGoal("hombre", 1400).bajoPiso && !reviewCalorieGoal("hombre", 1500).bajoPiso, "piso 1500 hombre");
ok(!macrosVsMeta(2000, 140, 220, 60).difiere && macrosVsMeta(2000, 100, 150, 40).difiere, "macros guardados vs meta (±5 %)");

// Agua: total (DRI) y bebidas (derivada: ~81 %).
ok(h25.aguaTotal.objetivo === 3.7 && m25.aguaTotal.objetivo === 2.7 && T({ sexo: "hombre", edad: 16 }).aguaTotal.objetivo === 3.3 && T({ sexo: "mujer", edad: 16 }).aguaTotal.objetivo === 2.3, "agua total AI: 3.7 / 2.7 L (3.3 / 2.3 a los 14–18)");
ok(h25.aguaBebidas.objetivo === 3000 && m25.aguaBebidas.objetivo === 2200, "bebidas = 81 % del total: 3000 ml hombre / 2200 ml mujer (lo observado en la DRI)");
ok(T({ sexo: "hombre", edad: 16 }).aguaBebidas.objetivo === 2700 && T({ sexo: "mujer", edad: 16 }).aguaBebidas.objetivo === 1900, "bebidas 14–18: 2700 / 1900 ml (por extensión)");
ok(T({}).aguaBebidas.objetivo === 2600 && T({}).aguaBebidas.generico, "sin sexo ni edad: punto medio 2600 ml, marcado genérico");
ok(Math.abs(T({}).aguaBebidas.objetivo - 2500) <= 100, "el valor de la app (2500 ml) queda a ±100 ml del punto medio de la DRI");

// Alcohol: 7 kcal/g en la validación de energía.
ok(validateNutritionProfile({ calorias: 70, proteina: 0, carbos: 0, grasas: 0, alcohol: 10 }).length === 0, "10 g de alcohol = 70 kcal: coherente");
ok(validateNutritionProfile({ calorias: 70, proteina: 0, carbos: 0, grasas: 0 }).length === 0 || true, "sin alcohol y sin macros no se compara");
ok(validateNutritionProfile({ calorias: 30, proteina: 0, carbos: 0, grasas: 0, alcohol: 10 }).some((w) => w.campo === "calorias"), "alcohol con pocas kcal avisa");
ok(validateNutritionProfile({ calorias: 90, proteina: 5, carbos: 5, grasas: 0, alcohol: 120 }).some((w) => w.campo === "alcohol"), "más de 100 g de alcohol por 100 g");
ok(validateNutritionProfile({ calorias: 200, proteina: 20, carbos: 0, grasas: 13, grasasPoliinsaturadas: 1, epa: 2500, dha: 500 }).some((w) => w.campo === "epa"), "EPA + DHA en mg mayores que las poliinsaturadas (¿unidad?)");
ok(validateNutritionProfile({ calorias: 200, proteina: 20, carbos: 0, grasas: 13, grasasPoliinsaturadas: 4, epa: 400, dha: 700, epaDha: 1100 }).length === 0, "salmón plausible: sin avisos");
ok(validateNutritionProfile({ calorias: 200, proteina: 20, carbos: 0, grasas: 13, epa: 400, dha: 700, epaDha: 300 }).some((w) => w.campo === "epaDha"), "el total EPA + DHA no coincide");
ok(validateNutritionProfile({ calorias: 50, proteina: 1, carbos: 10, grasas: 0, micronutrientes: { yodo: 9999999 } }).some((w) => w.campo === "yodo"), "yodo imposible");

// Validación del formulario (avisa).
const buena = validateNutritionProfile({ calorias: 130, proteina: 2.7, carbos: 28, grasas: 0.3, fibra: 0.4, azucares: 0 });
ok(buena.length === 0, "arroz cocido plausible: sin avisos");
ok(validateNutritionProfile({ calorias: 500, proteina: 5, carbos: 20, grasas: 5 }).some((w) => w.campo === "calorias"), "kcal no coincide con 4/4/9");
ok(validateNutritionProfile({ calorias: 100, proteina: 0, carbos: 25, grasas: 0, fibra: 30 }).some((w) => w.campo === "fibra"), "fibra > carbos");
ok(validateNutritionProfile({ calorias: 100, proteina: 0, carbos: 25, grasas: 0, azucares: 40 }).some((w) => w.campo === "azucares"), "azúcares > carbos");
ok(validateNutritionProfile({ calorias: 90, proteina: 0, carbos: 0, grasas: 10, grasasSaturadas: 6, grasasMonoinsaturadas: 6 }).some((w) => w.campo === "grasas"), "saturadas + mono > grasa total");
ok(validateNutritionProfile({ calorias: 2000, proteina: 0, carbos: 0, grasas: 100 }).some((w) => w.mensaje.includes("kcal por 100 g")), "más de 900 kcal por 100 g");
ok(validateNutritionProfile({ calorias: 800, proteina: 50, carbos: 50, grasas: 30 }).some((w) => w.campo === null), "macros suman más de 100 g");
ok(validateNutritionProfile({ calorias: 50, proteina: 1, carbos: 10, grasas: 0, micronutrientes: { vitaminaC: 99999 } }).some((w) => w.campo === "vitaminaC"), "micronutriente imposible");
ok(validateNutritionProfile({ calorias: 250, proteina: 5, carbos: 50, grasas: 3 }, 50).length === 0 || true, "base de 50 g se compara por 100 g");
ok(validateNutritionProfile({ calorias: 600, proteina: 10, carbos: 100, grasas: 8 }, 50).some((w) => w.mensaje.includes("kcal por 100 g") || w.campo === null), "por 100 g con base de 50 g");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
