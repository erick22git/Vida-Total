/**
 * Acceso a datos del agente DESDE EL SERVIDOR (Telegram, programador de avisos). Usa la service role: se salta RLS, así que
 * CADA consulta filtra por `user_id` explícitamente. Solo debe importarse desde rutas de servidor y scripts.
 *
 * Esto duplica a propósito unos pocos mapeos fila↔tipo de `gym-sync.ts` / `habits-sync.ts`, que dependen del cliente de
 * navegador. Si cambia una columna de esas tablas, actualiza también aquí.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeConfig } from "@/lib/agent/config";
import type { ActionRecord, UndoSpec } from "@/lib/agent/history";
import type { AgentConfig } from "@/lib/agent/types";
import type { Food, LoggedFood, MealType, Recipe, WaterEntry } from "@/lib/types";
import type { NotionBlock, NotionPage, Subtask, Task } from "@/lib/types/habits";

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export const admin = (): Admin | null => createAdminClient();

const warn = (label: string, err: unknown) => console.warn(`[agent-server] ${label}:`, err instanceof Error ? err.message : err);

// ───────────── Configuración ─────────────

/** Configuración saneada del usuario. Nunca trae "Auto total" (es del dispositivo). Sin tabla/fila → valores por defecto. */
export async function loadConfig(db: Admin, userId: string): Promise<AgentConfig> {
  try {
    const { data } = await db.from("agent_settings").select("config").eq("user_id", userId).maybeSingle();
    return { ...sanitizeConfig(data?.config ?? null), autoTotal: null };
  } catch (err) {
    warn("loadConfig", err);
    return { ...sanitizeConfig(null), autoTotal: null };
  }
}

export async function saveConfig(db: Admin, userId: string, config: AgentConfig): Promise<void> {
  const { error } = await db.from("agent_settings").upsert({ user_id: userId, config: { ...config, autoTotal: null }, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) warn("saveConfig", error.message);
}

// ───────────── Historial de acciones ─────────────

export async function recentWriteTimes(db: Admin, userId: string): Promise<number[]> {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data } = await db.from("agent_action_log").select("created_at").eq("user_id", userId).eq("ok", true).gte("created_at", since).limit(700);
    return (data ?? []).map((r) => new Date(r.created_at as string).getTime());
  } catch (err) {
    warn("recentWriteTimes", err);
    return [];
  }
}

export async function logAction(db: Admin, userId: string, rec: Pick<ActionRecord, "tool" | "args" | "summary" | "ok" | "undo"> & { channel: "telegram" | "scheduler" }): Promise<void> {
  const { error } = await db.from("agent_action_log").insert({ user_id: userId, channel: rec.channel, tool: rec.tool, args: rec.args, summary: rec.summary, ok: rec.ok, undo: rec.undo ?? null });
  if (error) warn("logAction", error.message);
}

// ───────────── Lecturas ─────────────

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: Task["priority"];
  due_date: string | null;
  time_slot: number | null;
  reminder?: string | null;
  is_completed: boolean;
  subtasks: Subtask[] | null;
  tags: string[] | null;
  color: string | null;
  icon: string | null;
}
export const rowToTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description ?? undefined,
  priority: r.priority,
  dueDate: r.due_date ?? undefined,
  timeSlot: r.time_slot ?? undefined,
  reminder: r.reminder ?? undefined,
  isCompleted: r.is_completed,
  subtasks: r.subtasks ?? [],
  tags: r.tags ?? [],
  color: r.color ?? "var(--habitos)",
  icon: r.icon ?? "CheckCircle2",
});

export async function fetchTasks(db: Admin, userId: string): Promise<Task[]> {
  const { data, error } = await db.from("tasks").select("*").eq("user_id", userId).limit(500);
  if (error) warn("fetchTasks", error.message);
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

export async function fetchNotes(db: Admin, userId: string): Promise<NotionPage[]> {
  const { data, error } = await db.from("notion_pages").select("id,title,icon,blocks").eq("user_id", userId).limit(300);
  if (error) warn("fetchNotes", error.message);
  return ((data ?? []) as Array<{ id: string; title: string; icon: string | null; blocks: NotionBlock[] | null }>).map((r) => ({ id: r.id, title: r.title, icon: r.icon ?? "FileText", blocks: r.blocks ?? [] }));
}

interface LoggedRow {
  id: string;
  food_id: string;
  nombre: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  meal: MealType;
  logged_at: string;
  gramos: number | null;
  activo: boolean;
}
export async function fetchLoggedFoodsOn(db: Admin, userId: string, dateKey: string): Promise<LoggedFood[]> {
  const { data, error } = await db.from("logged_foods").select("id,food_id,nombre,calorias,proteina,carbos,grasas,meal,logged_at,gramos,activo").eq("user_id", userId).eq("logged_date", dateKey).limit(300);
  if (error) warn("fetchLoggedFoodsOn", error.message);
  return ((data ?? []) as LoggedRow[]).map((r) => ({
    id: r.id,
    foodId: r.food_id,
    nombre: r.nombre,
    calorias: Number(r.calorias),
    proteina: Number(r.proteina),
    carbos: Number(r.carbos),
    grasas: Number(r.grasas),
    meal: r.meal,
    timestamp: new Date(r.logged_at).getTime(),
    gramos: r.gramos ?? undefined,
    activo: r.activo,
  }));
}

export async function fetchWaterBetween(db: Admin, userId: string, fromIso: string, toIso: string): Promise<WaterEntry[]> {
  const { data, error } = await db.from("water_entries").select("id,ml,logged_at").eq("user_id", userId).gte("logged_at", fromIso).lt("logged_at", toIso).limit(300);
  if (error) warn("fetchWaterBetween", error.message);
  return ((data ?? []) as Array<{ id: string; ml: number; logged_at: string }>).map((r) => ({ id: r.id, ml: Number(r.ml), timestamp: new Date(r.logged_at).getTime() }));
}

export async function fetchGoals(db: Admin, userId: string) {
  const { data } = await db.from("gym_settings").select("calorie_goal,protein_goal,carbs_goal,fat_goal,water_goal_ml").eq("user_id", userId).maybeSingle();
  return {
    calorias: Number(data?.calorie_goal ?? 2000),
    proteina: Number(data?.protein_goal ?? 140),
    carbos: Number(data?.carbs_goal ?? 220),
    grasas: Number(data?.fat_goal ?? 60),
    aguaMl: Number(data?.water_goal_ml ?? 2500),
  };
}

/** Alimentos propios del usuario (los de la base van aparte, en BASE_FOODS) y sus recetas, para el resolvedor. */
export async function fetchFoodCatalog(db: Admin, userId: string): Promise<{ foods: Food[]; recipes: Recipe[]; usage: LoggedFood[] }> {
  const [cf, rc, used] = await Promise.all([
    db.from("custom_foods").select("*").eq("user_id", userId).limit(1000),
    db.from("recipes").select("*").eq("user_id", userId).limit(300),
    db.from("logged_foods").select("food_id,nombre,logged_at").eq("user_id", userId).order("logged_at", { ascending: false }).limit(400),
  ]);
  const foods = ((cf.data ?? []) as Array<Record<string, unknown>>).map(
    (r): Food => ({
      id: String(r.id),
      nombre: String(r.nombre),
      marca: (r.marca as string | null) ?? undefined,
      categoria: String(r.categoria ?? "Otros"),
      porcion: String(r.porcion ?? "100 g"),
      pesoGramos: (r.peso_gramos as number | null) ?? undefined,
      calorias: Number(r.calorias),
      proteina: Number(r.proteina),
      carbos: Number(r.carbos),
      grasas: Number(r.grasas),
      porciones: (r.porciones as Food["porciones"] | null) ?? undefined,
      photoUrl: (r.photo_url as string | null) ?? null,
      creadoPorUsuario: true,
      configurado: true,
    }),
  );
  const recipes = ((rc.data ?? []) as Array<Record<string, unknown>>).map(
    (r): Recipe => ({
      id: String(r.id),
      nombre: String(r.nombre),
      porciones: Number(r.porciones ?? 1),
      tiempoPrepMin: Number(r.tiempo_prep_min ?? 0),
      tipos: (r.tipos as MealType[]) ?? [],
      ingredientes: (r.ingredientes as Recipe["ingredientes"]) ?? [],
      instrucciones: (r.instrucciones as string[]) ?? [],
      totales: (r.totales as Recipe["totales"]) ?? { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
      createdAt: new Date(String(r.created_at ?? Date.now())).getTime(),
    }),
  );
  const usage = ((used.data ?? []) as Array<{ food_id: string; nombre: string; logged_at: string }>).map(
    (u) => ({ id: "", foodId: u.food_id, nombre: u.nombre, calorias: 0, proteina: 0, carbos: 0, grasas: 0, meal: "almuerzo" as MealType, timestamp: new Date(u.logged_at).getTime() }),
  );
  return { foods, recipes, usage };
}

// ───────────── Escrituras (solo filas NUEVAS o una columna) ─────────────

export async function insertWater(db: Admin, userId: string, ml: number, atIso: string): Promise<string | null> {
  const id = crypto.randomUUID();
  const { error } = await db.from("water_entries").insert({ id, user_id: userId, ml, logged_at: atIso });
  if (error) {
    warn("insertWater", error.message);
    return null;
  }
  return id;
}

export async function insertLoggedFoods(db: Admin, userId: string, foods: LoggedFood[], dateKey: string, startOrden: number): Promise<boolean> {
  const rows = foods.map((f, i) => ({
    id: f.id,
    user_id: userId,
    food_id: f.foodId,
    nombre: f.nombre,
    calorias: f.calorias,
    proteina: f.proteina,
    carbos: f.carbos,
    grasas: f.grasas,
    meal: f.meal,
    logged_date: dateKey,
    logged_at: new Date(f.timestamp).toISOString(),
    cantidad: f.cantidad ?? null,
    porcion_nombre: f.porcionNombre ?? null,
    gramos: f.gramos ?? null,
    photo_url: null,
    cooked_state: f.cookedState ?? null,
    activo: true,
    source: null,
    orden: startOrden + i,
  }));
  const { error } = await db.from("logged_foods").insert(rows);
  if (error) warn("insertLoggedFoods", error.message);
  return !error;
}

export async function countLoggedOn(db: Admin, userId: string, dateKey: string, meal: MealType): Promise<number> {
  const { count } = await db.from("logged_foods").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("logged_date", dateKey).eq("meal", meal);
  return count ?? 0;
}

export async function insertTask(db: Admin, userId: string, t: Task): Promise<boolean> {
  const row: Record<string, unknown> = {
    id: t.id,
    user_id: userId,
    title: t.title,
    description: t.description ?? null,
    priority: t.priority,
    due_date: t.dueDate ?? null,
    time_slot: t.timeSlot ?? null,
    is_completed: false,
    subtasks: t.subtasks,
    tags: t.tags,
    color: t.color,
    icon: t.icon,
    // Solo si hay recordatorio: sin la migración 0013 el resto sigue funcionando.
    ...(t.reminder ? { reminder: t.reminder } : {}),
  };
  const { error } = await db.from("tasks").insert(row);
  if (error) warn("insertTask", error.message);
  return !error;
}

export async function setTaskCompleted(db: Admin, userId: string, id: string, done: boolean): Promise<boolean> {
  const { error } = await db.from("tasks").update({ is_completed: done }).eq("id", id).eq("user_id", userId);
  if (error) warn("setTaskCompleted", error.message);
  return !error;
}

export async function insertNote(db: Admin, userId: string, p: NotionPage): Promise<boolean> {
  const { error } = await db.from("notion_pages").insert({ id: p.id, user_id: userId, title: p.title, icon: p.icon, blocks: p.blocks });
  if (error) warn("insertNote", error.message);
  return !error;
}

export async function enqueueCommand(db: Admin, userId: string, tool: string, args: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.from("agent_commands").insert({ user_id: userId, tool, args, source: "telegram" }).select("id").single();
  if (error) {
    warn("enqueueCommand", error.message);
    return null;
  }
  return data.id as string;
}

export type { UndoSpec };
