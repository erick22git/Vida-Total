/*============================================================

    GLASS ENGINE
    UTILS.TS

    Funciones puras compartidas por todo el motor.
    Sin estado, sin dependencias de otros módulos.

    [GLASS ENGINE — CORE — PORTADO TAL CUAL desde
    C:\Erick\Gym\src\glass-engine\core\utils.js]
    Motor genérico, independiente del número de ítems o de los
    íconos usados. Se porta completo, sin cambios de lógica —
    solo se le agregan tipos de TypeScript y se lo convierte a
    módulo ES para poder importarlo desde componentes Next.js.

============================================================*/

class Utils {
  /*======================================================
    DOM — CREAR ELEMENTO
    ======================================================*/

  static create<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    return el;
  }

  /*======================================================
    MATEMÁTICA — CLAMP
    ======================================================*/

  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /*======================================================
    MATEMÁTICA — INTERPOLACIÓN LINEAL
    ======================================================*/

  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /*======================================================
    MATEMÁTICA — MAPEAR RANGO
    ======================================================*/

  static mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
    shouldClamp = true,
  ): number {
    const t = (value - inMin) / (inMax - inMin);

    const result = outMin + t * (outMax - outMin);

    if (!shouldClamp) {
      return result;
    }

    const low = Math.min(outMin, outMax);

    const high = Math.max(outMin, outMax);

    return Utils.clamp(result, low, high);
  }

  /*======================================================
    MATEMÁTICA — DISTANCIA ENTRE DOS PUNTOS
    ======================================================*/

  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;

    const dy = y2 - y1;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /*======================================================
    MATEMÁTICA — ÁNGULO ENTRE DOS PUNTOS (grados)
    ======================================================*/

  static angle(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  }

  /*======================================================
    MATEMÁTICA — REDONDEO A N DECIMALES
    ======================================================*/

  static round(value: number, decimals = 3): number {
    const factor = 10 ** decimals;

    return Math.round(value * factor) / factor;
  }

  /*======================================================
    RENDIMIENTO — DEBOUNCE
    ======================================================*/

  static debounce<F extends (...args: never[]) => void>(fn: F, wait = 150) {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>) => {
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  /*======================================================
    ACCESIBILIDAD — PREFERS REDUCED MOTION
    ======================================================*/

  static prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}

/*============================================================

    VECTOR 2D

    Estructura ligera usada por el motor de física y el
    cursor para representar posición, velocidad y aceleración.

============================================================*/

class Vector2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;

    this.y = y;
  }

  set(x: number, y: number) {
    this.x = x;

    this.y = y;

    return this;
  }

  copy(vector: Vector2) {
    this.x = vector.x;

    this.y = vector.y;

    return this;
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}

export default Utils;

export { Vector2 };
