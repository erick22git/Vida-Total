/**
 * Motor de permisos del agente. PURO: mismas entradas, mismo resultado. Corre en el servidor (antes de ejecutar o de
 * proponer una acción) y en el cliente (para mostrar la tarjeta), así que la interfaz nunca es la única barrera.
 *
 * Orden de evaluación (el primero que dice "no" gana; la lista "nunca automático" pone un piso de "preguntar"):
 *  1. herramienta desconocida / apagado total / canal apagado            → denegar
 *  2. nivel de la herramienta = bloquear                                 → denegar
 *  3. solo lectura (global o del canal) y la herramienta escribe         → denegar
 *  4. módulo no permitido                                                → denegar
 *  5. argumentos inválidos / límites (agua máx., calorías máx.)          → denegar
 *  6. tope de escrituras por hora / por día                              → denegar
 *  7. "nunca automático" (hábitos, borrar, lotes, config, origen no confiable) → preguntar SIEMPRE (config en Telegram: denegar)
 *  8. según el modo efectivo: auto_total → permitir · auto_safe → lecturas solas + escrituras con nivel "permitir" ·
 *     ask_always → solo lo marcado "permitir"; el resto pregunta.
 */
import { effectiveMode, levelFor, moduleAllowed, writeLimitHit } from "./config";
import { HARD_MAX_BATCH, NEVER_AUTO, type NeverAutoCode } from "./never-auto";
import { getTool } from "./tools/registry";
import type { Decision, PermissionContext } from "./types";

const TITULO = new Map(NEVER_AUTO.map((n) => [n.code, n.titulo] as const));

/** Qué reglas "nunca automático" se activan para esta llamada. Vacío = ninguna. */
export function neverAutoCodes(toolName: string, rawArgs: unknown, ctx: PermissionContext): NeverAutoCode[] {
  const tool = getTool(toolName);
  if (!tool) return [];
  const out = new Set<NeverAutoCode>(tool.neverAuto ?? []);
  if (tool.kind === "destructive") out.add("delete_data");
  if (tool.kind === "config") out.add("change_agent_config");
  if (ctx.origin === "untrusted" && tool.kind !== "read") out.add("untrusted_origin");

  const maxBatch = Math.min(ctx.config.limits.maxBatch, HARD_MAX_BATCH);
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
  const own = tool.kind === "read" ? 1 : tool.batchSize?.(args) ?? 1;
  const total = Math.max(own, ctx.batchSize ?? 1);
  if (tool.kind !== "read" && total > maxBatch) out.add("batch");
  return [...out];
}

export function decide(toolName: string, rawArgs: unknown, ctx: PermissionContext): Decision {
  const tool = getTool(toolName);
  if (!tool) return { action: "deny", reasons: ["Herramienta desconocida."] };
  const cfg = ctx.config;
  const channel = ctx.channel;

  if (cfg.killSwitch) return { action: "deny", reasons: ["El agente está apagado (apagado total)."] };
  if (!cfg.channels[channel].enabled) return { action: "deny", reasons: [`El canal ${channel === "app" ? "de la app" : "de Telegram"} está desactivado.`] };

  const level = levelFor(cfg, channel, toolName);
  if (level === "block") return { action: "deny", reasons: [`"${tool.label}" está bloqueada.`] };

  if (tool.kind !== "read" && (cfg.readOnly || cfg.channels[channel].readOnly)) {
    return { action: "deny", reasons: ["El agente está en modo solo lectura."] };
  }
  if (!moduleAllowed(cfg, tool.module)) return { action: "deny", reasons: [`El módulo "${tool.module}" no está permitido para el agente.`] };

  const v = tool.validate(rawArgs);
  if (!v.ok) return { action: "deny", reasons: [v.error] };
  const limitMsg = tool.limitCheck?.(v.args, cfg.limits);
  if (limitMsg) return { action: "deny", reasons: [limitMsg] };

  if (tool.kind !== "read") {
    const hit = writeLimitHit(cfg, ctx.recentWrites, ctx.now);
    if (hit) return { action: "deny", reasons: [hit === "hour" ? "Se alcanzó el tope de acciones por hora." : "Se alcanzó el tope de acciones por día."] };
  }

  const never = neverAutoCodes(toolName, v.args, ctx);
  if (never.length > 0) {
    // Vincular/cambiar permisos o configuración: desde Telegram no se puede, solo desde la app.
    if (channel === "telegram" && never.some((c) => c === "telegram_link" || c === "change_permissions" || c === "change_agent_config")) {
      return { action: "deny", reasons: ["Esto solo se puede hacer desde la app."] };
    }
    return { action: "ask", reasons: never.map((c) => TITULO.get(c) ?? c), canAlways: false };
  }

  const mode = effectiveMode(cfg, channel, ctx.now, ctx.sessionId);
  if (mode === "auto_total") return { action: "allow", reasons: ["Auto total activo."] };
  if (mode === "auto_safe" && tool.kind === "read") return { action: "allow", reasons: ["Lectura automática."] };
  if (level === "allow") return { action: "allow", reasons: ["Permitida siempre."] };
  return { action: "ask", reasons: ["Necesita tu permiso."], canAlways: true };
}

/**
 * Aplica una respuesta del usuario a un permiso. Devuelve la nueva configuración (o la misma) y si hay que ejecutar.
 * "Permitir siempre" solo guarda el nivel cuando la herramienta puede ser siempre permitida (no está en la lista fija).
 */
export function applyAnswer(
  cfg: import("./types").AgentConfig,
  toolName: string,
  channel: import("./types").Channel,
  answer: import("./types").PermissionAnswer,
  decision: Decision,
): { config: import("./types").AgentConfig; execute: boolean } {
  if (answer === "deny" || decision.action === "deny") return { config: cfg, execute: false };
  if (answer === "allow_always" && decision.action === "ask" && decision.canAlways) {
    return { config: { ...cfg, levels: { ...cfg.levels, [channel]: { ...cfg.levels[channel], [toolName]: "allow" } } }, execute: true };
  }
  return { config: cfg, execute: true };
}
