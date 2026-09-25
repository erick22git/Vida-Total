// Verifica que el GLB carga con el mismo GLTFLoader que usa React Three Fiber y que los clips reproducen.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const ROOT = "C:/Erick/app movil/vida-total-web/node_modules/three";
const THREE = await import(pathToFileURL(`${ROOT}/build/three.module.js`).href);
const { GLTFLoader } = await import(pathToFileURL(`${ROOT}/examples/jsm/loaders/GLTFLoader.js`).href);
const { MeshoptDecoder } = await import(pathToFileURL(`${ROOT}/examples/jsm/libs/meshopt_decoder.module.js`).href);

const file = process.argv[2];
const b = fs.readFileSync(file);
const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((res, rej) => loader.parse(ab, "", res, rej));

const scene = gltf.scene;
let meshes = 0, tris = 0, matSet = new Set(), boxes = new THREE.Box3();
const byStage = {};
scene.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    matSet.add(o.material.uuid);
  }
  const s = o.userData?.vt_stage;
  if (s !== undefined) byStage[s] = (byStage[s] ?? 0) + 1;
});
boxes.setFromObject(scene);
const size = boxes.getSize(new THREE.Vector3());

console.log("archivo:", file.split(/[\\/]/).pop(), (b.length / 1e6).toFixed(2) + " MB");
console.log("meshes:", meshes, "tris(instancias):", Math.round(tris), "materiales usados:", matSet.size);
console.log("tamaño de la escena (m, Y arriba):", size.toArray().map((v) => +v.toFixed(2)));
console.log("userData vt_stage por etapa:", JSON.stringify(byStage));
console.log("clips:", gltf.animations.map((c) => `${c.name}[${c.duration.toFixed(2)}s, ${c.tracks.length} pistas]`).join(" | "));

// Reproducir STAGE_4: un tronco arranca aplastado y termina a escala 1; una copa arranca en 0.
const mixer = new THREE.AnimationMixer(scene);
const clip = gltf.animations.find((c) => c.name === "STAGE_4");
let trunk = null; scene.traverse((o) => { if (!trunk && o.userData?.vt_anim === "tree_trunk" && o.userData?.vt_stage === 4) trunk = o; });
console.log("tronco elegido:", trunk.name, "hijos:", trunk.children.length, "extras:", JSON.stringify(trunk.userData));
const layer = trunk?.children?.[0];
const action = mixer.clipAction(clip);
action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
const report = [];
for (const t of [0, clip.duration * 0.5, clip.duration - 0.001]) {
  mixer.setTime(t);
  report.push({ t: +t.toFixed(2), trunkScaleY: +trunk.scale.y.toFixed(3), trunkY: +trunk.position.y.toFixed(3), layerScale: layer ? +layer.scale.x.toFixed(3) : null });
}
console.log("STAGE_4 muestreo:", JSON.stringify(report));
console.log("STAGE_4 t0 pistas:", clip.tracks.slice(0, 2).map((tr) => `${tr.name} t[0]=${tr.times[0].toFixed(3)}`).join(", "));
