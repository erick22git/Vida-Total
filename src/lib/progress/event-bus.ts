import type { ProgressEvent, ProgressEventType } from "./types";

/**
 * Bus de eventos de progreso ENTRE módulos (sin React, sin stores).
 *
 * Un módulo (hoy Gym: agua, calorías, entrenamiento) avisa "esto pasó" con un `ProgressEvent` y no sabe quién
 * escucha; quien lo consume (hoy Hábitos, vía `src/lib/habits/source-dispatcher.ts`) decide qué hacer. Es distinto
 * del Animation Engine (`src/lib/animations`), que solo lleva eventos VISUALES de una pantalla: aquí viajan hechos
 * de negocio. Sumar un evento nuevo (sueño, kegel, meditación…) es agregar su tipo a `ProgressEventType`.
 */
type Listener = (event: ProgressEvent) => void;

class ProgressEventBus {
  private listeners = new Set<Listener>();

  emit(event: ProgressEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        // Un consumidor que falle nunca debe romper al módulo que emitió el evento.
        console.warn("[progress-events] un consumidor lanzó una excepción:", err);
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const progressEvents = new ProgressEventBus();

/** Atajo para emitir un hecho de progreso. `entityId` identifica lo que lo causó (p.ej. la sesión de entrenamiento). */
export function emitProgressEvent(type: ProgressEventType, entityId: string, meta?: Record<string, unknown>): void {
  progressEvents.emit({ type, entityId, timestamp: Date.now(), meta });
}
