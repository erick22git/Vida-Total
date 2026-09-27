import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Vaso de agua 3D con nivel en vivo. El VASO viene del GLB (`glass`, con su perfil interior en `userData.vt_profile`);
 * el AGUA es una pieza propia generada aquí: un cilindro/tronco que sube hasta `fraction` (0..1 de la altura interior) con
 * degradado de profundidad (más oscura abajo, más clara y translúcida arriba), una superficie con oleaje, un menisco
 * junto al vidrio y, cada vez que se agrega agua (`pour()`), un CHORRO que cae desde arriba con salpicón y ondas al
 * tocar el nivel. Nada de simulación de fluido ni de texturas estáticas.
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
const STREAM_TOP = 2.9; // altura (en unidades del modelo) desde donde cae el chorro
const POUR_DUR = 1.25; // segundos
const N_SPLASH = 22;
const DEFAULT_WATER = "#1f7fd8";

const _c = new THREE.Color();

export class WaterGlassRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private root = new THREE.Group();
  private profile: Profile = { floorZ: 0.12, topZ: 1.98, rOuter0: 0.65, slope: 0.006, wall: 0.03 };
  private side: THREE.Mesh;
  private top: THREE.Mesh;
  private rim: THREE.Mesh;
  private waterMat: THREE.MeshPhysicalMaterial;
  private topPos: Float32Array;
  private baseColor = new THREE.Color(DEFAULT_WATER);
  // chorro
  private stream: THREE.Mesh;
  private streamMat: THREE.MeshBasicMaterial;
  private splash: THREE.InstancedMesh;
  private splashMat: THREE.MeshBasicMaterial;
  private ripples: THREE.Mesh[] = [];
  private parts = Array.from({ length: N_SPLASH }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 }));
  private pourT = -1;
  private emitAcc = 0;
  private surfaceY = 0;
  private surfaceR = 0.5;
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
  private envTex: THREE.Texture | null = null;

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

    // Reflejos de un estudio sencillo: sin esto el vidrio y el agua se ven planos.
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.45;
      pm.dispose();
    } catch {
      /* sin entorno: quedan las luces directas */
    }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f86a8, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2, 3, 3);
    this.scene.add(key);
    const rimLight = new THREE.DirectionalLight(0xbcd8ff, 0.9);
    rimLight.position.set(3, 1.5, -2);
    this.scene.add(rimLight);
    this.scene.add(this.root);

    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.1,
      ior: 1.33,
      specularIntensity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.side = new THREE.Mesh(this.buildSideGeometry(), this.waterMat);
    this.side.renderOrder = 1;
    const topGeo = new THREE.RingGeometry(0.0001, 1, SEG, RINGS);
    topGeo.rotateX(-Math.PI / 2);
    this.topPos = (topGeo.attributes.position.array as Float32Array).slice();
    const topCol = new Float32Array(topGeo.attributes.position.count * 4);
    topGeo.setAttribute("color", new THREE.BufferAttribute(topCol, 4));
    this.top = new THREE.Mesh(topGeo, this.waterMat);
    this.top.renderOrder = 1;
    // menisco: aro claro donde el agua toca el vidrio
    const rimGeo = new THREE.RingGeometry(0.9, 1, SEG, 1);
    rimGeo.rotateX(-Math.PI / 2);
    this.rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    this.rim.renderOrder = 1;

    // chorro + salpicón + ondas
    this.streamMat = new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 1, 14, 1, true), this.streamMat);
    this.stream.renderOrder = 3;
    this.stream.visible = false;
    this.splashMat = new THREE.MeshBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.85, depthWrite: false });
    this.splash = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 6, 4), this.splashMat, N_SPLASH);
    this.splash.frustumCulled = false;
    this.splash.renderOrder = 3;
    this.splash.visible = false;
    for (let i = 0; i < 2; i++) {
      const g = new THREE.RingGeometry(0.86, 1, 40, 1);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.renderOrder = 3;
      m.visible = false;
      this.ripples.push(m);
    }
    this.root.add(this.side, this.top, this.rim, this.stream, this.splash, ...this.ripples);
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
    this.paintSide();
    this.paintTop();
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
      color: 0xe9f6ff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      ior: 1.5,
      specularIntensity: 1,
      envMapIntensity: 0.9,
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

  /** Color base del agua (mezcla de las bebidas); el degradado de profundidad se deriva de él. */
  setColor(hex: string) {
    this.baseColor.set(hex);
    this.paintSide();
    this.paintTop();
  }

  /** Dispara la animación del chorro: el agua cae desde arriba y salpica al tocar el nivel. Sin animación si `reduceMotion`. */
  pour() {
    if (this.opts.reduceMotion) return;
    this.pourT = 0;
    this.emitAcc = 0;
    this.amp = Math.min(0.05, this.amp + 0.012);
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

  /** Para pruebas: nivel mostrado, oleaje y estado del chorro. */
  stats() {
    const info = this.renderer.info.render;
    return { level: +this.level.toFixed(3), target: this.target, amp: +this.amp.toFixed(4), pouring: this.pourT >= 0, drawCalls: info.calls, triangles: info.triangles };
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
    this.envTex?.dispose();
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
    this.updatePour(dt);
  }

  private innerR(z: number) {
    const p = this.profile;
    return Math.max(0.05, p.rOuter0 + p.slope * z - p.wall);
  }

  private buildSideGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 4), 4));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    g.setIndex(idx);
    return g;
  }

  /** Degradado de profundidad: abajo más oscuro y opaco, arriba más claro y translúcido. */
  private paintSide() {
    const col = this.side.geometry.attributes.color as THREE.BufferAttribute;
    const deep = _c.copy(this.baseColor).multiplyScalar(0.5);
    const dr = deep.r, dg = deep.g, db = deep.b;
    const shallow = _c.copy(this.baseColor).lerp(new THREE.Color(1, 1, 1), 0.1);
    for (let i = 0; i <= SEG; i++) {
      col.setXYZW(i * 2, dr, dg, db, 0.94); // fondo
      col.setXYZW(i * 2 + 1, shallow.r, shallow.g, shallow.b, 0.5); // superficie
    }
    col.needsUpdate = true;
  }

  private paintTop() {
    const col = this.top.geometry.attributes.color as THREE.BufferAttribute;
    const c = _c.copy(this.baseColor).lerp(new THREE.Color(1, 1, 1), 0.16);
    for (let i = 0; i < col.count; i++) col.setXYZW(i, c.r, c.g, c.b, 0.72);
    col.needsUpdate = true;
  }

  private updateWater(force: boolean) {
    const p = this.profile;
    const h = (p.topZ - p.floorZ) * Math.min(1, Math.max(0, this.level));
    const show = this.level > 0.004;
    this.side.visible = show;
    this.top.visible = show;
    this.rim.visible = show;
    if (!show && !force) {
      this.surfaceY = p.floorZ;
      return;
    }
    const z0 = p.floorZ;
    const z1 = z0 + h;
    const r0 = this.innerR(z0);
    const r1 = this.innerR(z1);
    this.surfaceY = z1;
    this.surfaceR = r1;
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
    if (force) this.paintSide();
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
    this.rim.scale.set(r1, 1, r1);
    this.rim.position.y = z1 + 0.004;
  }

  /** Chorro + salpicón + ondas. Solo trabaja mientras dura `pour()`. */
  private updatePour(dt: number) {
    const active = this.pourT >= 0;
    if (active) this.pourT += dt;
    const t = this.pourT;
    // envolvente del chorro: entra rápido, se sostiene y se afina al final
    const env = !active ? 0 : t < 0.14 ? t / 0.14 : t < POUR_DUR - 0.3 ? 1 : Math.max(0, (POUR_DUR - t) / 0.3);
    if (active && t >= POUR_DUR) this.pourT = -1;
    const surfY = Math.max(this.surfaceY, this.profile.floorZ);
    const anyPart = this.parts.some((p) => p.life > 0);

    this.stream.visible = env > 0.01;
    if (this.stream.visible) {
      const len = Math.max(0.05, STREAM_TOP - surfY);
      const rad = 0.07 * env * (1 + 0.12 * Math.sin(this.time * 38));
      this.stream.scale.set(rad, len, rad);
      this.stream.position.set(Math.sin(this.time * 9) * 0.006, surfY + len / 2, Math.cos(this.time * 8) * 0.006);
      this.streamMat.opacity = 0.62 * env;
    }

    // salpicones: partículas que salen del punto de impacto
    if (env > 0.3) {
      this.emitAcc += dt * 46 * env;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const p = this.parts.find((q) => q.life <= 0);
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const sp = 0.25 + Math.random() * 0.55;
        p.x = Math.cos(a) * 0.05;
        p.z = Math.sin(a) * 0.05;
        p.y = surfY + 0.01;
        p.vx = Math.cos(a) * sp;
        p.vz = Math.sin(a) * sp;
        p.vy = 0.9 + Math.random() * 1.1;
        p.max = 0.45 + Math.random() * 0.35;
        p.life = p.max;
      }
    }
    if (env > 0.01 || anyPart) {
      const m = new THREE.Matrix4();
      const rMax = this.surfaceR * 0.92;
      this.parts.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= 5.2 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const rr = Math.hypot(p.x, p.z);
          if (rr > rMax) { p.x *= rMax / rr; p.z *= rMax / rr; p.vx *= -0.3; p.vz *= -0.3; }
          if (p.y < surfY) p.life = 0; // vuelve al agua
        }
        const s = p.life > 0 ? Math.min(1, (p.life / p.max) * 2.2) : 0;
        m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
        this.splash.setMatrixAt(i, m);
      });
      this.splash.instanceMatrix.needsUpdate = true;
      this.splash.visible = true;
    } else {
      this.splash.visible = false;
    }

    // ondas que se expanden desde el punto de impacto
    this.ripples.forEach((r, i) => {
      const tt = active ? t - i * 0.32 : -1;
      const life = tt >= 0 ? (tt % 0.7) / 0.7 : -1;
      const on = active && env > 0.05 && tt >= 0 && life >= 0;
      r.visible = on;
      if (on) {
        const s = Math.max(0.02, life * this.surfaceR * 0.95);
        r.scale.set(s, 1, s);
        r.position.y = surfY + 0.006;
        (r.material as THREE.MeshBasicMaterial).opacity = (1 - life) * 0.55 * env;
      }
    });
  }

  private frame() {
    // el modelo mide 2 de alto y ~0.65 de radio; el chorro sube hasta 2.9: cámara a 3/4 con margen arriba
    this.camera.position.set(0, 1.7, 8.4);
    this.camera.lookAt(0, 0.5, 0);
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
