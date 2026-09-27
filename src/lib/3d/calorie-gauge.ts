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

/**
 * Medidor de energía (dial de radio 1, mira a +Z): la aguja (`aguja`) gira sobre su eje según `arcFraction` — 270° de recorrido, con la meta a
 * 2/3, igual que el arco. Sin etiqueta propia: las kcal y el estado ya se ven arriba, en la tarjeta de Calorías; repetirlos en el medio del
 * gráfico era redundante.
 */
function meterAdapter(): Adapter {
  let needle: THREE.Object3D | null = null;
  let needleMat: THREE.MeshStandardMaterial | null = null;
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
    },
    apply(level, _color, glowPulse) {
      if (needle) needle.rotation.z = Math.PI / 4 - 1.5 * Math.PI * level;
      if (needleMat) {
        needleMat.emissive.set(0xff2a1a);
        needleMat.emissiveIntensity = 0.7 * glowPulse;
      }
    },
  };
}

/**
 * Batería sci-fi (BlenderKit, Avishka Induwara): el núcleo de cristal (`nucleo`) y los anillos de cobre (`anillos`) toman el color continuo y
 * se iluminan con el nivel — apagado en 0, tenue ~25 %, brillante 50–75 %. Al llegar al 100 % suelta una chispa breve de partículas una sola
 * vez (no se repite mientras el nivel se mantenga arriba; vuelve a saltar si baja y vuelve a subir).
 */
function batteryAdapter(): Adapter {
  let core: THREE.MeshStandardMaterial | null = null;
  let ring: THREE.MeshStandardMaterial | null = null;
  let root: THREE.Object3D | null = null;
  let corePos = new THREE.Vector3(0, 0.1, 0);
  let burst: THREE.Points | null = null;
  let burstVel: Float32Array | null = null;
  let burstT0 = 0;
  let lastTick = 0;
  let wasFull = false;
  const N = 18;
  const spawnBurst = () => {
    if (!root) return;
    if (burst) {
      root.remove(burst);
      burst.geometry.dispose();
      (burst.material as THREE.Material).dispose();
    }
    const pos = new Float32Array(N * 3);
    burstVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = corePos.x;
      pos[i * 3 + 1] = corePos.y;
      pos[i * 3 + 2] = corePos.z;
      const a = Math.random() * Math.PI * 2;
      const r = 0.02 + Math.random() * 0.05;
      burstVel[i * 3] = Math.cos(a) * r;
      burstVel[i * 3 + 1] = 0.03 + Math.random() * 0.06;
      burstVel[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x86efac, size: 0.012, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    burst = new THREE.Points(geo, mat);
    root.add(burst);
    burstT0 = lastTick = performance.now();
  };
  return {
    yaw: 0.4,
    camera: { position: [0, 0.1, 0.42], target: [0, 0.1, 0], fov: 32 },
    value: (s) => s.level,
    bind(r) {
      root = r;
      const n = findNode(r, "nucleo") as THREE.Mesh | null;
      const a = findNode(r, "anillos") as THREE.Mesh | null;
      if (n) {
        core = n.material as THREE.MeshStandardMaterial;
        n.geometry.computeBoundingBox();
        const b = n.geometry.boundingBox!;
        corePos = n.position.clone().add(b.min.clone().add(b.max).multiplyScalar(0.5));
      }
      if (a) ring = a.material as THREE.MeshStandardMaterial;
    },
    apply(level, color, glowPulse) {
      const t = Math.max(0, Math.min(1, level));
      if (core) {
        core.emissive.copy(color);
        core.emissiveIntensity = 0.15 + t * 3.3 + 1.2 * glowPulse;
      }
      if (ring) {
        ring.emissive.copy(color);
        ring.emissiveIntensity = 0.1 + t * 1.7 + 0.6 * glowPulse;
      }
      const full = t > 0.995;
      if (full && !wasFull) spawnBurst();
      wasFull = full;
      if (burst && burstVel) {
        const now = performance.now();
        const dt = Math.min(0.05, (now - (lastTick || now)) / 1000);
        lastTick = now;
        const age = (now - burstT0) / 1000;
        const pos = burst.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < N; i++) {
          pos.setXYZ(i, pos.getX(i) + burstVel[i * 3] * dt, pos.getY(i) + burstVel[i * 3 + 1] * dt, pos.getZ(i) + burstVel[i * 3 + 2] * dt);
        }
        pos.needsUpdate = true;
        const mat = burst.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, 1 - age / 0.9);
        if (age > 0.9) {
          root?.remove(burst);
          burst.geometry.dispose();
          mat.dispose();
          burst = null;
          burstVel = null;
        }
      }
    },
    dispose() {
      if (burst) {
        burst.geometry.dispose();
        (burst.material as THREE.Material).dispose();
      }
    },
  };
}

const ADAPTERS: Record<GaugeKind, () => Adapter> = {
  canister: canisterAdapter,
  meter: meterAdapter,
  battery: batteryAdapter,
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
