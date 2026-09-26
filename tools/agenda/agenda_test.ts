// Pruebas de la lógica de la Agenda (sin navegador): repetir, copiar, solapes, borrar por día y creación única.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agenda/agenda_test.ts
import { planCopy } from "../../src/lib/agenda/copy";
import { isDoneOn, occursOn, occurrencesOn, repeatLabel } from "../../src/lib/agenda/recurrence";
import { emptyDraft, firstFreeStart, useAgendaStore } from "../../src/lib/agenda/store";
import { layoutDay, overlapFlags } from "../../src/lib/agenda/time";
import type { AgendaTask, AgendaTaskDraft } from "../../src/lib/agenda/types";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log("FALLA", name, JSON.stringify(got), "esperado", JSON.stringify(want));
  } else console.log("ok   ", name);
}

// 2026-09-25 es viernes.
const FRI = "2026-09-25";
const d = (over: Partial<AgendaTaskDraft>): AgendaTaskDraft => ({ ...emptyDraft(FRI, 9 * 60), title: "T", ...over });
const st = () => useAgendaStore.getState();
const titles = () => st().tasks.map((t) => t.title);

// --- Creación única: nada se crea salvo addTask explícito
eq("el store arranca vacío", st().tasks.length, 0);
const a = st().addTask(d({ title: "Clases", startMin: 600 }));
eq("una creación = una tarea", titles(), ["Clases"]);
st().addTask(d({ title: "Gym", startMin: 720 }));
eq("dos creaciones = dos tareas (sin tercera)", titles(), ["Clases", "Gym"]);
st().updateTask(a, { title: "Clases 2" });
eq("editar modifica la misma tarea (sin copia)", titles(), ["Clases 2", "Gym"]);
st().toggleDoneOn(a, FRI);
eq("marcar hecha no crea nada", [st().tasks.length, st().tasks[0].done], [2, true]);

// --- Repetición
const daily = { ...d({ title: "Diaria", repeat: { freq: "daily", days: [], until: "2026-09-30" } }), id: "r1", createdAt: 1 } as AgendaTask;
eq("diaria: el día de inicio", occursOn(daily, FRI), true);
eq("diaria: días después", occursOn(daily, "2026-09-28"), true);
eq("diaria: antes del inicio no", occursOn(daily, "2026-09-24"), false);
eq("diaria: después de 'hasta' no", occursOn(daily, "2026-10-01"), false);
const weekly = { ...d({ title: "Semanal", repeat: { freq: "weekly", days: [1, 3], until: null } }), id: "r2", createdAt: 2 } as AgendaTask;
eq("semanal lun/mié: lunes sí", occursOn(weekly, "2026-09-28"), true);
eq("semanal lun/mié: martes no", occursOn(weekly, "2026-09-29"), false);
eq("semanal lun/mié: miércoles sí", occursOn(weekly, "2026-09-30"), true);
eq("etiqueta semanal", repeatLabel(weekly), "lun, mié");
const skipped = { ...daily, skipDates: ["2026-09-28"] };
eq("un día borrado de la serie no aparece", [occursOn(skipped, "2026-09-28"), occursOn(skipped, "2026-09-29")], [false, true]);
const dn = { ...daily, doneDates: [FRI] };
eq("hecha solo ese día", [isDoneOn(dn, FRI), isDoneOn(dn, "2026-09-26")], [true, false]);
eq("ocurrencia lleva el día pedido", occurrencesOn([daily], "2026-09-27")[0].date, "2026-09-27");

// --- Solapes
const A = { ...d({ title: "A", startMin: 720, durationMin: 15 }), id: "a", createdAt: 1 } as AgendaTask;
const B = { ...d({ title: "B", startMin: 720, durationMin: 60 }), id: "b", createdAt: 2 } as AgendaTask;
const C = { ...d({ title: "C", startMin: 735, durationMin: 15 }), id: "c", createdAt: 3 } as AgendaTask;
const E = { ...d({ title: "E", startMin: 900, durationMin: 30 }), id: "e", createdAt: 4 } as AgendaTask;
eq("solapes marcados", overlapFlags([A, B, C, E]), [false, true, true, false]);
const lay = layoutDay([A, B, C, E]);
eq("las 4 tareas se dibujan", lay.items.length, 4);
eq("ninguna queda totalmente oculta (cada una asoma abajo de la anterior)", lay.items.every((it, i) => i === 0 || it.top > lay.items[i - 1].top + 8), true);
eq("la que no coincide no se marca", lay.items[3].overlapsPrev, false);

// --- Hueco libre por defecto
const busy = [{ ...d({ title: "X", startMin: 9 * 60, durationMin: 60 }), id: "x", createdAt: 1 } as AgendaTask];
eq("hueco libre salta lo ocupado", firstFreeStart(busy, FRI, 15, 15, new Date("2026-09-20T08:00:00")), 10 * 60);

// --- Copiar
st().tasks.length = 0;
useAgendaStore.setState({ tasks: [] });
st().addTask(d({ title: "Gimnasio", startMin: 480 }));
st().addTask(d({ title: "Estudiar", startMin: 600 }));
st().addTask(d({ title: "Serie", startMin: 700, repeat: { freq: "daily", days: [], until: null } }));
const ids = st().tasks.map((t) => t.id);
const pAll = planCopy(st().tasks, FRI, ids, [0, 1, 2, 3, 4, 5, 6], 7);
eq("todos los días (7): 2 tareas x 7 días; la serie no se copia", pAll.create.length, 14);
const pSome = planCopy(st().tasks, FRI, ids, [1, 3], 7);
eq("solo lunes y miércoles", [...new Set(pSome.create.map((t) => t.date))].sort(), ["2026-09-28", "2026-09-30"]);
eq("lunes y miércoles: 4 tareas", pSome.create.length, 4);
eq("copiar no toca el origen", planCopy(st().tasks, FRI, ids, [5], 7).create.every((t) => t.date !== FRI), true);
eq("el plan no escribe nada", st().tasks.length, 3);
const n = st().applyCopy(pSome);
eq("aplicar crea exactamente lo planeado", [n, st().tasks.length], [4, 7]);
eq("segunda copia igual: todo ya existe → 0 nuevas", planCopy(st().tasks, FRI, ids, [1, 3], 7).create.length, 0);
eq("segunda copia igual: se informan omitidas", planCopy(st().tasks, FRI, ids, [1, 3], 7).skipped, 4);
eq("copias nacen sin hacer y con id nuevo", st().tasks.slice(3).every((t) => !t.done && !ids.includes(t.id)), true);

// --- Borrar / vaciar / mover
const ser = st().tasks.find((t) => t.title === "Serie")!;
st().deleteTask(ser.id, "2026-09-27");
eq("borrar un día de la serie no la borra", [!!st().tasks.find((t) => t.id === ser.id), occursOn(st().tasks.find((t) => t.id === ser.id)!, "2026-09-27")], [true, false]);
const beforeClear = st().tasks.length;
st().clearDay("2026-09-28");
eq("vaciar día quita las 2 sueltas de ese día", st().tasks.length, beforeClear - 2);
eq("vaciar día oculta la serie ese día", occursOn(st().tasks.find((t) => t.id === ser.id)!, "2026-09-28"), false);
eq("los otros días siguen igual", st().tasks.filter((t) => t.date === "2026-09-30").length, 2);
const g = st().tasks.find((t) => t.title === "Gimnasio" && t.date === FRI)!;
st().moveTasks([g.id], "2026-10-02");
eq("mover conserva la hora y cambia el día", [st().tasks.find((t) => t.id === g.id)!.date, st().tasks.find((t) => t.id === g.id)!.startMin], ["2026-10-02", 480]);
st().deleteTask(g.id);
eq("eliminar quita solo esa", st().tasks.some((t) => t.id === g.id), false);

// --- Subtareas y notas viven dentro de la tarea
const p = st().addTask(d({ title: "Entreno" }));
st().addSubtask(p, "Calentamiento");
st().updateTask(p, { notes: "llevar toalla" });
const before = st().tasks.length;
st().addSubtask(p, "Estiramiento");
eq("subtareas no son tareas de la línea de tiempo", st().tasks.length, before);
eq("la subtarea pertenece a su padre", st().tasks.find((t) => t.id === p)!.subtasks.map((s) => s.title), ["Calentamiento", "Estiramiento"]);
eq("las notas se guardan", st().tasks.find((t) => t.id === p)!.notes, "llevar toalla");
st().deleteTask(p);
eq("borrar el padre borra sus subtareas", st().tasks.some((t) => t.id === p), false);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
