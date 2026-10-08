-- 0016 — BORRADOR, NO APLICADA. Hace que el perfil completo de un alimento viaje al sincronizar.
--
-- Hoy `custom_foods` solo tiene columnas para parte del perfil: no se guardan grasas mono/poliinsaturadas,
-- omega-3/6, agua, ceniza, el perfil «cocido» completo ni las marcas verificado/configurado/estadoDefault/
-- unSoloEstado/fdcIdCrudo. Esta migración agrega UNA columna JSON con todo eso. Es aditiva e idempotente.
--
-- ORDEN: aplicar primero esta migración y recién después cambiar `foodToRow`/`rowToFood` en
-- `src/lib/sync/gym-sync.ts` para leer/escribir `perfil_extra` (si el código escribe la columna antes de que
-- exista, los inserts fallan). Ver docs/calorias-flujo-datos.md, sección «Dudosos».

alter table public.custom_foods
  add column if not exists perfil_extra jsonb;

comment on column public.custom_foods.perfil_extra is
  'Resto del perfil del alimento que no tiene columna propia: grasasMonoinsaturadas, grasasPoliinsaturadas, omega3Ala, omega6Linoleico, agua, ceniza, cocido, verificado, configurado, estadoDefault, unSoloEstado, fdcIdCrudo.';
