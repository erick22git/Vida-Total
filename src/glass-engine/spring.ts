/*============================================================

    GLASS ENGINE
    SPRING.TS

    Motor de física de resorte para un único valor escalar.

    No es un "lerp" — es una simulación real con masa,
    rigidez, amortiguación y detección de reposo. El
    movimiento puede sobrepasar el objetivo (overshoot) y
    volver, igual que un material físico real.

    El paso de integración se normaliza a "frames de 60fps"
    (deltaFrames) para que stiffness/damping se comporten
    igual sin importar el refresh rate de la pantalla.

    [GLASS ENGINE — CORE — PORTADO TAL CUAL desde
    C:\Erick\Gym\src\glass-engine\core\spring.js] Motor
    genérico, independiente del número de ítems o de los
    íconos usados. Se porta completo, sin cambios de lógica —
    solo tipos de TypeScript, siguiendo el mismo patrón usado
    para utils.ts/renderer.ts/refraction.ts.

============================================================*/

import Utils from "./utils";

const BASE_FRAME_MS = 1000 / 60;

const MAX_DELTA_FRAMES = 3;

export interface SpringConfig {
  mass?: number;
  stiffness?: number;
  damping?: number;
  precision?: number;
}

class Spring {
  mass: number;
  stiffness: number;
  damping: number;
  precision: number;

  current: number;
  target: number;
  velocity: number;
  resting: boolean;

  constructor(value = 0, config: SpringConfig = {}) {
    this.mass = config.mass ?? 1;

    this.stiffness = config.stiffness ?? 0.16;

    this.damping = config.damping ?? 0.78;

    this.precision = config.precision ?? 0.001;

    this.current = value;

    this.target = value;

    this.velocity = 0;

    this.resting = true;
  }

  /*======================================================
    OBJETIVO
    ======================================================*/

  setTarget(value: number) {
    if (value !== this.target) {
      this.target = value;

      this.resting = false;
    }

    return this;
  }

  /*======================================================
    SALTAR SIN ANIMAR
    ======================================================*/

  jumpTo(value: number) {
    this.current = value;

    this.target = value;

    this.velocity = 0;

    this.resting = true;

    return this;
  }

  /*======================================================
    ACTUALIZAR — un paso de integración
    ======================================================*/

  update(deltaMs: number) {
    if (this.resting) {
      return this.current;
    }

    const deltaFrames = Utils.clamp(deltaMs / BASE_FRAME_MS, 0, MAX_DELTA_FRAMES);

    const displacement = this.target - this.current;

    const force = (displacement * this.stiffness) / this.mass;

    this.velocity += force * deltaFrames;

    this.velocity *= Math.pow(this.damping, deltaFrames);

    this.current += this.velocity * deltaFrames;

    this.checkRest(displacement);

    return this.current;
  }

  /*======================================================
    DETECCIÓN DE REPOSO
    ======================================================*/

  checkRest(displacement: number) {
    const isSlow = Math.abs(this.velocity) < this.precision;

    const isClose = Math.abs(displacement) < this.precision;

    if (isSlow && isClose) {
      this.current = this.target;

      this.velocity = 0;

      this.resting = true;
    }
  }

  /*======================================================
    ESTADO
    ======================================================*/

  isResting() {
    return this.resting;
  }
}

export default Spring;
