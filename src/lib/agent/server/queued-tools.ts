/** Herramientas de EDICIÓN que el servidor no escribe en la tabla: las encola y la app las aplica (ver executor.ts). Módulo sin dependencias de servidor, para poder usarlo también en el cliente. */
export const QUEUED_TOOLS: ReadonlySet<string> = new Set(["task_update", "subtask_add", "subtask_complete", "note_update"]);
