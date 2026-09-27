import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CalorieState } from "@/lib/gym/calorie-state";
import type { GaugeKind } from "./gauge-registry";

/**
 * Reproductor de los gráficos 3D de calorías. Recibe SIEMPRE un `CalorieState` ya calculado (src/lib/gym/calorie-state.ts) y solo lo
 * dibuja: nivel (`level`), color continuo (`smoothColor`) y, si `glow`, un pulso de emisión. La vibración (`shake`) y el halo rojo pulsante
 * los pone la interfaz reutilizando las clases `calorie-arc-shake` / `calorie-arc-glow` de globals.css (una sola definición, la del arco).
 * Cada modelo tiene un adaptador (`Adapter`) que sabe qué nodos del GLB mover; el resto (escena, luces, bucle, arrastre) es común.
 */
interface Adapter {
  /** Enlaza los nodos del GLB por nombre. */
  bind(root: THREE.Object3D): void;
  /** Aplica el estado con el nivel ya suavizado (0..1). */
  apply(level: number, color: THREE.Color, glowPulse: number): void;
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number };
  /** Giro inicial (rad) para mostrar la cara frontal. */
  yaw: number;
}

function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && o.name === name) hit = o;
  });
  return hit;
}

/** Bote de gritos: el indicador (barra ENERGY) crece en Y con el nivel, la aguja sube por el borde y el emisivo toma el color. */
function canisterAdapter(): Adapter {
  let bar: THREE.Mesh | null = null;
  let needle: THREE.Object3D | null = null;
  let z0 = 1.68;
  let z1 = 3.02;
  let needleBase = new THREE.Vector3();
  let mat: THREE.MeshStandardMaterial | null = null;
  return {
    yaw: 0.35,
    camera: { position: [0, 2.6, 9.6], target: [0, 2.35, 0], fov: 30 },
    bind(root) {
      bar = findNode(root, "indicador") as THREE.Mesh | null;
      needle = findNode(root, "aguja");
      const raw = (bar?.userData?.vt_range ?? "") as string;
      try {
        const r = JSON.parse(raw);
        z0 = r.z0;
        z1 = r.z1;
      } catch {
        /* recorrido por defecto */
      }
      if (needle) needleBase = needle.position.clone();
      if (bar) {
        const old = bar.material as THREE.Material;
        mat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0 });
        bar.material = mat;
        old.dispose?.();
      }
    },
    apply(level, color, glowPulse) {
      if (bar) {
        bar.visible = level > 0.004;
        bar.scale.y = Math.max(0.0001, level);
      }
      if (needle) needle.position.y = needleBase.y + (z1 - z0) * level;
      if (mat) {
        mat.color.copy(color);
        mat.emissive.copy(color);
        mat.emissiveIntensity = 1.5 + 1.6 * glowPulse;
      }
    },
  };
}

const ADAPTERS: Record<GaugeKind, () => Adapter> = {
  canister: canisterAdapter,
  // Se agregan al integrar cada modelo (medidor y batería) — mismo contrato.
  meter: canisterAdapter,
  battery: canisterAdapter,
};

export class CalorieGaugeRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private adapter: Adapter;
  private raf = 0;
  private running = false;
  private visible = true;
  private lastT = 0;
  private time = 0;
  private level = 0;
  private vel = 0;
  private target = 0;
  private color = new THREE.Color("#6b7280");
  private targetColor = new THREE.Color("#6b7280");
  private glow = false;
  private yaw: number;
  private baseYaw: number;
  private drag: { x: number; yaw: number } | null = null;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private env: THREE.Texture | null = null;
  private disposed = false;
  private loaded = false;

  constructor(
    private container: HTMLElement,
    private opts: { kind: GaugeKind; glbUrl: string; reduceMotion?: boolean },
  ) {
    this.adapter = ADAPTERS[opts.kind]();
    this.baseYaw = this.yaw = this.adapter.yaw;
    const c = this.adapter.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.env;
      this.scene.environmentIntensity = 0.7;
      pm.dispose();
    } catch {
      /* sin entorno */
    }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-3, 5, 6);
    this.scene.add(key);
    this.scene.add(this.root);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
    });
    this.io.observe(container);
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.resize();
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(this.opts.glbUrl);
    if (this.disposed) return;
    this.root.add(gltf.scene);
    this.adapter.bind(gltf.scene);
    this.loaded = true;
    this.applyNow();
  }

  /** Único punto de entrada de datos: el estado calculado por calorie-state.ts. */
  setState(s: CalorieState) {
    this.target = s.level;
    this.targetColor.set(s.smoothColor);
    this.glow = s.glow;
    if (this.opts.reduceMotion) {
      this.level = s.level;
      this.color.copy(this.targetColor);
      this.applyNow();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      if (!this.visible || document.hidden) return;
      this.tick(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  stats() {
    const info = this.renderer.info.render;
    return { level: +this.level.toFixed(3), target: this.target, color: `#${this.color.getHexString()}`, glow: this.glow, drawCalls: info.calls, triangles: info.triangles };
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => x?.dispose());
      }
    });
    this.env?.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // ------------------------------------------------------------------ internos
  private applyNow() {
    if (!this.loaded) return;
    this.adapter.apply(this.level, this.color, this.glow ? 0.5 + 0.5 * Math.sin(this.time * 4.2) : 0);
  }

  private tick(dt: number) {
    this.time += dt;
    const k = 55;
    const c = 2 * Math.sqrt(k);
    this.vel += (k * (this.target - this.level) - c * this.vel) * dt;
    this.level = Math.max(0, Math.min(1.0, this.level + this.vel * dt));
    this.color.lerp(this.targetColor, Math.min(1, dt * 5));
    if (!this.opts.reduceMotion && !this.drag) this.yaw += (this.baseYaw + Math.sin(this.time * 0.6) * 0.12 - this.yaw) * Math.min(1, dt * 1.2);
    this.root.rotation.y = this.yaw;
    this.applyNow();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const c = this.adapter.camera;
    this.camera.position.set(...c.position);
    this.camera.lookAt(...c.target);
    this.camera.updateProjectionMatrix();
  }

  private onDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, yaw: this.yaw };
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.01;
  };
  private onUp = () => {
    this.drag = null;
  };
}
