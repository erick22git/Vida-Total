"use client";

import { create } from "zustand";

/**
 * Cola de notificaciones de la Isla Dinámica (`DynamicIsland`) — ver docs/diseno.md, sección
 * "Notificaciones e isla". Guarda SOLO estado de UI (nada se persiste): si se recarga la página la
 * cola se vacía. Una notificación a la vez (`current`); el resto espera en `queue` con el indicador
 * "+n". Prioridad decide el comportamiento:
 *   - "low"    (informativa): se oculta sola a los `durationMs` (o 3600 ms por defecto).
 *   - "medium" (recordatorio): no se oculta sola — espera un toque, swipe o acción.
 *   - "high"   (permiso del agente): no se puede descartar con swipe — se queda hasta que se
 *     responda con una acción; además entra ya expandida (no hace falta tocarla).
 */
export type NotifyPriority = "low" | "medium" | "high";
export type NotifyType = "reminder" | "goal" | "error" | "agent-result" | "agent-message" | "permission";

export interface NotifyAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

export interface NotifyItem {
  id: string;
  type: NotifyType;
  priority: NotifyPriority;
  title: string;
  message?: string;
  actions?: NotifyAction[];
  /** ms antes de ocultarse sola — solo aplica a prioridad "low". Por defecto 3600 (ver expo-dynamic-notifications). */
  durationMs?: number;
  /** Se llama SIEMPRE que la notificación sale de `current` (swipe, acción o reemplazo) — para que
   * quien la empujó (p.ej. `AgentNotificationBanner`) pueda marcarla leída sin importar cómo se cerró. */
  onDismiss?: () => void;
  createdAt: number;
}

export type NotifyInput = Omit<NotifyItem, "id" | "createdAt">;

interface NotifyState {
  queue: NotifyItem[];
  current: NotifyItem | null;
  /** Expandida apenas entra (se fuerza para prioridad "high"; el usuario puede expandir cualquiera tocando). */
  expanded: boolean;
  push: (item: NotifyInput) => string;
  dismissCurrent: () => void;
  dismiss: (id: string) => void;
  setExpanded: (v: boolean) => void;
}

let seq = 0;
function nextId() {
  seq += 1;
  return `notif-${Date.now()}-${seq}`;
}

export const useNotifyStore = create<NotifyState>()((set, get) => ({
  queue: [],
  current: null,
  expanded: false,
  push: (item) => {
    const full: NotifyItem = { ...item, id: nextId(), createdAt: Date.now() };
    set((s) => {
      if (!s.current) return { current: full, expanded: full.priority === "high" };
      return { queue: [...s.queue, full] };
    });
    return full.id;
  },
  dismissCurrent: () => {
    get().current?.onDismiss?.();
    set((s) => {
      const [next, ...rest] = s.queue;
      return { current: next ?? null, queue: rest, expanded: next ? next.priority === "high" : false };
    });
  },
  dismiss: (id) => {
    const { current } = get();
    if (current?.id === id) {
      get().dismissCurrent();
      return;
    }
    set((s) => {
      s.queue.find((n) => n.id === id)?.onDismiss?.();
      return { queue: s.queue.filter((n) => n.id !== id) };
    });
  },
  setExpanded: (v) => set({ expanded: v }),
}));
