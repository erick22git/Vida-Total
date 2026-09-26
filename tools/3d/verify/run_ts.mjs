// Ejecuta un .ts del proyecto en Node (esbuild lo empaqueta con los alias de tsconfig). Uso: node tools/3d/verify/run_ts.mjs <archivo.ts>
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const entry = path.resolve(process.argv[2]);
const out = path.resolve(".harness_tmp", "run_ts_out.cjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  tsconfig: "tsconfig.json",
  logLevel: "error",
  define: { "process.env.NODE_ENV": '"development"' },
});
const r = spawnSync(process.execPath, [out], { stdio: "inherit" });
process.exit(r.status ?? 1);
