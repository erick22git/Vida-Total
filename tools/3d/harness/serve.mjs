import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2]; const models = process.argv[3];
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let f = u.startsWith("/models/") ? path.join(models, u.slice(8)) : path.join(dir, u === "/" ? "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  const ext = path.extname(f); res.writeHead(200, { "Content-Type": ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(4174, () => console.log("ok 4174"));
