/**
 * Herramientas "de sistema" y de hábitos que el agente NO ofrece al modelo (`exposed: false`): existen solo para que la
 * política de permisos las conozca y la lista "nunca automático" tenga dónde apoyarse (y para las pruebas). Si algún día
 * se exponen, ya nacen con confirmación obligatoria.
 */
import { asArgs, type ToolMeta } from "./meta";

const NO_PARAMS = { type: "object", properties: {}, additionalProperties: false } as const;
const passthrough = (raw: unknown) => {
  const a = asArgs(raw);
  return a ? ({ ok: true, args: a } as const) : ({ ok: false, error: "Argumentos inválidos." } as const);
};

export const SYSTEM_TOOLS: ToolMeta[] = [
  {
    name: "habit_complete",
    module: "habitos",
    label: "Marcar hábito como completado",
    description: "Marca un hábito como hecho hoy.",
    kind: "write",
    exposed: false,
    neverAuto: ["habit_complete"],
    parameters: NO_PARAMS,
    validate: passthrough,
  },
  {
    name: "data_delete",
    module: "sistema",
    label: "Borrar datos",
    description: "Borra registros del usuario.",
    kind: "destructive",
    exposed: false,
    neverAuto: ["delete_data"],
    parameters: NO_PARAMS,
    validate: passthrough,
  },
  {
    name: "permissions_change",
    module: "sistema",
    label: "Cambiar permisos del agente",
    description: "Modifica los permisos o niveles de las herramientas.",
    kind: "config",
    exposed: false,
    neverAuto: ["change_permissions"],
    parameters: NO_PARAMS,
    validate: passthrough,
  },
  {
    name: "agent_config_change",
    module: "sistema",
    label: "Cambiar configuración del agente",
    description: "Modifica modos, límites, canales o el apagado total.",
    kind: "config",
    exposed: false,
    neverAuto: ["change_agent_config"],
    parameters: NO_PARAMS,
    validate: passthrough,
  },
  {
    name: "telegram_link",
    module: "sistema",
    label: "Vincular o desvincular Telegram",
    description: "Asocia o separa una cuenta de Telegram.",
    kind: "config",
    exposed: false,
    neverAuto: ["telegram_link"],
    parameters: NO_PARAMS,
    validate: passthrough,
  },
];
