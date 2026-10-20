import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { QrMatrix } from "@/lib/qr/qr";
import { PAYMENT_FIGURES, DEFAULT_PAYMENT_FIGURE, type PaymentFigureDef } from "./payment-figures";

/**
 * Escena 3D de la pantalla de pago: un árbol sobre un tablero cuyo PISO tiene la forma real de la matriz del QR (cada módulo
 * oscuro es un bloque en relieve, los de las esquinas —los tres cuadrados de posición— son reconocibles), con pasto en los bordes.
 * Todo se mueve: las hojas se mecen con el viento (cada lóbulo de la copa rota sobre su propia base), el pasto se dobla y la
 * vista gira despacio.
 *
 * Al tocar: el árbol sube y desaparece, la cámara se levanta hasta una vista cenital, y los bloques del piso se aplanan (en
 * onda desde el centro) hasta quedar exactamente como la matriz 2D del QR. Recién ahí la interfaz muestra el QR como SVG PLANO
 * encima (overlay HTML, sin luz, sombra ni nada de esta escena). El QR que se escanea NUNCA es esta escena: acá solo se usa la
 * matriz para dar forma al piso y para el morph.
 *
 * Movimiento hecho por nodo/instancia (no con un shader a medida): funciona igual en WebGPU y en WebGL.
 * Render: intenta `WebGPURenderer` (three/webgpu, que cae solo a WebGL2) y, si falla, `WebGLRenderer`.
 */
export type RenderBackend = "webgpu" | "webgl2" | "webgl";

/** Zona de silencio del QR en módulos (debe coincidir con QR_QUIET_ZONE de lib/qr/qr.ts). */
const QUIET = 4;
/** Lado del tablero (incluida la zona de silencio), en unidades de la escena. */
const BOARD = 7.2;
const FLAT_H = 0.004;
const SUN_INTENSITY = 2.3;

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
  shadowMap?: { enabled: boolean; type: THREE.ShadowMapType };
}

/** Recuadro (en px CSS, relativo al canvas) donde la interfaz va a poner el QR plano: el morph termina exactamente ahí. */
export interface QrTargetRect {
  cx: number;
  cy: number;
  size: number;
}

export interface PaymentSceneOptions {
  figureId?: string;
  /** Matriz de módulos que da forma al piso (si falta el QR real se pasa una decorativa). */
  matrix: QrMatrix;
  reduceMotion?: boolean;
  onReady?: (info: { backend: RenderBackend; triangles: number }) => void;
  /** El usuario tocó el árbol o el tablero. */
  onSelect?: () => void;
  onError?: (e: unknown) => void;
}

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

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const ease = (x: number) => x * x * (3 - 2 * x);

interface Lobe {
  obj: THREE.Object3D;
  base: THREE.Euler;
  phase: number;
  speed: number;
  amp: number;
}

interface GrassInst {
  x: number;
  z: number;
  rotY: number;
  scale: number;
  phase: number;
}

export class PaymentScene {
  private host: HTMLElement;
  private opts: PaymentSceneOptions;
  private def: PaymentFigureDef;
  private renderer: RendererLike | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  private pivot = new THREE.Group();
  private boardGroup = new THREE.Group();
  private frameGroup = new THREE.Group();
  private treeRoot: THREE.Object3D | null = null;
  private treeBaseScale = 1;
  private lobes: Lobe[] = [];
  private grassMeshes: { mesh: THREE.InstancedMesh; inst: GrassInst[] }[] = [];
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private ro: ResizeObserver | null = null;
  private pointer = { down: false, moved: 0, x: 0, y: 0 };
  private envTexture: THREE.Texture | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private tmpObj = new THREE.Object3D();
  backend: RenderBackend = "webgl";

  // Piso (matriz del QR)
  private matrix: QrMatrix;
  private cellSize = 0;
  private cellData: { x: number; z: number; dark: boolean; delay: number }[] = [];
  private stdMesh: THREE.InstancedMesh | null = null;
  private flatMesh: THREE.InstancedMesh | null = null;
  private hLight = 0.07;
  private hDark = 0.24;
  private lastFlatten = -1;

  // Cámara / vista
  private yaw = 0.5;
  private yawVel = 0;
  private lastT = 0;
  private time = 0;
  private theta0 = THREE.MathUtils.degToRad(33);
  private phi0 = THREE.MathUtils.degToRad(45);
  private lookY0 = 1.9;
  private dist0 = 14;
  private distTop = 14;
  private shiftPx = { x: 0, y: 0 };
  private yawStart = 0;

  // Transición (k: 0 = reposo, 1 = QR plano)
  private k = 0;
  private kTarget = 0;
  private resolvers: (() => void)[] = [];

  constructor(host: HTMLElement, opts: PaymentSceneOptions) {
    this.host = host;
    this.opts = opts;
    this.matrix = opts.matrix;
    this.def = PAYMENT_FIGURES[opts.figureId ?? DEFAULT_PAYMENT_FIGURE] ?? PAYMENT_FIGURES[DEFAULT_PAYMENT_FIGURE];
    this.scene.add(this.pivot);
    this.pivot.add(this.boardGroup, this.frameGroup);
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
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 0.98;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      const el = renderer.domElement;
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.display = "block";
      el.style.touchAction = "pan-y";
      el.style.cursor = "grab";
      this.host.appendChild(el);

      try {
        this.envTexture = await buildEnv(new RoomEnvironment() as unknown as THREE.Scene);
        this.scene.environment = this.envTexture;
        this.scene.environmentIntensity = 0.4;
      } catch (e) {
        if (process.env.NODE_ENV !== "production") console.warn("payment-scene: sin entorno PMREM:", e);
      }
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a7a7a, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
      sun.position.set(-5, 9, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -6.5;
      sun.shadow.camera.right = 6.5;
      sun.shadow.camera.top = 6.5;
      sun.shadow.camera.bottom = -6.5;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 30;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      this.scene.add(sun);
      this.sun = sun;

      this.buildBoard();
      await Promise.all([this.loadTree(), this.loadGrass()]);
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
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry;
        const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
        tris += per * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
      });
      this.opts.onReady?.({ backend: this.backend, triangles: Math.round(tris) });
    } catch (e) {
      this.opts.onError?.(e);
    }
  }

  // ── piso: una instancia por celda (zona de silencio incluida) ─────────────
  private disposeBoard() {
    for (const m of [this.stdMesh, this.flatMesh]) {
      if (!m) continue;
      this.boardGroup.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    this.stdMesh = this.flatMesh = null;
    for (const child of [...this.frameGroup.children]) {
      this.frameGroup.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose();
    }
  }

  /** (Re)arma el tablero desde la matriz actual: un payload más largo da más módulos y el piso se adapta, sin cantidades fijas. */
  private buildBoard() {
    this.disposeBoard();
    const n = this.matrix.size;
    const N = n + QUIET * 2;
    const c = BOARD / N;
    this.cellSize = c;
    this.hLight = Math.max(0.045, c * 0.42);
    this.hDark = this.hLight + Math.max(0.12, c * 1.35);
    this.cellData = [];
    const maxD = (BOARD / 2) * Math.SQRT2;
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (ix - N / 2 + 0.5) * c;
        const z = (iy - N / 2 + 0.5) * c;
        const dark = this.matrix.isDark(ix - QUIET, iy - QUIET);
        this.cellData.push({ x, z, dark, delay: (Math.hypot(x, z) / maxD) * 0.4 });
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const total = N * N;

    const std = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
    this.stdMesh = new THREE.InstancedMesh(box, std, total);
    this.stdMesh.castShadow = true;
    this.stdMesh.receiveShadow = true;
    const col = new THREE.Color();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < total; i++) {
      const d = this.cellData[i].dark;
      col.setScalar(d ? 0.006 + 0.014 * rand() : 0.8 + 0.17 * rand());
      this.stdMesh.setColorAt(i, col);
    }

    // Copia "plana": blanco y negro PUROS sin luz ni tone mapping, para el último tramo del morph (idéntica a la matriz 2D).
    const flat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.flatMesh = new THREE.InstancedMesh(box.clone(), flat, total);
    for (let i = 0; i < total; i++) this.flatMesh.setColorAt(i, col.set(this.cellData[i].dark ? 0x000000 : 0xffffff));
    this.flatMesh.visible = false;

    this.boardGroup.add(this.stdMesh, this.flatMesh);
    this.lastFlatten = -1;
    this.updateCells(0);

    // Marco del tablero (borde oscuro + base), como el zócalo de la referencia.
    const T = 0.34;
    const rimH = Math.max(this.hDark + 0.05, 0.3);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 });
    const mk = (w: number, d: number, x: number, z: number) => {
      const g = new THREE.BoxGeometry(w, rimH, d);
      g.translate(0, rimH / 2, 0);
      const m = new THREE.Mesh(g, rimMat);
      m.position.set(x, 0, z);
      m.castShadow = m.receiveShadow = true;
      this.frameGroup.add(m);
    };
    const W = BOARD + 2 * T;
    mk(W, T, 0, -(BOARD / 2 + T / 2));
    mk(W, T, 0, BOARD / 2 + T / 2);
    mk(T, BOARD, -(BOARD / 2 + T / 2), 0);
    mk(T, BOARD, BOARD / 2 + T / 2, 0);
    const baseG = new THREE.BoxGeometry(W + 0.06, 0.42, W + 0.06);
    baseG.translate(0, -0.21, 0);
    const base = new THREE.Mesh(baseG, new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.85 }));
    base.receiveShadow = true;
    this.frameGroup.add(base);
  }

  /** `f` 0 = piso en relieve, 1 = todo plano (la matriz 2D). Cada celda se aplana con un retardo según su distancia al centro: onda desde el árbol. */
  private updateCells(f: number) {
    if (!this.stdMesh || !this.flatMesh || f === this.lastFlatten) return;
    this.lastFlatten = f;
    const dummy = this.tmpObj;
    const c = this.cellSize;
    for (let i = 0; i < this.cellData.length; i++) {
      const cd = this.cellData[i];
      const fi = ease(THREE.MathUtils.clamp((f - cd.delay) / (1 - 0.4), 0, 1));
      const idle = cd.dark ? this.hDark : this.hLight;
      const h = idle + (FLAT_H - idle) * fi;
      const g = 0.955 + 0.045 * fi; // las celdas se juntan: sin rendijas, igual que el SVG
      dummy.position.set(cd.x, 0, cd.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(c * g, h, c * g);
      dummy.updateMatrix();
      this.stdMesh.setMatrixAt(i, dummy.matrix);
      this.flatMesh.setMatrixAt(i, dummy.matrix);
    }
    this.stdMesh.instanceMatrix.needsUpdate = true;
    this.flatMesh.instanceMatrix.needsUpdate = true;
    if (this.stdMesh.instanceColor) this.stdMesh.instanceColor.needsUpdate = true;
    if (this.flatMesh.instanceColor) this.flatMesh.instanceColor.needsUpdate = true;
  }

  /** Cambia la matriz (p. ej. el admin cargó otro QR): el piso se rearma con la forma nueva. */
  setMatrix(matrix: QrMatrix) {
    this.matrix = matrix;
    if (this.renderer) {
      this.buildBoard();
      this.placeGrass();
      if (this.treeRoot) this.treeRoot.position.y = this.hLight;
    }
  }

  // ── árbol y pasto (GLB de Blender) ────────────────────────────────────────
  private async loadTree() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync(this.def.url);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if (std.alphaTest > 0) {
            std.transparent = false;
            std.depthWrite = true;
            std.color.multiplyScalar(0.92); // hojas en gris medio (como la referencia), no casi blancas bajo la luz
          }
          if (std.map) std.map.anisotropy = 4;
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const width = Math.max(size.x, size.z, 0.001);
      this.treeBaseScale = (BOARD * 0.88) / width;
      root.scale.setScalar(this.treeBaseScale);
      root.position.set(0, this.hLight, 0);
      this.treeRoot = root;
      this.pivot.add(root);
      root.traverse((o) => {
        if (!o.name.startsWith("lobe_")) return;
        this.lobes.push({
          obj: o,
          base: o.rotation.clone(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.7 + Math.random() * 0.7,
          amp: 0.03 + Math.random() * 0.035,
        });
      });
    } catch (e) {
      // Sin el GLB no se finge nada: se avisa y queda una figura simple y claramente provisoria.
      console.warn(`payment-scene: no se pudo cargar ${this.def.url}; se muestra una figura provisoria.`, e);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
      trunk.position.y = 1.1;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), new THREE.MeshStandardMaterial({ color: 0x777777, flatShading: true }));
      crown.position.y = 3.6;
      g.add(trunk, crown);
      g.position.y = this.hLight;
      this.treeRoot = g;
      this.treeBaseScale = 1;
      this.pivot.add(g);
    }
  }

  private async loadGrass() {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(this.def.grassUrl);
      gltf.scene.updateMatrixWorld(true);
      const tufts: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.name.startsWith("tuft_")) tufts.push(m);
      });
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
      for (const t of tufts) {
        const geo = t.geometry.clone();
        geo.applyMatrix4(t.matrixWorld); // deja la geometría con la base de la mata en el origen y Y arriba
        const mesh = new THREE.InstancedMesh(geo, mat, 1);
        mesh.count = 0;
        mesh.castShadow = true;
        this.boardGroup.add(mesh);
        this.grassMeshes.push({ mesh, inst: [] });
      }
      this.placeGrass();
    } catch (e) {
      console.warn("payment-scene: sin pasto:", e);
    }
  }

  /** Pasto en la zona de silencio: más denso en las 4 esquinas (como los canteros de la referencia) y suelto a lo largo de los bordes. */
  private placeGrass() {
    if (this.grassMeshes.length === 0) return;
    const ring = this.cellSize * QUIET; // ancho de la zona de silencio en unidades
    let seed = 91;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const half = BOARD / 2;
    const pts: GrassInst[] = [];
    const push = (x: number, z: number) => pts.push({ x, z, rotY: rand() * Math.PI * 2, scale: 0.55 + rand() * 0.55, phase: rand() * Math.PI * 2 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 11; i++) push(sx * (half - ring * 0.12 - rand() * ring * 0.76), sz * (half - ring * 0.12 - rand() * ring * 0.76));
      }
    }
    for (let i = 0; i < 26; i++) {
      const along = (rand() * 2 - 1) * (half - ring);
      const inset = half - ring * 0.12 - rand() * ring * 0.76;
      const side = i % 4;
      if (side === 0) push(along, -inset);
      else if (side === 1) push(along, inset);
      else if (side === 2) push(-inset, along);
      else push(inset, along);
    }
    const per = this.grassMeshes.map(() => [] as GrassInst[]);
    pts.forEach((p, i) => per[i % per.length].push(p));
    this.grassMeshes.forEach((g, i) => {
      const old = g.mesh;
      const fresh = new THREE.InstancedMesh(old.geometry, old.material, Math.max(1, per[i].length));
      fresh.castShadow = true;
      fresh.count = per[i].length;
      this.boardGroup.remove(old);
      old.dispose();
      this.boardGroup.add(fresh);
      g.mesh = fresh;
      g.inst = per[i];
    });
  }

  // ── vista ─────────────────────────────────────────────────────────────────
  private resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = h > w ? 34 : 26;
    this.camera.updateProjectionMatrix();
    // Distancia en reposo: que entren el tablero (en diagonal) y el árbol completo.
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const needV = (this.def.height * 0.56 + 1.0) / tanV;
    const needH = (BOARD * 0.78) / (tanV * this.camera.aspect);
    this.dist0 = Math.max(needV, needH) * 0.95;
    this.lookY0 = this.def.height * 0.34;
  }

  private onDown = (e: PointerEvent) => {
    this.pointer = { down: true, moved: 0, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.yawVel = 0;
    if (this.renderer) this.renderer.domElement.style.cursor = "grabbing";
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointer.down || this.kTarget > 0 || this.k > 0) return;
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
    if (wasTap && this.k === 0 && this.kTarget === 0 && this.hit(e)) this.opts.onSelect?.();
  };
  private onCancel = () => {
    this.pointer.down = false;
  };

  /** ¿El toque cayó sobre el árbol o el tablero? */
  private hit(e: PointerEvent): boolean {
    if (!this.renderer) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [this.boardGroup, this.frameGroup];
    if (this.treeRoot) targets.push(this.treeRoot);
    return this.raycaster.intersectObjects(targets, true).length > 0;
  }

  // ── transición ────────────────────────────────────────────────────────────
  /**
   * Morph hacia el QR plano. `getTarget` devuelve el recuadro (px CSS relativos al canvas) donde la interfaz coloca el QR; la
   * cámara cenital se calcula para que el tablero ocupe justo ese recuadro. Resuelve cuando el piso quedó plano y alineado.
   */
  playSelectTransition(getTarget: () => QrTargetRect | null): Promise<void> {
    if (this.kTarget >= 1) return Promise.resolve();
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const t = getTarget() ?? { cx: w / 2, cy: h / 2, size: Math.min(w, h) * 0.8 };
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.distTop = (BOARD * h) / (2 * t.size * tanV);
    this.shiftPx = { x: t.cx - w / 2, y: t.cy - h / 2 };
    // giro mínimo hasta quedar derecho (yaw = 0): el QR tiene que terminar con su orientación real
    this.yawStart = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.kTarget = 1;
    return new Promise((resolve) => this.resolvers.push(resolve));
  }

  /** Vuelve del QR plano al árbol (al cerrar el QR), con el mismo morph pero al revés. */
  reverseTransition(): Promise<void> {
    if (this.kTarget <= 0 && this.k <= 0) return Promise.resolve();
    this.kTarget = 0;
    return new Promise((resolve) => this.resolvers.push(resolve));
  }

  /** Vuelve a la vista normal sin animar. */
  reset() {
    this.k = this.kTarget = 0;
    this.flushResolvers();
  }

  private flushResolvers() {
    this.resolvers.splice(0).forEach((r) => r());
  }

  private tick = (tMs: number) => {
    if (!this.renderer) return;
    const dt = this.lastT ? Math.min(0.05, (tMs - this.lastT) / 1000) : 0.016;
    this.lastT = tMs;
    this.time += dt;
    const reduce = !!this.opts.reduceMotion;

    // avance de la transición
    const dur = reduce ? 0.3 : 2.7;
    if (this.k !== this.kTarget) {
      const dir = this.kTarget > this.k ? 1 : -1;
      this.k = THREE.MathUtils.clamp(this.k + (dir * dt) / dur, 0, 1);
      if (this.k === this.kTarget) this.flushResolvers();
    }
    const k = this.k;

    // giro de exhibición (solo en reposo)
    if (k === 0 && !this.pointer.down) {
      this.yawVel *= 0.94;
      this.yaw += this.yawVel;
      if (!reduce) this.yaw += dt * 0.07;
    }

    const e1 = ease(smooth(0, 0.55, k)); // cámara
    const eTree = ease(smooth(0.04, 0.5, k));
    const eGrass = ease(smooth(0, 0.4, k));
    const eFrame = ease(smooth(0.3, 0.8, k));
    const f = smooth(0.32, 0.88, k);

    this.pivot.rotation.y = k > 0 ? this.yawStart * (1 - e1) : this.yaw;

    // viento
    const gust = reduce ? 0 : 0.75 + 0.25 * Math.sin(this.time * 0.31) + 0.12 * Math.sin(this.time * 1.7 + 1.3);
    for (const l of this.lobes) {
      const s = Math.sin(this.time * l.speed + l.phase) * l.amp * gust;
      const s2 = Math.sin(this.time * l.speed * 0.77 + l.phase * 1.7) * l.amp * 0.6 * gust;
      l.obj.rotation.set(l.base.x + s, l.base.y + s2 * 0.6, l.base.z + s2);
    }
    if (this.treeRoot) {
      this.treeRoot.position.y = this.hLight + 9 * eTree;
      this.treeRoot.scale.setScalar(this.treeBaseScale * (1 - 0.94 * eTree));
      this.treeRoot.visible = eTree < 0.995;
    }
    const dummy = this.tmpObj;
    for (const g of this.grassMeshes) {
      for (let i = 0; i < g.inst.length; i++) {
        const p = g.inst[i];
        const sx = Math.sin(this.time * 1.9 + p.phase) * 0.13 * gust;
        const sz = Math.sin(this.time * 1.5 + p.phase * 1.3) * 0.13 * gust;
        dummy.position.set(p.x, this.hLight, p.z);
        dummy.rotation.set(sx, p.rotY, sz);
        dummy.scale.setScalar(Math.max(0.0001, p.scale * (1 - eGrass)));
        dummy.updateMatrix();
        g.mesh.setMatrixAt(i, dummy.matrix);
      }
      g.mesh.instanceMatrix.needsUpdate = true;
      g.mesh.visible = eGrass < 0.995;
    }
    this.frameGroup.scale.y = Math.max(0.0001, 1 - eFrame);
    this.frameGroup.visible = eFrame < 0.995;

    // piso: relieve -> plano; al final se cambia a la copia plana (blanco/negro puros, sin luz)
    this.updateCells(f);
    const swap = k >= 0.9;
    if (this.stdMesh) this.stdMesh.visible = !swap;
    if (this.flatMesh) this.flatMesh.visible = swap;
    if (this.sun) this.sun.intensity = SUN_INTENSITY * (1 - 0.6 * f);

    // cámara: de la vista isométrica a la cenital sobre el tablero
    const theta = THREE.MathUtils.lerp(this.theta0, THREE.MathUtils.degToRad(89.9), e1);
    const phi = THREE.MathUtils.lerp(this.phi0, 0, e1);
    const dist = Math.exp(THREE.MathUtils.lerp(Math.log(this.dist0), Math.log(this.distTop), e1));
    const lookY = THREE.MathUtils.lerp(this.lookY0, 0, e1);
    const breathe = reduce || k > 0 ? 0 : Math.sin(this.time * 0.4) * 0.06;
    this.camera.position.set(Math.sin(phi) * Math.cos(theta) * dist, lookY + Math.sin(theta) * dist + breathe, Math.cos(phi) * Math.cos(theta) * dist);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, lookY, 0);
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    if (e1 > 0) this.camera.setViewOffset(w, h, -this.shiftPx.x * e1, -this.shiftPx.y * e1, w, h);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();

    void this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.flushResolvers();
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
