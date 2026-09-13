"use client";

/*============================================================

    GLASS ENGINE
    GLASS.TS

    GlassMaterial es el "material" físico del vidrio: envuelve
    el contenido de un nodo raíz en capas (.glass-layer--fill/
    specular/rainbow), y en cada frame calcula, a partir de la
    distancia y velocidad del cursor, cuánta luz/cromatismo debe
    mostrar cada capa — expuesto como CSS custom properties
    (--light-intensity, --rainbow-opacity, --rainbow-offset,
    --border-intensity, --press) que el CSS de glass.css
    consume. Cuando se le da un `channel`, además alimenta al
    motor de refracción (refraction.ts) con velocidad/posición
    normalizada, y aplica los filtros SVG reales de ese canal en
    cuanto están disponibles.

    [GLASS ENGINE — CONSUMIDOR NUEVO en este proyecto — no
    existía como glass.ts/glass.js portado antes; SÍ existe tal
    cual en C:\Erick\Gym\src\glass-engine\core\glass.js. Se porta
    completo y sin cambios de lógica: la única adaptación es de
    sintaxis a TypeScript/ES modules e imports relativos de este
    proyecto (./utils, ./spring, ./renderer, ./cursor,
    ./refraction). No requiere ninguna guarda SSR propia porque
    solo se instancia desde código que ya sabemos que corre en
    cliente (GlassMenu, dentro de un useEffect de React — ver
    use-glass-menu.ts).

============================================================*/

import Utils from "./utils";
import Spring from "./spring";
import renderer, { type RendererModule } from "./renderer";
import cursor from "./cursor";
import refraction from "./refraction";

const LAYERS = ["fill", "specular", "rainbow"] as const;

type LayerName = (typeof LAYERS)[number];

export type ChromaMode = "off" | "physical" | "always" | "motion";

export interface GlassMaterialOptions {
  channel?: string | null;
  thickness?: string;
  proximity?: number;
  chroma?: ChromaMode;
  lightIntensityScale?: number;
  lightStiffness?: number;
  lightDamping?: number;
  squeezeStiffness?: number;
  squeezeDamping?: number;
}

class GlassMaterial implements RendererModule {
  root: HTMLElement;
  channel: string | null;
  thickness: string;
  proximity: number;
  chroma: ChromaMode;
  lightIntensityScale: number;

  rect: DOMRect;
  motionSpeed = 0;

  intensity: Spring;
  squeeze: Spring;

  refractionApplied = false;

  content!: HTMLElement;
  material!: HTMLDivElement;
  layers: Partial<Record<LayerName, HTMLDivElement>> = {};

  constructor(root: HTMLElement, options: GlassMaterialOptions = {}) {
    this.root = root;

    this.channel = options.channel ?? null;

    this.thickness = options.thickness ?? "regular";

    this.proximity = options.proximity ?? 240;

    this.chroma = options.chroma ?? "motion";

    this.lightIntensityScale = options.lightIntensityScale ?? 1;

    this.rect = root.getBoundingClientRect();

    this.intensity = new Spring(0, {
      stiffness: options.lightStiffness ?? 0.18,
      damping: options.lightDamping ?? 0.7,
    });

    this.squeeze = new Spring(0, {
      stiffness: options.squeezeStiffness ?? 0.42,
      damping: options.squeezeDamping ?? 0.6,
    });

    this.wrapContent();

    this.buildLayers();

    this.root.classList.add("glass-root", `glass--${this.thickness}`);

    renderer.add(this);
  }

  wrapContent() {
    let content = this.root.querySelector<HTMLElement>(":scope > .glass-content");

    if (!content) {
      content = Utils.create("div", "glass-content");

      while (this.root.firstChild) {
        content.appendChild(this.root.firstChild);
      }

      this.root.appendChild(content);
    }

    this.content = content;
  }

  buildLayers() {
    this.material = Utils.create("div", "glass-material");

    LAYERS.forEach((name) => {
      const layer = Utils.create("div", `glass-layer glass-layer--${name}`);

      this.material.appendChild(layer);

      this.layers[name] = layer;
    });

    this.root.insertBefore(this.material, this.root.firstChild);
  }

  update(deltaMs: number) {
    this.rect = this.root.getBoundingClientRect();

    const data = cursor.data;

    const distance = this.distanceToRect(data.x, data.y, this.rect);

    this.intensity.setTarget(Utils.mapRange(distance, 0, this.proximity, 1, 0, true));

    const intensity = this.intensity.update(deltaMs);

    const glow = intensity * this.lightIntensityScale;

    const press = this.squeeze.update(deltaMs);

    const speedFactor = Utils.clamp(Math.max(data.speed, this.motionSpeed) / 34, 0, 1);

    let rainbowOpacity: number;

    if (this.chroma === "off") {
      rainbowOpacity = 0;
    } else if (this.chroma === "physical") {
      const physicalFactor = Utils.clamp((speedFactor - 0.22) / 0.78, 0, 1);

      rainbowOpacity = physicalFactor * 0.26;
    } else {
      const chromaBase = this.chroma === "always" ? 0.2 : 0.02;

      rainbowOpacity = Utils.clamp(chromaBase + speedFactor * 0.5, 0, 0.62);
    }

    const rainbowOffset = data.dx * speedFactor * 9;

    const borderIntensity = Utils.clamp(glow * 0.3 + speedFactor * 0.75, 0, 1);

    this.applyVariables({
      lightIntensity: glow.toFixed(3),
      rainbowOpacity: rainbowOpacity.toFixed(3),
      rainbowOffset: `${rainbowOffset.toFixed(2)}px`,
      borderIntensity: borderIntensity.toFixed(3),
      press: press.toFixed(3),
    });

    if (this.channel) {
      const lx = this.rect.width > 0 ? Utils.clamp((data.x - this.rect.left) / this.rect.width, 0, 1) : 0.5;

      const ly = this.rect.height > 0 ? Utils.clamp((data.y - this.rect.top) / this.rect.height, 0, 1) : 0.5;

      refraction.feed(this.channel, { speed: data.speed, nx: lx, ny: ly });

      this.syncRefractionFilters();
    }
  }

  distanceToRect(px: number, py: number, rect: DOMRect) {
    const dx = Math.max(rect.left - px, 0, px - rect.right);

    const dy = Math.max(rect.top - py, 0, py - rect.bottom);

    return Math.hypot(dx, dy);
  }

  applyVariables(vars: {
    lightIntensity: string;
    rainbowOpacity: string;
    rainbowOffset: string;
    borderIntensity: string;
    press: string;
  }) {
    const style = this.root.style;

    style.setProperty("--light-intensity", vars.lightIntensity);

    style.setProperty("--rainbow-opacity", vars.rainbowOpacity);

    style.setProperty("--rainbow-offset", vars.rainbowOffset);

    style.setProperty("--border-intensity", vars.borderIntensity);

    style.setProperty("--press", vars.press);
  }

  syncRefractionFilters() {
    if (this.refractionApplied || !this.channel || !refraction.isAvailable(this.channel)) return;

    const fill = this.layers.fill;

    if (!fill) return;

    fill.style.filter = `url(#glass-refraction-${this.channel}) url(#glass-specular-${this.channel})`;

    this.refractionApplied = true;
  }

  press() {
    this.squeeze.setTarget(1);
  }

  release() {
    this.squeeze.setTarget(0);
  }

  setMotion(speed: number) {
    this.motionSpeed = speed;
  }

  destroy() {
    renderer.remove(this);

    this.material?.remove();

    this.root.classList.remove("glass-root", `glass--${this.thickness}`);
  }
}

export default GlassMaterial;
