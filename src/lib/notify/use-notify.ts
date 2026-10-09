"use client";

/**
 * API única para avisos dentro de la app (confirmaciones del agente, metas cumplidas, errores,
 * recordatorios, mensajes y permisos del agente) — Fase 4. Reemplaza los toasts/alertas sueltos que
 * había en `meal-actions-menu.tsx`, `mascot-dock.tsx`, `buscar-nuevo/page.tsx` y las dos páginas de
 * planificaciones (ver docs/diseno.md). La UI la pone `DynamicIsland` (montada una vez en el layout
 * del dashboard) leyendo `useNotifyStore` — este archivo solo expone la forma de llamarlo.
 */
import { useCallback } from "react";
import { useNotifyStore, type NotifyInput, type NotifyPriority, type NotifyType } from "@/lib/store/notifyStore";

export type { NotifyAction, NotifyInput, NotifyItem, NotifyPriority, NotifyType } from "@/lib/store/notifyStore";

/** Atajo sin hook, para llamar desde fuera de un componente (manejadores de eventos, stores, etc.). */
export function notify(input: NotifyInput): string {
  return useNotifyStore.getState().push(input);
}

/** Atajos de un solo uso para los casos más comunes (quedan como conveniencia, `notify()` cubre todo). */
export function notifyInfo(title: string, message?: string): string {
  return notify({ type: "reminder", priority: "low", title, message });
}
export function notifyGoal(title: string, message?: string): string {
  return notify({ type: "goal", priority: "low", title, message });
}
export function notifyError(title: string, message?: string): string {
  return notify({ type: "error", priority: "low", title, message });
}

export function useNotify() {
  const push = useNotifyStore((s) => s.push);
  const dismiss = useNotifyStore((s) => s.dismiss);
  const queueLength = useNotifyStore((s) => s.queue.length + (s.current ? 1 : 0));

  const send = useCallback(
    (
      title: string,
      message?: string,
      opts?: { type?: NotifyType; priority?: NotifyPriority; actions?: NotifyInput["actions"]; durationMs?: number; onDismiss?: () => void },
    ) =>
      push({
        type: opts?.type ?? "reminder",
        priority: opts?.priority ?? "low",
        title,
        message,
        actions: opts?.actions,
        durationMs: opts?.durationMs,
        onDismiss: opts?.onDismiss,
      }),
    [push],
  );

  return { notify: send, push, dismiss, queueLength };
}
