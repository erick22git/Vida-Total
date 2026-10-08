// Supabase FALSO solo para probar el build de producción en mi PC: devuelve un usuario de prueba y listas vacías.
const http = require("http");
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "prueba-local@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Prueba Local" },
  created_at: "2026-01-01T00:00:00Z",
};
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/auth/v1/user")) return res.end(JSON.stringify(user));
    if (req.url.startsWith("/rest/v1/")) return res.end("[]");
    res.end("{}");
  })
  .listen(54321, () => console.log("mock supabase en 54321"));
