"use client";

import { useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { ConfirmModal } from "@/components/admin/confirm-modal";

const ERROR_MESSAGES: Record<string, string> = {
  service_role_not_configured:
    "Falta configurar SUPABASE_SERVICE_ROLE_KEY en .env.local — sin esa clave, esta función no puede generar una sesión para otro usuario. Consulta el comentario en .env.local para saber dónde conseguirla.",
  not_admin: "Tu sesión ya no tiene permisos de administrador. Vuelve a iniciar sesión.",
  target_user_not_found: "No se encontró la cuenta objetivo (o no tiene un email registrado).",
  generate_link_failed: "Supabase no pudo generar el enlace de sesión. Intenta de nuevo en unos segundos.",
  cannot_impersonate_self: "No puedes entrar como tu propia cuenta de administrador.",
};

export function ImpersonateButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const body = await res.json();
      if (!res.ok || !body.tokenHash) {
        setError(ERROR_MESSAGES[body.error] ?? "No se pudo iniciar la impersonación. Intenta de nuevo.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({ token_hash: body.tokenHash, email: body.email });
      // Navegación forzosa (no next/navigation): `/auth/impersonate` es un
      // Route Handler que setea cookies de sesión y hace un redirect
      // server-side — necesita una carga de página real, no una
      // transición de cliente del router de Next.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/auth/impersonate?${params.toString()}`;
    } catch (err) {
      console.error("Error al iniciar impersonación:", err);
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <>
      <GlassButton type="button" variant="outline" accentColor="var(--outfit)" onClick={() => setConfirmOpen(true)}>
        <UserRoundCheck size={16} />
        Entrar como este usuario
      </GlassButton>

      {error && (
        <div className="mt-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200 max-w-md">
          {error}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Entrar como este usuario"
        message={`Vas a iniciar sesión como ${userEmail}. Verás la app exactamente como la ve esta cuenta, con un aviso persistente para volver a tu sesión de administrador en cualquier momento.`}
        confirmLabel="Entrar como este usuario"
        loading={loading}
      />
    </>
  );
}
