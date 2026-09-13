import { GlassBadge } from "@/components/glass/glass-badge";
import type { Profile } from "@/lib/types/profile";

export function userStatus(profile: Pick<Profile, "is_blocked" | "access_until">): {
  key: "blocked" | "expired" | "active";
  label: string;
  color: string;
} {
  if (profile.is_blocked) {
    return { key: "blocked", label: "Bloqueado", color: "#ff3b3b" };
  }
  if (profile.access_until) {
    const vencimiento = new Date(`${profile.access_until}T23:59:59`);
    if (vencimiento.getTime() < Date.now()) {
      return { key: "expired", label: "Vencido", color: "#f59e0b" };
    }
  }
  return { key: "active", label: "Activo", color: "#22c55e" };
}

export function UserStatusBadge({ profile }: { profile: Pick<Profile, "is_blocked" | "access_until"> }) {
  const status = userStatus(profile);
  return <GlassBadge color={status.color}>{status.label}</GlassBadge>;
}
