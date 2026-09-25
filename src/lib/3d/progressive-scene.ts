import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { SceneAssetDef } from "./scene-registry";

/**
 * Reproductor de escenas progresivas (three.js). No sabe nada de Hábitos, de stores ni de React:
 * recibe un GLB con el contrato `vt_*` (ver docs/3d/asset-pipeline.md) y una etapa; construye
 * lo que falta con la animación de esa etapa.
 *
 * Contrato del GLB (en `extras` de cada nodo → `userData`):
 *   vt_stage        1..N   etapa en que se construye
 *   vt_anim         tipo de montaje ("pop" y "drop_small" = detalle repetitivo animado aquí; el resto vienen en clips)
 *   vt_delay_frames retraso dentro de la etapa (24 fps)
 * Clips glTF: `STAGE_<k>` (empiezan en t = 0).
 *
 * Rendimiento: el detalle repetitivo (pasto, guijarros, ramitas) se agrupa en `InstancedMesh`
 * por (geometría, material); y cuando una etapa termina de animarse sus piezas repetidas se
 * convierten en instancias (menos draw calls). El fondo es transparente (`alpha: true`, sin
 * `scene.background`): el color lo pone la interfaz.
 */
const FPS = 24;
const PROCEDURAL = new Set(["pop", "drop_small"]);

type Key = [number, ...number[]];

/** Interpolación suave (ease in/out) por tramos entre claves [frame, valor…]. */
function sample(keys: Key[], frame: number, out: number[]): void {
  const n = out.length;
  if (frame <= keys[0][0]) {
    for (let i = 0; i < n; i++) out[i] = keys[0][i + 1];
    return;
  }
  const last = keys[keys.length - 1];
  if (frame >= last[0]) {
    for (let i = 0; i < n; i++) out[i] = last[i + 1];
    return;
  }
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k];
    const b = keys[k + 1];
    if (frame >= a[0] && frame <= b[0]) {
      const t = b[0] === a[0] ? 1 : (frame - a[0]) / (b[0] - a[0]);
      const e = t * t * (3 - 2 * t);
      for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * e;
      return;
    }
  }
}

// Mismas claves que la animación de Blender (02_build_7_day_stages.py).
const POP_KEYS: Key[] = [[0, 0], [6, 1.25], [9, 0.94], [11, 1]];
// [frame, alturaY, escalaXZ, escalaY, giro]
const DROP_KEYS: Key[] = [[0, 0.8, 0, 0, 0.7], [1, 0.8, 1, 1, 0.7], [7, -0.03, 1.12, 0.82, 0], [10, 0, 0.97, 1.04, 0], [13, 0, 1, 1, 0]];
const POP_FRAMES = 11;
const DROP_FRAMES = 13;

interface HeroNode {
  obj: THREE.Object3D;
  stage: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface Instance {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
  delay: number; // segundos
  kind: "pop" | "drop_small";
}

interface ClutterGroup {
  mesh: THREE.InstancedMesh;
  stage: number;
  instances: Instance[];
  maxEnd: number; // segundos hasta terminar toda la animación del grupo
}

interface SettledGroup {
  mesh: THREE.InstancedMesh;
  members: THREE.Object3D[];
}

export interface RendererOptions {
  reduceMotion?: boolean;
}

export interface SceneStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heroNodes: number;
  clutterInstances: number;
  clutterGroups: number;
}

function geometryHash(g: THREE.BufferGeometry): string {
  // FNV-1a sobre posiciones (+ índice): dos mallas idénticas comparten geometría.
  let h = 2166136261;
  const pos = g.getAttribute("position");
  const arr = pos.array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) {
    h ^= Math.round(arr[i] * 10000) | 0;
    h = Math.imul(h, 16777619);
  }
  const idx = g.getIndex();
  if (idx) {
    const ia = idx.array as ArrayLike<number>;
    for (let i = 0; i < ia.length; i++) {
      h ^= ia[i] | 0;
      h = Math.imul(h, 16777619);
    }
  }
  return `${arr.length}:${h >>> 0}`;
}

export class ProgressiveSceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  /** Pivote de interacción: rota/inclina/escala la figura completa alrededor de su centro. */
  private pivot = new THREE.Group();
  private root = new THREE.Group();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private heroes: HeroNode[] = [];
  private groups: ClutterGroup[] = [];
  private settled = new Map<number, SettledGroup[]>();
  private animating = new Map<ClutterGroup, number>(); // grupo → segundos transcurridos
  private mixerBusyUntil = 0;
  private elapsed = 0;
  private current = 0;
  private initialized = false;
  private radius = 4;
  private centerY = 0.9;
  private width = 300;
  private height = 300;
  private confetti: { t: number; mesh: THREE.InstancedMesh; data: { p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; life: number }[] } | null = null;
  private pulse = 0;
  private glow = 0;
  // Interacción táctil: rotar (arrastrar), zoom (pellizco / rueda), tap (rebote). Vuelve sola a la vista inicial.
  private yaw = 0;
  private pitch = 0;
  private zoom = 1;
  private yawVel = 0;
  private lastTouch = -1e9;
  private tapPulse = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; t: number; moved: boolean } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private baseDir = new THREE.Vector3(0, 0, 1);
  private baseDist = 10;
  private baseTarget = new THREE.Vector3();
  /** Se llama en cada toque corto sobre la figura (p. ej. para un háptico). */
  onTap: (() => void) | null = null;
  private disposed = false;
  private lastStats: SceneStats | null = null;
  readonly reduceMotion: boolean;

  constructor(
    private container: HTMLElement,
    private asset: SceneAssetDef,
    options: RendererOptions = {},
  ) {
    this.reduceMotion = !!options.reduceMotion;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0); // fondo TRANSPARENTE: lo pone la app
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // conserva los colores sin lavarlos
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(asset.camera.fov, 1, 0.1, 100);
    this.scene.add(this.pivot);
    this.pivot.add(this.root);

    // Luz que acompaña al objeto (no crea fondo): hemisférica + sol cálido + relleno frío.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8e97a3, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.8);
    sun.position.set(-4, 6, 5);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
    fill.position.set(5, 2, -4);
    this.scene.add(fill);

    this.attachControls();
    this.resize(container.clientWidth || 300, container.clientHeight || 300);
  }

  /** Carga el GLB y deja la escena vacía (etapa 0) lista para `setStage`. */
  async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(this.asset.glbUrl);
    if (this.disposed) return;

    const content = gltf.scene;
    this.root.add(content);
    content.updateMatrixWorld(true);

    for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    this.mixer = new THREE.AnimationMixer(content);

    // Clasificar nodos.
    const stageNodes: THREE.Object3D[] = [];
    content.traverse((o) => {
      const ud = o.userData as { vt_stage?: number };
      if (typeof ud.vt_stage === "number") stageNodes.push(o);
    });

    const buckets = new Map<string, { stage: number; geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; items: { mesh: THREE.Mesh; kind: "pop" | "drop_small"; delay: number }[] }>();
    const canonical = new Map<string, THREE.BufferGeometry>();

    for (const node of stageNodes) {
      const ud = node.userData as { vt_stage: number; vt_anim?: string; vt_delay_frames?: number };
      if (ud.vt_anim && PROCEDURAL.has(ud.vt_anim)) {
        const meshes: THREE.Mesh[] = [];
        node.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh);
        });
        for (const m of meshes) {
          const gh = geometryHash(m.geometry);
          const geo = canonical.get(gh) ?? (canonical.set(gh, m.geometry), m.geometry);
          const mat = m.material as THREE.Material;
          const key = `${ud.vt_stage}|${gh}|${Array.isArray(mat) ? mat.map((x) => x.uuid).join() : mat.uuid}`;
          let b = buckets.get(key);
          if (!b) {
            b = { stage: ud.vt_stage, geometry: geo, material: m.material, items: [] };
            buckets.set(key, b);
          }
          b.items.push({ mesh: m, kind: ud.vt_anim as "pop" | "drop_small", delay: (ud.vt_delay_frames ?? 0) / FPS });
        }
      } else {
        this.heroes.push({
          obj: node,
          stage: ud.vt_stage,
          pos: node.position.clone(),
          quat: node.quaternion.clone(),
          scale: node.scale.clone(),
        });
      }
    }

    // El GLB guarda en cada nodo su pose INICIAL (escala 0); la pose final (reposo) es el último fotograma de su clip.
    this.captureRestFromClips();
    for (const h of this.heroes) this.resetHero(h);
    content.updateMatrixWorld(true);

    // Encuadre: caja de TODA la figura terminada.
    const box = new THREE.Box3().setFromObject(content);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    this.centerY = sphere.center.y;
    const centerX = sphere.center.x;
    const centerZ = sphere.center.z;

    // Retirar del grafo los nodos que ahora son instancias.
    for (const node of stageNodes) {
      const ud = node.userData as { vt_anim?: string };
      if (ud.vt_anim && PROCEDURAL.has(ud.vt_anim)) node.removeFromParent();
    }

    const tmpS = new THREE.Vector3();
    for (const b of buckets.values()) {
      const inst = new THREE.InstancedMesh(b.geometry, b.material, b.items.length);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.frustumCulled = false;
      inst.visible = false;
      const instances: Instance[] = [];
      let maxEnd = 0;
      b.items.forEach((it) => {
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        it.mesh.matrixWorld.decompose(p, q, tmpS);
        const s = tmpS.clone();
        instances.push({ pos: p, quat: q, scale: s, delay: it.delay, kind: it.kind });
        maxEnd = Math.max(maxEnd, it.delay + (it.kind === "pop" ? POP_FRAMES : DROP_FRAMES) / FPS);
      });
      this.root.add(inst);
      this.groups.push({ mesh: inst, stage: b.stage, instances, maxEnd });
    }

    // El diorama queda centrado en el origen (después de haber leído las matrices de las instancias).
    this.root.position.set(-centerX, 0, -centerZ);
    this.fitCamera(this.centerY);

    // Todo oculto: etapa 0.
    for (const h of this.heroes) h.obj.visible = false;
    this.initialized = false;
    this.current = 0;
  }

  private captureRestFromClips() {
    const byStage = new Map<number, THREE.AnimationClip>();
    for (const cfg of this.asset.config.stages) {
      const clip = cfg.clip ? this.clips.get(cfg.clip) : undefined;
      if (clip) byStage.set(cfg.stage, clip);
    }
    for (const h of this.heroes) {
      const clip = byStage.get(h.stage);
      if (!clip) continue;
      for (const tr of clip.tracks) {
        const dot = tr.name.lastIndexOf(".");
        if (tr.name.slice(0, dot) !== h.obj.name) continue;
        const size = tr.getValueSize();
        const last = Array.from(tr.values).slice(tr.values.length - size);
        const prop = tr.name.slice(dot + 1);
        if (prop === "position") h.pos.fromArray(last);
        else if (prop === "scale") h.scale.fromArray(last);
        else if (prop === "quaternion") h.quat.fromArray(last);
      }
    }
  }

  private fitCamera(centerY: number) {
    const [dx, dy, dz] = this.asset.camera.direction;
    this.baseDir.set(dx, dy, dz).normalize();
    const vfov = THREE.MathUtils.degToRad(this.asset.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    this.baseDist = (this.radius * 1.04) / Math.sin(Math.min(vfov, hfov) / 2);
    this.baseTarget.set(0, Math.max(centerY, this.asset.camera.targetY * 0.8), 0);
    this.applyCamera();
  }

  private applyCamera() {
    const dist = this.baseDist / this.zoom;
    this.camera.position.copy(this.baseTarget).addScaledVector(this.baseDir, dist);
    this.camera.lookAt(this.baseTarget);
    this.camera.near = Math.max(dist - this.radius * 2.5, 0.1);
    this.camera.far = dist + this.radius * 3;
    this.camera.updateProjectionMatrix();
  }

  resize(w: number, h: number) {
    this.width = Math.max(w, 1);
    this.height = Math.max(h, 1);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.fitCamera(this.centerY);
  }

  // ---------------------------------------------------------------- etapas
  /**
   * Lleva la escena a la etapa `next`. Si sube, las etapas intermedias aparecen ya construidas y solo
   * la última se anima; si baja, se ocultan sin ceremonia.
   */
  setStage(next: number, options: { animate?: boolean } = {}) {
    if (!this.mixer) return;
    const total = this.asset.config.totalStages;
    next = Math.max(0, Math.min(next, total));
    const animate = (options.animate ?? true) && !this.reduceMotion && this.initialized;
    const prev = this.current;
    if (this.initialized && next === prev) return;

    if (next > prev && animate) {
      this.applyInstant(next - 1);
      this.playStage(next);
    } else {
      this.applyInstant(next);
    }
    this.current = next;
    this.initialized = true;
  }

  get stage() {
    return this.current;
  }

  private resetHero(h: HeroNode) {
    h.obj.position.copy(h.pos);
    h.obj.quaternion.copy(h.quat);
    h.obj.scale.copy(h.scale);
  }

  private applyInstant(stage: number) {
    this.mixer?.stopAllAction();
    this.animating.clear();
    this.mixerBusyUntil = 0;
    for (const h of this.heroes) {
      this.resetHero(h);
      h.obj.visible = h.stage <= stage;
    }
    for (const g of this.groups) {
      g.mesh.visible = g.stage <= stage;
      if (g.mesh.visible) this.writeFinal(g);
    }
    this.root.updateMatrixWorld(true);
    this.rebuildSettled(stage);
  }

  private writeFinal(g: ClutterGroup) {
    const m = new THREE.Matrix4();
    g.instances.forEach((it, i) => {
      m.compose(it.pos, it.quat, it.scale);
      g.mesh.setMatrixAt(i, m);
    });
    g.mesh.instanceMatrix.needsUpdate = true;
  }

  private playStage(stage: number) {
    const cfg = this.asset.config.stages.find((s) => s.stage === stage);
    // Piezas de la etapa: visibles y en su primer fotograma (escala 0) antes de pintar.
    for (const h of this.heroes) if (h.stage === stage) h.obj.visible = true;
    const clip = cfg?.clip ? this.clips.get(cfg.clip) : undefined;
    if (clip && this.mixer) {
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.mixer.update(0);
      this.mixerBusyUntil = this.elapsed + clip.duration + 0.05;
    }
    for (const g of this.groups) {
      if (g.stage !== stage) continue;
      g.mesh.visible = true;
      this.animating.set(g, 0);
      this.writeFrame(g, 0);
    }
  }

  private writeFrame(g: ClutterGroup, t: number) {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const qo = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const v1 = [0];
    const v4 = [0, 0, 0, 0];
    g.instances.forEach((it, i) => {
      const f = (t - it.delay) * FPS;
      p.copy(it.pos);
      q.copy(it.quat);
      if (it.kind === "pop") {
        sample(POP_KEYS, f, v1);
        s.copy(it.scale).multiplyScalar(Math.max(v1[0], 0));
      } else {
        sample(DROP_KEYS, f, v4);
        p.y += v4[0];
        qo.setFromAxisAngle(up, v4[3]);
        q.premultiply(qo);
        s.set(it.scale.x * v4[1], it.scale.y * v4[2], it.scale.z * v4[1]);
      }
      m.compose(p, q, s);
      g.mesh.setMatrixAt(i, m);
    });
    g.mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- instancias de piezas "héroe" ya asentadas
  /** Convierte en InstancedMesh las piezas repetidas de etapas terminadas: baja los draw calls. */
  private rebuildSettled(stage: number) {
    for (const list of this.settled.values()) {
      for (const sg of list) {
        this.root.remove(sg.mesh);
        sg.mesh.dispose();
        for (const o of sg.members) o.layers.set(0);
      }
    }
    this.settled.clear();
    // Solo se asientan etapas que ya no van a volver a moverse (todas menos la última construida con clip vivo).
    for (let s = 1; s <= stage; s++) this.settleStage(s);
  }

  private settleStage(stage: number) {
    if (this.settled.has(stage)) return;
    // Un nodo que se mueve en un clip posterior (p. ej. la baldosa en el pulso final) no se asienta.
    const movedLater = new Set<THREE.Object3D>();
    for (const cfg of this.asset.config.stages) {
      if (cfg.stage <= stage || !cfg.clip) continue;
      const clip = this.clips.get(cfg.clip);
      clip?.tracks.forEach((tr) => {
        const name = tr.name.split(".")[0];
        const node = this.root.getObjectByName(name);
        if (node) movedLater.add(node);
      });
    }
    const buckets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; entries: { mesh: THREE.Mesh; node: THREE.Object3D }[] }>();
    for (const h of this.heroes) {
      if (h.stage !== stage || movedLater.has(h.obj)) continue;
      const own: THREE.Mesh[] = [];
      if ((h.obj as THREE.Mesh).isMesh) own.push(h.obj as THREE.Mesh);
      for (const c of h.obj.children) if ((c as THREE.Mesh).isMesh && typeof (c.userData as { vt_stage?: number }).vt_stage !== "number") own.push(c as THREE.Mesh);
      own.forEach((mesh) => {
        const mat = mesh.material as THREE.Material;
        const key = `${mesh.geometry.uuid}|${Array.isArray(mat) ? mat.map((x) => x.uuid).join() : mat.uuid}`;
        let b = buckets.get(key);
        if (!b) {
          b = { geometry: mesh.geometry, material: mesh.material, entries: [] };
          buckets.set(key, b);
        }
        b.entries.push({ mesh, node: h.obj });
      });
    }
    const list: SettledGroup[] = [];
    const m = new THREE.Matrix4();
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const b of buckets.values()) {
      if (b.entries.length < 2) continue;
      const inst = new THREE.InstancedMesh(b.geometry, b.material, b.entries.length);
      inst.frustumCulled = false;
      b.entries.forEach((e, i) => {
        e.mesh.updateWorldMatrix(true, false);
        m.multiplyMatrices(inv, e.mesh.matrixWorld);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      const members = [...new Set(b.entries.map((e) => e.mesh as THREE.Object3D))];
      for (const mem of members) mem.layers.set(1); // capa 1: no se dibuja, pero sus hijos sí
      list.push({ mesh: inst, members });
    }
    this.settled.set(stage, list);
  }

  // ---------------------------------------------------------------- celebración
  /** Confeti sutil (pocas piezas pequeñas), brillo breve y un rebote de la figura. Lo dispara la vista tras la pausa. */
  celebrate() {
    if (this.reduceMotion) return;
    this.pulse = 0.0001;
    this.glow = 0.0001;
    this.clearConfetti();
    const n = 84;
    const geo = new THREE.PlaneGeometry(0.1, 0.05);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    const palette = [0xf5b301, 0xffffff, 0xffdca0, 0x8fd18a, 0xf49a7c, 0x9ec5ff].map((c) => new THREE.Color(c));
    const data: NonNullable<typeof this.confetti>["data"] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * this.radius * 0.5;
      data.push({
        p: new THREE.Vector3(Math.cos(a) * r, this.baseTarget.y + this.radius * 0.35, Math.sin(a) * r),
        v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 1.7 + Math.random() * 0.6,
      });
      mesh.setColorAt(i, palette[i % palette.length]);
    }
    this.scene.add(mesh);
    this.confetti = { t: 0, mesh, data };
  }

  private clearConfetti() {
    if (!this.confetti) return;
    this.scene.remove(this.confetti.mesh);
    this.confetti.mesh.geometry.dispose();
    (this.confetti.mesh.material as THREE.Material).dispose();
    this.confetti.mesh.dispose();
    this.confetti = null;
  }

  // ---------------------------------------------------------------- interacción táctil
  private attachControls() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none"; // el gesto es de la figura, no de la página
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private onPointerDown = (e: PointerEvent) => {
    // Nativo: corta la propagación ANTES de que la página (swipe de hábito/vista) lo vea.
    e.stopPropagation();
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastTouch = performance.now();
    if (this.pointers.size === 1) {
      this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      this.yawVel = 0;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
      this.drag = null;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    e.stopPropagation();
    this.lastTouch = performance.now();
    if (this.pointers.size >= 2 && this.pinch) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom = THREE.MathUtils.clamp(this.pinch.zoom * (d / Math.max(this.pinch.dist, 1)), 0.8, 1.6);
      this.applyCamera();
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.drag && !this.drag.moved && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6) this.drag.moved = true;
    if (this.drag?.moved) {
      // Suave y limitado: giro amplio pero no infinito; inclinación vertical corta.
      this.yaw = THREE.MathUtils.clamp(this.yaw + dx * 0.0085, -2.6, 2.6);
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0035, -0.16, 0.3);
      this.yawVel = dx * 0.0085 * 60;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    e.stopPropagation();
    this.pointers.delete(e.pointerId);
    this.lastTouch = performance.now();
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0 && this.drag) {
      if (!this.drag.moved && performance.now() - this.drag.t < 300) {
        this.tapPulse = 0.0001; // toque corto: pequeño rebote
        this.onTap?.();
      }
      this.drag = null;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.8, 1.6);
    this.lastTouch = performance.now();
    this.applyCamera();
  };

  /** Vuelve la figura a su vista inicial (rotación, inclinación y zoom). */
  resetView() {
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.yawVel = 0;
    this.applyCamera();
  }

  // ---------------------------------------------------------------- bucle
  private tick(dt: number) {
    this.elapsed += dt;
    this.mixer?.update(dt);

    for (const [g, t0] of [...this.animating]) {
      const t = t0 + dt;
      this.animating.set(g, t);
      if (t >= g.maxEnd) {
        this.animating.delete(g);
        this.writeFinal(g);
      } else {
        this.writeFrame(g, t);
      }
    }
    // Tras terminar la animación de la etapa, asentar sus piezas repetidas.
    if (this.mixerBusyUntil && this.elapsed >= this.mixerBusyUntil && this.animating.size === 0) {
      this.mixerBusyUntil = 0;
      this.root.updateMatrixWorld(true);
      this.settleStage(this.current);
    }

    // Interacción: inercia al soltar y regreso lento a la vista inicial cuando nadie toca la figura.
    const touching = this.pointers.size > 0;
    if (!touching) {
      if (Math.abs(this.yawVel) > 0.01) {
        this.yaw = THREE.MathUtils.clamp(this.yaw + this.yawVel * dt, -2.6, 2.6);
        this.yawVel *= Math.exp(-dt * 4.2);
      }
      const idle = (performance.now() - this.lastTouch) / 1000;
      if (idle > 2.2 && !this.reduceMotion) {
        const k = 1 - Math.exp(-dt * 1.6); // regreso suave, no un salto
        this.yaw += (0 - this.yaw) * k;
        this.pitch += (0 - this.pitch) * k;
        const nz = this.zoom + (1 - this.zoom) * k;
        if (Math.abs(nz - this.zoom) > 1e-4) {
          this.zoom = nz;
          this.applyCamera();
        }
      }
    }
    this.pivot.rotation.y = this.yaw;
    this.pivot.rotation.x = this.pitch;
    // Pulso de celebración.
    if (this.pulse > 0) {
      this.pulse += dt;
      const p = this.pulse / 0.7;
      const s = p >= 1 ? 1 : 1 + 0.045 * Math.sin(p * Math.PI) * (1 - p * 0.3);
      this.pivot.scale.setScalar(s);
      if (p >= 1) {
        this.pulse = 0;
        this.pivot.scale.setScalar(1);
      }
    } else if (this.tapPulse > 0) {
      this.tapPulse += dt;
      const p = this.tapPulse / 0.35;
      this.pivot.scale.setScalar(p >= 1 ? 1 : 1 + 0.03 * Math.sin(p * Math.PI));
      if (p >= 1) this.tapPulse = 0;
    }
    // Brillo breve (exposición) durante la celebración.
    if (this.glow > 0) {
      this.glow += dt;
      const g = this.glow / 1.0;
      this.renderer.toneMappingExposure = 1.1 + (g >= 1 ? 0 : 0.28 * Math.sin(g * Math.PI));
      if (g >= 1) {
        this.glow = 0;
        this.renderer.toneMappingExposure = 1.1;
      }
    }
    if (this.confetti) {
      const c = this.confetti;
      c.t += dt;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const sc = new THREE.Vector3();
      let alive = 0;
      c.data.forEach((d, i) => {
        d.v.y -= 6.5 * dt; // gravedad
        d.p.addScaledVector(d.v, dt);
        d.rot.x += d.spin.x * dt;
        d.rot.y += d.spin.y * dt;
        d.rot.z += d.spin.z * dt;
        const life = Math.max(0, 1 - c.t / d.life);
        if (life > 0) alive++;
        e.copy(d.rot);
        q.setFromEuler(e);
        sc.setScalar(Math.min(1, life * 3));
        m.compose(d.p, q, sc);
        c.mesh.setMatrixAt(i, m);
      });
      c.mesh.instanceMatrix.needsUpdate = true;
      if (alive === 0) this.clearConfetti();
    }
  }

  /** Bucle de render (llamar `pause()` cuando la vista no está visible). */
  start() {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      this.tick(Math.min(this.clock.getDelta(), 0.05));
      this.renderer.render(this.scene, this.camera);
      this.captureStats();
    });
  }

  pause() {
    this.renderer.setAnimationLoop(null);
  }

  /** Un fotograma manual (para pruebas y para el modo "reducir movimiento"). */
  renderOnce(dt = 0) {
    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
    this.captureStats();
  }

  private captureStats() {
    const info = this.renderer.info;
    this.lastStats = {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      heroNodes: this.heroes.length,
      clutterInstances: this.groups.reduce((a, g) => a + g.instances.length, 0),
      clutterGroups: this.groups.length,
    };
  }

  /** Métricas del último fotograma dibujado (draw calls, triángulos…). */
  stats(): SceneStats {
    return (
      this.lastStats ?? { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, heroNodes: this.heroes.length, clutterInstances: 0, clutterGroups: this.groups.length }
    );
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    this.clearConfetti();
    this.mixer?.stopAllAction();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
