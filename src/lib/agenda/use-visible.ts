import { useMemo } from "react";
import { useAgendaStore } from "./store";
import type { AgendaTask } from "./types";

/** Tareas que se deben mostrar: oculta las de calendarios/listas apagados en Ajustes (siguen guardadas). */
export function useVisibleTasks(): AgendaTask[] {
  const tasks = useAgendaStore((s) => s.tasks);
  const calendars = useAgendaStore((s) => s.calendars);
  return useMemo(() => {
    const hidden = new Set(calendars.filter((c) => !c.visible).map((c) => c.id));
    return hidden.size === 0 ? tasks : tasks.filter((t) => !t.calendarId || !hidden.has(t.calendarId));
  }, [tasks, calendars]);
}
