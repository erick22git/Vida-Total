import type { AnimationEvent } from "./types";

/**
 * Animation Engine — un pub/sub mínimo, sin dependencias de React. La
 * lógica de negocio (business actions / progress engine) nunca importa
 * componentes ni sabe qué animación existe; solo emite un `AnimationEvent`
 * acá. Los componentes de UI (ver `use-animation-engine.ts`) se suscriben y
 * deciden qué mostrar. Esto es lo que permite cambiar toda la capa visual
 * (p.ej. reemplazar el placeholder del cristal por un objeto Rive) sin
 * tocar ni un store ni el progress engine.
 */
type Listener = (event: AnimationEvent) => void;

class AnimationEngine {
  private listeners = new Set<Listener>();

  emit(event: AnimationEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const animationEngine = new AnimationEngine();
