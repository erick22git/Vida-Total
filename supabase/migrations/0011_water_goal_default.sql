-- ============================================================================
-- 0011 — gym_settings.water_goal_ml: default 2500 (PROPUESTA, NO aplicada)
--
-- Idempotente. Requiere 0002.
--
-- Hueco que cubre: la app arranca con waterGoalMl = 2500 (src/lib/store/gymStore.ts) pero la columna remota tiene
-- default 2000. Solo cambia el DEFAULT para filas NUEVAS: no toca ninguna fila existente ni ningún valor ya guardado.
-- ============================================================================

alter table public.gym_settings
  alter column water_goal_ml set default 2500;
