-- ============================================================================
-- aplicar-0016.sql — migración 0016 (campos nuevos del alimento + sync sin pérdida)
--
-- Se puede correr DOS (o más) veces sin dañar datos:
--   · solo ADITIVO: add column IF NOT EXISTS. NO hay DROP, DELETE, UPDATE de filas ni TRUNCATE.
-- Va dentro de UNA transacción: si algo falla, no queda nada a medias (todo o nada).
--
-- ANTES: tener aplicadas 0001 y 0002 (la tabla custom_foods).
-- DESPUÉS: corre supabase/verificar-0016.sql (solo lectura) y comprueba que todo salga en true.
--
-- Es EL MISMO texto que supabase/migrations/0016_custom_foods_full_profile.sql. Si cambias la migración, regenera este archivo
-- (node scripts/build-aplicar-0016.mjs).
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.custom_foods') is null then
    raise exception 'Falta la tabla custom_foods (migración 0002). Aplícala primero.';
  end if;
end $$;

-- ############################################################################
-- 0016_custom_foods_full_profile.sql
-- ############################################################################

-- 0016 — custom_foods: perfil completo + fecha de edición (NO aplicada). Única migración de esta tanda (campos nuevos y sync).
--
-- Idempotente (add column if not exists). Sin DROP, DELETE ni UPDATE de filas. Requiere 0002.
--
-- Por qué: la tabla solo tiene columnas para parte del perfil de un alimento, así que al sincronizar se perdían las grasas
-- mono/poliinsaturadas, omega-3/6, agua, ceniza, alcohol, EPA/DHA, el perfil COCIDO completo y las marcas
-- verificado / configurado / estadoDefault / unSoloEstado / fdcIdCrudo. Esta migración agrega UNA columna JSON con todo eso y la
-- fecha de la última edición (para decidir qué lado gana al fusionar). Los micronutrientes nuevos (biotina, yodo, cromo,
-- molibdeno, flúor, cloruro) NO necesitan columna: ya viajan dentro de `micronutrientes` (jsonb).
--
-- Retrocompatible: la app detecta si estas columnas existen; si no, guarda sin ellas y no pierde nada local.
-- Orden: se puede aplicar ANTES o DESPUÉS de subir el código nuevo.

alter table public.custom_foods
  add column if not exists perfil_extra jsonb;

-- Sin default ni NOT NULL a propósito: las filas que ya existen quedan en null (la app las trata como «sin fecha» y gana el
-- dato local), en vez de aparecer todas como «editadas ahora».
alter table public.custom_foods
  add column if not exists updated_at timestamptz;

comment on column public.custom_foods.perfil_extra is
  'Resto del perfil sin columna propia: grasasMonoinsaturadas, grasasPoliinsaturadas, omega3Ala, omega6Linoleico, agua, ceniza, alcohol, epa, dha, epaDha (mg), cocido (perfil completo), verificado, configurado, estadoDefault, unSoloEstado, fdcIdCrudo. Un 0 es un dato; una clave ausente es «sin dato».';
comment on column public.custom_foods.updated_at is
  'Última edición hecha en la app (la manda el cliente). Decide qué lado gana al fusionar datos locales y remotos.';

commit;
