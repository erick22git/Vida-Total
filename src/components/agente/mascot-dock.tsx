"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Droplets, FileText, Home, ListChecks, MessageSquare, MessageSquarePlus, Plus, Settings2, Utensils, Volume2, VolumeX } from "lucide-react";
import { AgentPicker } from "@/components/agente/agent-picker";
import { DockChat } from "@/components/agente/dock-chat";
import { DockHistory } from "@/components/agente/dock-history";
import { DockHome } from "@/components/agente/dock-home";
import { DockSettings } from "@/components/agente/dock-settings";
import { useAutoTotalActive } from "@/components/agente/auto-total-badge";
import { Mascot, type MascotMood } from "@/components/agente/mascot";
import { BORDER, CARD, CHIP, SURFACE } from "@/components/agente/ui";
import { useAgentChatStore } from "@/lib/store/agentChatStore";
import { useAgentStore } from "@/lib/store/agentStore";
import { useActiveAgent } from "@/lib/store/agentSend";
import { useGymStore } from "@/lib/store/gymStore";
import { useMascotUi, type DockTab } from "@/lib/store/mascotUiStore";
import { usePreferencesStore } from "@/lib/store/preferencesStore";

/** Estado de ánimo de la mascota según lo que pasa. */
export function useMascotMood(): { mood: MascotMood; status: string } {
  const busy = useAgentChatStore((s) => s.busy);
  const off = useAgentStore((s) => s.config.killSwitch || !s.config.channels.app.enabled);
  const { active } = useAutoTotalActive();
  if (off) return { mood: "off", status: "Apagado" };
  if (active) return { mood: "alert", status: "Auto total activo" };
  if (busy) return { mood: "thinking", status: "Pensando…" };
  return { mood: "idle", status: "Listo para ayudarte" };
}

const TABS: Array<{ id: DockTab; label: string; Icon: typeof Home }> = [
  { id: "home", label: "Inicio", Icon: Home },
  { id: "chat", label: "Chat", Icon: MessageSquare },
];

/**
 * Panel de la mascota: se despliega DESDE ARRIBA al tocar su ícono en el menú. Diseño negro de la Agenda (nada de vidrio):
 * Inicio (mascota + opciones rápidas) · Chat (con Historial) · «+» creación rápida / conversación nueva · Ajustes · sonido.
 */
export function MascotDock() {
  const { open, tab, expanded } = useMascotUi();
  const setTab = useMascotUi((s) => s.setTab);
  const close = useMascotUi((s) => s.closeDock);
  const expand = useMascotUi((s) => s.expand);
  const collapse = useMascotUi((s) => s.collapse);
  const openDock = useMascotUi((s) => s.openDock);
  const setLastAgent = useMascotUi((s) => s.setLastAgent);
  const clearChat = useAgentChatStore((s) => s.clear);
  const sound = usePreferencesStore((s) => s.soundEnabled);
  const setSound = usePreferencesStore((s) => s.setSoundEnabled);
  const { mood, status } = useMascotMood();
  const agent = useActiveAgent();
  const [plusOpen, setPlusOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  // «+»: creación rápida. Cada opción es un toque tuyo (no una orden del agente): el agua se aplica directo; el resto deja el texto listo en el chat.
  const plusItems: Array<{ label: string; Icon: typeof Plus; run: () => void }> = [
    {
      label: "Conversación nueva",
      Icon: MessageSquarePlus,
      run: () => {
        clearChat();
        setLastAgent(null);
        openDock("chat");
      },
    },
    { label: "Nueva tarea", Icon: ListChecks, run: () => openDock("chat", "Crea una tarea: ") },
    { label: "Nueva nota", Icon: FileText, run: () => openDock("chat", "Anota en una nota: ") },
    { label: "Registrar comida", Icon: Utensils, run: () => openDock("chat", "Comí ") },
    {
      label: "+250 ml de agua",
      Icon: Droplets,
      run: () => {
        useGymStore.getState().addWater(250);
        flash("✓ +250 ml de agua");
      },
    },
  ];

  const chatActive = tab === "chat" || tab === "history";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="dim" className="fixed inset-0 z-[80]" style={{ background: "rgba(0,0,0,0.6)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={close} />
          <motion.div
            key="dock"
            role="dialog"
            aria-label="Mascota y asistente"
            className="fixed inset-x-0 top-0 z-[81] mx-auto w-full max-w-[460px] px-2 pt-[max(env(safe-area-inset-top),8px)]"
            initial={{ y: "-110%" }}
            animate={{ y: 0 }}
            exit={{ y: "-110%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div className="relative rounded-[28px]" style={{ background: "#0b0b0c", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 18px 60px rgba(0,0,0,0.75)" }}>
              <div className="flex items-center justify-between px-2.5 pt-2.5">
                <div className="flex items-center gap-1" role="tablist" aria-label="Secciones">
                  {TABS.map(({ id, label, Icon }) => {
                    const on = id === "chat" ? chatActive : tab === id;
                    return (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={on}
                        aria-label={label}
                        onClick={() => {
                          setPlusOpen(false);
                          setTab(id);
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                        style={{ background: on ? CHIP : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.55)" }}
                      >
                        <Icon size={19} />
                      </button>
                    );
                  })}
                  <button aria-label="Crear algo rápido" aria-expanded={plusOpen} onClick={() => setPlusOpen((v) => !v)} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{ background: plusOpen ? CHIP : "transparent", color: plusOpen ? "#fff" : "rgba(255,255,255,0.55)" }}>
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    aria-label="Ajustes"
                    aria-pressed={tab === "settings"}
                    onClick={() => {
                      setPlusOpen(false);
                      setTab("settings");
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ background: tab === "settings" ? CHIP : "transparent", color: tab === "settings" ? "#fff" : "rgba(255,255,255,0.55)" }}
                  >
                    <Settings2 size={19} />
                  </button>
                  <button aria-label={sound ? "Silenciar" : "Activar sonido"} aria-pressed={sound} onClick={() => setSound(!sound)} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer text-white/55">
                    {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
                  </button>
                </div>
              </div>

              {plusOpen && (
                <div role="menu" aria-label="Crear" className="absolute left-3 top-[58px] z-20 w-[min(260px,88%)] rounded-[22px] p-1.5" style={{ background: CARD, border: BORDER, boxShadow: "0 14px 44px rgba(0,0,0,0.75)" }}>
                  {plusItems.map(({ label, Icon, run }) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => {
                        setPlusOpen(false);
                        run();
                      }}
                      className="w-full flex items-center gap-2.5 rounded-[16px] px-3 min-h-[44px] text-left text-[14px] font-bold cursor-pointer"
                    >
                      <Icon size={17} className="text-white/60 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {toast && (
                <p className="mx-3 mt-1.5 text-center text-[12px] font-bold rounded-full py-1.5" style={{ background: CHIP }} role="status">
                  {toast}
                </p>
              )}

              {expanded && tab !== "home" && tab !== "history" && <AgentPicker />}

              {!expanded && tab === "home" && (
                <button type="button" onClick={expand} aria-label="Desplegar el panel completo" className="w-full flex flex-col items-center gap-1 pt-1 pb-2.5 cursor-pointer">
                  <Mascot mood={mood} size={118} costume={agent.costume} accent={agent.accent} />
                  <span className="text-[11px] font-bold text-white/40">
                    {agent.label} · {status} · toca para desplegar
                  </span>
                </button>
              )}
              {expanded && tab === "home" && (
                <>
                  <AgentPicker />
                  <DockHome mood={mood} status={status} costume={agent.costume} accent={agent.accent} />
                  <button type="button" onClick={collapse} aria-label="Plegar el panel" className="mx-auto mb-0.5 flex h-6 w-16 items-center justify-center text-white/40 cursor-pointer">
                    <ChevronUp size={18} />
                  </button>
                </>
              )}
              {tab === "chat" && <DockChat />}
              {tab === "history" && <DockHistory onOpenChat={() => setTab("chat")} />}
              {tab === "settings" && <DockSettings />}
              <div className="mx-auto mb-2 mt-0.5 h-1 w-10 rounded-full" style={{ background: SURFACE }} aria-hidden />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** La mascota asomada en el ícono del menú (versión chica). */
export function MascotIcon({ size = 26 }: { size?: number }) {
  const { mood } = useMascotMood();
  const agent = useActiveAgent();
  return <Mascot mood={mood} size={size} still costume={agent.costume} accent={agent.accent} />;
}
