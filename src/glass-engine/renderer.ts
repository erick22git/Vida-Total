/*============================================================

GLASS ENGINE
RENDERER.TS

Single Render Loop

[GLASS ENGINE — CORE — PORTADO TAL CUAL desde
C:\Erick\Gym\src\glass-engine\core\renderer.js]
Motor genérico, independiente del número de ítems o de los
íconos usados. Se porta completo, sin cambios de lógica —
solo tipos de TypeScript. Guardado contra SSR: en Next.js
este módulo puede evaluarse en el servidor (Node), donde
`performance.now()` sí existe (global de Node >=16), pero
`requestAnimationFrame` no — por eso `start()` nunca se llama
sola al importar el módulo, solo cuando algún módulo real se
agrega vía `add()` desde código que ya sabemos que corre en
cliente (ver refraction.ts).

============================================================*/

export interface RendererModule {
  update?: (deltaMs: number, now: number) => void;
}

class Renderer {
  modules: RendererModule[];
  running: boolean;
  lastTime: number;
  delta: number;
  time: number;
  fps: number;
  frame: number;
  maxDelta: number;
  private boundLoop: (now: number) => void;

  constructor() {
    this.modules = [];

    this.running = false;

    this.lastTime = typeof performance !== "undefined" ? performance.now() : 0;

    this.delta = 0;

    this.time = 0;

    this.fps = 0;

    this.frame = 0;

    this.maxDelta = 32;

    this.boundLoop = this.loop.bind(this);
  }

  /*==========================================================
    ADD MODULE
    ==========================================================*/

  add(module: RendererModule | null | undefined) {
    if (!module) return;

    if (this.modules.includes(module)) return;

    this.modules.push(module);

    if (!this.running) this.start();
  }

  /*==========================================================
    REMOVE MODULE
    ==========================================================*/

  remove(module: RendererModule) {
    this.modules = this.modules.filter((m) => m !== module);
  }

  /*==========================================================
    START
    ==========================================================*/

  start() {
    if (this.running) return;

    if (typeof requestAnimationFrame === "undefined") return;

    this.running = true;

    this.lastTime = performance.now();

    requestAnimationFrame(this.boundLoop);
  }

  /*==========================================================
    STOP
    ==========================================================*/

  stop() {
    this.running = false;
  }

  /*==========================================================
    LOOP
    ==========================================================*/

  loop(now: number) {
    if (!this.running) return;

    let delta = now - this.lastTime;

    if (delta > this.maxDelta) delta = this.maxDelta;

    this.delta = delta / 16.666;

    this.time = now;

    this.fps = Math.round(1000 / Math.max(delta, 0.0001));

    this.frame++;

    this.lastTime = now;

    for (const rendererModule of this.modules) {
      if (rendererModule && typeof rendererModule.update === "function") {
        // Los módulos (Spring, GlassMaterial, GlassMenu,
        // GlassCard, Cursor...) esperan milisegundos reales
        // transcurridos, no el "frames equivalentes" que usa
        // this.delta internamente para fps/getInfo() — cada
        // Spring ya hace su propia normalización a 60fps.

        rendererModule.update(delta, now);
      }
    }

    requestAnimationFrame(this.boundLoop);
  }

  /*==========================================================
    CLEAR
    ==========================================================*/

  clear() {
    this.modules.length = 0;
  }

  /*==========================================================
    INFO
    ==========================================================*/

  getInfo() {
    return {
      fps: this.fps,

      delta: this.delta,

      frame: this.frame,

      modules: this.modules.length,

      time: this.time,
    };
  }
}

const renderer = new Renderer();

export default renderer;
