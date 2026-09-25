// Resumen de un GLB: tamaño, nodos, mallas, materiales, triángulos, clips y triángulos por etapa.
import fs from "node:fs";
const file = process.argv[2];
const b = fs.readFileSync(file); const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
const j = JSON.parse(b.slice(20, 20 + dv.getUint32(12, true)).toString());
const mt = j.meshes.map((m) => m.primitives.reduce((a, p) => a + (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3, 0));
let tris = 0; const per = {}; const cnt = {}; const meshUse = new Map(); let nodesWithMesh = 0;
for (const n of j.nodes) if (n.mesh !== undefined) { nodesWithMesh++; tris += mt[n.mesh]; const s = n.extras?.vt_stage ?? 0; per[s] = (per[s] ?? 0) + mt[n.mesh]; cnt[s] = (cnt[s] ?? 0) + 1; meshUse.set(n.mesh, (meshUse.get(n.mesh) ?? 0) + 1); }
const clips = (j.animations ?? []).map((a) => { let t1 = 0; for (const s of a.samplers) t1 = Math.max(t1, j.accessors[s.input].max?.[0] ?? 0); return `${a.name}:${t1.toFixed(2)}s`; });
const out = { file: file.split(/[\/]/).pop(), mb: +(b.length / 1e6).toFixed(3), nodes: j.nodes.length, nodesWithMesh, distinctMeshes: meshUse.size, materials: j.materials?.length ?? 0, textures: j.textures?.length ?? 0, trisRendered: Math.round(tris), clips, perStageTris: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, Math.round(v)])), perStageNodes: cnt, ext: j.extensionsUsed };
console.log(JSON.stringify(out));
