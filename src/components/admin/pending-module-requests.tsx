"use client";

/**
 * Pedidos de módulo sin resolver (migración 0019, botón "Pedir acceso" de `module-access-gate.tsx`).
 * El único aviso que tenía esto antes era la notificación puntual (Isla Dinámica + voz) — si el admin
 * no la atendía en el momento, se perdía de la UI aunque la fila seguía en la base. Esto la vuelve a
 * mostrar hasta que se resuelve (habilitada o descartada), igual que "Comprobantes pendientes" en Pagos.
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, X as XIcon } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import { MODULE_LABELS } from "@/lib/admin/module-labels";
import type { ModuleKey } from "@/lib/types/profile";

export interface ModuleRequestRow {
  id: string;
  user_id: string;
  module: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
}

function isModuleKey(m: string): m is ModuleKey {
  return m in MODULE_LABELS;
}

export function PendingModuleRequests({ initialRequests, adminId }: { initialRequests: ModuleRequestRow[]; adminId: string }) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function resolve(req: ModuleRequestRow, enable: boolean) {
    setBusyId(req.id);
    const supabase = createClient();
    if (enable) {
      const { error } = await supabase
        .from("user_module_access")
        .upsert({ user_id: req.user_id, module: req.module, enabled: true }, { onConflict: "user_id,module" });
      if (error) {
        console.error("No se pudo habilitar el módulo pedido:", error.message);
        setBusyId(null);
        return;
      }
      await logAdminAction(supabase, {
        adminId,
        targetUserId: req.user_id,
        action: AUDIT_ACTIONS.ENABLED_MODULE,
        details: { email: req.email, module: req.module, fromRequest: req.id },
      });
    }
    const { error: resolveError } = await supabase
      .from("module_requests")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    if (resolveError) console.error("No se pudo marcar el pedido como resuelto:", resolveError.message);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setBusyId(null);
  }

  return (
    <GlassCard padding="lg" className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Pedidos de módulo ({requests.length})</h2>
        <p className="text-xs text-white/45 mt-0.5">Un usuario tocó &ldquo;Pedir acceso&rdquo; en un módulo que no tiene habilitado.</p>
      </div>
      {requests.map((r) => {
        const label = isModuleKey(r.module) ? MODULE_LABELS[r.module].label : r.module;
        return (
          <div key={r.id} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-white truncate">
                <b>Pedido de acceso a {label}</b>
              </p>
              <p className="text-xs text-white/55 truncate">{r.full_name || r.email || r.user_id}</p>
              <p className="text-[11px] text-white/40">{format(new Date(r.created_at), "d MMM, HH:mm", { locale: es })}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={busyId === r.id}
                onClick={() => resolve(r, true)}
                className="rounded-full px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 bg-emerald-500/80 hover:bg-emerald-500 text-black flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Habilitar
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => resolve(r, false)}
                className="rounded-full px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
              >
                <XIcon size={14} /> Descartar
              </button>
            </div>
          </div>
        );
      })}
    </GlassCard>
  );
}
