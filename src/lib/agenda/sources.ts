import type { AgendaSource, AgendaTask } from "./types";

export const sourceOf = (t: Pick<AgendaTask, "source">): AgendaSource => t.source ?? "local";
export const isImported = (t: Pick<AgendaTask, "source">) => sourceOf(t) !== "local";
/** Los eventos de calendario son de solo lectura (título, día, hora, notas): solo se puede cambiar color e icono. */
export const isReadOnlyEvent = (t: Pick<AgendaTask, "source">) => sourceOf(t) === "calendar";

export const SOURCE_LABEL: Record<AgendaSource, string> = {
  local: "Tarea",
  calendar: "Evento de calendario",
  reminder: "Recordatorio",
};
