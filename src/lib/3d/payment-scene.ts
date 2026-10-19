import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PAYMENT_FIGURES, DEFAULT_PAYMENT_FIGURE, type PaymentFigureDef } from "./payment-figures";

/**
 * Escena 3D de la pantalla de pago: una figura (hoy un árbol) que se puede girar y tocar. Al tocarla hay una transición
 * (acercamiento + fundido) y recién entonces la interfaz muestra el QR como SVG plano ENCIMA de la escena.
 *
 * El QR no está acá: no es una textura, no recibe luz, sombras ni post-procesado. Esta escena no sabe nada de pagos.
 *
 * Render: intenta `WebGPURenderer` (three/webgpu, que a su vez cae solo a WebGL2 si el navegador no tiene WebGPU) y, si la
 * importación o la inicialización fallan, usa `WebGLRenderer`. `backend` informa cuál quedó activo.
 */
export type RenderBackend = "webgpu" | "webgl2" | "webgl";

interface RendererLike {
  domElement: HTMLCanvasElement;
  setSize(w: number, h: number, updateStyle?: boolean): void;
  setPixelRatio(r: number): void;
  setAnimationLoop(cb: ((t: number) => void) | null): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void | Promise<void>;
  dispose(): void;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: string;
}

export interface PaymentSceneOptions {
  figureId?: string;
  reduceMotion?: boolean;
  onReady?: (info: { backend: RenderBackend; triangles: number }) => void;
  onSelect?: () => void;
  onError?: (e: unknown) => void;
}

/** Genera el entorno de luz (PMREM) con la implementación que corresponde al renderer activo. */
type EnvBuilder = (scene: THREE.Scene) => Promise<THREE.Texture>;

async function createRenderer(): Promise<{ renderer: RendererLike; backend: RenderBackend; buildEnv: EnvBuilder }> {
  try {
    const mod = await import("three/webgpu");
    const r = new mod.WebGPURenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    await r.init();
    const isWebGPU = !!(r as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend?.isWebGPUBackend;
    const buildEnv: EnvBuilder = async (scene) => {
      const pm = new mod.PMREMGenerator(r);
      const rt = await pm.fromSceneAsync(scene as never, 0.04);
      pm.dispose();
      return rt.texture;
    };
    return { renderer: r as unknown as RendererLike, backend: isWebGPU ? "webgpu" : "webgl2", buildEnv };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("payment-scene: WebGPURenderer no disponible, uso WebGLRenderer:", e);
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    const buildEnv: EnvBuilder = async (scene) => {
      const pm = new THREE.PMREMGenerator(r);
      const rt = pm.fromScene(scene, 0.04);
      pm.dispose();
      return rt.texture;
    };
    return { renderer: r as unknown as RendererLike, backend: "webgl", buildEnv };
  }
}

export class PaymentScene {
  private host: HTMLElement;
  private opts: PaymentSceneOptions;
  private def: PaymentFigureDef;
  private renderer: RendererLike | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  private figure: THREE.Object3D | null = null;
  private pivot = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private ro: ResizeObserver | null = null;
  private pointer = { down: false, moved: 0, x: 0, y: 0 };
  private yaw = 0.5;
  private yawVel = 0;
  private lastT = 0;
  private transition: { t0: number; dur: number; resolve: () => void } | null = null;
  private selected = false;
  private envTexture: THREE.Texture | null = null;
  backend: RenderBackend = "webgl";

  constructor(host: HTMLElement, opts: PaymentSceneOptions = {}) {
    this.host = host;
    this.opts = opts;
    this.def = PAYMENT_FIGURES[opts.figureId ?? DEFAULT_PAYMENT_FIGURE] ?? PAYMENT_FIGURES[DEFAULT_PAYMENT_FIGURE];
    this.scene.add(this.pivot);
    void this.init();
  }

  private async init() {
    try {
      const { renderer, backend, buildEnv } = await createRenderer();
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      this.renderer = renderer;
      this.backend = backend;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const el = renderer.domElement;
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.display = "block";
      el.style.touchAction = "pan-y";
      el.style.cursor = "grab";
      this.host.appendChild(el);

      // Luz: ambiente tipo estudio (PMREM procedural, sin archivos) + sol cálido + relleno de cielo.
      try {
        this.envTexture = await buildEnv(new RoomEnvironment() as unknown as THREE.Scene);
        this.scene.environment = this.envTexture;
        this.scene.environmentIntensity = 0.55;
      } catch (e) {
        if (process.env.NODE_ENV !== "production") console.warn("payment-scene: sin entorno PMREM:", e);
      }
      this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a2a1a, 0.55));
      const sun = new THREE.DirectionalLight(0xfff0d6, 1.9);
      sun.position.set(4.5, 7, 3.5);
      this.scene.add(sun);

      await this.loadFigure();
      if (this.disposed) return;
      this.resize();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.host);
      el.addEventListener("pointerdown", this.onDown);
      el.addEventListener("pointermove", this.onMove);
      el.addEventListener("pointerup", this.onUp);
      el.addEventListener("pointercancel", this.onCancel);
      renderer.setAnimationLoop(this.tick);
      let tris = 0;
      this.figure?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
      });
      this.opts.onReady?.({ backend: this.backend, triangles: Math.round(tris) });
    } catch (e) {
      this.opts.onError?.(e);
    }
  }

  private async loadFigure() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync(this.def.url);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          // Hojas: recorte por alfa que escribe profundidad (el árbol no se ve «lavado» por el orden de transparencias).
          if (std.alphaTest > 0) {
            std.transparent = false;
            std.depthWrite = true;
          }
          if (std.map) std.map.anisotropy = 4;
        }
      });
      this.figure = root;
    } catch (e) {
      // Sin el GLB no se finge nada: se avisa y se muestra una figura simple y claramente provisoria.
      console.warn(`payment-scene: no se pudo cargar ${this.def.url}; se muestra una figura provisoria.`, e);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x5a3b22 }));
      trunk.position.y = 0.7;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: 0x2f7a2c, flatShading: true }));
      crown.position.y = 2.3;
      g.add(trunk, crown);
      this.figure = g;
    }
    this.pivot.add(this.figure);
  }

  private resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En vertical (celular) se abre un poco el encuadre para que la copa entre completa.
    this.camera.fov = h > w ? 38 : 30;
    this.camera.updateProjectionMatrix();
  }

  private onDown = (e: PointerEvent) => {
    this.pointer = { down: true, moved: 0, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.yawVel = 0;
    if (this.renderer) this.renderer.domElement.style.cursor = "grabbing";
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointer.down || this.selected) return;
    const dx = e.clientX - this.pointer.x;
    this.pointer.moved += Math.abs(dx) + Math.abs(e.clientY - this.pointer.y);
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.yaw += dx * 0.008;
    this.yawVel = dx * 0.008;
  };
  private onUp = (e: PointerEvent) => {
    const wasTap = this.pointer.down && this.pointer.moved < 8;
    this.pointer.down = false;
    if (this.renderer) this.renderer.domElement.style.cursor = "grab";
    if (wasTap && !this.selected && this.hit(e)) this.opts.onSelect?.();
  };
  private onCancel = () => {
    this.pointer.down = false;
  };

  /** ¿El toque cayó sobre la figura? (raycast contra sus mallas; los huecos entre hojas no cuentan). */
  private hit(e: PointerEvent): boolean {
    if (!this.renderer || !this.figure) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObject(this.figure, true).length > 0;
  }

  /** Transición al QR: la cámara sube a vista cenital mientras el árbol se eleva y se funde. Resuelve al terminar. */
  playSelectTransition(): Promise<void> {
    if (this.selected) return Promise.resolve();
    this.selected = true;
    const dur = this.opts.reduceMotion ? 260 : 1400;
    return new Promise((resolve) => {
      this.transition = { t0: performance.now(), dur, resolve };
    });
  }

  /** Vuelve a la vista normal (al cerrar el QR). */
  reset() {
    this.selected = false;
    this.transition = null;
    this.pivot.position.y = 0;
    if (this.renderer) this.renderer.domElement.style.opacity = "1";
  }

  private tick = (t: number) => {
    if (!this.renderer) return;
    const dt = this.lastT ? Math.min(0.05, (t - this.lastT) / 1000) : 0.016;
    this.lastT = t;
    if (!this.pointer.down) {
      this.yawVel *= 0.94;
      this.yaw += this.yawVel;
      if (!this.opts.reduceMotion) this.yaw += dt * (this.selected ? 0.5 : 0.16); // giro lento de exhibición
    }
    this.pivot.rotation.y = this.yaw;

    let k = 0; // progreso de la transición 0..1 (ease in-out)
    if (this.transition) {
      const p = Math.min(1, (performance.now() - this.transition.t0) / this.transition.dur);
      k = p * p * (3 - 2 * p);
      if (p >= 1) {
        const done = this.transition.resolve;
        this.transition = null;
        done();
      }
    } else if (this.selected) {
      k = 1;
    }
    // Cámara: en reposo mira de frente; al tocar sube en arco hasta una vista cenital sobre la base mientras el árbol
    // se eleva y se desvanece. El QR NO se dibuja acá: aparece después como SVG plano encima (ver payment-gate).
    const f = this.def.focus[1];
    const e0 = Math.atan2(f * 0.8 - f, this.def.distance);
    const e = e0 + (1.45 - e0) * k;
    const r = this.def.distance * (1 - 0.3 * k);
    const ty = f * (1 - k) + 0.2 * k;
    this.camera.position.set(0, ty + r * Math.sin(e), r * Math.cos(e));
    this.camera.lookAt(0, ty, 0);
    this.pivot.position.y = 6 * k * k;
    const fade = Math.min(1, Math.max(0, (k - 0.45) / 0.55));
    this.renderer.domElement.style.opacity = String(1 - fade * fade * (3 - 2 * fade) * 0.85);
    void this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.ro?.disconnect();
    const r = this.renderer;
    if (r) {
      r.setAnimationLoop(null);
      const el = r.domElement;
      el.removeEventListener("pointerdown", this.onDown);
      el.removeEventListener("pointermove", this.onMove);
      el.removeEventListener("pointerup", this.onUp);
      el.removeEventListener("pointercancel", this.onCancel);
      el.parentElement?.removeChild(el);
      r.dispose();
    }
    this.envTexture?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.normalMap?.dispose();
        mat.dispose();
      }
    });
    this.renderer = null;
  }
}
