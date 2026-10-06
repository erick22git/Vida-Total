// Pruebas de kegel-dates.ts. Se corre con:
//   node tools/3d/verify/run_ts.mjs tools/3d/verify/kegel_dates_test.ts
import {
  localDayKey,
  dayKeyToDate,
  daysDiff,
  toLocalDayKey,
  computeKegelStreak,
} from "../../../src/lib/gym/kegel-dates";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `  got=${JSON.stringify(got)}  want=${JSON.stringify(want)}`);
}

// ── localDayKey ──────────────────────────────────────────────────────────────
const d = new Date(2026, 9, 5, 23, 30, 0); // Oct 5 2026 23:30 local
eq("localDayKey Oct 5 23:30", localDayKey(d), "2026-10-05");
const d2 = new Date(2026, 0, 1, 0, 0, 0); // Jan 1
eq("localDayKey Jan 1 00:00", localDayKey(d2), "2026-01-01");
// Medianoche: sin desbordamiento de UTC
const midnight = new Date(2026, 9, 6, 0, 0, 0);
eq("localDayKey medianoche local Oct 6", localDayKey(midnight), "2026-10-06");

// ── dayKeyToDate ─────────────────────────────────────────────────────────────
const parsed = dayKeyToDate("2026-10-05");
eq("dayKeyToDate año", parsed.getFullYear(), 2026);
eq("dayKeyToDate mes (0-idx)", parsed.getMonth(), 9);
eq("dayKeyToDate día", parsed.getDate(), 5);
eq("dayKeyToDate hora local", parsed.getHours(), 0);

// ── daysDiff ─────────────────────────────────────────────────────────────────
eq("daysDiff mismo día", daysDiff("2026-10-05", "2026-10-05"), 0);
eq("daysDiff +1 día", daysDiff("2026-10-05", "2026-10-06"), 1);
eq("daysDiff -1 día", daysDiff("2026-10-06", "2026-10-05"), -1);
eq("daysDiff +7 días", daysDiff("2026-10-01", "2026-10-08"), 7);
eq("daysDiff cruce de mes", daysDiff("2026-09-30", "2026-10-01"), 1);
eq("daysDiff cruce de año", daysDiff("2025-12-31", "2026-01-01"), 1);

// ── toLocalDayKey ─────────────────────────────────────────────────────────────
eq("toLocalDayKey null → null", toLocalDayKey(null), null);
eq("toLocalDayKey undefined → null", toLocalDayKey(undefined), null);
eq("toLocalDayKey vacío → null", toLocalDayKey(""), null);
// Ya es dayKey
eq("toLocalDayKey dayKey ya formateado", toLocalDayKey("2026-10-05"), "2026-10-05");
// ISO con Z (el bug: new Date("2026-10-05") sería UTC midnight)
const isoUtc = "2026-10-05T03:00:00.000Z"; // UTC 03:00 = local Oct 4 23:00 (UTC-4) o Oct 5 06:00 (UTC+3)
const fromIso = toLocalDayKey(isoUtc);
eq("toLocalDayKey ISO parseado sin crash", fromIso !== null, true);
// ISO que ya fue procesado por gym-sync (midnight local como ISO)
const isoMidnightLocal = new Date(2026, 9, 5, 0, 0, 0).toISOString();
eq("toLocalDayKey ISO midnight local → Oct 5", toLocalDayKey(isoMidnightLocal), "2026-10-05");

// Migración: ISO con hora completa (como guardaba el store antiguo)
const storedByOldStore = new Date(2026, 9, 5, 14, 30, 0).toISOString(); // Oct 5 14:30 local
eq("migración ISO antiguo → Oct 5", toLocalDayKey(storedByOldStore), "2026-10-05");

// ── computeKegelStreak ────────────────────────────────────────────────────────
const empty: Set<string> = new Set();
eq("racha vacía", computeKegelStreak(empty, "2026-10-05"), { current: 0, best: 0 });

// 3 días consecutivos que terminan hoy
const three = new Set(["2026-10-03", "2026-10-04", "2026-10-05"]);
eq("3 días consecutivos actual", computeKegelStreak(three, "2026-10-05").current, 3);
eq("3 días consecutivos best", computeKegelStreak(three, "2026-10-05").best, 3);

// Hoy no cumplido: corriente = 0, histórica cuenta desde antes
const pastRun = new Set(["2026-10-03", "2026-10-04"]);
eq("hoy no cumplido → actual 0", computeKegelStreak(pastRun, "2026-10-05").current, 0);
eq("hoy no cumplido → best 2", computeKegelStreak(pastRun, "2026-10-05").best, 2);

// Racha rota y retomada
const broken = new Set(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05"]);
eq("racha rota actual (2)", computeKegelStreak(broken, "2026-10-05").current, 2);
eq("racha rota best (2)", computeKegelStreak(broken, "2026-10-05").best, 2);

// Histórica más larga que la actual
const older = new Set(["2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-10-05"]);
eq("histórica más larga", computeKegelStreak(older, "2026-10-05").best, 4);
eq("actual solo 1", computeKegelStreak(older, "2026-10-05").current, 1);

// Doble llamada (idempotencia) — simulación: mismo dayKey dos veces
// La lógica de idempotencia está en gymStore, aquí solo verificamos daysDiff
eq("doble llamada mismo día → diff 0", daysDiff("2026-10-05", "2026-10-05"), 0);

// Cruce de medianoche: sesión a las 23:58, nueva a las 00:02 siguiente día
const yesterday = localDayKey(new Date(2026, 9, 4, 23, 58, 0));
const today = localDayKey(new Date(2026, 9, 5, 0, 2, 0));
eq("cruce medianoche: días distintos", yesterday !== today, true);
eq("cruce medianoche: diff = 1", daysDiff(yesterday, today), 1);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
