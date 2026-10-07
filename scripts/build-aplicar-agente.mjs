// Regenera supabase/aplicar-agente.sql a partir de las migraciones 0012–0015 (texto literal, en orden, en una transacción).
//   node scripts/build-aplicar-agente.mjs
import { readFileSync, writeFileSync } from "node:fs";

const names = ["0012_agent_settings", "0013_tasks_reminder", "0014_telegram_agent", "0015_agent_notifications"];
const current = readFileSync("supabase/aplicar-agente.sql", "utf8");
const headEnd = current.indexOf("begin;");
if (headEnd < 0) throw new Error("No encuentro el encabezado de supabase/aplicar-agente.sql (¿se borró?).");
const guardEnd = current.indexOf("-- ####", headEnd);
const head = current.slice(0, guardEnd);
let body = "";
for (const n of names) {
  const sql = readFileSync(`supabase/migrations/${n}.sql`, "utf8").trim();
  body += `-- ############################################################################\n-- ${n}.sql\n-- ############################################################################\n\n${sql}\n\n`;
}
writeFileSync("supabase/aplicar-agente.sql", `${head}${body}commit;\n`);
console.log("✓ supabase/aplicar-agente.sql regenerado");
