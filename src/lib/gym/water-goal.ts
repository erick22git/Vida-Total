/**
 * Meta diaria de agua sugerida con base científica (pedido: "que sepa cuánta agua debería tomar al
 * día respaldado con base científica... relacionado a cuántas calorías y el ejercicio que hago").
 * Combina dos piezas, cada una con su propia fuente — no inventa ningún número:
 *
 * 1. Base por sexo/edad: la AI (Adequate Intake) de agua total del Institute of Medicine, de la que
 *    ~81% viene de bebidas — exactamente la misma cuenta que ya usa `nutrient-targets.ts` (reusada
 *    acá, no duplicada) para la sugerencia de "Revisar sugerencia" de Ajustes de Calorías.
 * 2. Extra por el entrenamiento de HOY: Mayo Clinic Care Network (atribuido a la ACSM) recomienda
 *    120-230 ml cada 15-20 minutos de ejercicio. Es un estimado GENERAL, no individualizado — el
 *    propio position stand de la ACSM (2007, "Exercise and Fluid Replacement") evita dar un número
 *    fijo porque la tasa de sudor real varía mucho entre personas, y lo preciso es pesarse antes y
 *    después del ejercicio, algo que esta app no mide. Se usa el punto medio de ese rango (~10 ml por
 *    minuto de entrenamiento), redondeado a los 50 ml más cercanos.
 *
 * Nunca cambia la meta guardada por su cuenta — es una sugerencia con Aceptar/Descartar, mismo patrón
 * que el resto de los ajustes adaptativos de la app.
 */
import { getNutrientTargets, type Sexo } from "@/lib/nutrition/nutrient-targets";

/** Punto medio de 120-230 ml cada 15-20 min (Mayo Clinic Care Network / ACSM) — ver comentario de arriba. */
export const EXERCISE_WATER_ML_PER_MIN = 10;

export interface WaterGoalSuggestion {
  baseMl: number;
  genericoBase: boolean;
  exerciseMinutesToday: number;
  exercicioMl: number;
  totalMl: number;
  mensaje: string;
}

export function suggestWaterGoal(sexo: Sexo | undefined, edad: number | undefined, exerciseMinutesToday: number): WaterGoalSuggestion {
  const targets = getNutrientTargets({ sexo, edad });
  const aguaBebidas = targets.targets.aguaBebidas;
  const baseMl = aguaBebidas.objetivo;
  const minutos = Math.max(0, Math.round(exerciseMinutesToday));
  const exercicioMl = Math.round((minutos * EXERCISE_WATER_ML_PER_MIN) / 50) * 50;
  const totalMl = baseMl + exercicioMl;
  const mensaje =
    exercicioMl > 0
      ? `${baseMl} ml base (según sexo/edad) + ${exercicioMl} ml extra por ${minutos} min de entrenamiento hoy (estimado general, Mayo Clinic/ACSM) = ${totalMl} ml.`
      : `${baseMl} ml base (según sexo/edad). Sin entrenamiento registrado hoy, sin ajuste extra.`;
  return { baseMl, genericoBase: aguaBebidas.generico, exerciseMinutesToday: minutos, exercicioMl, totalMl, mensaje };
}
