"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TelegramLinkCard } from "@/components/agente/telegram-link-card";
import { useAutoTotalActive } from "@/components/agente/auto-total-badge";
import { BORDER, Btn, DarkCard, Row, SURFACE, Toggle } from "@/components/agente/ui";
import { useAgentStore } from "@/lib/store/agentStore";
import { useMascotUi } from "@/lib/store/mascotUiStore";
import { cn } from "@/lib/utils";

/** Ajustes rápidos de la mascota. Todo lo demás (herramientas, límites, historial) está en «Agente y permisos». */
export function DockSettings() {
  const config = useAgentStore((s) => s.config);
  const setConfig = useAgentStore((s) => s.setConfig);
  const setKill = useAgentStore((s) => s.setKillSwitch);
  const stopAuto = useAgentStore((s) => s.stopAutoTotal);
  const close = useMascotUi((s) => s.closeDock);
  const { active } = useAutoTotalActive();

  return (
    <div className="flex flex-col gap-2.5 p-2.5 max-h-[min(66dvh,540px)] overflow-y-auto">
      <DarkCard>
        <Row label="Agente encendido" hint="Apágalo y no hace nada en ningún canal." right={<Toggle on={!config.killSwitch} onChange={(v) => setKill(!v)} label="Agente encendido" />} />
      </DarkCard>

      <DarkCard className="flex flex-col gap-2">
        <p className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Cómo te pregunta</p>
        {([
          ["ask_always", "Preguntar siempre", "Solo hace sin preguntar lo que tú marques «Permitir»."],
          ["auto_safe", "Auto en lo seguro", "Las lecturas pasan solas; las escrituras si las permitiste."],
        ] as const).map(([v, t, d]) => (
          <button key={v} aria-pressed={config.mode === v} onClick={() => setConfig((c) => ({ ...c, mode: v }))} className={cn("text-left rounded-[18px] p-3 cursor-pointer")} style={{ background: config.mode === v ? "#2b2b2e" : "transparent", border: config.mode === v ? "1px solid rgba(255,255,255,0.35)" : BORDER }}>
            <p className="text-[14px] font-extrabold">{t}</p>
            <p className="text-xs text-white/50">{d}</p>
          </button>
        ))}
        {active && (
          <Btn variant="danger" onClick={stopAuto}>
            Auto total ACTIVO · apagar ahora
          </Btn>
        )}
      </DarkCard>

      <DarkCard className="flex flex-col gap-1">
        <Row label="En la app" right={<Toggle on={config.channels.app.enabled} onChange={(v) => setConfig((c) => ({ ...c, channels: { ...c.channels, app: { ...c.channels.app, enabled: v } } }))} label="Canal app" />} />
        <Row label="Avisos" hint="Recordatorios de tareas, rutina, agua…" right={<Toggle on={config.notifications.enabled} onChange={(v) => setConfig((c) => ({ ...c, notifications: { ...c.notifications, enabled: v } }))} label="Avisos" />} />
      </DarkCard>

      <TelegramLinkCard />

      <Link href="/configuracion/agente" onClick={close} className="flex items-center justify-between rounded-[22px] px-4 min-h-[52px] text-[15px] font-extrabold" style={{ background: SURFACE, border: BORDER }}>
        Permisos, herramientas e historial
        <ChevronRight size={18} className="text-white/50" />
      </Link>
    </div>
  );
}
