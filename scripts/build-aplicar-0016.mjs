// Regenera supabase/aplicar-0016.sql a partir de supabase/migrations/0016_custom_foods_full_profile.sql (texto literal, en una
// transacción, con su verificación previa).  node scripts/build-aplicar-0016.mjs
import { readFileSync, writeFileSync } from "node:fs";

const name = "0016_custom_foods_full_profile";
const sql = readFileSync(`supabase/migrations/${name}.sql`, "utf8").trim();
const head = `-- ============================================================================
-- aplicar-0016.sql — migración 0016 (campos nuevos del alimento + sync sin pérdida + default de agua)
--
-- Se puede correr DOS (o más) veces sin dañar datos:
--   · solo ADITIVO: add column IF NOT EXISTS y un DEFAULT nuevo. NO hay DROP, DELETE, UPDATE de filas ni TRUNCATE.
-- Va dentro de UNA transacción: si algo falla, no queda nada a medias (todo o nada).
--
-- ANTES: tener aplicadas 0001 y 0002 (la tabla custom_foods).
-- DESPUÉS: corre supabase/verificar-0016.sql (solo lectura) y comprueba que todo salga en true.
--
-- Es EL MISMO texto que supabase/migrations/${name}.sql. Si cambias la migración, regenera este archivo
-- (node scripts/build-aplicar-0016.mjs).
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.custom_foods') is null then
    raise exception 'Falta la tabla custom_foods (migración 0002). Aplícala primero.';
  end if;
  if to_regclass('public.gym_settings') is null then
    raise exception 'Falta la tabla gym_settings (migración 0002). Aplícala primero.';
  end if;
end $$;

-- ############################################################################
-- ${name}.sql
-- ############################################################################

`;
writeFileSync("supabase/aplicar-0016.sql", `${head}${sql}\n\ncommit;\n`);
console.log("✓ supabase/aplicar-0016.sql regenerado");
