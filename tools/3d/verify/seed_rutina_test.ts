/**
 * Prueba de seed de rutinas reales y diasSemana.
 * Corre con: node tools/3d/verify/run_ts.mjs tools/3d/verify/seed_rutina_test.ts
 *
 * Verifica:
 * - Qué pasos salen en un lunes, sábado y domingo
 * - Orden por hora
 * - Importar dos veces no duplica
 * - mergeRoutine conserva completedDates con el campo diasSemana nuevo
 */

import type { HabitRoutine, RoutineStep } from "../../../src/lib/types/habits";
import { SEED_RUTINAS } from "../../../src/lib/data/seed-mi-rutina";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `\n       got =${JSON.stringify(got)}\n       want=${JSON.stringify(want)}`);
}
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) fails++;
  console.log(cond ? "ok   " : "FALLA", name, cond ? "" : (detail ?? ""));
}

// ─── Helpers (copia de routine-utils para correr sin Next.js) ────────────────

interface RoutineStepForDay extends RoutineStep {
  routineNombre: string;
}

function stepsForDate(routines: HabitRoutine[], dateISO: string): RoutineStepForDay[] {
  const dow = new Date(`${dateISO}T12:00:00`).getDay();
  const result: RoutineStepForDay[] = [];
  for (const r of routines) {
    if (r.diasSemana && !r.diasSemana.includes(dow)) continue;
    for (const step of r.items) {
      if (step.diasSemana && !step.diasSemana.includes(dow)) continue;
      result.push({ ...step, routineNombre: r.nombre });
    }
  }
  return result.sort((a, b) => a.hora.localeCompare(b.hora));
}

function mergeDates(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

function mergeRoutine(remote: HabitRoutine, local: HabitRoutine): HabitRoutine {
  const remoteStepsById = new Map(remote.items.map((s) => [s.id, s] as const));
  const localStepsById = new Map(local.items.map((s) => [s.id, s] as const));
  const allStepIds = [...new Set([...remote.items.map((s) => s.id), ...local.items.map((s) => s.id)])];
  const items = allStepIds.map((id) => {
    const r = remoteStepsById.get(id);
    const l = localStepsById.get(id);
    if (!r) return l!;
    if (!l) return r;
    return {
      ...r,
      completedDates: mergeDates(r.completedDates, l.completedDates),
      diasSemana: r.diasSemana ?? l.diasSemana,
    };
  });
  return {
    ...remote,
    completedDates: mergeDates(remote.completedDates, local.completedDates),
    streak: Math.max(remote.streak, local.streak),
    milestonesUnlocked: [...new Set([...remote.milestonesUnlocked, ...local.milestonesUnlocked])],
    items,
    diasSemana: remote.diasSemana ?? local.diasSemana,
    endsAt: remote.endsAt ?? local.endsAt,
  };
}

// Importación idempotente (copia de la lógica del store)
function importMiRutina(current: HabitRoutine[]): HabitRoutine[] {
  const existingById = new Map(current.map((r) => [r.id, r]));
  const next = [...current];
  for (const seed of SEED_RUTINAS) {
    const existing = existingById.get(seed.id);
    if (!existing) {
      next.push({ ...seed, createdAt: Date.now() });
    } else {
      const existingStepsById = new Map(existing.items.map((s) => [s.id, s]));
      const mergedItems = seed.items.map((seedStep) => {
        const ex = existingStepsById.get(seedStep.id);
        return ex ? { ...seedStep, completedDates: ex.completedDates } : { ...seedStep };
      });
      const idx = next.indexOf(existing);
      next[idx] = {
        ...seed,
        createdAt: existing.createdAt,
        completedDates: existing.completedDates,
        streak: existing.streak,
        milestonesUnlocked: existing.milestonesUnlocked,
        items: mergedItems,
      };
    }
  }
  return next;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const routines: HabitRoutine[] = SEED_RUTINAS.map((r) => ({ ...r, createdAt: Date.now() }));

// ─── Lunes 2026-10-05 (getDay() === 1) ────────────────────────────────────────

console.log("\n=== Lunes 2026-10-05 (dow=1) ===");
const lunes = stepsForDate(routines, "2026-10-05");

ok("lunes: al menos un paso de comida", lunes.some((s) => s.categoryId === "comida"));
ok("lunes: al menos un paso de gym", lunes.some((s) => s.categoryId === "gym" && s.diasSemana?.includes(1)));
ok("lunes: al menos una clase", lunes.some((s) => s.categoryId === "estudio" && s.diasSemana?.includes(1)));
ok("lunes: ordenados por hora", lunes.every((s, i) => i === 0 || s.hora >= lunes[i - 1].hora));

const gymLunes = lunes.find((s) => s.id === "seed-gym-lun");
ok("lunes: gym es 'Pecho, hombro, tríceps'", gymLunes?.label === "Pecho, hombro, tríceps");
eq("lunes: gym hora", gymLunes?.hora, "18:00");

const clasesSis421Lun = lunes.filter((s) => s.id === "seed-cl-lun-sis421");
eq("lunes: SIS421 aparece exactamente 1 vez", clasesSis421Lun.length, 1);
eq("lunes: SIS421 hora", clasesSis421Lun[0]?.hora, "09:00");

// Pasos de Gym del martes NO deben aparecer el lunes
ok("lunes: gym-mar NO aparece", !lunes.some((s) => s.id === "seed-gym-mar"));
ok("lunes: gym-mie NO aparece", !lunes.some((s) => s.id === "seed-gym-mie"));

console.log(`  Pasos en lunes: ${lunes.length}`);
lunes.forEach((s) => console.log(`  ${s.hora} [${s.routineNombre}] ${s.label}`));

// ─── Sábado 2026-10-03 (getDay() === 6) ──────────────────────────────────────

console.log("\n=== Sábado 2026-10-03 (dow=6) ===");
const sabado = stepsForDate(routines, "2026-10-03");

eq("sábado: exactamente 3 pasos", sabado.length, 3);
ok("sábado: primer paso 06:30", sabado[0]?.hora === "06:30");
ok("sábado: Curex está", sabado.some((s) => s.label === "Curex"));
ok("sábado: sem.lun-vie NO aparece", !sabado.some((s) => s.routineNombre === "Semana (lun-vie)"));
ok("sábado: gym NO aparece", !sabado.some((s) => s.categoryId === "gym"));
ok("sábado: rutina Clases NO aparece", !sabado.some((s) => s.routineNombre === "Clases"));
ok("sábado: ordenados por hora", sabado.every((s, i) => i === 0 || s.hora >= sabado[i - 1].hora));

console.log(`  Pasos en sábado: ${sabado.length}`);
sabado.forEach((s) => console.log(`  ${s.hora} [${s.routineNombre}] ${s.label}`));

// ─── Domingo 2026-10-04 (getDay() === 0) ─────────────────────────────────────

console.log("\n=== Domingo 2026-10-04 (dow=0) ===");
const domingo = stepsForDate(routines, "2026-10-04");

eq("domingo: cero pasos (sin rutinas activas)", domingo.length, 0);

// ─── Importar dos veces no duplica ───────────────────────────────────────────

console.log("\n=== Idempotencia de importMiRutina() ===");
const empty: HabitRoutine[] = [];
const once = importMiRutina(empty);
const twice = importMiRutina(once);

eq("idempotente: 1 vez = misma cantidad que 2 veces", once.length, twice.length);
ok("idempotente: IDs únicos en once", new Set(once.map((r) => r.id)).size === once.length);
ok("idempotente: IDs únicos en twice", new Set(twice.map((r) => r.id)).size === twice.length);

// Simula que el usuario ya marcó un día
const withUserData = once.map((r) =>
  r.id === "seed-semana-lun-vie"
    ? { ...r, completedDates: ["2026-10-05"], streak: 1 }
    : r,
);
const thrice = importMiRutina(withUserData);
const swResult = thrice.find((r) => r.id === "seed-semana-lun-vie");
ok("idempotente: completedDates del usuario se preserva", swResult?.completedDates.includes("2026-10-05") ?? false);
eq("idempotente: streak del usuario se preserva", swResult?.streak, 1);

// ─── mergeRoutine conserva diasSemana ────────────────────────────────────────

console.log("\n=== mergeRoutine conserva diasSemana ===");
const remote: HabitRoutine = {
  id: "seed-gym",
  nombre: "Gym",
  diasSemana: [1, 2, 3, 4, 5],
  completedDates: ["2026-10-05"],
  streak: 1,
  milestonesUnlocked: [],
  createdAt: Date.now(),
  items: [
    { id: "seed-gym-lun", hora: "18:00", label: "Pecho", durationMin: 120, categoryId: "gym", diasSemana: [1], completedDates: ["2026-10-05"] },
    { id: "seed-gym-mar", hora: "16:00", label: "Cuádriceps", durationMin: 120, categoryId: "gym", diasSemana: [2], completedDates: [] },
  ],
};
const local: HabitRoutine = {
  ...remote,
  completedDates: ["2026-10-05", "2026-10-06"],
  streak: 2,
  items: [
    { id: "seed-gym-lun", hora: "18:00", label: "Pecho", durationMin: 120, categoryId: "gym", diasSemana: [1], completedDates: ["2026-10-05", "2026-10-06"] },
    { id: "seed-gym-mar", hora: "16:00", label: "Cuádriceps", durationMin: 120, categoryId: "gym", diasSemana: [2], completedDates: ["2026-10-07"] },
  ],
};

const merged = mergeRoutine(remote, local);
eq("merge: diasSemana de rutina se conserva", merged.diasSemana, [1, 2, 3, 4, 5]);
eq("merge: completedDates unión", merged.completedDates, ["2026-10-05", "2026-10-06"]);
eq("merge: streak mayor", merged.streak, 2);

const mergedLun = merged.items.find((s) => s.id === "seed-gym-lun");
eq("merge: step diasSemana conservado", mergedLun?.diasSemana, [1]);
eq("merge: step completedDates unión", mergedLun?.completedDates, ["2026-10-05", "2026-10-06"]);

const mergedMar = merged.items.find((s) => s.id === "seed-gym-mar");
eq("merge: step Mar completedDates del local", mergedMar?.completedDates, ["2026-10-07"]);

// ─── Seed no tiene domingo activo ────────────────────────────────────────────
console.log("\n=== Estructura del seed ===");
eq("seed: 4 rutinas", SEED_RUTINAS.length, 4);
ok("seed: IDs estables únicos", new Set(SEED_RUTINAS.map((r) => r.id)).size === 4);
ok("seed: Gym tiene 5 pasos", SEED_RUTINAS.find((r) => r.id === "seed-gym")?.items.length === 5);
ok("seed: Clases tiene 10 pasos", SEED_RUTINAS.find((r) => r.id === "seed-clases")?.items.length === 10);
ok("seed: endsAt de Clases es undefined", SEED_RUTINAS.find((r) => r.id === "seed-clases")?.endsAt === undefined);

console.log(fails > 0 ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails > 0 ? 1 : 0);
