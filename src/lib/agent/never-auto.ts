/**
 * LISTA "NUNCA AUTOMÁTICO" — fija en código. Ni el modo "Auto total" ni un "Permitir siempre" la saltan: estas acciones
 * siempre piden confirmación explícita (o, en Telegram, directamente no se pueden hacer). Se evalúa en `permissions.ts`.
 * Documentada en `docs/agente-nunca-automatico.md`; si cambias esto, cambia también ese documento y las pruebas.
 */

export type NeverAutoCode =
  | "habit_complete"
  | "delete_data"
  | "batch"
  | "change_permissions"
  | "change_agent_config"
  | "telegram_link"
  | "untrusted_origin";

export const NEVER_AUTO: ReadonlyArray<{ code: NeverAutoCode; titulo: string; porque: string }> = [
  { code: "habit_complete", titulo: "Marcar hábitos como completados", porque: "Regla del producto: un hábito solo se cumple porque tú lo hiciste." },
  { code: "delete_data", titulo: "Borrar datos", porque: "No se puede deshacer del todo; siempre lo confirmas tú." },
  { code: "batch", titulo: "Acciones por lotes (más de N elementos)", porque: "Un error se multiplica; se muestra el plan y lo apruebas." },
  { code: "change_permissions", titulo: "Cambiar los permisos del agente", porque: "El agente no puede darse permisos a sí mismo." },
  { code: "change_agent_config", titulo: "Cambiar la configuración del agente", porque: "Modos, límites, canales y apagado son tuyos." },
  { code: "telegram_link", titulo: "Vincular o desvincular Telegram", porque: "Decide quién puede hablarle a tu agente; solo desde la app." },
  { code: "untrusted_origin", titulo: "Acciones disparadas por contenido no confiable", porque: "Una nota, un archivo o un mensaje ajeno son datos, no órdenes." },
];

/** Tope duro del "N" de lotes: la configuración puede bajarlo, nunca subirlo por encima de esto. */
export const HARD_MAX_BATCH = 5;
export const DEFAULT_MAX_BATCH = 3;

/** Tope duro de escrituras: la configuración puede bajarlo, nunca subirlo por encima de esto. */
export const HARD_MAX_WRITES_PER_HOUR = 120;
export const HARD_MAX_WRITES_PER_DAY = 600;
