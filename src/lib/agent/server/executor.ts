/**
 * Ejecutor del agente EN EL SERVIDOR (Telegram y programador). Elección de diseño (ver docs/telegram.md):
 *
 *  - El estado de la app vive en localStorage + Supabase y se mezcla por id sin reemplazar. Para no pisar nada:
 *      · CREAR (agua, comida, tarea, nota) → se inserta una fila NUEVA con id propio: no puede chocar con nada y la app la
 *        recoge en su siguiente sincronización.
 *      · COMPLETAR una tarea → se cambia una sola columna (`is_completed`).
 *      · EDITAR algo que ya existe (título, fechas, subtareas, notas) → NO se escribe en la tabla: se encola en
 *        `agent_commands` y la app lo aplica con sus acciones de negocio (la que tiene el estado completo) y lo marca.
 *  - Los permisos ya se decidieron antes de llegar aquí (`decide()` con el canal "telegram").
 */
import { mergeFoods } from "@/lib/food-utils";
import { commitDraftItems } from "@/lib/nutrition/draft-item";
import { buildUsageMap, getResolverIndex } from "@/lib/nutrition/food-resolver";
import type { LoggedFood, MealType } from "@/lib/types";
import type { ExecResult } from "../actions/client";
import { buildNoteBlocks, buildTask, describeTaskChange, listNotes, listTasks, newId, noteUpdatePatch, taskUpdatePatch } from "../actions/pure";
import { dayTotals, dayFromKey, inferMeal, outcomeData, planFoodItems } from "../actions/nutrition-pure";
import type { Args } from "../tools/meta";
import type { AgentConfig } from "../types";
import { localParts, addDays, zonedTimeToMs } from "../tz";
import * as db from "./db";
import { loadRoutines } from "./tick";
import { agendaForDay, exerciseName, trainingToday } from "../actions/readers-pure";

export interface ServerCtx {
  db: db.Admin;
  userId: string;
  config: AgentConfig;
  nowMs: number;
}

const fail = (error: string): ExecResult => ({ ok: false, summary: error, error });
const QUEUED = "En cola: se aplicará cuando abras la app.";

export { QUEUED_TOOLS } from "./queued-tools";

async function dayWindow(ctx: ServerCtx, key: string) {
  // Ventana UTC que cubre el día local completo (para el agua, que se guarda con instante exacto).
  const from = new Date(zonedTimeToMs(key, "00:00", ctx.config.timezone)).toISOString();
  const to = new Date(zonedTimeToMs(addDays(key, 1), "00:00", ctx.config.timezone)).toISOString();
  return { from, to };
}

export async function execServer(ctx: ServerCtx, tool: string, args: Args): Promise<ExecResult> {
  try {
    switch (tool) {
      case "task_list":
        return { ok: true, summary: "Tareas", data: listTasks(await db.fetchTasks(ctx.db, ctx.userId), args) };
      case "note_list":
        return { ok: true, summary: "Notas", data: listNotes(await db.fetchNotes(ctx.db, ctx.userId), args) };

      case "training_today": {
        const wd = new Date(`${(args.fecha as string | undefined) ?? localParts(ctx.nowMs, ctx.config.timezone).date}T12:00:00Z`).getUTCDay();
        const [plan, routines] = await Promise.all([db.fetchWeeklyPlan(ctx.db, ctx.userId), db.fetchGymRoutines(ctx.db, ctx.userId)]);
        return { ok: true, summary: "Entrenamiento del día", data: trainingToday(plan, routines, wd, (id) => exerciseName(id)) };
      }
      case "agenda_today": {
        const key = (args.fecha as string | undefined) ?? localParts(ctx.nowMs, ctx.config.timezone).date;
        const [tasks, blocks, routines] = await Promise.all([db.fetchTasks(ctx.db, ctx.userId), db.fetchTimeBlocks(ctx.db, ctx.userId), loadRoutines(ctx.db, ctx.userId)]);
        return { ok: true, summary: "Agenda del día", data: agendaForDay(tasks, blocks, routines, key) };
      }
      case "ranks_summary":
        return fail("Los rangos se calculan en la app: ábrela y pregúntale ahí (por Telegram todavía no está disponible).");

      case "day_totals": {
        const key = (args.fecha as string | undefined) ?? localParts(ctx.nowMs, ctx.config.timezone).date;
        const w = await dayWindow(ctx, key);
        const [foods, water, goals] = await Promise.all([db.fetchLoggedFoodsOn(ctx.db, ctx.userId, key), db.fetchWaterBetween(ctx.db, ctx.userId, w.from, w.to), db.fetchGoals(ctx.db, ctx.userId)]);
        const t = dayTotals(foods, water, dayFromKey(key), key);
        return { ok: true, summary: `${t.calorias} kcal · ${t.aguaMl} ml de agua`, data: { ...t, metas: goals } };
      }

      case "water_add": {
        const ml = args.ml as number;
        const id = await db.insertWater(ctx.db, ctx.userId, ml, new Date(ctx.nowMs).toISOString());
        return id ? { ok: true, summary: `Agua +${ml} ml`, undo: { kind: "remove_water", id }, after: `+${ml} ml` } : fail("No pude guardar el agua.");
      }

      case "food_log": {
        const lp = localParts(ctx.nowMs, ctx.config.timezone);
        const meal = (args.meal as MealType | undefined) ?? inferMeal(lp.hour);
        const cat = await db.fetchFoodCatalog(ctx.db, ctx.userId);
        const idx = getResolverIndex(mergeFoods(cat.foods), cat.recipes);
        const outcomes = planFoodItems(args.items as Args[], meal, idx, { usage: buildUsageMap(cat.usage), caloriesMax: ctx.config.limits.caloriesMaxPerEntry });
        const oks = outcomes.flatMap((o) => (o.kind === "ok" ? [o.draft] : []));
        const created: LoggedFood[] = [];
        if (oks.length) {
          commitDraftItems(oks, {
            addLoggedFood: (f) => {
              const c: LoggedFood = { activo: true, ...f, id: newId(), timestamp: ctx.nowMs };
              created.push(c);
              return c;
            },
            addCustomFood: () => {
              throw new Error("El agente no crea alimentos nuevos.");
            },
          });
          const start = await db.countLoggedOn(ctx.db, ctx.userId, lp.date, meal);
          if (!(await db.insertLoggedFoods(ctx.db, ctx.userId, created, lp.date, start))) return fail("No pude guardar la comida.");
        }
        const kcal = created.reduce((s, f) => s + f.calorias, 0);
        const skipped = outcomes.length - oks.length;
        return {
          ok: oks.length > 0,
          summary: oks.length ? `Registré ${created.length} alimento(s) en ${meal} (${kcal} kcal)${skipped ? `; ${skipped} sin registrar` : ""}` : "No registré nada: hay dudas o no encontré los alimentos",
          data: { comida: meal, resultados: outcomeData(outcomes) },
          undo: created.length ? { kind: "remove_foods", ids: created.map((c) => c.id) } : undefined,
          after: oks.map((d) => `${d.nombre} ${d.gramos} g`).join(", ") || undefined,
        };
      }

      case "task_create": {
        const t = buildTask(args);
        return (await db.insertTask(ctx.db, ctx.userId, t)) ? { ok: true, summary: `Tarea creada: ${t.title}`, data: { id: t.id }, undo: { kind: "remove_task", id: t.id }, after: t.title } : fail("No pude guardar la tarea.");
      }

      case "task_complete": {
        const t = (await db.fetchTasks(ctx.db, ctx.userId)).find((x) => x.id === args.id);
        if (!t) return fail("No encontré esa tarea.");
        const done = args.done !== false;
        if (t.isCompleted === done) return { ok: true, summary: `«${t.title}» ya estaba ${done ? "completada" : "pendiente"}` };
        if (!(await db.setTaskCompleted(ctx.db, ctx.userId, t.id, done))) return fail("No pude actualizar la tarea.");
        return { ok: true, summary: `${done ? "Completada" : "Reabierta"}: ${t.title}`, undo: { kind: "restore_task", id: t.id, patch: { isCompleted: t.isCompleted } }, before: t.isCompleted ? "completada" : "pendiente", after: done ? "completada" : "pendiente" };
      }

      case "note_create": {
        const page = { id: newId(), title: args.title as string, icon: "FileText", blocks: buildNoteBlocks(args.text as string | undefined, args.checklist as string[] | undefined) };
        return (await db.insertNote(ctx.db, ctx.userId, page)) ? { ok: true, summary: `Nota creada: ${page.title}`, data: { id: page.id }, undo: { kind: "remove_note", id: page.id }, after: page.title } : fail("No pude guardar la nota.");
      }

      case "task_update":
      case "subtask_add":
      case "subtask_complete":
      case "note_update": {
        // Comprobar que existe antes de encolar (no encolar basura).
        if (tool === "note_update") {
          if (!(await db.fetchNotes(ctx.db, ctx.userId)).some((n) => n.id === args.id)) return fail("No encontré esa nota.");
        } else {
          const taskId = (tool === "task_update" ? args.id : args.taskId) as string;
          if (!(await db.fetchTasks(ctx.db, ctx.userId)).some((t) => t.id === taskId)) return fail("No encontré esa tarea.");
        }
        const id = await db.enqueueCommand(ctx.db, ctx.userId, tool, args);
        return id ? { ok: true, summary: QUEUED, data: { cola: true } } : fail("No pude encolar el cambio.");
      }
      default:
        return fail("Esa herramienta no está disponible.");
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falló la acción.");
  }
}

/** Vista previa breve para las tarjetas de Telegram (lee, no cambia nada). */
export async function previewServer(ctx: ServerCtx, tool: string, args: Args): Promise<{ before?: string; after?: string } | null> {
  try {
    if (tool === "task_complete" || tool === "task_update") {
      const t = (await db.fetchTasks(ctx.db, ctx.userId)).find((x) => x.id === args.id);
      if (!t) return null;
      return tool === "task_complete"
        ? { before: t.isCompleted ? "completada" : "pendiente", after: args.done !== false ? "completada" : "pendiente" }
        : describeTaskChange(t, taskUpdatePatch(t, args).patch);
    }
    if (tool === "note_update") {
      const p = (await db.fetchNotes(ctx.db, ctx.userId)).find((x) => x.id === args.id);
      if (!p) return null;
      const { patch } = noteUpdatePatch(p, args);
      return { before: p.title, after: `${patch.title ?? p.title}${patch.blocks ? ` (+${patch.blocks.length - p.blocks.length} bloque/s)` : ""}` };
    }
    if (tool === "water_add") {
      const key = localParts(ctx.nowMs, ctx.config.timezone).date;
      const w = await dayWindow(ctx, key);
      const today = (await db.fetchWaterBetween(ctx.db, ctx.userId, w.from, w.to)).reduce((s, x) => s + x.ml, 0);
      return { before: `${today} ml hoy`, after: `${today + (args.ml as number)} ml hoy` };
    }
  } catch {
    /* sin vista previa */
  }
  return null;
}
