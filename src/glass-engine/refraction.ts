/*============================================================

    GLASS ENGINE
    REFRACTION.TS

    Controla los <filter> SVG definidos en public/svg/filters.svg
    (feTurbulence, feGaussianBlur, feDisplacementMap, feImage,
    feMorphology, feSpecularLighting, feComposite).

    [GLASS ENGINE — CORE — PORTADO TAL CUAL desde
    C:\Erick\Gym\src\glass-engine\core\refraction.js, con la
    MISMA decisión de arquitectura: inyectar el SVG inline en
    <body> (fetch + prepend), no <object>, para que CSS y JS
    compartan el mismo nodo de filtro. Los canales cacheados
    (cacheChannel) son "menu" (burbuja del BottomNav — ver
    glass-engine/menu.ts) y "panel" (dropdowns/.glass-panel), más
    "card"/"button" (definidos en filters.svg pero sin consumidor
    propio todavía en esta app, cacheados para no perder
    funcionalidad si algún componente futuro los usa). También se
    agrega el cacheo de la lupa real (glassLensDistortion +
    feImage#lensMapImage) con setLensMap()/isLensAvailable(), que
    en el proyecto de referencia vive repartido entre menu.js y
    card.js.

    GUARDA CONTRA SSR — Next.js evalúa este módulo también en el
    servidor (React renderiza los componentes cliente en el
    servidor para el HTML inicial), donde no existe `document` ni
    tiene sentido hacer fetch() de una ruta relativa. El
    constructor detecta ese caso y no hace nada: `ready` queda en
    false, `isAvailable()`/`isLensAvailable()` devuelven false, y
    cualquier consumidor cae a su fallback CSS — igual que si el
    fetch fallara en el cliente (ver catch() de abajo).

============================================================*/

import Utils from "./utils";

import renderer, { type RendererModule } from "./renderer";

const SOURCE_PATH = "/svg/filters.svg";

interface Channel {
  displacement: Element | null;
  light: Element | null;
  baseScale: number;
  speed: number;
  nx: number;
  ny: number;
}

interface FeedParams {
  speed: number;
  nx: number;
  ny: number;
}

class RefractionEngine implements RendererModule {
  ready = false;
  root: SVGElement | null = null;
  channels = new Map<string, Channel>();

  // Lupa real (glassLensDistortion) — no sigue el patrón
  // #glass-refraction-${name}/#glass-specular-${name} de los
  // demás canales (es un único filtro global, no una familia
  // por nombre), así que se cachea aparte.
  private lensDisplacement: Element | null = null;
  private lensImage: Element | null = null;

  // Promesa que cualquier componente cliente puede esperar para
  // saber si el motor terminó de cargar (true) o degradó a CSS
  // simple (false) — evita que cada consumidor tenga que hacer
  // su propio polling de `ready`.
  readyPromise: Promise<boolean>;
  private resolveReady!: (ok: boolean) => void;

  constructor() {
    this.readyPromise = new Promise<boolean>((resolve) => {
      this.resolveReady = resolve;
    });

    if (typeof document === "undefined") {
      // SSR: nunca inyectar, nunca registrar en el renderer.
      return;
    }

    this.inject();

    renderer.add(this);
  }

  /*======================================================
    CARGA E INYECCIÓN EN EL DOCUMENTO PRINCIPAL
    ======================================================*/

  inject() {
    fetch(SOURCE_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }

        return response.text();
      })
      .then((markup) => this.mount(markup))
      .catch(() => {
        console.warn(
          "[GlassEngine] No se pudieron cargar los filtros SVG " +
            "(public/svg/filters.svg). El material seguirá " +
            "funcionando solo con CSS (blur/saturate simples).",
        );

        this.resolveReady(false);
      });
  }

  mount(markup: string) {
    const wrapper = document.createElement("div");

    wrapper.innerHTML = markup.trim();

    const svg = wrapper.querySelector("svg");

    if (!svg) {
      this.resolveReady(false);

      return;
    }

    document.body.prepend(svg);

    this.root = svg;

    this.ready = true;

    this.cacheChannel("menu");

    this.cacheChannel("panel");

    // "card"/"button" no tienen consumidor propio todavía en esta
    // app (Vida Total no reutiliza esos canales hoy), pero
    // public/svg/filters.svg SÍ los define (portados tal cual del
    // proyecto de referencia) — se cachean igual para que un
    // consumidor futuro (GlassMaterial con channel:"card"/"button")
    // los encuentre disponibles sin tocar refraction.ts de nuevo.
    this.cacheChannel("card");

    this.cacheChannel("button");

    this.lensDisplacement = svg.querySelector("#glassLensDisplacement");

    this.lensImage = svg.querySelector("#lensMapImage");

    this.resolveReady(true);
  }

  /*======================================================
    CACHÉ DE REFERENCIAS A PRIMITIVAS DEL FILTRO
    ======================================================*/

  cacheChannel(name: string) {
    if (!this.root) return;

    const displacement = this.root.querySelector(`#glass-refraction-${name} feDisplacementMap`);

    const light = this.root.querySelector(`#glass-specular-${name} fePointLight`);

    if (!displacement && !light) {
      return;
    }

    this.channels.set(name, {
      displacement,

      light,

      baseScale: displacement ? parseFloat(displacement.getAttribute("scale") || "0") : 0,

      speed: 0,

      nx: 0.5,

      ny: 0.5,
    });
  }

  /*======================================================
    API PÚBLICA — canales "menu"/"panel" (refracción + specular)
    ======================================================*/

  isAvailable(name: string) {
    return this.ready && this.channels.has(name);
  }

  feed(name: string, { speed, nx, ny }: FeedParams) {
    const channel = this.channels.get(name);

    if (!channel) {
      return;
    }

    channel.speed = speed;

    channel.nx = nx;

    channel.ny = ny;
  }

  /*======================================================
    API PÚBLICA — lupa real (glassLensDistortion)
    ======================================================*/

  isLensAvailable() {
    return this.ready && !!this.lensImage && !!this.lensDisplacement;
  }

  setLensMap(dataUrl: string) {
    if (!this.lensImage) return;

    this.lensImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
  }

  setLensScale(scale: number) {
    if (!this.lensDisplacement) return;

    this.lensDisplacement.setAttribute("scale", scale.toFixed(1));
  }

  /*======================================================
    ACTUALIZAR — llamado por renderer en cada frame
    ======================================================*/

  update() {
    if (!this.ready) {
      return;
    }

    this.channels.forEach((channel) => this.applyChannel(channel));
  }

  applyChannel(channel: Channel) {
    if (channel.displacement) {
      const boost = Utils.clamp(channel.speed * 0.6, 0, 26);

      channel.displacement.setAttribute("scale", (channel.baseScale + boost).toFixed(2));
    }

    if (channel.light) {
      channel.light.setAttribute("x", Utils.clamp(channel.nx, 0, 1).toFixed(3));

      channel.light.setAttribute("y", Utils.clamp(channel.ny, 0, 1).toFixed(3));
    }
  }
}

/*============================================================

    SINGLETON

============================================================*/

const refraction = new RefractionEngine();

export default refraction;
