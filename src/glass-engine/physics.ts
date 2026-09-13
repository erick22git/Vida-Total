"use client";

/*============================================================

    GLASS ENGINE
    PHYSICS.TS

    PhysicsConfig lee los valores por defecto de resorte
    (--spring-stiffness/--spring-damping/--spring-mass/
    --spring-precision) desde las CSS custom properties de
    :root, cacheándolos tras la primera lectura. SpringVector2
    es un par de Spring (x/y) que comparte esa config base,
    salvo overrides puntuales por instancia.

    [GLASS ENGINE — CORE — PORTADO TAL CUAL desde
    C:\Erick\Gym\src\glass-engine\core\physics.js] Único cambio
    real de lógica respecto al original: PhysicsConfig.read()
    agrega una guarda SSR (`typeof document === "undefined"`)
    antes de llamar a getComputedStyle(document.documentElement)
    — en el original esto nunca hacía falta porque el archivo
    corría solo en un navegador (Electron); en Next.js este
    módulo puede evaluarse en el servidor a través de cursor.ts,
    así que se agrega el mismo patrón de guarda que ya usa
    refraction.ts, devolviendo los valores por defecto sin
    cachearlos (se cachean recién en la primera lectura real en
    cliente).

============================================================*/

import Spring, { type SpringConfig } from "./spring";

interface PhysicsConfigShape {
  stiffness: number;
  damping: number;
  mass: number;
  precision: number;
}

const DEFAULTS: PhysicsConfigShape = {
  stiffness: 0.16,
  damping: 0.78,
  mass: 1,
  precision: 0.001,
};

class PhysicsConfig {
  static cached: PhysicsConfigShape | null = null;

  static read(): PhysicsConfigShape {
    if (PhysicsConfig.cached) return PhysicsConfig.cached;

    if (typeof document === "undefined") {
      return DEFAULTS;
    }

    const style = getComputedStyle(document.documentElement);

    const numberOf = (name: string, fallback: number) => {
      const raw = style.getPropertyValue(name).trim();

      const value = parseFloat(raw);

      return Number.isFinite(value) ? value : fallback;
    };

    PhysicsConfig.cached = {
      stiffness: numberOf("--spring-stiffness", DEFAULTS.stiffness),
      damping: numberOf("--spring-damping", DEFAULTS.damping),
      mass: numberOf("--spring-mass", DEFAULTS.mass),
      precision: numberOf("--spring-precision", DEFAULTS.precision),
    };

    return PhysicsConfig.cached;
  }
}

class SpringVector2 {
  x: Spring;
  y: Spring;

  constructor(x = 0, y = 0, config: SpringConfig = {}) {
    const merged = { ...PhysicsConfig.read(), ...config };

    this.x = new Spring(x, merged);

    this.y = new Spring(y, merged);
  }

  setTarget(x: number, y: number) {
    this.x.setTarget(x);

    this.y.setTarget(y);

    return this;
  }

  jumpTo(x: number, y: number) {
    this.x.jumpTo(x);

    this.y.jumpTo(y);

    return this;
  }

  update(deltaMs: number) {
    return { x: this.x.update(deltaMs), y: this.y.update(deltaMs) };
  }

  isResting() {
    return this.x.isResting() && this.y.isResting();
  }
}

export default SpringVector2;

export { PhysicsConfig };
