"use client";

/*============================================================

    GLASS ENGINE
    CURSOR.TS

    Singleton que trackea la posición del puntero suavizada por
    un resorte físico (SpringVector2), y de ahí deriva velocidad,
    dirección y posición normalizada — GlassMaterial lo consulta
    cada frame para decidir brillo/cromatismo según distancia y
    velocidad del cursor.

    [GLASS ENGINE — CORE — PORTADO TAL CUAL desde
    C:\Erick\Gym\src\glass-engine\core\cursor.js] Único cambio
    real de lógica respecto al original: el original instancia
    `new Cursor()` a nivel de módulo y ese constructor lee
    `window.innerWidth`/`window.innerHeight` de inmediato — en
    Next.js este módulo se evalúa también en el servidor (SSR
    del componente cliente que lo importa transitivamente), donde
    `window` no existe. Se aplica el MISMO patrón de guarda que ya
    usa refraction.ts: el constructor detecta
    `typeof window === "undefined"` y en ese caso arranca en
    (0,0) sin registrar listeners ni añadirse al renderer —
    ningún acceso a `window`/`document` ocurre en el server. En
    cliente el comportamiento es idéntico al original: se
    instancia una única vez a nivel de módulo, se bindea a
    pointermove/resize y se registra en el renderer compartido.

============================================================*/

import renderer, { type RendererModule } from "./renderer";
import SpringVector2 from "./physics";
import Utils from "./utils";

interface CursorData {
  x: number;
  y: number;
  nx: number;
  ny: number;
  vx: number;
  vy: number;
  speed: number;
  dx: number;
  dy: number;
}

class Cursor implements RendererModule {
  private ssr: boolean;

  position: { x: number; y: number };
  previous: { x: number; y: number };
  velocity: { x: number; y: number; speed: number };
  direction: { x: number; y: number };
  normalized: { x: number; y: number };
  spring: SpringVector2;

  constructor() {
    this.ssr = typeof window === "undefined";

    const initialX = this.ssr ? 0 : window.innerWidth * 0.5;

    const initialY = this.ssr ? 0 : window.innerHeight * 0.5;

    this.position = { x: initialX, y: initialY };

    this.previous = { x: this.position.x, y: this.position.y };

    this.velocity = { x: 0, y: 0, speed: 0 };

    this.direction = { x: 0, y: 0 };

    this.normalized = { x: 0.5, y: 0.5 };

    this.spring = new SpringVector2(this.position.x, this.position.y, {
      stiffness: 0.16,
      damping: 0.8,
    });

    if (this.ssr) {
      // SSR: nunca bindear listeners ni registrarse en el renderer.
      return;
    }

    this.bind();

    renderer.add(this);
  }

  bind() {
    window.addEventListener("pointermove", this.onMove, { passive: true });

    window.addEventListener("resize", this.onResize);
  }

  onMove = (event: PointerEvent) => {
    this.position.x = event.clientX;

    this.position.y = event.clientY;

    this.spring.setTarget(this.position.x, this.position.y);
  };

  onResize = () => {
    this.normalized.x = this.position.x / window.innerWidth;

    this.normalized.y = this.position.y / window.innerHeight;
  };

  update(delta: number) {
    const { x, y } = this.spring.update(delta);

    this.velocity.x = x - this.previous.x;

    this.velocity.y = y - this.previous.y;

    this.velocity.speed = Math.hypot(this.velocity.x, this.velocity.y);

    if (this.velocity.speed > 0.0001) {
      this.direction.x = this.velocity.x / this.velocity.speed;

      this.direction.y = this.velocity.y / this.velocity.speed;
    }

    this.previous.x = x;

    this.previous.y = y;

    this.normalized.x = x / window.innerWidth;

    this.normalized.y = y / window.innerHeight;
  }

  get x() {
    return this.spring.x.current;
  }

  get y() {
    return this.spring.y.current;
  }

  get speed() {
    return this.velocity.speed;
  }

  localPosition(rect: DOMRect) {
    const x = rect.width > 0 ? (this.x - rect.left) / rect.width : 0.5;

    const y = rect.height > 0 ? (this.y - rect.top) / rect.height : 0.5;

    return { x: Utils.clamp(x, 0, 1), y: Utils.clamp(y, 0, 1) };
  }

  get data(): CursorData {
    return {
      x: this.x,
      y: this.y,
      nx: this.normalized.x,
      ny: this.normalized.y,
      vx: this.velocity.x,
      vy: this.velocity.y,
      speed: this.velocity.speed,
      dx: this.direction.x,
      dy: this.direction.y,
    };
  }
}

/*============================================================

    SINGLETON

============================================================*/

const cursor = new Cursor();

export default cursor;
