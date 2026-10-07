import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { NO_RANK_MATERIAL, RANK_MATERIALS, RANK_TIER_DEFS, type RankMaterial } from "@/lib/gym/rank-config";

/**
 * Cuerpo 3D de la pantalla de Rango. El GLB (`rango_cuerpo_m_001`) es UNA malla con 14 pesos de región por vértice (atributos
 * `_REGA.._REGD`, 4 canales cada uno, en el orden de `REGION_KEYS`). El shader toma, por píxel, la región de mayor peso con un
 * borde suave: así el límite entre músculos es una curva lisa que no depende de cómo estén cortados los polígonos.
 * El renderer NO calcula rangos: recibe `setRegionStyles` ya resuelto (src/lib/gym/rank-engine.ts).
 *
 * La malla es lisa (no trae músculos esculpidos), así que las regiones se leen con sombreado y no con geometría: luz de borde
 * (Fresnel) que tiñe el contorno con el color de la región, entorno de estudio suave y un brillo extra en la región elegida.
 *
 * Interacción: arrastrar gira el cuerpo (con inercia), un toque elige la región (raycast + pesos) y fuera de una región la
 * suelta. Se dibuja SOLO cuando algo cambia o se mueve, y se pausa si la pantalla no está visible.
 */
export interface RegionStyle {
  /** Color del rango (CSS). null = sin rango (gris neutro). */
  color: string | null;
  /** Clave del rango (`RANK_TIER_DEFS[i].key`) para elegir su material; si falta se deduce de `color`. */
  tier?: string | null;
  /** true = fuera del grupo en foco: se oscurece. */
  dim?: boolean;
}

/** Orden de los canales de peso en el GLB. DEBE coincidir con REGIONS de tools/3d/blender/70_rango_cuerpo.py. */
export const REGION_KEYS = [
  "Pecho",      // _REGA.x  (slot 0)
  "Espalda",    // _REGA.y  (slot 1)
  "Hombros",    // _REGA.z  (slot 2)
  "Biceps",     // _REGA.w  (slot 3)
  "Triceps",    // _REGB.x  (slot 4)
  "Antebrazo",  // _REGB.y  (slot 5)
  "Abdomen",    // _REGB.z  (slot 6)
  "Gluteos",    // _REGB.w  (slot 7)
  "Cuadriceps", // _REGC.x  (slot 8)
  "Femoral",    // _REGC.y  (slot 9)
  "Aductores",  // _REGC.z  (slot 10)
  "Abductores", // _REGC.w  (slot 11)
  "Pantorrilla",// _REGD.x  (slot 12)
  "Cuello",     // _REGD.y  (slot 13)
  "Neutro",     // _REGD.z  (slot 14)
] as const;
const N = REGION_KEYS.length;
const NEUTRO = REGION_KEYS.indexOf("Neutro");
const WEIGHT_ATTRS = ["_REGA", "_REGB", "_REGC", "_REGD"] as const;

const SKIN_MATERIAL: RankMaterial = { base: "#51545d", light: "#5a5d66", shade: "#444750", shine: 0, rough: 1, tint: "#51545d" }; // cabeza, manos, pies
const DIM_MATERIAL: RankMaterial = { base: "#2a2c33", light: "#2d2f37", shade: "#25272d", shine: 0, rough: 1, tint: "#2a2c33" };
const SKIN_REGION = SKIN_MATERIAL.base;
/** Cuánto se "afila" el borde entre regiones (más alto = borde más fino). */
const EDGE_SHARPNESS = 34;

/** Material de una región en 4 vec4 (para el shader): A = luz.rgb + brillo · B = sombra.rgb + aspereza · C = tinte.rgb + iridiscencia · D = luz interior. */
interface MaterialVecs {
  a: THREE.Vector4;
  b: THREE.Vector4;
  c: THREE.Vector4;
  d: THREE.Vector4;
}
const newVecs = (): MaterialVecs => ({ a: new THREE.Vector4(), b: new THREE.Vector4(), c: new THREE.Vector4(), d: new THREE.Vector4() });
const tmpColor = new THREE.Color();
function fillVecs(v: MaterialVecs, m: RankMaterial) {
  tmpColor.set(m.light);
  v.a.set(tmpColor.r, tmpColor.g, tmpColor.b, m.shine);
  tmpColor.set(m.shade);
  v.b.set(tmpColor.r, tmpColor.g, tmpColor.b, m.rough);
  tmpColor.set(m.tint);
  v.c.set(tmpColor.r, tmpColor.g, tmpColor.b, m.irid ?? 0);
  v.d.set(m.inner ?? 0, 0, 0, 0);
}
const dist2 = (a: THREE.Vector4, b: THREE.Vector4) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 + (a.w - b.w) ** 2;
function vecsClose(a: MaterialVecs, b: MaterialVecs) {
  return dist2(a.a, b.a) + dist2(a.b, b.b) + dist2(a.c, b.c) + dist2(a.d, b.d) < 1e-6;
}

interface RegionState {
  color: THREE.Color;
  target: THREE.Color;
  mat: MaterialVecs;
  matTarget: MaterialVecs;
  glow: number;
  glowTarget: number;
  box: THREE.Box3;
}

/** Material del rango de un estilo: por `tier`, o por coincidencia de color con un rango, o "sin rango". */
function materialFor(st: RegionStyle): RankMaterial {
  const byTier = st.tier ? RANK_MATERIALS[st.tier] : undefined;
  if (byTier) return byTier;
  if (st.color) {
    const t = RANK_TIER_DEFS.find((d) => d.color.toLowerCase() === st.color!.toLowerCase());
    if (t && RANK_MATERIALS[t.key]) return RANK_MATERIALS[t.key];
  }
  return NO_RANK_MATERIAL;
}

export class RankBodyRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  private root = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private regions: RegionState[] = REGION_KEYS.map(() => {
    const mat = newVecs();
    const matTarget = newVecs();
    fillVecs(mat, SKIN_MATERIAL);
    fillVecs(matTarget, SKIN_MATERIAL);
    return { mat, matTarget };
  }).map(({ mat, matTarget }) => ({
    color: new THREE.Color(SKIN_REGION),
    target: new THREE.Color(SKIN_REGION),
    mat,
    matTarget,
    glow: 0,
    glowTarget: 0,
    box: new THREE.Box3(),
  }));
  private uniforms = {
    uCol: { value: this.regions.map((r) => r.color) },
    uPalA: { value: this.regions.map((r) => r.mat.a) },
    uPalB: { value: this.regions.map((r) => r.mat.b) },
    uPalC: { value: this.regions.map((r) => r.mat.c) },
    uPalD: { value: this.regions.map((r) => r.mat.d) },
    uGlow: { value: this.regions.map(() => 0) },
    uPulse: { value: 0 },
  };
  private disposed = false;
  private visible = true;
  private raf = 0;
  private needs = true;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private envTex: THREE.Texture | null = null;
  private raycaster = new THREE.Raycaster();
  // cámara y giro (con suavizado hacia el objetivo)
  private yaw = 0;
  private yawTarget = 0;
  private yawVel = 0;
  private camTarget = new THREE.Vector3(0, 0.92, 0);
  private camPos = new THREE.Vector3(0, 0.92, 6);
  private lookAt = new THREE.Vector3(0, 0.92, 0);
  private lookAtTarget = new THREE.Vector3(0, 0.92, 0);
  private focusRegions: string[] | null = null;
  private bodyBox = new THREE.Box3();
  private loaded = false;
  private selected: string | null = null;
  private down: { x: number; y: number; id: number; moved: boolean; lastX: number; lastT: number } | null = null;
  private pickCb: ((region: string | null) => void) | null = null;
  private pulse = 0;

  constructor(
    private container: HTMLElement,
    private opts: { glbUrl: string; reduceMotion?: boolean },
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.4;
      pm.dispose();
    } catch {
      /* sin entorno: quedan las luces directas */
    }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x39404f, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const back = new THREE.DirectionalLight(0xb7c8ff, 1.1);
    back.position.set(3, 2, -3);
    this.scene.add(back);
    this.scene.add(this.root);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
      if (this.visible) this.invalidate();
    });
    this.io.observe(container);
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    this.resize();
  }

  /** Quién se entera de los toques sobre una región (null = tocó fuera de una región con rango o el fondo). */
  onPick(cb: (region: string | null) => void) {
    this.pickCb = cb;
  }

  /** Material estándar de three con el reparto de color por región inyectado en el shader. */
  private makeMaterial() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.04 });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCol = u.uCol;
      shader.uniforms.uPalA = u.uPalA;
      shader.uniforms.uPalB = u.uPalB;
      shader.uniforms.uPalC = u.uPalC;
      shader.uniforms.uPalD = u.uPalD;
      shader.uniforms.uGlow = u.uGlow;
      shader.uniforms.uPulse = u.uPulse;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute vec4 regA; attribute vec4 regB; attribute vec4 regC; attribute vec4 regD; attribute vec4 rimA;
           varying vec4 vRegA; varying vec4 vRegB; varying vec4 vRegC; varying vec4 vRegD; varying vec4 vRim;`,
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegA = regA; vRegB = regB; vRegC = regC; vRegD = regD; vRim = rimA;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform vec3 uCol[${N}]; uniform float uGlow[${N}]; uniform float uPulse;
           uniform vec4 uPalA[${N}]; uniform vec4 uPalB[${N}]; uniform vec4 uPalC[${N}]; uniform vec4 uPalD[${N}];
           varying vec4 vRegA; varying vec4 vRegB; varying vec4 vRegC; varying vec4 vRegD; varying vec4 vRim;
           vec3 vtRegionColor; float vtRegionGlow; vec3 vtSpec; vec3 vtInner;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           {
             float w[16];
             w[0]=vRegA.x; w[1]=vRegA.y; w[2]=vRegA.z; w[3]=vRegA.w;
             w[4]=vRegB.x; w[5]=vRegB.y; w[6]=vRegB.z; w[7]=vRegB.w;
             w[8]=vRegC.x; w[9]=vRegC.y; w[10]=vRegC.z; w[11]=vRegC.w;
             w[12]=vRegD.x; w[13]=vRegD.y; w[14]=vRegD.z; w[15]=0.0;
             float mx = 0.0;
             for (int i = 0; i < ${N}; i++) mx = max(mx, w[i]);
             float sum = 0.0; vec3 col = vec3(0.0); float glow = 0.0;
             vec4 pa = vec4(0.0); vec4 pb = vec4(0.0); vec4 pc = vec4(0.0); vec4 pd = vec4(0.0);
             for (int i = 0; i < ${N}; i++) {
               float e = exp((w[i] - mx) * ${EDGE_SHARPNESS.toFixed(1)});
               sum += e; col += uCol[i] * e; glow += uGlow[i] * e;
               pa += uPalA[i] * e; pb += uPalB[i] * e; pc += uPalC[i] * e; pd += uPalD[i] * e;
             }
             float inv = 1.0 / sum;
             col *= inv; glow *= inv; pa *= inv; pb *= inv; pc *= inv; pd *= inv;
             vtRegionColor = col; vtRegionGlow = glow;

             // Material: tono (sombra -> base -> luz) por orientación, centro del músculo (vRim.y) y sombra horneada (vRim.z),
             // más un falso reflejo de entorno (gradiente por reflejo + softbox de estudio) y fresnel. Sin texturas.
             vec3 nN = normalize(vNormal); vec3 vV = normalize(vViewPosition);
             float ndv = clamp(dot(nN, vV), 0.0, 1.0);
             float fres = pow(1.0 - ndv, 3.0);
             vec3 rR = reflect(-vV, nN);
             float shine = pa.w; float rough = pb.w; float irid = pc.w;
             float tone = clamp(0.36 + 0.20 * nN.y + 0.20 * vRim.y + (vRim.z - 0.93) * 0.9, 0.0, 1.0);
             vec3 alb = tone < 0.5 ? mix(pb.rgb, col, tone * 2.0) : mix(col, pa.rgb, (tone - 0.5) * 1.5);
             float box = smoothstep(0.62 - rough * 0.30, 0.97, dot(rR, normalize(vec3(-0.35, 0.75, 0.55))));
             float sky = smoothstep(-0.5, 0.9, rR.y);
             vec3 spec = pc.rgb * shine * (box * 0.55 + sky * 0.10 + fres * 0.20);
             vec3 ir = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + fres * 1.2 + rR.x * 0.22));
             spec += ir * irid * (0.20 + 0.80 * fres) * shine;
             vtSpec = spec;
             vtInner = col * pd.x * (0.30 + 0.70 * vRim.y);
             // _RIM (horneado en Blender): x = borde oscuro difuminado x sombra suave, y = centro del músculo.
             diffuseColor.rgb = alb * (0.78 * vRim.x);
           }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           totalEmissiveRadiance += vtRegionColor * vRim.x * vtRegionGlow * (0.38 + uPulse) + vtInner * vRim.x;`,
        )
        .replace(
          "#include <opaque_fragment>",
          `float vtF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.4);
           outgoingLight += mix(vtRegionColor, vec3(1.0), 0.45) * vtF * 0.40 * vRim.x;
           outgoingLight += vtSpec * vRim.x;
           #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => "vt-rank-body-v5";
    return mat;
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(this.opts.glbUrl);
    if (this.disposed) return;
    let body: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !body) body = m;
    });
    if (!body) throw new Error("rank-body: el GLB no trae malla");
    const mesh = body as THREE.Mesh;
    const geo = mesh.geometry;
    // Los pesos llegan como _REGA.._REGD (three los deja en minúsculas): se renombran a los que declara el shader.
    WEIGHT_ATTRS.forEach((orig, i) => {
      const a = geo.getAttribute(orig.toLowerCase()) ?? geo.getAttribute(orig);
      if (!a) throw new Error(`rank-body: falta el atributo ${orig}`);
      geo.setAttribute(["regA", "regB", "regC", "regD"][i], a);
      geo.deleteAttribute(orig.toLowerCase());
      geo.deleteAttribute(orig);
    });
    // _RIM: multiplicador de borde/sombra (x) y brillo (y). Un GLB sin él (versiones viejas) queda sin borde: (1,0,1,1).
    const rim = geo.getAttribute("_rim") ?? geo.getAttribute("_RIM");
    if (rim) {
      geo.setAttribute("rimA", rim);
      geo.deleteAttribute("_rim");
      geo.deleteAttribute("_RIM");
    } else {
      const n = geo.getAttribute("position").count;
      const flat = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) flat.set([1, 0, 1, 1], i * 4);
      geo.setAttribute("rimA", new THREE.BufferAttribute(flat, 4));
    }
    (mesh.material as THREE.Material).dispose?.();
    mesh.material = this.makeMaterial();
    this.mesh = mesh;
    this.root.add(gltf.scene);
    this.root.rotation.y = 0;
    this.root.updateMatrixWorld(true);

    // Caja de cada región (con el cuerpo de frente): vértices cuya región dominante es esa. Sirve para encuadrar.
    const pos = geo.getAttribute("position");
    const wa = [geo.getAttribute("regA"), geo.getAttribute("regB"), geo.getAttribute("regC"), geo.getAttribute("regD")];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const dom = this.dominant(wa, i);
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      this.regions[dom].box.expandByPoint(v);
    }
    this.bodyBox.setFromObject(this.root);
    this.loaded = true;
    this.frame(null, true);
    this.invalidate();
  }

  /** Índice de la región con más peso en el vértice `i` (o con pesos interpolados `w` si se pasa). */
  private dominant(wa: (THREE.BufferAttribute | THREE.InterleavedBufferAttribute)[], i: number): number {
    let best = NEUTRO;
    let bw = -1;
    for (let k = 0; k < N; k++) {
      const val = wa[k >> 2].getComponent(i, k & 3);
      if (val > bw) {
        bw = val;
        best = k;
      }
    }
    return best;
  }

  /** Tiñe cada región (nombre de región -> estilo). Las que no aparecen quedan como músculo sin rango. */
  setRegionStyles(styles: Record<string, RegionStyle | undefined>) {
    REGION_KEYS.forEach((name, i) => {
      const st = styles[name];
      const m = name === "Neutro" ? SKIN_MATERIAL : !st ? NO_RANK_MATERIAL : st.dim ? DIM_MATERIAL : materialFor(st);
      this.regions[i].target.set(m.base);
      fillVecs(this.regions[i].matTarget, m);
    });
    this.invalidate();
  }

  setSelected(region: string | null) {
    this.selected = region;
    REGION_KEYS.forEach((name, i) => (this.regions[i].glowTarget = name === region ? 1 : 0));
    this.invalidate();
  }

  /** Encuadra las regiones dadas (null = cuerpo completo) y gira hacia `yaw` (radianes; 0 = de frente, π = de espaldas). */
  focus(regions: string[] | null, yaw: number, animate = true) {
    this.focusRegions = regions && regions.length ? regions : null;
    this.yawTarget = this.nearestYaw(yaw);
    this.frame(this.focusRegions, !animate);
    if (!animate) this.yaw = this.yawTarget;
    this.invalidate();
  }

  rotateBy(delta: number) {
    this.yawTarget += delta;
    this.invalidate();
  }

  /** Giro equivalente a `yaw` más cercano al actual (evita dar la vuelta larga). */
  private nearestYaw(yaw: number) {
    const TWO = Math.PI * 2;
    const k = Math.round((this.yawTarget - yaw) / TWO);
    return yaw + k * TWO;
  }

  /** Calcula a dónde mirar y qué tan lejos poner la cámara para que `regions` ocupen la vista. */
  private frame(regions: string[] | null, immediate: boolean) {
    const box = new THREE.Box3();
    if (regions) {
      for (const n of regions) {
        const i = REGION_KEYS.indexOf(n as (typeof REGION_KEYS)[number]);
        if (i >= 0 && !this.regions[i].box.isEmpty()) box.union(this.regions[i].box);
      }
    }
    if (box.isEmpty()) box.copy(this.bodyBox.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.7, 0, -0.2), new THREE.Vector3(0.7, 1.85, 0.2)) : this.bodyBox);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Al girar, el ancho visible depende del ángulo: se usa el mayor de ancho y fondo para no recortar.
    const w = regions ? Math.max(size.x, size.z) : size.x * 0.62 + 0.3;
    const h = size.y;
    const aspect = this.camera.aspect || 0.7;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const margin = regions ? 1.35 : 1.12;
    const dist = Math.max((h * margin) / 2 / Math.tan(vFov / 2), (w * margin) / 2 / Math.tan(hFov / 2)) + (regions ? 0.15 : 0.25);
    this.lookAtTarget.copy(center);
    this.camTarget.set(center.x, center.y, center.z + Math.max(dist, 0.6));
    if (immediate) {
      this.lookAt.copy(this.lookAtTarget);
      this.camPos.copy(this.camTarget);
    }
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.loaded) this.frame(this.focusRegions, true);
    this.invalidate();
  }

  start() {
    if (this.raf || this.disposed) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private invalidate() {
    this.needs = true;
  }

  private tick() {
    if (this.disposed || !this.visible || document.hidden) return;
    let moving = false;
    // giro: inercia al soltar, luego suavizado hacia el objetivo
    if (!this.down) {
      if (Math.abs(this.yawVel) > 0.0002) {
        this.yawTarget += this.yawVel;
        this.yawVel *= 0.93;
      } else this.yawVel = 0;
    }
    const k = this.opts.reduceMotion ? 1 : this.down ? 0.5 : 0.14;
    const dYaw = this.yawTarget - this.yaw;
    if (Math.abs(dYaw) > 0.0005) {
      this.yaw += dYaw * k;
      moving = true;
    } else this.yaw = this.yawTarget;
    // cámara
    const ck = this.opts.reduceMotion ? 1 : 0.12;
    if (this.camPos.distanceToSquared(this.camTarget) > 1e-7 || this.lookAt.distanceToSquared(this.lookAtTarget) > 1e-7) {
      this.camPos.lerp(this.camTarget, ck);
      this.lookAt.lerp(this.lookAtTarget, ck);
      moving = true;
    }
    // colores y brillo de la región elegida
    this.regions.forEach((r, i) => {
      const cur = r.color;
      if (Math.abs(cur.r - r.target.r) + Math.abs(cur.g - r.target.g) + Math.abs(cur.b - r.target.b) > 0.002) {
        cur.lerp(r.target, this.opts.reduceMotion ? 1 : 0.18);
        moving = true;
      } else cur.copy(r.target);
      if (!vecsClose(r.mat, r.matTarget)) {
        const f = this.opts.reduceMotion ? 1 : 0.18;
        r.mat.a.lerp(r.matTarget.a, f); r.mat.b.lerp(r.matTarget.b, f); r.mat.c.lerp(r.matTarget.c, f); r.mat.d.lerp(r.matTarget.d, f);
        moving = true;
      } else {
        r.mat.a.copy(r.matTarget.a); r.mat.b.copy(r.matTarget.b); r.mat.c.copy(r.matTarget.c); r.mat.d.copy(r.matTarget.d);
      }
      if (Math.abs(r.glow - r.glowTarget) > 0.01) {
        r.glow += (r.glowTarget - r.glow) * 0.2;
        moving = true;
      } else r.glow = r.glowTarget;
      this.uniforms.uGlow.value[i] = r.glow;
    });
    if (this.selected && !this.opts.reduceMotion) {
      this.pulse += 0.06;
      this.uniforms.uPulse.value = 0.12 * (0.5 + 0.5 * Math.sin(this.pulse));
      moving = true;
    } else this.uniforms.uPulse.value = 0;
    if (!(moving || this.needs)) return;
    this.needs = false;
    this.root.rotation.y = this.yaw;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- gestos
  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, lastX: e.clientX, lastT: performance.now() };
    this.yawVel = 0;
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private onMove = (e: PointerEvent) => {
    const d = this.down;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) d.moved = true;
    if (!d.moved) return;
    const dx = e.clientX - d.lastX;
    const now = performance.now();
    const dyaw = dx * 0.011;
    this.yawTarget += dyaw;
    this.yaw += dyaw;
    // velocidad para la inercia (por fotograma de ~16 ms)
    this.yawVel = (dyaw * 16) / Math.max(8, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    this.invalidate();
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    if (!d || d.id !== e.pointerId) return;
    this.down = null;
    this.renderer.domElement.style.cursor = "grab";
    if (!d.moved) this.pick(e.clientX, e.clientY);
    else if (Math.abs(this.yawVel) < 0.002) this.yawVel = 0;
    this.invalidate();
  };

  private pick(clientX: number, clientY: number) {
    if (!this.loaded || !this.mesh) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit || !hit.face) {
      this.pickCb?.(null);
      return;
    }
    // Región con más peso en el punto tocado: pesos de los 3 vértices de la cara, mezclados por coordenadas baricéntricas.
    const geo = this.mesh.geometry;
    const pos = geo.getAttribute("position");
    const wa = [geo.getAttribute("regA"), geo.getAttribute("regB"), geo.getAttribute("regC"), geo.getAttribute("regD")];
    const { a, b, c } = hit.face;
    const local = this.mesh.worldToLocal(hit.point.clone());
    const bary = new THREE.Vector3();
    THREE.Triangle.getBarycoord(
      local,
      new THREE.Vector3().fromBufferAttribute(pos, a),
      new THREE.Vector3().fromBufferAttribute(pos, b),
      new THREE.Vector3().fromBufferAttribute(pos, c),
      bary,
    );
    let best = NEUTRO;
    let bw = -1;
    for (let k = 0; k < N; k++) {
      const arr = wa[k >> 2];
      const val = arr.getComponent(a, k & 3) * bary.x + arr.getComponent(b, k & 3) * bary.y + arr.getComponent(c, k & 3) * bary.z;
      if (val > bw) {
        bw = val;
        best = k;
      }
    }
    this.pickCb?.(best === NEUTRO ? null : REGION_KEYS[best]);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose?.());
      }
    });
    this.envTex?.dispose();
    this.renderer.dispose();
    el.remove();
  }
}

