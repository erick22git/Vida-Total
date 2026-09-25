"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Cristal 3D del progreso (three.js). Es una bipirámide hexagonal partida en
 * 6 piezas — una por nivel (10 repeticiones cada una). Las piezas ya ganadas
 * están ensambladas y sólidas; la que se está construyendo se va acercando a
 * medida que suma repeticiones; las que faltan flotan alrededor como
 * fantasmas. Es una geometría hecha con código: el día que exista el modelo
 * de Blender (GLB) se reemplaza SOLO este archivo (mismas props).
 *
 * Usa three.js directo (no React Three Fiber): el paquete de fiber amplía los
 * tipos JSX globales y rompe el chequeo de tipos del resto de la app.
 * Solo se carga en la vista FIGURA (ver `Crystal3D`) — nunca global.
 */
const PIECES = 6;
const RADIUS = 1;
const HEIGHT = 1.35;

export interface SceneProps {
  /** Piezas ya ganadas (0..6). */
  level: number;
  /** 0..1 — avance dentro del nivel en curso. */
  inLevel: number;
  /** true un instante al alcanzar un hito (el cristal brilla y pulsa). */
  burst: boolean;
  reduceMotion: boolean;
}

function wedgeGeometry(k: number): THREE.BufferGeometry {
  const a0 = (k / PIECES) * Math.PI * 2;
  const a1 = ((k + 1) / PIECES) * Math.PI * 2;
  const top = new THREE.Vector3(0, HEIGHT, 0);
  const bottom = new THREE.Vector3(0, -HEIGHT, 0);
  const e0 = new THREE.Vector3(Math.cos(a0) * RADIUS, 0, Math.sin(a0) * RADIUS);
  const e1 = new THREE.Vector3(Math.cos(a1) * RADIUS, 0, Math.sin(a1) * RADIUS);
  // Tetraedro (top, bottom, e0, e1): 4 caras.
  const faces = [
    [top, e0, e1],
    [bottom, e1, e0],
    [top, bottom, e0],
    [top, e1, bottom],
  ];
  const positions: number[] = [];
  for (const f of faces) for (const v of f) positions.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

export default function CrystalScene(props: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.4, 5.2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb0ff, 0.6);
    rim.position.set(-4, -2, -2);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffd27a, 6, 8);
    warm.position.set(0, 0, 3);
    scene.add(warm);

    const root = new THREE.Group();
    root.rotation.set(0.28, 0.4, 0);
    scene.add(root);

    const pieces = Array.from({ length: PIECES }, (_, k) => {
      const geometry = wedgeGeometry(k);
      const material = new THREE.MeshStandardMaterial({
        color: 0xf6c344,
        emissive: 0xf5a800,
        emissiveIntensity: 0.12,
        roughness: 0.22,
        metalness: 0.15,
        flatShading: true,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, material));
      root.add(group);
      return { k, geometry, material, group, current: 0, mid: ((k + 0.5) / PIECES) * Math.PI * 2 };
    });

    function resize() {
      if (!mount) return;
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    let glow = 0;
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const { level, inLevel, burst, reduceMotion } = propsRef.current;

      glow += ((burst ? 1 : 0) - glow) * Math.min(1, delta * 4);
      if (!reduceMotion) root.rotation.y += delta * 0.35;
      root.scale.setScalar(1 + glow * 0.08 * Math.sin(clock.elapsedTime * 10));

      for (const p of pieces) {
        // Ensamblada (1) si el nivel ya la incluye; la del nivel en curso se
        // acerca con el progreso dentro del nivel (hasta 0.9: el "click"
        // final llega al completar el nivel); el resto (0) flota.
        const target = p.k < level ? 1 : p.k === level ? Math.min(inLevel, 1) * 0.9 : 0;
        // Suavizado exponencial (independiente del fps).
        p.current += (target - p.current) * Math.min(1, delta * 5);
        const t = p.current;
        const far = 1 - t;
        const sign = p.k % 2 === 0 ? 1 : -1;
        p.group.position.set(Math.cos(p.mid) * far * 1.7, far * 0.6 * sign, Math.sin(p.mid) * far * 1.7);
        p.group.rotation.set(-sign * far * 0.9, far * 1.2, far * 0.6);
        p.group.scale.setScalar(0.72 + 0.28 * t);
        p.material.opacity = 0.14 + 0.86 * t;
        p.material.emissiveIntensity = 0.12 + glow * 0.9 * t;
      }
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      for (const p of pieces) {
        p.geometry.dispose();
        p.material.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
}
