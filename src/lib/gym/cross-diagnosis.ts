/**
 * Diagnóstico cruzado: cruza REGISTRO, CALORÍAS, PROTEÍNA, PESO, AGUA y ENTRENAMIENTO para decir DÓNDE estás
 * fallando y por qué tu peso no se mueve como tu objetivo. Módulo PURO. Nunca cambia nada solo: cada hallazgo trae
 * una acción que la persona decide tocar (ir al nutriólogo, a Calorías, a Agua, o ajustar la meta de agua).
 *
 * Orden de causas (la primera que aplica es la "causa principal"):
 *   1) no estás anotando (sin datos no se puede juzgar nada), 2) no llegas / te pasas de calorías,
 *   3) proteína baja, 4) entrenamiento al día, 5) agua. Cada una se explica con sus números.
 * Umbrales (convenciones de práctica): días "cumplidos" dentro de ±10 % de la meta; proteína ≥ 1,6 g/kg para quien
 * entrena (Morton et al. 2018, Br J Sports Med) y ≥ 1,2 g/kg si no; agua ≥ 80 % de la meta en ≥ 4 de 7 días.
 */
import type { PlanAdherenceResult } from "@/lib/nutrition/plan-adherence";

export type Area = "registro" | "calorias" | "proteina" | "peso" | "entrenamiento" | "agua";
export type Severity = "alta" | "media" | "ok";

export interface FindingAction {
  label: string;
  kind: "link" | "waterGoal";
  href?: string;
  ml?: number;
}

export interface Finding {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  detail: string;
  action?: FindingAction;
}

export interface CrossInput {
  objetivo?: "perder" | "mantener" | "ganar";
  entrena: boolean;
  pesoKg?: number;
  calorieGoal: number;
  proteinGoal: number;
  plan: PlanAdherenceResult;
  /** Días (de los últimos 7 incluido hoy) con algo registrado, y promedio de proteína de esos días. */
  loggedDaysLast7: number;
  proteinAvgG: number | null;
  water: { goalMl: number; last7Ml: number[]; trainingDaysAvgMl: number | null; restDaysAvgMl: number | null };
  training: { planned: number; completed: number; daysLeft: number; lowGroups: string[]; anySetsThisWeek: boolean };
}

const round50 = (n: number) => Math.round(n / 50) * 50;

export interface CrossResult {
  headline: string;
  findings: Finding[];
}

export function diagnoseAcrossModules(i: CrossInput): CrossResult {
  const f: Finding[] = [];
  const { plan } = i;
  const goalWord = i.objetivo === "ganar" ? "subir" : i.objetivo === "perder" ? "bajar" : "mantener";
  const notMoving = plan.weight.movedAsExpected === false;

  // 1) Registro
  if (i.loggedDaysLast7 < 5) {
    f.push({
      id: "registro",
      area: "registro",
      severity: "alta",
      title: `Solo anotaste ${i.loggedDaysLast7} de los últimos 7 días`,
      detail: "Con menos de 5 días registrados no puedo saber si estás llegando a tus calorías: lo que no se anota no cuenta. Anota todo, aunque sea aproximado.",
      action: { label: "Ir a Calorías", kind: "link", href: "/gym/calorias" },
    });
  } else {
    f.push({ id: "registro", area: "registro", severity: "ok", title: `Anotaste ${i.loggedDaysLast7} de 7 días`, detail: "Buen registro: los datos alcanzan para diagnosticar." });
  }

  // 2) Calorías
  if (plan.loggedDays >= 3 && i.calorieGoal > 0) {
    const avg = plan.avgKcal;
    const diff = Math.abs(avg - i.calorieGoal);
    if (plan.verdict === "por_debajo" || (plan.verdict === "cerca" && avg < i.calorieGoal)) {
      const isGain = i.objetivo === "ganar";
      f.push({
        id: "cal-bajo",
        area: "calorias",
        severity: isGain || plan.verdict === "por_debajo" ? "alta" : "media",
        title: `No estás llegando a tus calorías: ${avg} de ${i.calorieGoal} kcal`,
        detail: isGain
          ? `Te faltan ~${diff} kcal al día: por eso no estás ${goalWord}. Suma un snack de ~${Math.round(diff / 50) * 50} kcal (batido, fruta con yogur, frutos secos) antes de subir la meta.`
          : `Comes ~${diff} kcal menos que tu meta. Comer muy por debajo frena el entrenamiento y la recuperación.`,
        action: { label: "Ver con el nutriólogo", kind: "link", href: "/gym/nutriologo" },
      });
    } else if (plan.verdict === "sobrepasaste" || (plan.verdict === "cerca" && avg > i.calorieGoal)) {
      f.push({
        id: "cal-alto",
        area: "calorias",
        severity: i.objetivo === "perder" ? "alta" : "media",
        title: `Te pasas de tus calorías: ${avg} de ${i.calorieGoal} kcal`,
        detail: i.objetivo === "perder"
          ? `Comes ~${diff} kcal más de lo planeado: por eso no estás ${goalWord}. Revisa qué comida se te dispara (bebidas, snacks, porciones).`
          : `Comes ~${diff} kcal más que tu meta.`,
        action: { label: "Ver con el nutriólogo", kind: "link", href: "/gym/nutriologo" },
      });
    } else if (plan.verdict === "llegaste") {
      f.push({ id: "cal-ok", area: "calorias", severity: "ok", title: `Calorías en meta: ${avg} de ${i.calorieGoal} kcal`, detail: "Estás cumpliendo tu plan calórico." });
    }
  }

  // 3) Peso vs. objetivo (cuando cumples y no se mueve → ajustar la meta)
  if (notMoving && plan.adjustment) {
    f.push({
      id: "peso-ajuste",
      area: "peso",
      severity: "media",
      title: `Cumples tu meta pero el peso no se mueve`,
      detail: plan.adjustment.text,
      action: { label: "Ajustar con el nutriólogo", kind: "link", href: "/gym/nutriologo" },
    });
  } else if (plan.weight.movedAsExpected === true) {
    f.push({ id: "peso-ok", area: "peso", severity: "ok", title: "Tu peso va en la dirección de tu objetivo", detail: `${plan.weight.deltaKg} kg desde que empezó el plan.` });
  }

  // 4) Proteína
  if (i.pesoKg && i.proteinAvgG !== null && i.loggedDaysLast7 >= 3) {
    const need = (i.entrena ? 1.6 : 1.2) * i.pesoKg;
    if (i.proteinAvgG < need * 0.9) {
      f.push({
        id: "prot",
        area: "proteina",
        severity: i.objetivo === "ganar" || i.entrena ? "alta" : "media",
        title: `Proteína baja: ${Math.round(i.proteinAvgG)} g de ~${Math.round(need)} g`,
        detail: `Para ${i.entrena ? "ganar o mantener músculo entrenando" : "tu peso"} conviene ≥ ${i.entrena ? "1,6" : "1,2"} g por kg (${Math.round(need)} g). Te faltan ~${Math.round(need - i.proteinAvgG)} g: un snack con proteína (yogur griego, huevos, atún) los cubre.`,
        action: { label: "Ver con el nutriólogo", kind: "link", href: "/gym/nutriologo" },
      });
    } else {
      f.push({ id: "prot-ok", area: "proteina", severity: "ok", title: `Proteína en rango: ${Math.round(i.proteinAvgG)} g`, detail: `Meta práctica ≈ ${Math.round(need)} g.` });
    }
  }

  // 5) Entrenamiento
  const t = i.training;
  const missing = Math.max(0, t.planned - t.completed);
  if (t.planned > 0 && missing > 0) {
    const tight = missing >= t.daysLeft;
    f.push({
      id: "entreno",
      area: "entrenamiento",
      severity: tight ? "alta" : "media",
      title: `Entrenaste ${t.completed} de ${t.planned} sesiones planeadas`,
      detail: `${tight ? "No te alcanzan los días que quedan: reprograma." : `Quedan ${t.daysLeft} días para ponerte al día.`} Sin estímulo de entrenamiento el cuerpo no tiene motivo para ${i.objetivo === "ganar" ? "construir músculo" : "conservar músculo mientras baja grasa"}.`,
      action: { label: "Ir a Entrenamiento", kind: "link", href: "/gym/entrenamiento" },
    });
  } else if (t.planned > 0) {
    f.push({ id: "entreno-ok", area: "entrenamiento", severity: "ok", title: "Cumpliste tus sesiones de la semana", detail: `${t.completed} de ${t.planned}.` });
  }
  if (t.lowGroups.length > 0 && t.anySetsThisWeek) {
    f.push({
      id: "entreno-vol",
      area: "entrenamiento",
      severity: "media",
      title: `Volumen bajo en ${t.lowGroups.slice(0, 3).join(", ")}`,
      detail: "Están por debajo del mínimo semanal para progresar. El detalle de cuántas series faltan está en Coach → Progreso.",
      action: { label: "Ver mejoras", kind: "link", href: "/gym/entrenamiento/coach" },
    });
  }

  // 6) Agua
  const w = i.water;
  const metDays = w.last7Ml.filter((ml) => ml >= w.goalMl * 0.8).length;
  const avgMl = w.last7Ml.length ? w.last7Ml.reduce((a, b) => a + b, 0) / w.last7Ml.length : 0;
  if (w.goalMl > 0 && metDays < 4) {
    const reachable = Math.max(1500, round50(avgMl + 250));
    f.push({
      id: "agua",
      area: "agua",
      severity: avgMl < w.goalMl * 0.6 ? "alta" : "media",
      title: `Agua: llegaste a tu meta ${metDays} de 7 días (promedio ${Math.round(avgMl)} de ${w.goalMl} ml)`,
      detail:
        "La deshidratación leve baja el rendimiento y la saciedad. Tu meta es correcta; lo que falla es la constancia. Una meta alcanzable que vas subiendo de a 250 ml funciona mejor que una que nunca cumples.",
      action: avgMl < w.goalMl * 0.7 && reachable < w.goalMl ? { label: `Ajustar meta a ${reachable} ml`, kind: "waterGoal", ml: reachable } : { label: "Ir a Agua", kind: "link", href: "/gym/agua" },
    });
  } else if (w.goalMl > 0) {
    f.push({ id: "agua-ok", area: "agua", severity: "ok", title: `Agua: ${metDays} de 7 días en meta`, detail: "Hidratación constante." });
  }
  if (w.trainingDaysAvgMl !== null && w.restDaysAvgMl !== null && w.trainingDaysAvgMl < w.restDaysAvgMl * 0.9 && w.trainingDaysAvgMl < w.goalMl) {
    f.push({
      id: "agua-entreno",
      area: "agua",
      severity: "media",
      title: "Tomas menos agua los días que entrenas",
      detail: `${Math.round(w.trainingDaysAvgMl)} ml en días de entreno contra ${Math.round(w.restDaysAvgMl)} ml en descanso. Justo cuando sudas necesitas más: suma ~500 ml antes y después de entrenar.`,
      action: { label: "Ir a Agua", kind: "link", href: "/gym/agua" },
    });
  }

  const sev: Record<Severity, number> = { alta: 0, media: 1, ok: 2 };
  f.sort((a, b) => sev[a.severity] - sev[b.severity]);

  const first = f.find((x) => x.severity === "alta") ?? f.find((x) => x.severity === "media");
  let headline: string;
  if (!first) headline = "Todo va en orden: registro, calorías, agua y entrenamiento están alineados con tu objetivo.";
  else if (notMoving || i.objetivo)
    headline = `${notMoving ? `Tu peso no está ${goalWord === "mantener" ? "estable" : goalWord === "subir" ? "subiendo" : "bajando"} como esperas.` : "Esto es lo que más te frena ahora."} Causa principal: ${first.title.charAt(0).toLowerCase()}${first.title.slice(1)}.`;
  else headline = `Lo que más te frena ahora: ${first.title.charAt(0).toLowerCase()}${first.title.slice(1)}.`;
  return { headline, findings: f };
}
