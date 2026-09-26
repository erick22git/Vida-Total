// Pruebas de las funciones avanzadas de la Agenda: alertas, colores, iconos, importación .ics, Replan, IA (interfaz) e Inbox.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agenda/agenda_advanced_test.ts
import { icons } from "lucide-react";
import { addDays, format } from "date-fns";
import { alertLabel, alertsOf, alertsSummary, alertTimes, clampOffset, newAlert } from "../../src/lib/agenda/alerts";
import { MAX_PRESETS, hexToHsl, hslToHex, normalizeHex, readableInk } from "../../src/lib/agenda/colors";
import { planCopy } from "../../src/lib/agenda/copy";
import { interpretPhrase } from "../../src/lib/agenda/assistant";
import { searchAllIcons } from "../../src/lib/agenda/all-icons";
import { iconForTitle, searchIcons } from "../../src/lib/agenda/icons";
import { parseICS } from "../../src/lib/agenda/ics";
import { occursOn } from "../../src/lib/agenda/recurrence";
import { pendingItems } from "../../src/lib/agenda/replan";
import { isReadOnlyEvent, sourceOf } from "../../src/lib/agenda/sources";
import { emptyDraft, useAgendaStore } from "../../src/lib/agenda/store";
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
const st = () => useAgendaStore.getState();
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = new Date();
const day = (n: number) => iso(addDays(TODAY, n));
const d = (over: Partial<AgendaTaskDraft>): AgendaTaskDraft => ({ ...emptyDraft(day(0), 9 * 60), title: "T", ...over });

// ---------------- Alertas
eq("tarea nueva: 1 alerta a la hora", alertsOf(emptyDraft(day(0), 600)).map((a) => a.offsetMin), [0]);
eq("tarea antigua (alert:true) → 1 alerta", alertsOf({ alert: true }).map((a) => a.offsetMin), [0]);
eq("tarea antigua (alert:false) → ninguna", alertsOf({ alert: false }), []);
eq("etiquetas", [0, 5, 60, 90, 1440, 2880].map(alertLabel), ["A la hora", "5 min antes", "1 hora antes", "1 h 30 min antes", "1 día antes", "2 días antes"]);
eq("resumen", [alertsSummary([]), alertsSummary([newAlert(10)]), alertsSummary([newAlert(0), newAlert(5)])], ["Sin alertas", "10 min antes", "2 alertas"]);
eq("límite de adelanto", [clampOffset(-5), clampOffset(99999)], [0, 7 * 1440]);
const at = { ...d({ startMin: 600, alerts: [newAlert(0), newAlert(30)] }), id: "x", createdAt: 1 } as AgendaTask;
eq("momentos de aviso (10:00 y 9:30)", alertTimes(at, day(0)).map((t) => t.getHours() * 60 + t.getMinutes()), [570, 600]);
eq("todo el día avisa desde las 8:00", alertTimes({ ...at, allDay: true, startMin: null, alerts: [newAlert(0)] }, day(0)).map((t) => t.getHours()), [8]);
useAgendaStore.setState({ tasks: [] });
const t1 = st().addTask(d({ title: "Con alertas" }));
st().updateTask(t1, { alerts: [newAlert(15), newAlert(60)] });
eq("crear/editar alertas se guarda en la tarea", alertsOf(st().tasks[0]).map((a) => a.offsetMin), [15, 60]);
const idFirst = alertsOf(st().tasks[0])[0].id;
st().updateTask(t1, { alerts: alertsOf(st().tasks[0]).map((a) => (a.id === idFirst ? { ...a, offsetMin: 5 } : a)) });
eq("editar una alerta", alertsOf(st().tasks[0]).map((a) => a.offsetMin), [5, 60]);
st().updateTask(t1, { alerts: alertsOf(st().tasks[0]).filter((a) => a.id !== idFirst) });
eq("eliminar una alerta", alertsOf(st().tasks[0]).map((a) => a.offsetMin), [60]);
st().updateTask(t1, { alerts: [] });
eq("sin alertas se mantiene (no vuelve solo)", alertsOf(st().tasks[0]), []);

// ---------------- Colores
eq("HEX #FFFFFF", normalizeHex("#FFFFFF"), "#FFFFFF");
eq("HEX corto y sin #", [normalizeHex("fc0"), normalizeHex("ffcc00"), normalizeHex(" #AbC ")], ["#FFCC00", "#FFCC00", "#AABBCC"]);
eq("HEX inválidos", [normalizeHex("#GG0000"), normalizeHex("12"), normalizeHex("")], [null, null, null]);
const back = hslToHex(hexToHsl("#0B63D6").h, hexToHsl("#0B63D6").s, hexToHsl("#0B63D6").l);
eq("HEX ⇄ HSL (redondeo de ±2 por canal)", [1, 3, 5].every((i) => Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt("#0B63D6".slice(i, i + 2), 16)) <= 2), true);
eq("tinta legible", [readableInk("#FFFFFF"), readableInk("#0B63D6"), readableInk("#F5C037")], ["#161618", "#FFFFFF", "#161618"]);
eq("sin presets al inicio", st().colorPresets, []);
eq("crear preset", [st().addColorPreset("#12ab34"), st().colorPresets], [true, ["#12AB34"]]);
st().addColorPreset("#12AB34");
eq("no duplica presets", st().colorPresets.length, 1);
eq("HEX inválido no crea preset", [st().addColorPreset("zzz"), st().colorPresets.length], [false, 1]);
eq("editar preset", [st().updateColorPreset("#12AB34", "ff0000"), st().colorPresets], [true, ["#FF0000"]]);
for (let i = 0; i < 20; i++) st().addColorPreset(`#${(i + 16).toString(16).padStart(2, "0")}0000`);
eq(`máximo ${MAX_PRESETS} presets`, st().colorPresets.length, MAX_PRESETS);
st().removeColorPreset("#FF0000");
eq("eliminar preset", st().colorPresets.includes("#FF0000"), false);
st().resetColorPresets();
eq("restablecer paleta", st().colorPresets, []);
st().updateTask(t1, { color: "#12AB34" });
eq("el color vive en la tarea (fuente única)", st().tasks[0].color, "#12AB34");

// ---------------- Iconos
const names = Object.keys(icons);
eq("biblioteca amplia (>1000 iconos)", names.length > 1000, true);
eq("buscar 'comida' en la biblioteca", searchAllIcons("comida", names).slice(0, 3).includes("Utensils"), true);
eq("buscar 'comida' en el catálogo rápido", searchIcons("comida").some((i) => i.key === "utensils"), true);
eq("buscar por nombre en inglés", searchAllIcons("pizza", names).includes("Pizza"), true);
eq("icono automático por título", [iconForTitle("Ir al gym"), iconForTitle("Clases de inglés")], ["dumbbell", "book"]);
st().updateTask(t1, { icon: "lucide:Pizza" });
eq("el icono elegido persiste en la tarea", st().tasks[0].icon, "lucide:Pizza");

// ---------------- Importación .ics
const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Trabajo",
  "BEGIN:VEVENT", "UID:ev1", "SUMMARY:Reunión de equipo", `DTSTART:${day(1).replace(/-/g, "")}T100000`, `DTEND:${day(1).replace(/-/g, "")}T110000`, "END:VEVENT",
  "BEGIN:VEVENT", "UID:ev2", "SUMMARY:Feriado", `DTSTART;VALUE=DATE:${day(2).replace(/-/g, "")}`, "END:VEVENT",
  "BEGIN:VEVENT", "UID:ev3", "SUMMARY:Standup", `DTSTART:${day(1).replace(/-/g, "")}T103000`, "DURATION:PT30M", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE", "END:VEVENT",
  "BEGIN:VTODO", "UID:td1", "SUMMARY:Comprar comida", "END:VTODO",
  "BEGIN:VTODO", "UID:td2", "SUMMARY:Pagar internet", `DUE:${day(3).replace(/-/g, "")}T180000`, "END:VTODO",
  "END:VCALENDAR",
].join("\r\n");
const parsed = parseICS(ICS);
eq("nombre del calendario", parsed.calendarName, "Trabajo");
eq("eventos leídos", parsed.events.map((e) => [e.title, e.startMin, e.durationMin, e.allDay]), [["Reunión de equipo", 600, 60, false], ["Feriado", null, 60, true], ["Standup", 630, 30, false]]);
eq("repetición semanal desde RRULE", parsed.events[2].repeat, { freq: "weekly", days: [1, 3], until: null });
eq("recordatorios leídos (con y sin fecha)", parsed.reminders.map((r) => [r.title, r.date === null, r.startMin]), [["Comprar comida", true, null], ["Pagar internet", false, 1080]]);
let bad = "";
try { parseICS("esto no es un calendario"); } catch (e) { bad = (e as Error).message; }
eq("archivo inválido da error claro", bad.includes("no es un calendario"), true);

useAgendaStore.setState({ tasks: [], calendars: [] });
const localA = st().addTask(d({ title: "Mi tarea", startMin: 600, durationMin: 60 }));
void localA;
const r1 = st().importCalendar({ name: "Trabajo", kind: "events", fileName: "trabajo.ics", color: "#6C9FD8", items: parsed.events });
eq("importa 3 eventos nuevos", [r1.added, r1.updated, r1.removed], [3, 0, 0]);
const r2 = st().importCalendar({ name: "Trabajo", kind: "events", fileName: "trabajo.ics", color: "#6C9FD8", items: parsed.events });
eq("volver a importar no duplica", [r2.added, r2.updated, st().tasks.filter((t) => sourceOf(t) === "calendar").length], [0, 3, 3]);
const r3 = st().importCalendar({ name: "Trabajo", kind: "events", fileName: "trabajo.ics", color: "#6C9FD8", items: parsed.events.slice(0, 2) });
eq("lo que ya no está en el archivo se quita (sincronía de una vía)", [r3.removed, st().tasks.filter((t) => sourceOf(t) === "calendar").length], [1, 2]);
st().importCalendar({ name: "Trabajo", kind: "events", fileName: "trabajo.ics", color: "#6C9FD8", items: parsed.events });
const ri = st().importCalendar({ name: "Lista", kind: "reminders", fileName: "rec.ics", color: "#79B247", items: parsed.reminders });
eq("recordatorios: 2 nuevos", ri.added, 2);
const rem = st().tasks.filter((t) => sourceOf(t) === "reminder");
eq("recordatorio sin fecha va a la Bandeja", rem.find((t) => t.title === "Comprar comida")?.date, null);
eq("recordatorio con fecha/hora va a la línea de tiempo", [rem.find((t) => t.title === "Pagar internet")?.date, rem.find((t) => t.title === "Pagar internet")?.startMin], [day(3), 1080]);
eq("las fuentes no se mezclan", [...new Set(st().tasks.map((t) => sourceOf(t)))].sort(), ["calendar", "local", "reminder"]);
eq("evento de calendario = solo lectura; tarea no", [isReadOnlyEvent(st().tasks.find((t) => t.title === "Standup")!), isReadOnlyEvent(st().tasks.find((t) => t.title === "Mi tarea")!)], [true, false]);
const calId = st().calendars.find((c) => c.kind === "events")!.id;
st().setCalendarVisible(calId, false);
eq("calendario oculto sigue guardado", [st().calendars.find((c) => c.id === calId)!.visible, st().tasks.some((t) => t.calendarId === calId)], [false, true]);
const standup = st().tasks.find((t) => t.title === "Standup")!;
eq("Standup se repite lun/mié desde el día importado", [occursOn(standup, day(1)), occursOn(standup, day(2))].length, 2);
st().setCalendarVisible(calId, true);

// ---------------- Solapes con eventos de calendario
useAgendaStore.setState({ tasks: [], calendars: [] });
const tk = (title: string, start: number, dur: number, source?: "calendar") => ({ ...d({ title, startMin: start, durationMin: dur, source }), id: title, createdAt: title.charCodeAt(0) }) as AgendaTask;
const mix = [tk("Tarea A", 600, 60), tk("Tarea B", 615, 30), tk("Evento C", 630, 60, "calendar"), tk("Tarea D", 720, 30)];
eq("A, B, evento C y D: solapes", overlapFlags(mix), [false, true, true, false]);
eq("las 4 se dibujan", layoutDay(mix).items.map((i) => i.task.title), ["Tarea A", "Tarea B", "Evento C", "Tarea D"]);
useAgendaStore.setState({ tasks: mix });
eq("copiar día NO copia eventos de calendario", planCopy(mix, day(0), mix.map((m) => m.id), [0, 1, 2, 3, 4, 5, 6], 7).create.filter((c) => c.title === "Evento C").length, 0);

// ---------------- Replan (con recurrencia)
useAgendaStore.setState({ tasks: [], calendars: [] });
const now = new Date(`${day(0)}T15:00:00`);
const oneOff = st().addTask(d({ title: "Pasada suelta", date: day(-2), startMin: 600 }));
const inbox0 = st().addTask(d({ title: "En la bandeja", date: null, startMin: null }));
const future = st().addTask(d({ title: "Futura", date: day(3), startMin: 600 }));
const series = st().addTask(d({ title: "Entrenamiento", date: day(-7), startMin: 480, repeat: { freq: "daily", days: [], until: null } }));
const ev = st().addTask({ ...d({ title: "Evento pasado", date: day(-1), startMin: 700 }), source: "calendar" });
void inbox0; void future; void ev;
const pend = pendingItems(st().tasks, now);
eq("Replan no incluye futuras, bandeja ni eventos de calendario", pend.some((p) => ["Futura", "En la bandeja", "Evento pasado"].includes(p.task.title)), false);
eq("cada ocurrencia sin hacer de la serie es un pendiente", pend.filter((p) => p.task.id === series).length, 8);
eq("incluye la tarea suelta", pend.some((p) => p.task.id === oneOff && p.date === day(-2)), true);
const target = day(-3);
const snapshot = st().tasks;
st().replanAction(series, target, "complete");
eq("completar UNA ocurrencia no toca las demás", [st().tasks.find((t) => t.id === series)!.doneDates, occursOn(st().tasks.find((t) => t.id === series)!, day(-4))], [[target], true]);
st().replanAction(series, day(-4), "delete");
eq("eliminar una ocurrencia = omitir ese día, la serie sigue", [st().tasks.find((t) => t.id === series)!.skipDates, st().tasks.some((t) => t.id === series), occursOn(st().tasks.find((t) => t.id === series)!, day(-5))], [[day(-4)], true, true]);
const n0 = st().tasks.length;
st().replanAction(series, day(-5), "reschedule", { date: day(1), startMin: 900 });
const moved = st().tasks.find((t) => t.date === day(1) && t.title === "Entrenamiento" && !t.repeat?.freq.startsWith("d"));
eq("reprogramar una ocurrencia crea una tarea suelta y omite ese día", [!!moved, moved?.startMin, st().tasks.length, occursOn(st().tasks.find((t) => t.id === series)!, day(-5))], [true, 900, n0 + 1, false]);
st().replanAction(series, day(-6), "inbox");
const inb = st().tasks.find((t) => t.date === null && t.title === "Entrenamiento");
eq("enviar una ocurrencia a la Bandeja: copia sin fecha, serie intacta", [!!inb, occursOn(st().tasks.find((t) => t.id === series)!, day(-6)), occursOn(st().tasks.find((t) => t.id === series)!, day(-1))], [true, false, true]);
st().replanAction(oneOff, day(-2), "complete");
eq("completar una tarea suelta", st().tasks.find((t) => t.id === oneOff)!.done, true);
const one2 = st().addTask(d({ title: "Para eliminar", date: day(-1), startMin: 600 }));
st().replanAction(one2, day(-1), "delete");
eq("eliminar una tarea suelta la borra", st().tasks.some((t) => t.id === one2), false);
const one3 = st().addTask(d({ title: "Para bandeja", date: day(-1), startMin: 600 }));
st().replanAction(one3, day(-1), "inbox");
eq("enviar tarea suelta a la Bandeja", [st().tasks.find((t) => t.id === one3)!.date, st().tasks.find((t) => t.id === one3)!.startMin], [null, null]);
st().restoreTasks(snapshot);
eq("deshacer devuelve el estado anterior", st().tasks.length, snapshot.length);

// ---------------- Bandeja → línea de tiempo
useAgendaStore.setState({ tasks: [] });
const ib = st().addTask(d({ title: "Comprar comida", date: null, startMin: null }));
eq("en la Bandeja no tiene día ni hora", [st().tasks[0].date, st().tasks[0].startMin], [null, null]);
st().updateTask(ib, { date: day(1), startMin: 18 * 60, durationMin: 45 });
eq("al programarla pasa a la línea de tiempo", [st().tasks[0].date, st().tasks[0].startMin, layoutDay(st().tasks.filter((t) => t.date === day(1))).items.length], [day(1), 1080, 1]);

// ---------------- IA (solo interfaz): el intérprete de vista previa
const sug = interpretPhrase("Quiero entrenar mañana a las 7", TODAY);
eq("IA vista previa: título", sug?.title, "Entrenar");
eq("IA vista previa: mañana 7:00", [sug?.date, sug?.startMin], [day(1), 420]);
eq("IA vista previa: icono", sug?.icon, "dumbbell");
eq("IA vista previa: frase vacía = sin sugerencia", interpretPhrase("  ", TODAY), null);
eq("interpretar no crea nada", st().tasks.length, 1);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
