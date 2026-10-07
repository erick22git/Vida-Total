/**
 * "Tick" del programador de avisos: para cada usuario con avisos activados, calcula qué toca avisar ahora
 * (`dueNotifications`, función pura) y lo envía por Telegram y/o lo deja listo para la app. Es independiente de QUIÉN lo
 * dispare (Supabase pg_cron, Vercel Cron, n8n…): solo hay que llamar a /api/agent/tick cada minuto.
 */
import { sanitizeConfig } from "../config";
import { buttonLabel, dueNotifications, SNOOZE_MIN, type Notice, type SentInfo } from "../notifications";
import { addDays, localParts, zonedTimeToMs } from "../tz";
import type { AgentConfig } from "../types";
import { encodeCallback } from "@/lib/telegram/update";
import { sendMessage, telegramConfigured, type InlineButton } from "@/lib/telegram/api";
import type { MealType } from "@/lib/types";
import type { Habit, HabitRoutine, RoutineStep } from "@/lib/types/habits";
import * as dbx from "./db";

export interface TickResult {
  users: number;
  sent: number;
  telegram: number;
  errors: number;
}

const warn = (label: string, err: unknown) => console.warn(`[agent-tick] ${label}:`, err instanceof Error ? err.message : err);

export async function loadRoutines(db: dbx.Admin, userId: string): Promise<HabitRoutine[]> {
  const { data, error } = await db.from("habit_routines").select("*").eq("user_id", userId).limit(100);
  if (error) {
    warn("habit_routines", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(
    (r): HabitRoutine => ({
      id: String(r.id),
      nombre: String(r.nombre),
      items: (r.items as RoutineStep[]) ?? [],
      createdAt: new Date(String(r.created_at ?? Date.now())).getTime(),
      completedDates: (r.completed_dates as string[]) ?? [],
      streak: Number(r.streak ?? 0),
      milestonesUnlocked: (r.milestones_unlocked as number[]) ?? [],
      diasSemana: (r.dias_semana as number[] | null) ?? undefined,
      endsAt: (r.ends_at as string | null) ?? undefined,
    }),
  );
}

async function loadHabits(db: dbx.Admin, userId: string): Promise<Habit[]> {
  const { data } = await db.from("habits").select("id,completed_dates").eq("user_id", userId).limit(300);
  return ((data ?? []) as Array<{ id: string; completed_dates: string[] | null }>).map(
    (h): Habit => ({ id: h.id, name: "", icon: "", color: "", frequency: "diario", streak: 0, completedDates: h.completed_dates ?? [], milestonesUnlocked: [] }),
  );
}

function telegramButtons(logId: string, n: Notice): InlineButton[][] {
  const row = n.buttons.map((b): InlineButton => ({ text: buttonLabel[b], callback_data: encodeCallback({ type: "notif", id: logId, action: b === "water250" ? "water" : b }) }));
  return row.length ? [row] : [];
}

export async function processUser(db: dbx.Admin, userId: string, config: AgentConfig, nowMs: number): Promise<{ sent: number; telegram: number }> {
  const tz = config.timezone;
  const lp = localParts(nowMs, tz);
  const dayStartIso = new Date(zonedTimeToMs(lp.date, "00:00", tz)).toISOString();
  const dayEndIso = new Date(zonedTimeToMs(addDays(lp.date, 1), "00:00", tz)).toISOString();

  const [tasks, routines, habits, goals, foods, water, logRes, linkRes] = await Promise.all([
    dbx.fetchTasks(db, userId),
    loadRoutines(db, userId),
    loadHabits(db, userId),
    dbx.fetchGoals(db, userId),
    dbx.fetchLoggedFoodsOn(db, userId, lp.date),
    dbx.fetchWaterBetween(db, userId, dayStartIso, dayEndIso),
    db.from("agent_notification_log").select("key,kind,created_at,snooze_until").eq("user_id", userId).gte("created_at", new Date(nowMs - 36 * 3_600_000).toISOString()).limit(500),
    db.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle(),
  ]);

  const sent = new Map<string, SentInfo>();
  let sentToday = 0;
  let lastWaterAt: number | undefined;
  for (const r of (logRes.data ?? []) as Array<{ key: string; kind: string; created_at: string; snooze_until: string | null }>) {
    const at = new Date(r.created_at).getTime();
    sent.set(r.key, { at, snoozeUntil: r.snooze_until ? new Date(r.snooze_until).getTime() : undefined });
    if (r.created_at >= dayStartIso) sentToday++;
    if (r.kind === "water" && (lastWaterAt === undefined || at > lastWaterAt)) lastWaterAt = at;
  }

  const active = foods.filter((f) => f.activo !== false);
  const notices = dueNotifications({
    nowMs,
    config,
    tasks,
    routines,
    habits,
    waterTodayMl: water.reduce((s, w) => s + w.ml, 0),
    waterGoalMl: goals.aguaMl,
    kcalToday: active.reduce((s, f) => s + f.calorias, 0),
    kcalGoal: goals.calorias,
    mealsLoggedToday: new Set<MealType>(active.map((f) => f.meal)),
    sent,
    sentToday,
    lastWaterAt,
  });

  const chatId = linkRes.data ? Number(linkRes.data.chat_id) : null;
  const viaTelegram = config.notifications.telegram && config.channels.telegram.enabled && chatId !== null && telegramConfigured();
  let telegram = 0;
  let count = 0;
  for (const n of notices) {
    // El registro único (user_id, key) es la deduplicación: si otro tick ya lo creó, esto falla y no se envía dos veces.
    const { data: row, error } = await db
      .from("agent_notification_log")
      .insert({ user_id: userId, key: n.key, kind: n.kind, title: n.title, body: n.body, payload: { taskId: n.taskId ?? null, subtaskId: n.subtaskId ?? null, buttons: n.buttons } })
      .select("id")
      .single();
    if (error || !row) continue;
    count++;
    if (viaTelegram && chatId !== null) {
      await sendMessage(chatId, `🔔 ${n.title}\n${n.body}`, telegramButtons(row.id as string, n));
      await db.from("agent_notification_log").update({ telegram_sent: true }).eq("id", row.id);
      telegram++;
    }
  }
  return { sent: count, telegram };
}

/** Recorre a los usuarios con avisos activados. */
export async function runTick(nowMs = Date.now()): Promise<TickResult> {
  const res: TickResult = { users: 0, sent: 0, telegram: 0, errors: 0 };
  const db = dbx.admin();
  if (!db) return res;
  const { data, error } = await db.from("agent_settings").select("user_id,config").limit(1000);
  if (error) {
    warn("agent_settings", error.message);
    return { ...res, errors: 1 };
  }
  for (const row of (data ?? []) as Array<{ user_id: string; config: unknown }>) {
    const config = { ...sanitizeConfig(row.config), autoTotal: null };
    if (!config.notifications.enabled || config.killSwitch) continue;
    res.users++;
    try {
      const r = await processUser(db, row.user_id, config, nowMs);
      res.sent += r.sent;
      res.telegram += r.telegram;
    } catch (err) {
      res.errors++;
      warn(`usuario ${row.user_id.slice(0, 8)}`, err);
    }
  }
  return res;
}

export { SNOOZE_MIN };
