"use client";

import { useState } from "react";
import { Mascot, type MascotMood } from "@/components/agente/mascot";
import { CARD, CHIP, SURFACE, BORDER } from "@/components/agente/ui";
import { useGymStore } from "@/lib/store/gymStore";
import { sendChat } from "@/lib/store/agentChatStore";
import { useMascotUi } from "@/lib/store/mascotUiStore";
import { useAgentStore } from "@/lib/store/agentStore";

interface Quick {
  label: string;
  dot: string;
  run: () => void;
}

/** Inicio del panel: la mascota con su estado a la izquierda y las opciones rápidas a la derecha. */
export function DockHome({ mood, status }: { mood: MascotMood; status: string }) {
  const [done, setDone] = useState<string | null>(null);
  const open = useMascotUi((s) => s.openDock);
  const config = useAgentStore((s) => s.config);

  const ask = (text: string) => {
    open("chat");
    void sendChat(text);
  };
  const compose = (prefill: string) => open("chat", prefill);

  const quick: Quick[] = [
    {
      label: "+250 ml de agua",
      dot: "#f4f4f5",
      run: () => {
        // Es un toque tuyo (no una orden del agente): se aplica directo, igual que el botón de Agua.
        useGymStore.getState().addWater(250);
        setDone("✓ +250 ml de agua");
        setTimeout(() => setDone(null), 2200);
      },
    },
    { label: "¿Cuánto llevo hoy?", dot: "#34c759", run: () => ask("¿Cuántas calorías y cuánta agua llevo hoy?") },
    { label: "Nueva tarea", dot: "#ff9f0a", run: () => compose("Crea una tarea: ") },
    { label: "Nueva nota", dot: "#a78bfa", run: () => compose("Anota en una nota: ") },
    { label: "Registrar comida", dot: "#ff453a", run: () => compose("Comí ") },
    { label: "Mis tareas de hoy", dot: "#0a84ff", run: () => ask("¿Qué tareas tengo pendientes para hoy?") },
  ];

  return (
    <div className="grid grid-cols-[1fr_1.25fr] gap-2.5 p-2.5">
      <div className="rounded-[22px] p-3 flex flex-col items-center justify-center gap-2 text-center" style={{ background: SURFACE, border: BORDER }}>
        <Mascot mood={mood} size={104} />
        <p className="text-[13px] font-extrabold leading-tight">{status}</p>
        <p className="text-[11px] text-white/45 leading-tight">
          {config.killSwitch ? "Apagado" : config.channels.telegram.enabled ? "App + Telegram" : "Solo en la app"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-1.5 content-start">
        {quick.map((q) => (
          <button key={q.label} onClick={q.run} className="flex items-center gap-2.5 rounded-full px-2.5 min-h-[40px] text-left cursor-pointer active:scale-[0.98] transition-transform" style={{ background: CARD, border: BORDER }}>
            <span className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center" style={{ background: q.dot }}>
              <span className="w-1 h-1 rounded-full bg-black mr-0.5" />
              <span className="w-1 h-1 rounded-full bg-black" />
            </span>
            <span className="text-[13px] font-bold truncate">{q.label}</span>
          </button>
        ))}
        {done && (
          <p className="text-[12px] font-bold text-center rounded-full py-1.5" style={{ background: CHIP }} role="status">
            {done}
          </p>
        )}
      </div>
    </div>
  );
}
