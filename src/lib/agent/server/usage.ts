/**
 * Contador de llamadas al proveedor del modelo (tabla `agent_llm_usage`, migración 0012): una fila por usuario y día (UTC).
 * Sirve para ver cuánto se gasta y para avisar cuando se está llegando a los límites. Es "mejor esfuerzo": si falla, nada se rompe.
 * Lectura-modificación-escritura (sin RPC): una carrera entre dos peticiones simultáneas puede perder una cuenta, no más.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmMeta } from "../llm";

export const utcDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

export async function recordUsage(db: SupabaseClient, userId: string, agent: string, meta: LlmMeta, label: "turn" | "classify" = "turn"): Promise<void> {
  try {
    const day = utcDay();
    const { data } = await db.from("agent_llm_usage").select("calls,rate_limited,fallbacks,by_agent").eq("user_id", userId).eq("day", day).maybeSingle();
    const by = { ...((data?.by_agent as Record<string, number> | null) ?? {}) };
    const key = label === "classify" ? "clasificador" : agent;
    by[key] = (by[key] ?? 0) + meta.calls;
    await db.from("agent_llm_usage").upsert(
      {
        user_id: userId,
        day,
        calls: Number(data?.calls ?? 0) + meta.calls,
        rate_limited: Number(data?.rate_limited ?? 0) + meta.rateLimited,
        fallbacks: Number(data?.fallbacks ?? 0) + (meta.fallback ? 1 : 0),
        by_agent: by,
      },
      { onConflict: "user_id,day" },
    );
  } catch (err) {
    console.warn("[agent-usage] no se pudo guardar:", err instanceof Error ? err.message : err);
  }
}

export async function readUsage(db: SupabaseClient, userId: string, days = 30) {
  const since = utcDay(Date.now() - days * 86_400_000);
  const { data } = await db.from("agent_llm_usage").select("day,calls,rate_limited,fallbacks,by_agent").eq("user_id", userId).gte("day", since).order("day", { ascending: false });
  return (data ?? []) as Array<{ day: string; calls: number; rate_limited: number; fallbacks: number; by_agent: Record<string, number> }>;
}
