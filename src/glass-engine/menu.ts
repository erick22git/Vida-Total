"use client";

/*============================================================

    GLASS ENGINE
    MENU.TS

    GlassMenu es la clase que gestiona la burbuja de verdad: un
    div `.glass-selector` que ella misma inyecta en el DOM (no
    React) como primer hijo del root, envuelto en un
    GlassMaterial propio (canal "menu"), y animado con DOS
    resortes físicos independientes (xSpring/widthSpring) hacia
    la posición/ancho del `.menu-item` activo. El stretch/squash
    tipo gel sale de la velocidad instantánea de eses resortes
    (applyTransform), no de una aproximación de Framer Motion.
    También genera y sube al filtro `glassLensDistortion` un mapa
    de desplazamiento de lupa real (lens-map.ts) del tamaño exacto
    de la burbuja.

    [GLASS ENGINE — CONSUMIDOR NUEVO en este proyecto — no existía
    como menu.ts/menu.js portado antes; SÍ existe tal cual en
    C:\Erick\Gym\src\glass-engine\core\menu.js. Se porta completo
    y sin cambios de lógica: la única adaptación real es de
    sintaxis a TypeScript/ES modules. El listener de click que
    bindEvents() agrega directo sobre cada `.menu-item` es
    redundante con la navegación de Next.js (<Link>, ver
    bottom-nav.tsx) pero inofensivo — se deja tal cual, es parte
    del motor.

============================================================*/

import Utils from "./utils";
import Spring from "./spring";
import renderer, { type RendererModule } from "./renderer";
import GlassMaterial from "./glass";
import buildLensDisplacementMap from "./lens-map";

const BUBBLE_OVERSIZE_X = 1.2;

const BUBBLE_OVERSIZE_Y = 1.25;

export interface GlassMenuOptions {
  proximity?: number;
  stiffness?: number;
  damping?: number;
}

class GlassMenu implements RendererModule {
  root: HTMLElement;
  items: HTMLElement[];
  activeIndex: number;
  pointerDown = false;

  baseWidth = 1;
  baseHeight = 1;
  activeContentHeight = 1;
  activeContentWidth = 1;
  activeContentLeft = 0;
  activeExtraOffsetX = 0;

  lensMapDataUrl: string | null = null;
  lensMapApplied = false;

  selector!: HTMLDivElement;
  material!: GlassMaterial;
  xSpring: Spring;
  widthSpring: Spring;

  private onResize: () => void;

  constructor(root: HTMLElement, options: GlassMenuOptions = {}) {
    this.root = root;

    this.items = Array.from(root.querySelectorAll<HTMLElement>(".menu-item"));

    this.activeIndex = Math.max(
      this.items.findIndex((item) => item.classList.contains("active")),
      0,
    );

    this.buildSelector();

    this.material = new GlassMaterial(this.selector, {
      channel: "menu",
      thickness: "thick",
      proximity: options.proximity ?? 260,
      chroma: "physical",
      lightIntensityScale: 0.45,
    });

    this.xSpring = new Spring(0, { stiffness: options.stiffness ?? 0.24, damping: options.damping ?? 0.76 });

    this.widthSpring = new Spring(0, { stiffness: options.stiffness ?? 0.24, damping: options.damping ?? 0.8 });

    this.onResize = Utils.debounce(() => this.syncToActive(true), 120);

    this.bindEvents();

    requestAnimationFrame(() => this.syncToActive(true));

    renderer.add(this);
  }

  buildSelector() {
    this.selector = Utils.create("div", "glass-selector");

    this.root.prepend(this.selector);
  }

  bindEvents() {
    this.items.forEach((item, index) => {
      item.addEventListener("click", () => this.select(index));
    });

    this.root.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest(".menu-item")) {
        this.pointerDown = true;

        this.material.press();
      }
    });

    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });

    window.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });

    window.addEventListener("resize", this.onResize);
  }

  select(index: number) {
    if (index === this.activeIndex) return;

    this.items[this.activeIndex]?.classList.remove("active");

    this.activeIndex = index;

    this.items[index]?.classList.add("active");

    this.material.press();

    this.syncToActive(false);
  }

  hoverAt(index: number) {
    const item = this.items[index];

    if (!item) return;

    const rootRect = this.root.getBoundingClientRect();

    const itemRect = item.getBoundingClientRect();

    this.xSpring.setTarget(itemRect.left - rootRect.left);

    this.widthSpring.setTarget(itemRect.width);
  }

  hoverRelease() {
    this.syncToActive(false);
  }

  syncToActive(immediate: boolean) {
    const item = this.items[this.activeIndex];

    if (!item) return;

    const rootRect = this.root.getBoundingClientRect();

    const itemRect = item.getBoundingClientRect();

    const x = itemRect.left - rootRect.left;

    const width = itemRect.width;

    this.xSpring.setTarget(x);

    this.widthSpring.setTarget(width);

    const content = item.querySelector<HTMLElement>(".menu-item-content") || item;

    const contentRect = content.getBoundingClientRect();

    this.activeContentHeight = contentRect.height;

    this.activeContentWidth = contentRect.width;

    this.activeContentLeft = contentRect.left - rootRect.left;

    if (immediate) {
      this.xSpring.jumpTo(x);

      this.widthSpring.jumpTo(width);

      this.baseWidth = width * BUBBLE_OVERSIZE_X;

      this.baseHeight = itemRect.height;

      this.selector.style.width = `${this.baseWidth.toFixed(2)}px`;

      this.applyTransform(x, width);

      this.selector.style.opacity = "1";

      const map = buildLensDisplacementMap(this.baseWidth, itemRect.height);

      this.lensMapDataUrl = map.dataUrl;

      this.lensMapApplied = false;
    }
  }

  update(deltaMs: number) {
    const x = this.xSpring.update(deltaMs);

    const width = this.widthSpring.update(deltaMs);

    this.applyTransform(x, width);

    this.syncLensMap();

    const motion = Math.abs(this.xSpring.velocity) + Math.abs(this.widthSpring.velocity);

    this.material.setMotion(motion);

    const lensDisplacement = document.getElementById("glassLensDisplacement");

    if (lensDisplacement) {
      const motionBoost = Math.min(motion * 0.08, 20);

      lensDisplacement.setAttribute("scale", (110 + motionBoost).toFixed(1));
    }

    if (!this.pointerDown && this.xSpring.isResting() && this.widthSpring.isResting()) {
      this.material.release();
    }
  }

  syncLensMap() {
    if (this.lensMapApplied || !this.lensMapDataUrl) return;

    const image = document.getElementById("lensMapImage");

    if (!image) return;

    image.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.lensMapDataUrl);

    this.lensMapApplied = true;
  }

  applyTransform(x: number, width: number) {
    const stretch = Utils.clamp(1 + Math.abs(this.xSpring.velocity) * 0.014, 1, 1.45);

    const squash = Utils.clamp(1 - (stretch - 1) * 0.7, 0.8, 1);

    const scaleX = stretch * BUBBLE_OVERSIZE_X;

    let scaleY = squash * BUBBLE_OVERSIZE_Y;

    const boxHeight = this.selector.offsetHeight;

    if (boxHeight > 0 && this.activeContentHeight > 0) {
      scaleY = Math.max(scaleY, (this.activeContentHeight + 8) / boxHeight);
    }

    let visualWidth = width * scaleX;

    const minVisualWidth = this.activeContentWidth + 8;

    if (visualWidth < minVisualWidth) visualWidth = minVisualWidth;

    let tx = x + width / 2 - visualWidth / 2;

    const contentLeft = this.activeContentLeft;

    const contentRight = this.activeContentLeft + this.activeContentWidth;

    const NEARBY_MARGIN = 60;

    const nearby = tx < contentRight + NEARBY_MARGIN && tx + visualWidth > contentLeft - NEARBY_MARGIN;

    if (nearby && this.activeContentWidth > 0) {
      if (tx > contentLeft - 4) tx = contentLeft - 4;

      if (tx + visualWidth < contentRight + 4) tx = contentRight + 4 - visualWidth;
    }

    tx += this.activeExtraOffsetX;

    const cssScaleX = visualWidth / this.baseWidth;

    const cssScaleY = scaleY;

    this.selector.style.transform = `translateX(${tx.toFixed(2)}px) scaleX(${cssScaleX.toFixed(4)}) scaleY(${cssScaleY.toFixed(3)})`;

    const renderedHeight = this.baseHeight * cssScaleY;

    const targetRadius = renderedHeight / 2;

    this.selector.style.borderRadius = `${(targetRadius / cssScaleX).toFixed(2)}px / ${(targetRadius / cssScaleY).toFixed(2)}px`;
  }

  destroy() {
    renderer.remove(this);

    this.material.destroy();

    this.selector.remove();

    window.removeEventListener("resize", this.onResize);
  }
}

export default GlassMenu;
