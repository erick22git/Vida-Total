import { AgentPermissionsScreen } from "@/components/agente/agent-permissions-screen";

// Pantalla negra completa (mismo diseño de la Agenda de Hábitos), por encima del menú.
export default function AgentePage() {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-white">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-[max(env(safe-area-inset-top),12px)] pb-16">
        <AgentPermissionsScreen />
      </div>
    </div>
  );
}
