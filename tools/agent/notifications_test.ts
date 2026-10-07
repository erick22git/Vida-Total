// Pruebas de "qué toca avisar ahora" (función pura, independiente del programador).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/notifications_test.ts
import { dueNotifications, variantKey, MAX_SNOOZES, type NotifInput, type SentInfo } from "../../src/lib/agent/notifications";
import { defaultAgentConfig, sanitizeConfig } from "../../src/lib/agent/config";
import { zonedTimeToMs } from "../../src/lib/agent/tz";
import type { AgentConfig } from "../../src/lib/agent/types";
import type { Habit, HabitRoutine, Task } from "../../src/lib/types/habits";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const TZ = "America/La_Paz";
const DAY = "2026-10-07"; // miércoles
const at = (hhmm: string) => zonedTimeToMs(DAY, hhmm, TZ);
function cfg(over: (c: AgentConfig) => void = () => {}): AgentConfig {
  const c = defaultAgentConfig();
  c.timezone = TZ;
  c.notifications.enabled = true;
  c.notifications.types = { tasks: true, routines: false, water: false, meals: false, summary: false };
  over(c);
  return c;
}
const task = (over: Partial<Task> = {}): Task => ({ id: "t1", title: "Entregar informe", priority: "media", dueDate: DAY, reminder: "10:00", isCompleted: false, subtasks: [], tags: [], color: "x", icon: "x", ...over });
function input(nowHHmm: string, over: Partial<NotifInput> = {}): NotifInput {
  return {
    nowMs: at(nowHHmm),
    config: cfg(),
    tasks: [],
    routines: [],
    habits: [],
    waterTodayMl: 0,
    waterGoalMl: 2500,
    kcalToday: 0,
    kcalGoal: 2000,
    mealsLoggedToday: new Set(),
    sent: new Map(),
    sentToday: 0,
    ...over,
  };
}
const keys = (n: ReturnType<typeof dueNotifications>) => n.map((x) => x.key);

// ── interruptor general y silencio ─────────────────────────────────
ok(dueNotifications(input("10:05", { tasks: [task()], config: cfg((c) => { c.notifications.enabled = false; }) })).length === 0, "apagado por defecto: no avisa");
ok(dueNotifications(input("10:05", { tasks: [task()], config: cfg((c) => { c.killSwitch = true; }) })).length === 0, "apagado total: no avisa");
ok(dueNotifications(input("23:30", { tasks: [task({ reminder: "23:15" })] })).length === 0, "horario silencioso 22:30–07:00: no avisa");
ok(dueNotifications(input("03:00", { tasks: [task({ reminder: "02:50" })] })).length === 0, "silencio de madrugada");
ok(dueNotifications(input("10:05", { tasks: [task()], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 1, "sin silencio configurado avisa");

// ── tareas ─────────────────────────────────────────────────────────
ok(dueNotifications(input("09:59", { tasks: [task()] })).length === 0, "antes de la hora no avisa");
const n1 = dueNotifications(input("10:00", { tasks: [task()] }));
ok(n1.length === 1 && n1[0].kind === "task" && n1[0].buttons.join() === "done,snooze" && n1[0].taskId === "t1", "a la hora avisa con Hecho/Posponer");
ok(dueNotifications(input("12:30", { tasks: [task()] })).length === 0, "pasada la ventana de 2 h no avisa");
ok(dueNotifications(input("10:05", { tasks: [task({ isCompleted: true })] })).length === 0, "tarea completada no avisa");
ok(dueNotifications(input("10:05", { tasks: [task({ dueDate: "2026-10-08" })] })).length === 0, "otro día no avisa");
ok(dueNotifications(input("10:05", { tasks: [task({ reminder: undefined })] })).length === 0, "sin recordatorio no avisa");
const sentTask = new Map<string, SentInfo>([[n1[0].key, { at: at("10:00") }]]);
ok(dueNotifications(input("10:30", { tasks: [task()], sent: sentTask })).length === 0, "un aviso no se repite");
const sub = dueNotifications(input("11:00", { tasks: [task({ reminder: undefined, subtasks: [{ id: "s1", title: "Borrador", done: false, dueDate: DAY, reminder: "11:00" }] })] }));
ok(sub.length === 1 && sub[0].kind === "subtask" && sub[0].subtaskId === "s1", "subtarea con recordatorio");
ok(dueNotifications(input("11:00", { tasks: [task({ reminder: undefined, subtasks: [{ id: "s1", title: "x", done: true, dueDate: DAY, reminder: "11:00" }] })] })).length === 0, "subtarea hecha no avisa");

// ── posponer ───────────────────────────────────────────────────────
const base = n1[0].key;
const snoozed = new Map<string, SentInfo>([[base, { at: at("10:00"), snoozeUntil: at("10:10") }]]);
ok(dueNotifications(input("10:05", { tasks: [task()], sent: snoozed })).length === 0, "pospuesto: antes del plazo no avisa");
const again = dueNotifications(input("10:11", { tasks: [task()], sent: snoozed }));
ok(again.length === 1 && again[0].key === base + "#1", "pospuesto: vuelve a avisar con clave #1");
const snoozed2 = new Map(snoozed).set(base + "#1", { at: at("10:11"), snoozeUntil: at("10:21") });
ok(dueNotifications(input("10:25", { tasks: [task()], sent: snoozed2 }))[0]?.key === base + "#2", "segundo pospuesto");
ok(dueNotifications(input("11:45", { tasks: [task()], sent: snoozed })).length === 1, "un pospuesto vencido vuelve a avisar aun fuera de la ventana de 2 h");
ok(variantKey(base, new Map([[base, { at: 1, snoozeUntil: 5 }], [base + "#1", { at: 6, snoozeUntil: 7 }], [base + "#2", { at: 8, snoozeUntil: 9 }], [base + "#3", { at: 10, snoozeUntil: 11 }]]), 99999) === null, `máximo ${MAX_SNOOZES} pospuestos`);
ok(variantKey(base, new Map([[base, { at: 1 }]]), 99999) === null, "enviado sin posponer: nunca vuelve");

// ── rutinas ────────────────────────────────────────────────────────
const routine: HabitRoutine = {
  id: "r1",
  nombre: "Mañana",
  items: [{ id: "st1", hora: "06:35", label: "Estirar", completedDates: [] }],
  createdAt: 0,
  completedDates: [],
  streak: 0,
  milestonesUnlocked: [],
};
ok(dueNotifications(input("06:20", { routines: [routine], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 0, "rutina: 15 min antes todavía no (aviso a 10 min)");
const rn = dueNotifications(input("06:27", { routines: [routine], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) }));
ok(rn.length === 1 && rn[0].kind === "routine" && rn[0].body.includes("06:35"), "rutina: avisa 10 min antes");
ok(dueNotifications(input("06:27", { routines: [{ ...routine, items: [{ ...routine.items[0], completedDates: [DAY] }] }], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 0, "rutina: paso ya hecho no avisa");
ok(dueNotifications(input("06:27", { routines: [{ ...routine, diasSemana: [1] }], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 0, "rutina: no aplica hoy (solo lunes)");
ok(dueNotifications(input("06:27", { routines: [{ ...routine, endsAt: "2026-10-01" }], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 0, "rutina vencida no avisa");
const habit: Habit = { id: "h1", name: "Estirar", icon: "x", color: "x", frequency: "diario", streak: 0, completedDates: [DAY], milestonesUnlocked: [] };
ok(dueNotifications(input("06:27", { routines: [{ ...routine, items: [{ ...routine.items[0], habitId: "h1" }] }], habits: [habit], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.routines = true; }) })).length === 0, "rutina: paso vinculado a un hábito ya cumplido no avisa");

// ── agua ───────────────────────────────────────────────────────────
ok(dueNotifications(input("07:30", { waterTodayMl: 0, config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types.water = true; }) })).length === 0, "agua: antes de las 8:00 no");
const wc = cfg((c) => { c.notifications.types.water = true; });
const w = dueNotifications(input("15:00", { waterTodayMl: 300, config: wc }));
ok(w.length === 1 && w[0].kind === "water" && w[0].buttons.join() === "water250,later", "agua: va por debajo del ritmo");
ok(dueNotifications(input("15:00", { waterTodayMl: 1800, config: wc })).length === 0, "agua: va bien, no avisa");
ok(dueNotifications(input("15:00", { waterTodayMl: 300, lastWaterAt: at("14:00"), config: wc })).length === 0, "agua: respeta el mínimo entre avisos (150 min)");
ok(dueNotifications(input("15:00", { waterTodayMl: 300, lastWaterAt: at("11:00"), config: wc })).length === 1, "agua: pasado el mínimo vuelve a avisar");
ok(dueNotifications(input("15:00", { waterTodayMl: 300, config: cfg() })).length === 0, "agua desactivada");

// ── comidas ────────────────────────────────────────────────────────
const m = dueNotifications(input("10:00", { config: cfg((c) => { c.notifications.types.meals = true; }) }));
ok(m.length === 1 && m[0].key === `meal:desayuno:${DAY}`, "desayuno sin registrar a las 9:30+");
ok(dueNotifications(input("10:00", { mealsLoggedToday: new Set(["desayuno" as const]), config: cfg((c) => { c.notifications.types.meals = true; }) })).length === 0, "desayuno ya registrado no avisa");
ok(dueNotifications(input("12:00", { config: cfg((c) => { c.notifications.types.meals = true; }) })).length === 0, "pasadas 2 h de la hora de la comida no avisa");

// ── resumen ────────────────────────────────────────────────────────
const sm = dueNotifications(input("21:35", { kcalToday: 1800, waterTodayMl: 2000, tasks: [task({ reminder: undefined })], config: cfg((c) => { c.quietHours.enabled = false; c.notifications.types = { tasks: false, routines: false, water: false, meals: false, summary: true }; }) }));
ok(sm.length === 1 && sm[0].kind === "summary" && sm[0].body.includes("1800") && sm[0].body.includes("sin hacer: 1"), "resumen diario");

// ── límites anti-spam ──────────────────────────────────────────────
const many = Array.from({ length: 6 }, (_, k) => task({ id: `t${k}` }));
ok(dueNotifications(input("10:05", { tasks: many })).length === 3, "máximo 3 avisos por pasada");
ok(dueNotifications(input("10:05", { tasks: many, sentToday: 9 })).length === 1, "tope diario (10): quedan 1");
ok(dueNotifications(input("10:05", { tasks: many, sentToday: 10 })).length === 0, "tope diario alcanzado");
const mixed = dueNotifications(input("10:05", { tasks: [task()], waterTodayMl: 0, config: cfg((c) => { c.notifications.types.water = true; c.notifications.types.meals = true; }) }));
ok(keys(mixed)[0].startsWith("task:"), "las tareas van primero");
ok(sanitizeConfig({ notifications: { maxPerDay: 9999, waterEveryMin: 1, mealTimes: { desayuno: "25:99" } } }).notifications.maxPerDay === 30, "sanea: tope diario máximo");
ok(sanitizeConfig({ notifications: { waterEveryMin: 1 } }).notifications.waterEveryMin === 60 && sanitizeConfig({ notifications: { mealTimes: { desayuno: "25:99" } } }).notifications.mealTimes.desayuno === "09:30", "sanea: mínimos y horas inválidas");
ok(sanitizeConfig(null).notifications.enabled === false, "por defecto no avisa");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
