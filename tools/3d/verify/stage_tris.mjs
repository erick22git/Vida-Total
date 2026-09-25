import fs from "node:fs";
const b = fs.readFileSync(process.argv[2]); const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
const j = JSON.parse(b.slice(20, 20 + dv.getUint32(12, true)).toString());
const mt = j.meshes.map((m) => m.primitives.reduce((a, p) => a + (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3, 0));
const per = {}, cnt = {};
for (const n of j.nodes) if (n.mesh !== undefined) { const s = n.extras?.vt_stage ?? "?"; per[s] = (per[s] ?? 0) + mt[n.mesh]; cnt[s] = (cnt[s] ?? 0) + 1; }
let tot = 0; for (const s of Object.keys(per).sort()) { tot += per[s]; console.log("stage", s, "nodos", cnt[s], "tris", Math.round(per[s])); } console.log("total", Math.round(tot));
// desglose de la etapa 3 y 7 por nombre base
const byName = {};
for (const n of j.nodes) if (n.mesh !== undefined && [3, 7].includes(n.extras?.vt_stage)) { const k = (n.extras.vt_stage) + ":" + n.name.split(".")[0].replace(/_.*/, ""); byName[k] = (byName[k] ?? 0) + mt[n.mesh]; }
console.log(Object.entries(byName).map(([k, v]) => k + "=" + Math.round(v)).join("  "));
