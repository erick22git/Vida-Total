import fs from "node:fs";

const file = process.argv[2];
const buf = fs.readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("no es GLB");
const len0 = dv.getUint32(12, true);
const json = JSON.parse(buf.slice(20, 20 + len0).toString("utf8"));
const out = { file: file.split(/[\\/]/).pop(), bytes: buf.length };
out.asset = json.asset;
out.extensionsUsed = json.extensionsUsed;
out.extensionsRequired = json.extensionsRequired;
out.counts = {
  scenes: json.scenes?.length, nodes: json.nodes?.length, meshes: json.meshes?.length, materials: json.materials?.length,
  textures: json.textures?.length ?? 0, images: json.images?.length ?? 0, animations: json.animations?.length ?? 0,
  accessors: json.accessors?.length, bufferViews: json.bufferViews?.length,
};
// triángulos y vértices (por mesh única y por instancia de nodo)
let tris = 0, verts = 0, instTris = 0, gpuInst = 0;
const meshTris = json.meshes.map((m) => {
  let t = 0, v = 0;
  for (const p of m.primitives) {
    const idx = p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count;
    t += idx / 3; v += json.accessors[p.attributes.POSITION].count;
  }
  return { t, v };
});
meshTris.forEach((m) => { tris += m.t; verts += m.v; });
let nodesWithMesh = 0;
for (const n of json.nodes) {
  if (n.mesh !== undefined) { nodesWithMesh++; instTris += meshTris[n.mesh].t; }
  const inst = n.extensions?.EXT_mesh_gpu_instancing;
  if (inst) {
    gpuInst++;
    const cnt = json.accessors[inst.attributes.TRANSLATION ?? Object.values(inst.attributes)[0]].count;
    if (n.mesh !== undefined) instTris += meshTris[n.mesh].t * (cnt - 1);
  }
}
out.geometry = { uniqueMeshTris: Math.round(tris), uniqueVerts: verts, nodesWithMesh, gpuInstancingNodes: gpuInst, renderedTrisApprox: Math.round(instTris) };
// animaciones
out.animations = (json.animations ?? []).map((a) => {
  let tmin = 1e9, tmax = -1e9, keys = 0;
  for (const s of a.samplers) {
    const acc = json.accessors[s.input];
    tmin = Math.min(tmin, acc.min?.[0] ?? 0); tmax = Math.max(tmax, acc.max?.[0] ?? 0); keys += acc.count;
  }
  const targets = new Set(a.channels.map((c) => c.target.node));
  return { name: a.name, channels: a.channels.length, targetNodes: targets.size, t0: +tmin.toFixed(3), t1: +tmax.toFixed(3), keyframes: keys };
});
// extras
const withExtras = json.nodes.filter((n) => n.extras);
const stageCount = {};
for (const n of withExtras) { const s = n.extras.vt_stage; if (s !== undefined) stageCount[s] = (stageCount[s] ?? 0) + 1; }
out.extras = { nodesWithExtras: withExtras.length, sample: withExtras[0]?.extras, perStage: stageCount };
out.materials = (json.materials ?? []).map((m) => ({ name: m.name, base: m.pbrMetallicRoughness?.baseColorFactor?.map((v) => +v.toFixed(2)), ext: m.extensions ? Object.keys(m.extensions) : undefined, alpha: m.alphaMode }));
const rootNames = json.scenes[0].nodes.map((i) => json.nodes[i].name);
out.rootNodes = rootNames.length;
out.rootSample = rootNames.slice(0, 8);
console.log(JSON.stringify(out, null, 1));
