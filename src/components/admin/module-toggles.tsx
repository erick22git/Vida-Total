"use client";

import { useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import { MODULE_LABELS } from "@/lib/admin/module-labels";
import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";

function Toggle({ enabled, onClick, disabled }: { enabled: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-emerald-500/70" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-[22px]" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/**
 * Toggles de los 7 módulos para un usuario. Sin fila en
 * `user_module_access` para un módulo dado, se trata como
 * `enabled: true` (ver comentario en la migración SQL) — solo se crea
 * fila cuando el admin efectivamente cambia el valor (enciende o
 * apaga), vía `upsert` sobre la clave primaria (user_id, module).
 */
export function ModuleToggles({
  userId,
  adminId,
  userEmail,
  initialEnabled,
}: {
  userId: string;
  adminId: string;
  userEmail: string | null;
  initialEnabled: Record<ModuleKey, boolean>;
}) {
  const [enabledMap, setEnabledMap] = useState(initialEnabled);
  const [busyModule, setBusyModule] = useState<ModuleKey | null>(null);

  async function toggle(moduleKey: ModuleKey) {
    const next = !enabledMap[moduleKey];
    setBusyModule(moduleKey);
    const supabase = createClient();
    const { error } = await supabase
      .from("user_module_access")
      .upsert({ user_id: userId, module: moduleKey, enabled: next }, { onConflict: "user_id,module" });

    if (!error) {
      setEnabledMap((prev) => ({ ...prev, [moduleKey]: next }));
      await logAdminAction(supabase, {
        adminId,
        targetUserId: userId,
        action: next ? AUDIT_ACTIONS.ENABLED_MODULE : AUDIT_ACTIONS.DISABLED_MODULE,
        details: { email: userEmail, module: moduleKey },
      });
    } else {
      console.error("No se pudo actualizar user_module_access:", error.message);
    }
    setBusyModule(null);
  }

  return (
    <GlassCard padding="lg">
      <h2 className="text-sm font-semibold text-white mb-1">Módulos habilitados</h2>
      <p className="text-xs text-white/45 mb-4">
        Controla a qué módulos de la app tiene acceso esta cuenta. Un módulo sin configurar explícitamente está
        habilitado por defecto.
      </p>
      <div className="flex flex-col divide-y divide-white/[0.06]">
        {MODULE_KEYS.map((key) => {
          const meta = MODULE_LABELS[key];
          return (
            <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: meta.color }} />
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{meta.label}</div>
                  <div className="text-[11px] text-white/35">{meta.group}</div>
                </div>
              </div>
              <Toggle enabled={enabledMap[key]} disabled={busyModule === key} onClick={() => toggle(key)} />
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
