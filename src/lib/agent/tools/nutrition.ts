/** Herramientas del agente: agua y comidas. Solo metadatos y validación (la resolución de alimentos vive en `actions/nutrition-pure.ts`). */
import {
  asArgs,
  isDayKey,
  isErr,
  optNumber,
  optText,
  reqNumber,
  type Args,
  type ToolMeta,
  type Validation,
} from "./meta";

const fail = (error: string): Validation => ({ ok: false, error });
export const MEALS = ["desayuno", "almuerzo", "cena", "snack1", "snack2"] as const;
export const MAX_FOOD_ITEMS = 8;

export const NUTRITION_TOOLS: ToolMeta[] = [
  {
    name: "water_add",
    module: "agua",
    label: "Registrar agua",
    description: "Suma agua al registro de hoy, en mililitros (un vaso ≈ 250 ml, una botella chica ≈ 500 ml).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: { ml: { type: "number", description: "Mililitros a registrar." } },
      required: ["ml"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const ml = reqNumber(a, "ml", 10, 5000);
      if (isErr(ml)) return fail(ml.error);
      return { ok: true, args: { ml: Math.round(ml) } };
    },
    limitCheck: (a, limits) => ((a.ml as number) > limits.waterMaxMl ? `Son ${a.ml} ml; tu límite por acción es ${limits.waterMaxMl} ml.` : null),
  },
  {
    name: "food_log",
    module: "comidas",
    label: "Registrar comida",
    description:
      "Registra lo que comió el usuario. Cada item es un alimento con su cantidad (gramos, o cantidad de porciones). Busca el alimento en la base; si es ambiguo o no existe NO lo registra y te devuelve opciones para que preguntes. Nunca crea alimentos nuevos.",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: {
        meal: { type: "string", enum: [...MEALS], description: "Si no lo dice, infiérelo de la hora (desayuno, almuerzo, cena, snack1 media tarde, snack2)." },
        items: {
          type: "array",
          maxItems: MAX_FOOD_ITEMS,
          items: {
            type: "object",
            properties: {
              texto: { type: "string", description: "Nombre del alimento tal como lo dijo el usuario, sin la cantidad." },
              gramos: { type: "number" },
              cantidad: { type: "number", description: "Número de porciones/unidades (2 huevos = 2) cuando no da gramos." },
            },
            required: ["texto"],
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    batchSize: (a) => (Array.isArray(a.items) ? a.items.length : 1),
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      if (a.meal !== undefined && !MEALS.includes(a.meal as (typeof MEALS)[number])) return fail('"meal" inválida.');
      if (!Array.isArray(a.items) || a.items.length === 0 || a.items.length > MAX_FOOD_ITEMS) return fail(`"items" debe traer de 1 a ${MAX_FOOD_ITEMS} alimentos.`);
      const items: Args[] = [];
      for (const it of a.items) {
        const o = asArgs(it);
        if (!o) return fail("Cada item debe ser un objeto.");
        const texto = optText(o, "texto", 100);
        if (isErr(texto) || !texto) return fail('Cada item necesita "texto".');
        const gramos = optNumber(o, "gramos", 1, 5000);
        if (isErr(gramos)) return fail(gramos.error);
        const cantidad = optNumber(o, "cantidad", 0.25, 50);
        if (isErr(cantidad)) return fail(cantidad.error);
        items.push({ texto, ...(gramos !== undefined ? { gramos } : {}), ...(cantidad !== undefined ? { cantidad } : {}) });
      }
      return { ok: true, args: { ...(a.meal ? { meal: a.meal } : {}), items } };
    },
  },
  {
    name: "day_totals",
    module: "comidas",
    label: "Ver totales del día",
    description: "Calorías, macros y agua de un día (por defecto hoy) frente a las metas del usuario.",
    kind: "read",
    exposed: true,
    parameters: {
      type: "object",
      properties: { fecha: { type: "string", description: "yyyy-MM-dd; por defecto hoy." } },
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      if (a.fecha !== undefined && !isDayKey(a.fecha)) return fail('"fecha" debe ser yyyy-MM-dd.');
      return { ok: true, args: a.fecha ? { fecha: a.fecha } : {} };
    },
  },
];
