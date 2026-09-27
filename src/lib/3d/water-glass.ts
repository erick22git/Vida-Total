import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * Vaso de agua 3D con nivel en vivo. El VASO viene del GLB (`glass`, con su perfil interior en `userData.vt_profile`);
 * el AGUA es una pieza propia generada aquí: un tronco de cono que sube hasta `fraction` (0..1 de la altura interior) y una
 * superficie con oleaje que se agita cuando el nivel cambia. Nada de simulación de fluido ni de texturas estáticas.
 * El renderer NO calcula el porcentaje: recibe `setFraction` de quien lo calculó (src/lib/gym/water-state.ts).
 */
interface Profile {
  floorZ: number;
  topZ: number;
  rOuter0: number;
  slope: number;
  wall: number;
}

const SEG = 48;
const RINGS = 9;

export class WaterGlassRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private root = new THREE.Group();
  private profile: Profile = { floorZ: 0.12, topZ: 1.98, rOuter0: 0.385, slope: 0.1967, wall: 0.03 };
  private side: THREE.Mesh;
  private top: THREE.Mesh;
  private waterMat: THREE.MeshPhysicalMaterial;
  private topPos: Float32Array;
  private raf = 0;
  private running = false;
  private visible = true;
  private lastT = 0;
  private time = 0;
  private level = 0; // fracción mostrada
  private vel = 0;
  private target = 0;
  private amp = 0.006; // amplitud del oleaje (unidades del modelo)
  private yaw = -0.5;
  private drag: { x: number; yaw: number } | null = null;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private opts: { glbUrl: string; reduceMotion?: boolean },
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f86a8, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-2, 3, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd8ff, 0.9);
    rim.position.set(3, 1.5, -2);
    this.scene.add(rim);
    this.scene.add(this.root);

    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b9dff,
      transparent: true,
      opacity: 0.86,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.side = new THREE.Mesh(this.buildSideGeometry(), this.waterMat);
    this.side.renderOrder = 1;
    const topGeo = new THREE.RingGeometry(0.0001, 1, SEG, RINGS);
    topGeo.rotateX(-Math.PI / 2);
    this.topPos = (topGeo.attributes.position.array as Float32Array).slice();
    this.top = new THREE.Mesh(topGeo, this.waterMat);
    this.top.renderOrder = 1;
    this.root.add(this.side, this.top);
    this.root.position.y = -1; // el vaso mide 2 de alto: centrado en el origen

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
    let glass: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !glass) glass = m;
    });
    if (!glass) throw new Error("water-glass: el GLB no trae malla");
    const g = glass as THREE.Mesh;
    const raw = (g.userData?.vt_profile ?? g.parent?.userData?.vt_profile) as string | undefined;
    if (raw) {
      try {
        this.profile = { ...this.profile, ...JSON.parse(raw) };
      } catch {
        /* perfil por defecto */
      }
    }
    (g.material as THREE.Material).dispose?.();
    g.material = new THREE.MeshPhysicalMaterial({
      color: 0xdaf0ff,
      transparent: true,
      opacity: 0.26,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    g.renderOrder = 2;
    this.root.add(gltf.scene);
    this.updateWater(true);
  }

  /** Nivel objetivo 0..1 (lo calcula water-state.ts). El agua sube con un resorte y agita la superficie. */
  setFraction(f: number) {
    const t = Math.max(0, Math.min(1, f));
    if (Math.abs(t - this.target) > 1e-4) this.amp = Math.min(0.05, this.amp + 0.02 + Math.abs(t - this.target) * 0.06);
    this.target = t;
    if (this.opts.reduceMotion) {
      this.level = t;
      this.vel = 0;
      this.updateWater(true);
    }
  }

  setColor(hex: string) {
    this.waterMat.color.set(hex);
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

  /** Para pruebas: nivel mostrado y amplitud del oleaje. */
  stats() {
    const info = this.renderer.info.render;
    return { level: +this.level.toFixed(3), target: this.target, amp: +this.amp.toFixed(4), drawCalls: info.calls, triangles: info.triangles };
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
    this.renderer.dispose();
    el.remove();
  }

  // ------------------------------------------------------------------ internos
  private tick(dt: number) {
    this.time += dt;
    // resorte críticamente amortiguado hacia el objetivo
    const k = 60;
    const c = 2 * Math.sqrt(k);
    const a = k * (this.target - this.level) - c * this.vel;
    this.vel += a * dt;
    this.level += this.vel * dt;
    this.level = Math.max(0, Math.min(1.02, this.level));
    this.amp += (0.006 - this.amp) * Math.min(1, dt * 1.6);
    if (!this.opts.reduceMotion && !this.drag) this.yaw += (-0.5 - this.yaw) * Math.min(1, dt * 0.6);
    this.root.rotation.y = this.yaw;
    this.updateWater(false);
  }

  private innerR(z: number) {
    const p = this.profile;
    return Math.max(0.05, p.rOuter0 + p.slope * z - p.wall);
  }

  private buildSideGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    g.setIndex(idx);
    return g;
  }

  private updateWater(force: boolean) {
    const p = this.profile;
    const h = (p.topZ - p.floorZ) * Math.min(1, Math.max(0, this.level));
    const show = this.level > 0.004;
    this.side.visible = show;
    this.top.visible = show;
    if (!show && !force) return;
    const z0 = p.floorZ;
    const z1 = z0 + h;
    const r0 = this.innerR(z0);
    const r1 = this.innerR(z1);
    const sp = this.side.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      sp.setXYZ(i * 2, cx * r0, z0, sz * r0);
      sp.setXYZ(i * 2 + 1, cx * r1, z1, sz * r1);
    }
    sp.needsUpdate = true;
    this.side.geometry.computeVertexNormals();
    this.side.geometry.computeBoundingSphere();
    // superficie: oleaje en coordenadas del disco unitario, escalado al radio de la superficie
    const tp = this.top.geometry.attributes.position as THREE.BufferAttribute;
    const t = this.time;
    const amp = this.amp / Math.max(r1, 0.1);
    for (let i = 0; i < tp.count; i++) {
      const x = this.topPos[i * 3];
      const zz = this.topPos[i * 3 + 2];
      const rr = Math.hypot(x, zz);
      const w = Math.sin(x * 5 + t * 2.6) * 0.6 + Math.cos(zz * 4.2 - t * 2.1) * 0.5 + Math.sin(rr * 7 - t * 3.1) * 0.4;
      tp.setXYZ(i, x, w * amp * (0.35 + 0.65 * rr), zz);
    }
    tp.needsUpdate = true;
    this.top.geometry.computeVertexNormals();
    this.top.geometry.computeBoundingSphere();
    this.top.scale.set(r1, 1, r1);
    this.top.position.y = z1;
  }

  private frame() {
    // el modelo mide 2 de alto y ~0.9 de radio: cámara a 3/4
    this.camera.position.set(0, 1.5, 6.4);
    this.camera.lookAt(0, 0.05, 0);
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame();
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
