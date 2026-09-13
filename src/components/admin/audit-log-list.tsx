import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollText } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { auditActionTitle, formatAuditDetails } from "@/lib/admin/audit-format";
import type { AdminAuditLog } from "@/lib/types/profile";

const ACTION_COLORS: Record<string, string> = {
  blocked_account: "#ff3b3b",
  unblocked_account: "#22c55e",
  updated_access_dates: "var(--habitos)",
  enabled_module: "#22c55e",
  disabled_module: "var(--gym-2)",
  impersonated_user: "var(--outfit)",
};

export function AuditLogList({
  entries,
  emptyLabel = "Todavía no hay acciones registradas.",
  showTargetEmail = false,
}: {
  entries: (AdminAuditLog & { admin_email?: string | null; target_email?: string | null })[];
  emptyLabel?: string;
  showTargetEmail?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <GlassCard padding="lg" interactive={false} className="flex items-center gap-3 text-white/40 text-sm">
        <ScrollText size={16} />
        {emptyLabel}
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <GlassCard key={entry.id} padding="md" interactive={false}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBadge color={ACTION_COLORS[entry.action] ?? "#9a9aa5"}>{auditActionTitle(entry.action)}</GlassBadge>
              {showTargetEmail && entry.target_email && (
                <span className="text-xs text-white/40">a {entry.target_email}</span>
              )}
            </div>
            <span className="text-[11px] text-white/35 shrink-0">
              {format(new Date(entry.created_at), "d MMM yyyy, HH:mm", { locale: es })}
            </span>
          </div>
          <p className="text-xs text-white/60 mt-2">{formatAuditDetails(entry.action, entry.details)}</p>
          {entry.admin_email && (
            <p className="text-[11px] text-white/30 mt-1.5">Por {entry.admin_email}</p>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
