-- ============================================================================
-- 0009 — logged_foods.recipe_id (PROPUESTA, NO aplicada)
--
-- SOLO ADITIVA e idempotente. Requiere 0002.
--
-- Hueco que cubre: `LoggedFood.recipeId` (src/lib/types/index.ts) marca los alimentos que salieron de expandir una
-- receta del usuario (Lista / Escáner / Voz). Hoy solo vive en el dispositivo: la fila remota no tiene dónde guardarlo.
--
-- Es un vínculo "blando" a propósito (uuid SIN foreign key): la receta puede no haberse sincronizado todavía cuando se
-- sincroniza el alimento registrado, y una FK haría fallar ese insert completo. Si la receta se borra, el id queda
-- huérfano y la app lo ignora.
--
-- Para que sirva falta además mapear `recipe_id` en LoggedFoodRow (src/lib/sync/gym-sync.ts); esa parte NO está hecha.
-- ============================================================================

alter table public.logged_foods
  add column if not exists recipe_id uuid;

create index if not exists logged_foods_recipe_idx
  on public.logged_foods (user_id, recipe_id)
  where recipe_id is not null;
