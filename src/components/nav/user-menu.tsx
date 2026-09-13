"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { createClient } from "@/lib/supabase/client";
import { setCurrentUserId } from "@/lib/store/user-scope";

export interface SessionUser {
  name: string;
  email: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ user, size = 36 }: { user: SessionUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="rounded-full bg-white/10 glass-specular-ring flex items-center justify-center text-white text-xs font-semibold shrink-0"
      style={{ width: size, height: size }}
    >
      {initials(user.name)}
    </div>
  );
}

/**
 * Avatar de usuario + nombre. Al hacer click abre un GlassModal con el
 * detalle de la cuenta y el botón de cerrar sesión. Usado en el Sidebar
 * (desktop) y en el header móvil del layout del dashboard.
 */
export function UserMenu({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Limpiamos el uid cacheado para que, si otra persona inicia sesión en
    // este mismo navegador después, los stores de Zustand no sigan
    // apuntando (aunque sea momentáneamente) a los datos de esta cuenta.
    setCurrentUserId(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-2xl px-2 py-2 hover:bg-white/[0.06] transition-colors cursor-pointer text-left min-w-0"
      >
        <Avatar user={user} size={compact ? 34 : 36} />
        {!compact && (
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user.name}</div>
            <div className="text-[11px] text-white/40 truncate">{user.email}</div>
          </div>
        )}
      </button>

      <GlassModal open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar user={user} size={64} />
          <div className="text-center">
            <div className="text-base font-semibold text-white">{user.name}</div>
            <div className="text-sm text-white/45">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full mt-2 rounded-2xl px-5 py-3 inline-flex items-center justify-center gap-2 text-sm font-medium text-red-200 bg-red-500/10 border border-red-400/25 hover:bg-red-500/15 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={16} />
            {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </GlassModal>
    </>
  );
}
