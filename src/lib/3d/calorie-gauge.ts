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
  /** Valor 0..1 que sigue el muelle (por defecto `s.level`, kcal/meta topado en 1). El medidor usa `arcFraction` (la meta queda a 2/3). */
  value?(s: CalorieState): number;
  /** Recibe el estado completo (p. ej. para redibujar una etiqueta viva). */
  setState?(s: CalorieState): void;
  dispose?(): void;
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

const STATUS_LABEL: Record<CalorieState["status"], string> = { vacio: "SIN ANOTAR", bajo: "BAJO", logrado: "META", excedido: "EXCEDIDO", excedidoFuerte: "EXCEDIDO" };

/**
 * Medidor de energía (dial de radio 1, mira a +Z): la aguja (`aguja`) gira sobre su eje según `arcFraction` — 270° de recorrido, con la meta a
 * 2/3, igual que el arco. El número de kcal y el estado son una etiqueta VIVA (canvas → plano) delante del cristal, no parte de la textura.
 */
function meterAdapter(): Adapter {
  let needle: THREE.Object3D | null = null;
  let needleMat: THREE.MeshStandardMaterial | null = null;
  let tex: THREE.CanvasTexture | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let plane: THREE.Mesh | null = null;
  let lastKey = "";
  let pending: CalorieState | null = null;
  const draw = (s: CalorieState) => {
    pending = s;
    if (!canvas || !tex) return;
    const key = `${Math.round(s.kcal)}|${s.status}`;
    if (key === lastKey) return;
    lastKey = key;
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(12,13,16,0.82)";
    g.beginPath();
    g.roundRect(6, 6, W - 12, H - 12, 34);
    g.fill();
    g.textBaseline = "alphabetic";
    const num = Math.round(s.kcal).toLocaleString("es");
    g.font = "700 104px system-ui, sans-serif";
    const nw = g.measureText(num).width;
    g.font = "600 38px system-ui, sans-serif";
    const kw = g.measureText("kcal").width;
    const x0 = (W - (nw + 12 + kw)) / 2;
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    g.font = "700 104px system-ui, sans-serif";
    g.fillText(num, x0, 128);
    g.fillStyle = "#9ca3af";
    g.font = "600 38px system-ui, sans-serif";
    g.fillText("kcal", x0 + nw + 12, 128);
    g.textAlign = "center";
    g.fillStyle = s.color;
    g.font = "800 44px system-ui, sans-serif";
    g.fillText(STATUS_LABEL[s.status], W / 2, 202);
    tex.needsUpdate = true;
  };
  return {
    yaw: 0,
    camera: { position: [0, 0.0, 5.6], target: [0, 0, 0], fov: 30 },
    value: (s) => s.arcFraction,
    bind(root) {
      needle = findNode(root, "aguja");
      if (needle) {
        const m = (needle as THREE.Mesh).material as THREE.MeshStandardMaterial;
        needleMat = m;
      }
      canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.45),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
      );
      plane.position.set(0, -0.52, 0.16);
      plane.renderOrder = 10;
      root.add(plane);
      if (pending) draw(pending);
    },
    setState(s) {
      draw(s);
    },
    apply(level, _color, glowPulse) {
      if (needle) needle.rotation.z = Math.PI / 4 - 1.5 * Math.PI * level;
      if (needleMat) {
        needleMat.emissive.set(0xff2a1a);
        needleMat.emissiveIntensity = 0.7 * glowPulse;
      }
    },
    dispose() {
      tex?.dispose();
      (plane?.material as THREE.Material | undefined)?.dispose();
      plane?.geometry.dispose();
    },
  };
}

const ADAPTERS: Record<GaugeKind, () => Adapter> = {
  canister: canisterAdapter,
  meter: meterAdapter,
  // La batería se agrega al integrarla — mismo contrato.
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
    this.target = this.adapter.value ? this.adapter.value(s) : s.level;
    this.adapter.setState?.(s);
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
    this.adapter.dispose?.();
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
