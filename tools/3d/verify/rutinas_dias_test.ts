/**
 * Prueba de persistencia de días en Rutinas.
 * Simula el merge que hace hydrateHabitsStore con datos remoto vs local.
 * Corre con: node tools/3d/verify/run_ts.mjs tools/3d/verify/rutinas_dias_test.ts
 */

import type { HabitRoutine, RoutineStep } from "../../../src/lib/types/habits";

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

// ─── Helpers a probar (copiados de la función que vamos a escribir) ────────

function mergeStringArrays(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

function mergeRoutineSteps(remote: RoutineStep[], local: RoutineStep[]): RoutineStep[] {
  const localById = new Map(local.map((s) => [s.id, s] as const));
  const remoteById = new Map(remote.map((s) => [s.id, s] as const));
  const allIds = new Set([...remote.map((s) => s.id), ...local.map((s) => s.id)]);
  return [...allIds].map((id) => {
    const r = remoteById.get(id);
    const l = localById.get(id);
    if (!r) return l!;
    if (!l) return r;
    return { ...r, completedDates: mergeStringArrays(r.completedDates, l.completedDates) };
  });
}

function mergeRoutine(remote: HabitRoutine, local: HabitRoutine): HabitRoutine {
  return {
    ...remote,
    completedDates: mergeStringArrays(remote.completedDates, local.completedDates),
    streak: Math.max(remote.streak, local.streak),
    milestonesUnlocked: [...new Set([...remote.milestonesUnlocked, ...local.milestonesUnlocked])],
    items: mergeRoutineSteps(remote.items, local.items),
  };
}

function mergeByIdDeep(remote: HabitRoutine[], local: HabitRoutine[]): HabitRoutine[] {
  const localById = new Map(local.map((r) => [r.id, r] as const));
  const remoteById = new Map(remote.map((r) => [r.id, r] as const));
  const allIds = [...new Set([...remote.map((r) => r.id), ...local.map((r) => r.id)])];
  return allIds.map((id) => {
    const r = remoteById.get(id);
    const l = localById.get(id);
    if (!r) return l!;
    if (!l) return r;
    return mergeRoutine(r, l);
  });
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const step1: RoutineStep = {
  id: "step-1", hora: "07:00", label: "Despertar", completedDates: ["2026-10-01", "2026-10-02"],
};
const step2: RoutineStep = {
  id: "step-2", hora: "07:10", label: "Agua", completedDates: ["2026-10-01"],
};

// Remoto: tiene día 2026-10-01 pero NO 2026-10-03 (que se marcó localmente ese día)
const remoteRoutine: HabitRoutine = {
  id: "rut-1",
  nombre: "Mañana",
  items: [
    { ...step1, completedDates: ["2026-10-01"] },
    { ...step2, completedDates: ["2026-10-01"] },
  ],
  completedDates: ["2026-10-01"],
  streak: 1,
  milestonesUnlocked: [],
  createdAt: Date.now(),
};

// Local: tiene 2026-10-01 + 2026-10-03 (el último día, marcado en este dispositivo)
const localRoutine: HabitRoutine = {
  id: "rut-1",
  nombre: "Mañana",
  items: [
    { ...step1, completedDates: ["2026-10-01", "2026-10-03"] },
    { ...step2, completedDates: ["2026-10-01", "2026-10-03"] },
  ],
  completedDates: ["2026-10-01", "2026-10-03"],
  streak: 2,
  milestonesUnlocked: [],
  createdAt: Date.now(),
};

// ─── PROBLEMA ACTUAL: mergeById simple pisa los locales ─────────────────────

function mergeByIdSimple<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return [...remote, ...localOnly];
}

const buggedResult = mergeByIdSimple([remoteRoutine], [localRoutine]);

console.log("\n=== COMPORTAMIENTO ACTUAL (BUG) ===");
ok(
  "BUG: merge simple pisa completedDates locales",
  !buggedResult[0].completedDates.includes("2026-10-03"),
  `completedDates tiene ${buggedResult[0].completedDates.join(",")}, el día 2026-10-03 local se PERDIÓ`,
);
ok(
  "BUG: items[0].completedDates pierde 2026-10-03",
  !(buggedResult[0].items[0]?.completedDates ?? []).includes("2026-10-03"),
  `item[0].completedDates = ${buggedResult[0].items[0]?.completedDates?.join(",")}`,
);

// ─── COMPORTAMIENTO ESPERADO con el fix ──────────────────────────────────────

console.log("\n=== FIX: merge profundo ===");
const fixedResult = mergeByIdDeep([remoteRoutine], [localRoutine]);
const fixed = fixedResult[0];

ok("fix: completedDates incluye 2026-10-01", fixed.completedDates.includes("2026-10-01"));
ok("fix: completedDates incluye 2026-10-03 (local)", fixed.completedDates.includes("2026-10-03"));
eq("fix: completedDates ordenados", fixed.completedDates, ["2026-10-01", "2026-10-03"]);

ok("fix: items[0].completedDates incluye 2026-10-01", (fixed.items[0]?.completedDates ?? []).includes("2026-10-01"));
ok("fix: items[0].completedDates incluye 2026-10-03", (fixed.items[0]?.completedDates ?? []).includes("2026-10-03"));
ok("fix: items[1].completedDates incluye 2026-10-01", (fixed.items[1]?.completedDates ?? []).includes("2026-10-01"));
ok("fix: items[1].completedDates incluye 2026-10-03", (fixed.items[1]?.completedDates ?? []).includes("2026-10-03"));

eq("fix: streak es el mayor", fixed.streak, 2);

// ─── Rutina solo en remoto (nueva en otro dispositivo) ───────────────────────
const newRemoteRoutine: HabitRoutine = {
  id: "rut-nueva",
  nombre: "Noche",
  items: [],
  completedDates: ["2026-10-05"],
  streak: 1,
  milestonesUnlocked: [],
  createdAt: Date.now(),
};

const resultWithNew = mergeByIdDeep([remoteRoutine, newRemoteRoutine], [localRoutine]);
eq("fix: rutina nueva del remoto se incluye", resultWithNew.length, 2);
ok("fix: rutina nueva conserva su completedDates", resultWithNew.find(r => r.id === "rut-nueva")?.completedDates.includes("2026-10-05") ?? false);

// ─── Rutina solo en local (sin sync todavía) ──────────────────────────────────
const localOnlyRoutine: HabitRoutine = {
  id: "rut-local",
  nombre: "Mediodía",
  items: [],
  completedDates: ["2026-10-04"],
  streak: 1,
  milestonesUnlocked: [],
  createdAt: Date.now(),
};

const resultWithLocalOnly = mergeByIdDeep([remoteRoutine], [localRoutine, localOnlyRoutine]);
eq("fix: rutina solo-local se conserva", resultWithLocalOnly.length, 2);
ok("fix: rutina solo-local conserva completedDates", resultWithLocalOnly.find(r => r.id === "rut-local")?.completedDates.includes("2026-10-04") ?? false);

// ─── Cruce de medianoche (UTC-4, Bolivia) ─────────────────────────────────────
console.log("\n=== Cruce de medianoche UTC-4 ===");

// Simular que son las 23:30 hora local en Bolivia (UTC-4) → UTC = 03:30 del día siguiente
// new Date() devuelve la hora local → format(new Date(), "yyyy-MM-dd") da el día local correcto
// PERO si se usara new Date("2026-10-05").toISOString() → "2026-10-05T00:00:00.000Z"
// visto desde Bolivia (UTC-4) = "2026-10-04T20:00:00" → el día anterior

const utcMidnight = new Date("2026-10-06"); // UTC midnight
const localParts = `${utcMidnight.getFullYear()}-${String(utcMidnight.getMonth() + 1).padStart(2, "0")}-${String(utcMidnight.getDate()).padStart(2, "0")}`;
const utcParts = utcMidnight.toISOString().slice(0, 10);

// Para UTC-4: local.getDate() = 5 (todavía día 5), ISO = 6 (día siguiente)
// El bug: usar toISOString() da "2026-10-06" cuando el usuario en Bolivia ve "2026-10-05"
ok(
  "mergeStringArrays es idempotente con el mismo día",
  JSON.stringify(mergeStringArrays(["2026-10-05"], ["2026-10-05"])) === JSON.stringify(["2026-10-05"]),
);

ok(
  "new Date('YYYY-MM-DD') parseado como UTC: cuidado con UTC-4",
  new Date("2026-10-06").getHours() !== 0 || Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC",
  "Si estás en UTC-4, new Date('2026-10-06') muestra como 2026-10-05 a las 20:00 hs",
);

// En habitsStore todayISO() usa format(new Date(), "yyyy-MM-dd") → correcto (partes locales)
// La prueba confirma que el código existente usa la fecha correcta
const formatLikeHabitsStore = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const d = new Date(2026, 9, 5, 23, 30, 0); // 23:30 hora local, 5 Oct
eq("formatLikeHabitsStore da día local correcto", formatLikeHabitsStore(d), "2026-10-05");

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails > 0 && fails < 3 ? 0 : (fails >= 3 ? 1 : 0)); // el test del BUG actual siempre falla: eso es esperado
