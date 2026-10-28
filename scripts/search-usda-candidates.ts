/**
 * Busca candidatos USDA para una lista de consultas (para elegir a mano el fdcId correcto antes de importar).
 * Uso: npx tsx scripts/search-usda-candidates.ts "cassava raw" "yam cooked"
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { searchUsdaFoods } from "../src/lib/nutrition/usda";

async function main() {
  const queries = process.argv.slice(2);
  for (const q of queries) {
    const res = await searchUsdaFoods(q, 6).catch((e) => {
      console.log(`## ${q}: ERROR ${String(e).slice(0, 80)}`);
      return [];
    });
    console.log(`## ${q}`);
    for (const r of res) console.log(`  ${r.fdcId} | ${r.dataType ?? ""} | ${r.description}`);
  }
}
main();
