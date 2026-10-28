/**
 * "Qué mejorar" de Entrenamiento: en vez de un genérico "priorizá X", dice QUÉ grupo, CUÁNTAS series faltan o
 * sobran, con qué ejercicios y por qué. Módulo PURO, todo sale del motor `hypertrophy-engine.ts`.
 *
 * Base: landmarks de volumen semanal MEV/MAV/MRV por grupo (Israetel; ver docs/ciencia-entrenamiento.md);
 * frecuencia ≥ 2 días por semana por grupo rinde más que 1 con el mismo volumen (Schoenfeld et al. 2016,
 * Sports Med); meseta = 1RM estimado sin subir en 3 sesiones. Las series al fallo altas (≥ 40 %) avisan de fatiga.
 */
import type { Exercise, MuscleGroup, WorkoutSession } from "@/lib/types";
import {
  estimated1RM,
  plateauDetected,
  recentTechniqueWarnings,
  volumeLandmarksFor,
  volumeStatus,
  weeklyFailureLoad,
  weeklyMuscleVolume,
  type ExperienceLevel,
} from "@/lib/training/hypertrophy-engine";

export type Priority = "alta" | "media" | "baja";

export interface ImprovementItem {
  id: string;
  area: string;
  priority: Priority;
  title: string;
  detail: string;
}

const GROUPS: MuscleGroup[] = ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps", "Cuadriceps", "Femoral", "Gluteos", "Pantorrilla", "Abdomen"];

export interface ImprovementInput {
  /** Sesiones con `date` en día LOCAL (y, si la hay, la sesión en curso). */
  sessions: WorkoutSession[];
  exercises: Exercise[];
  level: ExperienceLevel;
  weekStart: string;
  /** Sesiones planeadas esta semana (días sin "Descanso") y completadas. */
  planned: number;
  completed: number;
  /** Días que quedan de la semana contando hoy (1-7). */
  daysLeft: number;
}

export function adviseImprovements(i: ImprovementInput): ImprovementItem[] {
  const out: ImprovementItem[] = [];
  const volume = weeklyMuscleVolume(i.sessions, i.exercises, i.weekStart);
  const nameOf = (g: MuscleGroup) =>
    i.exercises
      .filter((e) => e.categoria === g)
      .slice(0, 2)
      .map((e) => e.nombre)
      .join(" o ");

  // 1) Adherencia: cuántas sesiones faltan y si todavía alcanzan los días.
  const missing = Math.max(0, i.planned - i.completed);
  if (i.planned > 0 && missing > 0) {
    const tight = missing >= i.daysLeft;
    out.push({
      id: "adherencia",
      area: "Constancia",
      priority: tight ? "alta" : "media",
      title: `Te faltan ${missing} ${missing === 1 ? "sesión" : "sesiones"} esta semana`,
      detail: tight
        ? `Quedan ${i.daysLeft} ${i.daysLeft === 1 ? "día" : "días"}: tendrías que entrenar todos los que quedan. Si no llegas, reprograma una sesión y no la dejes pasar en blanco.`
        : `Quedan ${i.daysLeft} días: hay margen, solo agéndalas.`,
    });
  }

  // 2) Volumen por grupo, con números concretos.
  for (const g of GROUPS) {
    const lm = volumeLandmarksFor(g, i.level);
    if (!lm) continue;
    const sets = Math.round((volume[g] ?? 0) * 10) / 10;
    const status = volumeStatus(sets, lm);
    if (status === "bajo") {
      const need = Math.ceil(lm.mev - sets);
      out.push({
        id: `vol-${g}`,
        area: g,
        priority: sets === 0 ? "alta" : "media",
        title: `${g}: ${sets} de ${lm.mev} series mínimas`,
        detail: `Te faltan ~${need} series para llegar al mínimo que hace progresar (MEV). Suma ${Math.min(need, 4)} series${nameOf(g) ? ` de ${nameOf(g)}` : ""} en tu próxima sesión.`,
      });
    } else if (status === "excedido") {
      out.push({
        id: `vol-${g}`,
        area: g,
        priority: "alta",
        title: `${g}: ${sets} series, pasaste tu máximo recuperable (${lm.mrv})`,
        detail: `Baja ~${Math.ceil(sets - lm.mrv)} series o programa un deload de ${g}: más volumen que esto ya no se recupera.`,
      });
    } else if (status === "cercaLimite") {
      out.push({
        id: `vol-${g}`,
        area: g,
        priority: "baja",
        title: `${g}: ${sets} series, cerca de tu límite (${lm.mrv})`,
        detail: `Mantén lo que haces; no sumes más series de ${g} esta semana.`,
      });
    }
  }

  // 3) Frecuencia: un grupo con volumen concentrado en un solo día.
  const daysByGroup = new Map<MuscleGroup, Set<string>>();
  for (const s of i.sessions) {
    const key = s.date.slice(0, 10);
    if (key < i.weekStart) continue;
    for (const log of s.ejercicios) {
      if (!log.sets.some((x) => x.completado)) continue;
      const ex = i.exercises.find((e) => e.id === log.exerciseId);
      if (!ex) continue;
      daysByGroup.set(ex.categoria, (daysByGroup.get(ex.categoria) ?? new Set()).add(key));
    }
  }
  if (i.daysLeft <= 3) {
    for (const [g, days] of daysByGroup) {
      const sets = volume[g] ?? 0;
      if (days.size === 1 && sets >= 8 && volumeLandmarksFor(g, i.level)) {
        out.push({
          id: `frec-${g}`,
          area: g,
          priority: "baja",
          title: `${g}: todo el volumen en un solo día`,
          detail: `Repartir las series de ${g} en 2 días por semana rinde más que juntarlas en uno (Schoenfeld 2016). Pasa la mitad a otro día.`,
        });
      }
    }
  }

  // 4) Fatiga y técnica.
  const fail = weeklyFailureLoad(i.sessions, i.weekStart);
  if (fail.highFatigue) {
    out.push({
      id: "fallo",
      area: "Fatiga",
      priority: "alta",
      title: `${Math.round(fail.ratio * 100)} % de tus series fueron al fallo`,
      detail: "Llegar siempre al fallo acumula fatiga sin más resultado. Deja 1-2 repeticiones en reserva en la mayoría de las series y adelanta un deload si te sientes agotado.",
    });
  }
  for (const w of recentTechniqueWarnings(i.sessions)) {
    const ex = i.exercises.find((e) => e.id === w.exerciseId);
    out.push({
      id: `tec-${w.exerciseId}`,
      area: "Técnica",
      priority: "media",
      title: `${ex?.nombre ?? w.exerciseId}: técnica irregular`,
      detail: `${w.notedSets} notas recientes (ej. “${w.lastNote}”). Baja el peso y arregla la técnica antes de subir carga.`,
    });
  }

  // 5) Mesetas: ejercicios cuyo 1RM estimado no sube.
  const sorted = [...i.sessions].filter((s) => s.completado).sort((a, b) => (a.date < b.date ? -1 : 1));
  const ids = new Set(sorted.flatMap((s) => s.ejercicios.map((l) => l.exerciseId)));
  let plateaus = 0;
  for (const id of ids) {
    if (plateaus >= 3) break;
    const history: number[] = [];
    for (const s of sorted) {
      const log = s.ejercicios.find((l) => l.exerciseId === id);
      if (!log) continue;
      const best = log.sets.filter((x) => x.completado && x.tipo !== "calentamiento").reduce((m, x) => Math.max(m, estimated1RM(x.peso, x.reps)), 0);
      if (best > 0) history.push(best);
    }
    if (plateauDetected(history)) {
      plateaus++;
      const ex = i.exercises.find((e) => e.id === id);
      out.push({
        id: `meseta-${id}`,
        area: "Progreso",
        priority: "media",
        title: `${ex?.nombre ?? id}: no sube hace 3 sesiones`,
        detail: "Prueba un deload (baja 10-20 % la carga una semana), cambia la variante o sube las repeticiones antes de subir el peso.",
      });
    }
  }

  const order: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}
