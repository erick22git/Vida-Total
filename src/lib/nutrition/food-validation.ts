/**
 * Validaciones del formulario de verificación de alimentos: AVISAN, nunca bloquean (hay alimentos reales con cifras raras:
 * alcohol, polioles, redondeos de etiqueta). Módulo puro.
 */
import type { NutritionProfile } from "@/lib/types";

export interface FoodWarning {
  /** Campo principal afectado (clave del perfil o del micronutriente), o `null` si es del conjunto. */
  campo: string | null;
  mensaje: string;
}

/** Máximos plausibles por 100 g de alimento (valores reales extremos con margen: aceite de hígado de bacalao, nuez de Brasil, hierbas secas…). */
const MAX_POR_100G: Record<string, { max: number; unidad: string; nombre: string }> = {
  vitaminaA: { max: 40000, unidad: "mcg", nombre: "Vitamina A" },
  vitaminaC: { max: 3000, unidad: "mg", nombre: "Vitamina C" },
  vitaminaD: { max: 300, unidad: "mcg", nombre: "Vitamina D" },
  vitaminaE: { max: 200, unidad: "mg", nombre: "Vitamina E" },
  vitaminaK: { max: 2500, unidad: "mcg", nombre: "Vitamina K" },
  vitaminaB1: { max: 10, unidad: "mg", nombre: "Vitamina B1" },
  vitaminaB2: { max: 10, unidad: "mg", nombre: "Vitamina B2" },
  vitaminaB3: { max: 100, unidad: "mg", nombre: "Vitamina B3" },
  vitaminaB5: { max: 40, unidad: "mg", nombre: "Vitamina B5" },
  vitaminaB6: { max: 10, unidad: "mg", nombre: "Vitamina B6" },
  vitaminaB12: { max: 200, unidad: "mcg", nombre: "Vitamina B12" },
  folato: { max: 3000, unidad: "mcg", nombre: "Folato" },
  colina: { max: 1500, unidad: "mg", nombre: "Colina" },
  calcio: { max: 3000, unidad: "mg", nombre: "Calcio" },
  hierro: { max: 150, unidad: "mg", nombre: "Hierro" },
  magnesio: { max: 800, unidad: "mg", nombre: "Magnesio" },
  fosforo: { max: 1500, unidad: "mg", nombre: "Fósforo" },
  potasio: { max: 6000, unidad: "mg", nombre: "Potasio" },
  zinc: { max: 120, unidad: "mg", nombre: "Zinc" },
  selenio: { max: 2000, unidad: "mcg", nombre: "Selenio" },
  cobre: { max: 15, unidad: "mg", nombre: "Cobre" },
  manganeso: { max: 80, unidad: "mg", nombre: "Manganeso" },
  biotina: { max: 500, unidad: "mcg", nombre: "Biotina" },
  yodo: { max: 400000, unidad: "mcg", nombre: "Yodo" },
  cromo: { max: 1000, unidad: "mcg", nombre: "Cromo" },
  molibdeno: { max: 2000, unidad: "mcg", nombre: "Molibdeno" },
  fluoruro: { max: 20000, unidad: "mcg", nombre: "Flúor" },
  cloruro: { max: 65000, unidad: "mg", nombre: "Cloruro" },
};

const has = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * @param p perfil nutricional tal como lo escribió el usuario (por la porción base)
 * @param baseGramos gramos de esa porción base (para comparar «por 100 g»); por defecto 100
 */
export function validateNutritionProfile(p: Partial<NutritionProfile>, baseGramos = 100): FoodWarning[] {
  const out: FoodWarning[] = [];
  const kcal = p.calorias ?? 0;
  const prot = p.proteina ?? 0;
  const carb = p.carbos ?? 0;
  const gras = p.grasas ?? 0;

  // Energía: kcal ≈ 4P + 4C + 9G. Tolerancia amplia: la fibra, el alcohol y los polioles hacen que no sea exacto.
  const alc = p.alcohol ?? 0;
  // El alcohol aporta 7 kcal/g y no cuenta como carbohidrato, proteína ni grasa.
  const calc = 4 * prot + 4 * carb + 9 * gras + 7 * alc;
  if (kcal > 0 && calc > 0) {
    const dif = Math.abs(kcal - calc);
    if (dif > Math.max(20, kcal * 0.15)) {
      out.push({ campo: "calorias", mensaje: `Las calorías (${Math.round(kcal)}) no coinciden con 4 × proteína + 4 × carbos + 9 × grasa${alc > 0 ? " + 7 × alcohol" : ""} (${Math.round(calc)}). Puede ser fibra, polioles o un error de captura.` });
    }
  } else if (kcal === 0 && calc > 20) {
    out.push({ campo: "calorias", mensaje: `Tiene macros (${Math.round(calc)} kcal por 4/4/9) pero 0 calorías.` });
  }

  if (has(p.fibra) && p.fibra > carb + 0.05) out.push({ campo: "fibra", mensaje: "La fibra no puede ser mayor que los carbohidratos totales." });
  if (has(p.azucares) && p.azucares > carb + 0.05) out.push({ campo: "azucares", mensaje: "Los azúcares no pueden ser mayores que los carbohidratos totales." });
  if (has(p.azucaresAnadidos) && has(p.azucares) && p.azucaresAnadidos > p.azucares + 0.05) out.push({ campo: "azucaresAnadidos", mensaje: "Los azúcares añadidos no pueden ser mayores que los azúcares totales." });
  if (has(p.fibra) && has(p.azucares) && p.fibra + p.azucares > carb + 0.5) {
    out.push({ campo: "fibra", mensaje: "Fibra + azúcares suman más que los carbohidratos totales." });
  }

  const parts = (p.grasasSaturadas ?? 0) + (p.grasasTrans ?? 0) + (p.grasasMonoinsaturadas ?? 0) + (p.grasasPoliinsaturadas ?? 0);
  if (parts > gras * 1.05 + 0.5) {
    out.push({ campo: "grasas", mensaje: `Saturadas + trans + mono + poliinsaturadas (${Math.round(parts * 10) / 10} g) superan la grasa total (${Math.round(gras * 10) / 10} g).` });
  }
  if (has(p.alcohol) && p.alcohol * (baseGramos > 0 ? 100 / baseGramos : 1) > 100) out.push({ campo: "alcohol", mensaje: "Más de 100 g de alcohol por 100 g es imposible; revisa la cifra." });
  const epaDhaG = ((p.epaDha ?? ((p.epa ?? 0) + (p.dha ?? 0))) / 1000);
  if (epaDhaG > 0 && has(p.grasasPoliinsaturadas) && epaDhaG > p.grasasPoliinsaturadas + 0.5) {
    out.push({ campo: "epa", mensaje: "EPA + DHA (están en mg) superan las grasas poliinsaturadas; revisa la unidad." });
  }
  if (has(p.epaDha) && has(p.epa) && has(p.dha) && Math.abs(p.epaDha - (p.epa + p.dha)) > Math.max(5, p.epaDha * 0.1)) {
    out.push({ campo: "epaDha", mensaje: "El total EPA + DHA no coincide con la suma de EPA y DHA." });
  }
  if (has(p.omega3Ala) && has(p.omega6Linoleico) && p.omega3Ala + p.omega6Linoleico > (p.grasasPoliinsaturadas ?? Infinity) + 0.5) {
    out.push({ campo: "grasasPoliinsaturadas", mensaje: "Omega-3 + omega-6 superan las grasas poliinsaturadas." });
  }

  // Plausibilidad por 100 g.
  const f = baseGramos > 0 ? 100 / baseGramos : 1;
  if (kcal * f > 900) out.push({ campo: "calorias", mensaje: `${Math.round(kcal * f)} kcal por 100 g es más que la grasa pura (~900); revisa la porción o la cifra.` });
  const masa = (prot + carb + gras + alc) * f;
  if (masa > 100.5) out.push({ campo: null, mensaje: `Proteína + carbos + grasa${alc > 0 ? " + alcohol" : ""} suman ${Math.round(masa)} g por 100 g (no puede pasar de 100).` });
  const total = ((p.agua ?? 0) + (p.ceniza ?? 0) + prot + carb + gras + alc) * f;
  if (has(p.agua) && total > 105) out.push({ campo: "agua", mensaje: `Agua + ceniza + macros suman ${Math.round(total)} g por 100 g (no puede pasar de 100).` });
  if (has(p.sodio) && p.sodio * f > 40000) out.push({ campo: "sodio", mensaje: "Más sodio por 100 g que la sal pura (~39 000 mg); revisa la unidad (mg)." });
  if (has(p.colesterol) && p.colesterol * f > 4000) out.push({ campo: "colesterol", mensaje: "Colesterol muy alto por 100 g; revisa la unidad (mg)." });
  for (const [k, v] of Object.entries(p.micronutrientes ?? {})) {
    const ref = MAX_POR_100G[k];
    if (ref && typeof v === "number" && v * f > ref.max) {
      out.push({ campo: k, mensaje: `${ref.nombre}: ${Math.round(v * f)} ${ref.unidad} por 100 g es poco probable (¿unidad equivocada?).` });
    }
  }
  return out;
}
