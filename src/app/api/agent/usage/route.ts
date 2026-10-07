import { NextResponse } from "next/server";
import { readUsage, utcDay } from "@/lib/agent/server/usage";
import { createClient } from "@/lib/supabase/server";

// Contador de llamadas al proveedor del modelo: hoy y últimos 30 días (tabla agent_llm_usage, migración 0012).
export async function GET() {
  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rows = await readUsage(supabase, userId, 30);
    const today = rows.find((r) => r.day === utcDay());
    const sum = (k: "calls" | "rate_limited" | "fallbacks") => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    return NextResponse.json({
      today: { calls: today?.calls ?? 0, rateLimited: today?.rate_limited ?? 0 },
      month: { calls: sum("calls"), rateLimited: sum("rate_limited"), fallbacks: sum("fallbacks") },
      byAgentToday: today?.by_agent ?? {},
    });
  } catch {
    return NextResponse.json({ today: { calls: 0, rateLimited: 0 }, month: { calls: 0, rateLimited: 0, fallbacks: 0 }, byAgentToday: {}, unavailable: true });
  }
}
