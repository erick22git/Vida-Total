/**
 * Busca, en todas las cuentas, alimentos personalizados (custom_foods) y alimentos ya registrados
 * (logged_foods) en 0 kcal/0 g — para detectar los que se guardaron mal (error de tipeo, foto que no
 * se procesó, etc.) y poder revisarlos antes de borrar nada. Solo LEE, no borra ni modifica (REST
 * directo con fetch — el cliente @supabase/supabase-js necesita WebSocket nativo que Node 20 no trae).
 * Uso: npx tsx scripts/find-zero-custom-foods.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function rest(path: string) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const customFoods = await rest(
    "custom_foods?select=id,user_id,nombre,categoria,porcion,calorias,proteina,carbos,grasas,created_at&calorias=eq.0&proteina=eq.0&carbos=eq.0&grasas=eq.0",
  );
  console.log(`\ncustom_foods en 0 (${customFoods.length}):`);
  for (const f of customFoods) console.log(`  ${f.id} | user ${f.user_id} | ${f.nombre} | ${f.categoria} | ${f.porcion} | creado ${f.created_at}`);

  const logged = await rest(
    "logged_foods?select=id,user_id,food_id,nombre,calorias,proteina,carbos,grasas,logged_date,meal&calorias=eq.0&proteina=eq.0&carbos=eq.0&grasas=eq.0&activo=eq.true",
  );
  console.log(`\nlogged_foods activos en 0 (${logged.length}):`);
  for (const f of logged) console.log(`  ${f.id} | user ${f.user_id} | food_id=${f.food_id} | ${f.nombre} | ${f.logged_date} ${f.meal}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
