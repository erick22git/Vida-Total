// Pruebas de las herramientas de tareas y notas del agente (validación + lógica pura).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/tasks_notes_test.ts
import { getTool, exposedTools } from "../../src/lib/agent/tools/registry";
import { decide } from "../../src/lib/agent/permissions";
import { defaultAgentConfig } from "../../src/lib/agent/config";
import { addSubtaskTo, buildNoteBlocks, buildTask, describeTaskChange, listNotes, listTasks, noteUpdatePatch, taskUpdatePatch } from "../../src/lib/agent/actions/pure";
import type { NotionPage, Task } from "../../src/lib/types/habits";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const v = (tool: string, args: unknown) => getTool(tool)!.validate(args);

// ── validación ─────────────────────────────────────────────────────
ok(v("task_create", { title: "Comprar pan" }).ok, "task_create mínima");
ok(!v("task_create", {}).ok, "task_create sin título");
ok(!v("task_create", { title: "x", dueDate: "2026-02-31" }).ok, "fecha inexistente");
ok(!v("task_create", { title: "x", reminder: "09:00" }).ok, "recordatorio sin fecha");
ok(v("task_create", { title: "x", dueDate: "2026-10-08", reminder: "09:30" }).ok, "fecha + recordatorio");
ok(!v("task_create", { title: "x", dueDate: "2026-10-08", reminder: "25:00" }).ok, "hora inválida");
ok(!v("task_create", { title: "x", subtasks: Array(11).fill("a") }).ok, "más de 10 subtareas");
ok(!v("task_create", { title: "x", priority: "urgente" }).ok, "prioridad inválida");
ok(!v("task_create", { title: "a".repeat(200) }).ok, "título demasiado largo");
ok(!v("task_update", { id: "t1" }).ok, "task_update sin cambios");
ok(v("task_update", { id: "t1", dueDate: "" }).ok, "task_update puede quitar la fecha");
ok(v("task_complete", { id: "t1" }).ok && (v("task_complete", { id: "t1" }) as { args: { done: boolean } }).args.done === true, "task_complete done=true por defecto");
ok(!v("task_complete", { id: "t1", done: "si" }).ok, "done debe ser booleano");
ok(!v("subtask_add", { taskId: "t1" }).ok, "subtask_add sin título");
ok(v("note_create", { title: "Ideas", text: "hola", checklist: ["a", "b"] }).ok, "note_create completa");
ok(!v("note_create", { title: "Ideas", checklist: Array(21).fill("a") }).ok, "checklist demasiado larga");
ok(!v("note_update", { id: "n1" }).ok, "note_update sin cambios");
ok(!v("task_list", { estado: "otra" }).ok, "task_list estado inválido");
ok(v("note_list", {}).ok, "note_list sin filtros");

// ── permisos sobre estas herramientas ──────────────────────────────
const ctx = (over = {}) => ({ channel: "app" as const, origin: "user" as const, config: defaultAgentConfig(), now: Date.now(), recentWrites: [], ...over });
ok(decide("task_create", { title: "x" }, ctx()).action === "ask", "por defecto task_create pregunta");
ok(decide("task_create", { title: "x", subtasks: ["a", "b", "c"] }, ctx({ config: { ...defaultAgentConfig(), levels: { app: { task_create: "allow" }, telegram: {} } } })).action === "ask", "tarea + 3 subtareas = 4 elementos (>3) pide confirmación aun permitida");
ok(decide("task_create", { title: "x", subtasks: ["a", "b"] }, ctx({ config: { ...defaultAgentConfig(), levels: { app: { task_create: "allow" }, telegram: {} } } })).action === "allow", "tarea + 2 subtareas = 3 elementos pasa si está permitida");
ok(getTool("task_list")?.taints === true && getTool("note_list")?.taints === true, "leer tareas/notas marca el turno como no confiable");
ok(decide("task_complete", { id: "t" }, ctx({ origin: "untrusted", config: { ...defaultAgentConfig(), levels: { app: { task_complete: "allow" }, telegram: {} } } })).action === "ask", "tras leer datos ajenos, completar pregunta aunque esté permitido");
ok(exposedTools().every((t) => t.parameters && (t.parameters as { type?: string }).type === "object"), "toda herramienta expuesta trae su esquema");

// ── lógica pura ────────────────────────────────────────────────────
const t1: Task = { id: "t1", title: "Informe", priority: "media", dueDate: "2026-10-08", isCompleted: false, subtasks: [{ id: "s1", title: "Borrador", done: false }], tags: [], color: "x", icon: "x" };
const t2: Task = { ...t1, id: "t2", title: "Gym", dueDate: "2026-10-07", isCompleted: true, subtasks: [] };
const t3: Task = { ...t1, id: "t3", title: "Sin fecha", dueDate: undefined, subtasks: [] };
ok(listTasks([t1, t2, t3], {}).map((x) => x.id).join() === "t1,t3", "pendientes por defecto, ordenadas por fecha (sin fecha al final)");
ok(listTasks([t1, t2, t3], { estado: "completadas" }).length === 1, "completadas");
ok(listTasks([t1, t2, t3], { estado: "todas", fecha: "2026-10-07" }).map((x) => x.id).join() === "t2", "filtro por fecha");
const built = buildTask({ title: "Nueva", subtasks: ["a", "b"], dueDate: "2026-10-09", reminder: "08:00" }, "fixed");
ok(built.id === "fixed" && built.subtasks.length === 2 && built.reminder === "08:00" && !built.isCompleted, "buildTask");
const up = taskUpdatePatch(t1, { id: "t1", title: "Informe final", dueDate: "" });
ok(up.patch.title === "Informe final" && up.inverse.title === "Informe" && up.patch.dueDate === undefined && up.inverse.dueDate === "2026-10-08", "taskUpdatePatch guarda el inverso");
const ch = describeTaskChange(t1, up.patch);
ok(ch.before.includes("Informe") && ch.after.includes("Informe final"), "antes → después");
const sub = addSubtaskTo(t1, { taskId: "t1", title: "Revisar" }, "new");
ok(sub.subtasks.length === 2 && sub.subtasks[1].id === "new" && t1.subtasks.length === 1, "addSubtaskTo no muta");
const page: NotionPage = { id: "n1", title: "Compras", icon: "x", blocks: buildNoteBlocks("leche y pan", ["huevos"]) };
ok(page.blocks.length === 2 && page.blocks[1].type === "checklist" && page.blocks[1].items?.[0].text === "huevos", "buildNoteBlocks");
ok(listNotes([page], { buscar: "huevos" }).length === 1 && listNotes([page], { buscar: "zzz" }).length === 0, "listNotes busca en el contenido");
const nu = noteUpdatePatch(page, { id: "n1", appendText: "más", title: "Súper" });
ok(nu.patch.title === "Súper" && nu.inverse.title === "Compras" && nu.patch.blocks?.length === 3 && nu.inverse.blocks?.length === 2, "noteUpdatePatch agrega sin borrar y guarda inverso");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
