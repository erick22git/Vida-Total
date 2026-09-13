import { AUDIT_ACTIONS } from "@/lib/admin/audit";
import { MODULE_LABELS } from "@/lib/admin/module-labels";
import type { ModuleKey } from "@/lib/types/profile";

const ACTION_TITLES: Record<string, string> = {
  [AUDIT_ACTIONS.BLOCKED_ACCOUNT]: "Bloqueó la cuenta",
  [AUDIT_ACTIONS.UNBLOCKED_ACCOUNT]: "Desbloqueó la cuenta",
  [AUDIT_ACTIONS.UPDATED_ACCESS_DATES]: "Actualizó la vigencia de acceso",
  [AUDIT_ACTIONS.ENABLED_MODULE]: "Habilitó un módulo",
  [AUDIT_ACTIONS.DISABLED_MODULE]: "Deshabilitó un módulo",
  [AUDIT_ACTIONS.IMPERSONATED_USER]: "Entró como este usuario",
};

/** Título humano de la acción (para el badge/encabezado de cada fila). */
export function auditActionTitle(action: string): string {
  return ACTION_TITLES[action] ?? action;
}

function fmtDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  if (value === "") return "Sin vencimiento";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

/**
 * Convierte el `details` JSON crudo de una fila de `admin_audit_log` en
 * una descripción de una línea, legible, específica al tipo de acción —
 * en vez de mostrar el JSON crudo al admin (pedido explícito del
 * encargo). Si la acción no tiene un formateador específico, cae a un
 * resumen genérico de las claves del JSON.
 */
export function formatAuditDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "Sin detalles adicionales.";

  switch (action) {
    case AUDIT_ACTIONS.BLOCKED_ACCOUNT:
      return `Cuenta ${details.email ?? ""} marcada como bloqueada.`;
    case AUDIT_ACTIONS.UNBLOCKED_ACCOUNT:
      return `Cuenta ${details.email ?? ""} desbloqueada.`;
    case AUDIT_ACTIONS.UPDATED_ACCESS_DATES: {
      const before = (details.before as Record<string, unknown>) ?? {};
      const after = (details.after as Record<string, unknown>) ?? {};
      return `Vigencia cambiada de ${fmtDate(before.access_from as string)} → ${fmtDate(
        (before.access_until as string) ?? "",
      )} a ${fmtDate(after.access_from as string)} → ${fmtDate((after.access_until as string) ?? "")}.`;
    }
    case AUDIT_ACTIONS.ENABLED_MODULE:
    case AUDIT_ACTIONS.DISABLED_MODULE: {
      const moduleKey = details.module as ModuleKey | undefined;
      const label = moduleKey ? MODULE_LABELS[moduleKey]?.label ?? moduleKey : "módulo desconocido";
      return action === AUDIT_ACTIONS.ENABLED_MODULE ? `Módulo "${label}" habilitado.` : `Módulo "${label}" deshabilitado.`;
    }
    case AUDIT_ACTIONS.IMPERSONATED_USER:
      return `Inició sesión como ${details.target_email ?? "el usuario"} para soporte.`;
    default:
      return Object.entries(details)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join(" · ");
  }
}
