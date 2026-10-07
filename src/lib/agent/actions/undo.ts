"use client";

/**
 * Deshacer una acción del agente. Usa las acciones normales de los stores (así también se sincroniza con Supabase), no
 * un borrado directo. Devuelve false si no hay cómo deshacerla.
 */
import { useGymStore } from "@/lib/store/gymStore";
import { useHabitsStore } from "@/lib/store/habitsStore";
import { useAgentStore } from "@/lib/store/agentStore";
import type { ActionRecord, UndoSpec } from "../history";
import type { NotionPage, Task } from "@/lib/types/habits";

export function applyUndo(spec: UndoSpec): boolean {
  const gym = useGymStore.getState();
  const habits = useHabitsStore.getState();
  switch (spec.kind) {
    case "remove_water":
      gym.removeWaterEntry(spec.id);
      return true;
    case "remove_food":
      gym.removeLoggedFood(spec.id);
      return true;
    case "remove_task":
      habits.removeTask(spec.id);
      return true;
    case "restore_task":
      habits.updateTask(spec.id, spec.patch as Partial<Task>);
      return true;
    case "remove_note":
      habits.removePage(spec.id);
      return true;
    case "restore_note":
      habits.updatePage(spec.id, spec.patch as Partial<NotionPage>);
      return true;
  }
}

export function undoRecord(rec: ActionRecord): boolean {
  if (!rec.undo || rec.undone) return false;
  const ok = applyUndo(rec.undo);
  if (ok) useAgentStore.getState().markUndone(rec.id);
  return ok;
}
